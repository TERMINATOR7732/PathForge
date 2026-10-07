import { Finding, ValidationResult } from '@pathforge/shared';
import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot } from './snapshot.js';
import { diffEnvironments, InfrastructureDiff } from './diff.js';

export type VerificationStatus =
  | 'verified'
  | 'requires-attention'
  | 'still-present';

export type ResolutionClassification =
  | 'policy-change'
  | 'encryption-change'
  | 'port-restriction'
  | 'edge-removal'
  | 'node-reconfiguration'
  | 'topological-isolation';

export interface ResolvedFinding {
  finding: Finding;
  resolutionType: ResolutionClassification;
  changeSummary: string;
  verificationDetails: string;
  beforeState: {
    sourceName?: string;
    targetName?: string;
    protocol?: string;
    ports?: string;
    access?: string;
    encrypted?: boolean;
  };
  afterState?: {
    sourceName?: string;
    targetName?: string;
    protocol?: string;
    ports?: string;
    access?: string;
    encrypted?: boolean;
    isRemoved?: boolean;
  };
}

export interface StillPresentFinding {
  finding: Finding;
  unchangedContext: string;
}

export interface NewFinding {
  finding: Finding;
  whyItAppeared: string;
}

export interface FixVerificationResult {
  baselineTimestamp: string;
  evaluatedAt: string;
  status: VerificationStatus;
  headline: string;
  summaryMessage: string;
  resolvedFindings: ResolvedFinding[];
  stillPresentFindings: StillPresentFinding[];
  newFindings: NewFinding[];
  diff: InfrastructureDiff;
  summaryDelta: {
    critical: { before: number; after: number; delta: number };
    high: { before: number; after: number; delta: number };
    medium: { before: number; after: number; delta: number };
    low: { before: number; after: number; delta: number };
    total: { before: number; after: number; delta: number };
    productionGate: {
      before: 'BLOCKED' | 'PASSED';
      after: 'BLOCKED' | 'PASSED';
    };
  };
  appliedRemediation?: {
    actionId: string;
    type: string;
    title: string;
  };
}

/**
 * Deterministically compares the validated baseline against current validation results
 * and infrastructure diff to verify whether security findings were genuinely eliminated.
 */
export function verifyFix(
  baseline: EnvironmentSnapshot,
  current: Environment,
  currentResult: ValidationResult,
  appliedRemediation?: { actionId: string; type: string; title: string }
): FixVerificationResult {
  const diff = diffEnvironments(baseline, current);

  const beforeFindings = baseline.validationResult.findings;
  const afterFindings = currentResult.findings;

  const afterFindingIds = new Set(afterFindings.map((f) => f.id));
  const beforeFindingIds = new Set(beforeFindings.map((f) => f.id));

  const resolvedRaw = beforeFindings.filter((f) => !afterFindingIds.has(f.id));
  const stillPresentRaw = beforeFindings.filter((f) => afterFindingIds.has(f.id));
  const newRaw = afterFindings.filter((f) => !beforeFindingIds.has(f.id));

  // Build baseline edge map for beforeState extraction
  const baselineEdgeMap = new Map(baseline.edges.map((e) => [e.id, e]));
  const baselineNodeMap = new Map(baseline.nodes.map((n) => [n.id, n]));

  // 1. Process Resolved Findings
  const resolvedFindings: ResolvedFinding[] = resolvedRaw.map((finding) => {
    const primaryEdgeId = finding.affectedEdges[0];
    const baseEdge = primaryEdgeId ? baselineEdgeMap.get(primaryEdgeId) : undefined;
    const currEdge = primaryEdgeId ? current.getEdge(primaryEdgeId) : undefined;

    const baseSource = baseEdge ? baselineNodeMap.get(baseEdge.source) : undefined;
    const baseTarget = baseEdge ? baselineNodeMap.get(baseEdge.target) : undefined;

    const beforeState = {
      sourceName: baseSource?.name ?? baseEdge?.source ?? finding.affectedNodes[0],
      targetName: baseTarget?.name ?? baseEdge?.target ?? finding.affectedNodes[1],
      protocol: baseEdge?.metadata?.protocol as string | undefined,
      ports: baseEdge?.metadata?.ports as string | undefined,
      access: baseEdge?.metadata?.access as string | undefined,
      encrypted: baseEdge?.metadata?.encrypted as boolean | undefined,
    };

    let resolutionType: ResolutionClassification = 'topological-isolation';
    let changeSummary = 'Topological Isolation';
    let verificationDetails = `${finding.ruleId} is no longer detected under the revalidated configuration.`;

    // Check if edge policy was updated to DENY
    if (baseEdge && currEdge) {
      if (baseEdge.metadata?.access === 'allow' && currEdge.access === 'deny') {
        resolutionType = 'policy-change';
        changeSummary = 'ALLOW → DENY';
        verificationDetails = 'Edge access policy was changed from ALLOW to DENY. Network reachability along this path was blocked.';
      } else if (!baseEdge.metadata?.encrypted && currEdge.encrypted) {
        resolutionType = 'encryption-change';
        changeSummary = 'Unencrypted → Encrypted (TLS)';
        verificationDetails = 'Transport layer encryption was enabled. Cleartext eavesdropping risk was eliminated.';
      } else if (
        (baseEdge.metadata?.ports === 'ANY' || baseEdge.metadata?.ports === '*') &&
        currEdge.ports !== 'ANY' &&
        currEdge.ports !== '*'
      ) {
        resolutionType = 'port-restriction';
        changeSummary = `Wildcard (ANY) → Port ${currEdge.ports}`;
        verificationDetails = `Destination ports were restricted from wildcard to explicit service listener ${currEdge.ports}.`;
      }
    } else if (primaryEdgeId && diff.removedEdgeIds.includes(primaryEdgeId)) {
      resolutionType = 'edge-removal';
      changeSummary = 'Connection Removed';
      verificationDetails = 'Direct insecure edge was deleted from the infrastructure graph.';
    } else if (finding.affectedNodes.some((nId) => diff.modifiedNodeIds.includes(nId))) {
      resolutionType = 'node-reconfiguration';
      changeSummary = 'Node Hardened';
      verificationDetails = 'Affected node configuration (zone/service) was updated to satisfy security policy.';
    }

    const afterState = currEdge
      ? {
          sourceName: current.getNode(currEdge.source)?.name ?? currEdge.source,
          targetName: current.getNode(currEdge.target)?.name ?? currEdge.target,
          protocol: currEdge.protocol,
          ports: currEdge.ports,
          access: currEdge.access,
          encrypted: currEdge.encrypted,
          isRemoved: false,
        }
      : {
          isRemoved: true,
        };

    return {
      finding,
      resolutionType,
      changeSummary,
      verificationDetails,
      beforeState,
      afterState,
    };
  });

  // 2. Process Still Present Findings
  const stillPresentFindings: StillPresentFinding[] = stillPresentRaw.map((finding) => {
    return {
      finding,
      unchangedContext: `Condition remains detected on [${finding.affectedNodes.join(', ')}].`,
    };
  });

  // 3. Process New Findings
  const newFindings: NewFinding[] = newRaw.map((finding) => {
    let why = 'Detected in current topology after revalidation.';
    const affectedEdgesInDiff = finding.affectedEdges.filter((eId) =>
      diff.addedEdgeIds.includes(eId)
    );
    if (affectedEdgesInDiff.length > 0) {
      why = `Introduced by new connection "${affectedEdgesInDiff[0]}" added to the graph.`;
    } else if (finding.affectedNodes.some((nId) => diff.addedNodeIds.includes(nId))) {
      why = 'Introduced by new component added to the environment.';
    } else if (finding.affectedEdges.some((eId) => diff.modifiedEdgeIds.includes(eId))) {
      why = 'Introduced following edge configuration update.';
    }
    return {
      finding,
      whyItAppeared: why,
    };
  });

  // 4. Compute Summary Deltas
  const baseSummary = baseline.validationResult.summary;
  const currSummary = currentResult.summary;

  const summaryDelta = {
    critical: {
      before: baseSummary.criticalCount,
      after: currSummary.criticalCount,
      delta: currSummary.criticalCount - baseSummary.criticalCount,
    },
    high: {
      before: baseSummary.highCount,
      after: currSummary.highCount,
      delta: currSummary.highCount - baseSummary.highCount,
    },
    medium: {
      before: baseSummary.mediumCount,
      after: currSummary.mediumCount,
      delta: currSummary.mediumCount - baseSummary.mediumCount,
    },
    low: {
      before: baseSummary.lowCount,
      after: currSummary.lowCount,
      delta: currSummary.lowCount - baseSummary.lowCount,
    },
    total: {
      before: baseSummary.totalFindings,
      after: currSummary.totalFindings,
      delta: currSummary.totalFindings - baseSummary.totalFindings,
    },
    productionGate: {
      before:
        baseSummary.criticalCount === 0 && baseSummary.highCount === 0
          ? ('PASSED' as const)
          : ('BLOCKED' as const),
      after:
        currSummary.criticalCount === 0 && currSummary.highCount === 0
          ? ('PASSED' as const)
          : ('BLOCKED' as const),
    },
  };

  // 5. Determine Overall Verification Status
  let status: VerificationStatus = 'still-present';
  let headline = 'VERIFICATION UNCHANGED';
  let summaryMessage = 'No findings were resolved in this validation cycle.';

  if (newFindings.length > 0) {
    status = 'requires-attention';
    headline = 'VERIFICATION REQUIRES ATTENTION';
    summaryMessage = `${resolvedFindings.length} finding(s) resolved, but ${newFindings.length} new finding(s) introduced. Review new issues before declaring environment secure.`;
  } else if (resolvedFindings.length > 0) {
    status = 'verified';
    if (currSummary.totalFindings === 0) {
      headline = 'VERIFICATION PASSED — ZERO FINDINGS';
      summaryMessage = `All ${resolvedFindings.length} previous finding(s) resolved. Zero security violations detected. Production gate PASSED.`;
    } else {
      headline = 'VERIFICATION PASSED';
      summaryMessage = `${resolvedFindings.length} finding(s) resolved. Security condition successfully improved.`;
    }
  }

  return {
    baselineTimestamp: baseline.timestamp,
    evaluatedAt: currentResult.evaluatedAt,
    status,
    headline,
    summaryMessage,
    resolvedFindings,
    stillPresentFindings,
    newFindings,
    diff,
    summaryDelta,
    appliedRemediation,
  };
}
