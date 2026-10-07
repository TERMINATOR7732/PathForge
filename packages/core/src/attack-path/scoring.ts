import {
  AttackPathNodeSummary,
  AttackPathEdgeSummary,
  AttackPathRisk,
  TraversalStepFact,
} from './types.js';
import { isTrustBoundaryCrossing } from './traversal.js';

export interface PathScoringInput {
  entryPoint: AttackPathNodeSummary;
  target: AttackPathNodeSummary;
  nodes: readonly AttackPathNodeSummary[];
  edges: readonly AttackPathEdgeSummary[];
}

export interface PathScoringResult {
  hopCount: number;
  trustBoundariesCrossed: number;
  risk: AttackPathRisk;
  riskFactors: readonly string[];
  whyItExists: readonly string[];
  steps: readonly TraversalStepFact[];
}

/**
 * Deterministically evaluates an attack path to calculate:
 * - Hop count
 * - Trust boundaries crossed
 * - Granular traversal step facts
 * - Deterministic explainable risk classification
 * - Human-readable risk factors and existence rationale
 */
export function scoreAttackPath(input: PathScoringInput): PathScoringResult {
  const { entryPoint, target, nodes, edges } = input;
  const hopCount = edges.length;

  let trustBoundariesCrossed = 0;
  const steps: TraversalStepFact[] = [];
  const whyItExists: string[] = [];

  whyItExists.push(
    `Attacker controls ingress entry point "${entryPoint.name}" (${entryPoint.type}) in '${entryPoint.zone}' zone.`
  );

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const sourceNode = nodes[i];
    const targetNode = nodes[i + 1] ?? target;

    const boundaryCrossed = isTrustBoundaryCrossing(sourceNode.zone, targetNode.zone);
    if (boundaryCrossed) {
      trustBoundariesCrossed++;
    }

    const stepNum = i + 1;
    const protoPort = `${edge.protocol}:${edge.ports}`;
    const encStr = edge.encrypted ? 'TLS Encrypted' : 'Cleartext';
    const boundaryStr = boundaryCrossed
      ? ` (crosses boundary: ${sourceNode.zone} → ${targetNode.zone})`
      : '';

    const explanation = `Hop ${stepNum}: Traffic allowed from "${sourceNode.name}" to "${targetNode.name}" via ${protoPort} [${encStr}]${boundaryStr}.`;

    steps.push({
      step: stepNum,
      sourceNodeId: sourceNode.id,
      sourceNodeName: sourceNode.name,
      targetNodeId: targetNode.id,
      targetNodeName: targetNode.name,
      edgeId: edge.id,
      protocol: edge.protocol,
      ports: edge.ports,
      access: edge.access,
      encrypted: edge.encrypted,
      fromZone: sourceNode.zone,
      toZone: targetNode.zone,
      boundaryCrossed,
      explanation,
    });

    whyItExists.push(
      `Hop ${stepNum}: "${sourceNode.name}" allows network reachability to "${targetNode.name}" on ${protoPort} (${encStr}${boundaryCrossed ? `, entering '${targetNode.zone}' zone` : ''}).`
    );
  }

  whyItExists.push(
    `Reachable target "${target.name}" is reached by attacker (${target.criticality} criticality, '${target.zone}' zone).`
  );

  // Deterministic Risk Classification
  const isPublicEntry =
    entryPoint.zone === 'public' ||
    entryPoint.type === 'internet' ||
    entryPoint.type === 'external_network';

  const isTargetCritical = target.criticality === 'critical';
  const isTargetHigh = target.criticality === 'high';
  const isTargetRestricted = target.zone === 'restricted';
  const isDirectOrShallow = hopCount <= 2;
  const isCoreDataOrAdmin =
    target.type === 'database' || target.type === 'admin' || target.type === 'redis';

  const hasUnencrypted = edges.some((e) => !e.encrypted);
  const hasWildcard = edges.some((e) => e.ports === 'ANY' || e.ports === '*');

  let risk: AttackPathRisk = 'low';

  // 1. CRITICAL Risk Rules
  if (
    (isPublicEntry && (isTargetCritical || isTargetRestricted) && (trustBoundariesCrossed <= 1 || isDirectOrShallow)) ||
    (isPublicEntry && isCoreDataOrAdmin && hopCount <= 2) ||
    (isPublicEntry && isTargetCritical && hasWildcard) ||
    (isPublicEntry && target.type === 'database' && hopCount === 1)
  ) {
    risk = 'critical';
  }
  // 2. HIGH Risk Rules
  else if (
    (isPublicEntry && (isTargetCritical || isTargetRestricted) && trustBoundariesCrossed >= 2) ||
    (isPublicEntry && isTargetHigh) ||
    (!isPublicEntry && isTargetCritical && trustBoundariesCrossed <= 1) ||
    (isTargetRestricted && isCoreDataOrAdmin)
  ) {
    risk = 'high';
  }
  // 3. MEDIUM Risk Rules
  else if (
    (isPublicEntry && target.criticality === 'medium') ||
    (!isPublicEntry && (isTargetHigh || isTargetRestricted)) ||
    (target.type === 'internal_network' || target.type === 'vpn' || target.type === 'redis')
  ) {
    risk = 'medium';
  }
  // 4. LOW Risk
  else {
    risk = 'low';
  }

  // Generate explainable risk factors
  const riskFactors: string[] = [];

  if (isPublicEntry) {
    riskFactors.push(`Public untrusted attacker entry point ("${entryPoint.name}")`);
  }
  if (isTargetCritical) {
    riskFactors.push(`Target asset "${target.name}" has CRITICAL criticality rating`);
  } else if (isTargetHigh) {
    riskFactors.push(`Target asset "${target.name}" has HIGH criticality rating`);
  }
  if (isTargetRestricted) {
    riskFactors.push(`Target resides within RESTRICTED security zone`);
  }
  if (isCoreDataOrAdmin) {
    riskFactors.push(`High-value sensitive asset role: ${target.type.toUpperCase()}`);
  }
  if (hopCount === 1) {
    riskFactors.push(`Direct 1-hop exposure to attacker`);
  } else if (isDirectOrShallow) {
    riskFactors.push(`Shallow attack path: reached in only ${hopCount} network hops`);
  } else {
    riskFactors.push(`Multi-hop traversal across ${hopCount} network hops`);
  }
  if (trustBoundariesCrossed === 0) {
    riskFactors.push(`Zero defensive security boundaries separating entry point from target`);
  } else if (trustBoundariesCrossed === 1) {
    riskFactors.push(`Only 1 perimeter trust boundary traversed`);
  } else {
    riskFactors.push(`Crosses ${trustBoundariesCrossed} distinct security trust boundaries`);
  }
  if (hasUnencrypted) {
    riskFactors.push(`Cleartext unencrypted network traffic permitted along path`);
  }
  if (hasWildcard) {
    riskFactors.push(`Broad wildcard port access ('ANY') permitted along path`);
  }

  return {
    hopCount,
    trustBoundariesCrossed,
    risk,
    riskFactors,
    whyItExists,
    steps,
  };
}
