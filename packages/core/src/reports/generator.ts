import { Environment } from '../domain/environment.js';
import { ValidationResult } from '@pathforge/shared';
import { EnvironmentSnapshot } from '../comparison/snapshot.js';
import { FixVerificationResult } from '../comparison/verification.js';
import {
  VerificationReport,
  ReportGateState,
  ReportRemediationRecord,
} from './types.js';

export interface GenerateReportParams {
  environment: Environment;
  baseline?: EnvironmentSnapshot | null;
  currentResult: ValidationResult;
  verification?: FixVerificationResult | null;
  appliedRemediation?: { actionId: string; type: string; title: string } | null;
  generatedAt?: string;
}

/**
 * Deterministically constructs a VerificationReport domain object
 * from existing validation, baseline, and verification state.
 */
export function generateVerificationReport(params: GenerateReportParams): VerificationReport {
  const {
    environment,
    currentResult,
    verification,
    appliedRemediation,
    generatedAt = new Date().toISOString(),
  } = params;

  const metadata = {
    title: 'PathForge Infrastructure Security Verification Report',
    reportVersion: '1.0.0',
    toolVersion: '0.3.0',
    generatedAt,
  };

  const environmentIdentity = {
    id: environment.id,
    name: environment.name,
    description: environment.description,
    nodeCount: environment.getNodes().length,
    edgeCount: environment.getEdges().length,
  };

  const remediationInfo = appliedRemediation ?? verification?.appliedRemediation ?? null;
  const remediationRecord: ReportRemediationRecord | undefined = remediationInfo
    ? {
        actionId: remediationInfo.actionId,
        type: remediationInfo.type,
        title: remediationInfo.title,
        outcome:
          verification && verification.resolvedFindings.length > 0
            ? 'Verified Eliminated'
            : 'Applied',
      }
    : undefined;

  // Case 1: Active verification against an established baseline
  if (verification) {
    const executiveSummary = {
      status: verification.status,
      headline: verification.headline,
      narrative: verification.summaryMessage,
      baselineAvailable: true,
      baselineTimestamp: verification.baselineTimestamp,
      evaluatedAt: verification.evaluatedAt,
      productionGate: verification.summaryDelta.productionGate.after as ReportGateState,
    };

    const resolvedFindings = verification.resolvedFindings.map((rf) => ({
      ruleId: rf.finding.ruleId,
      title: rf.finding.title,
      severity: rf.finding.severity,
      category: rf.finding.category,
      affectedNodes: [...rf.finding.affectedNodes],
      affectedEdges: [...rf.finding.affectedEdges],
      resolutionType: rf.resolutionType,
      changeSummary: rf.changeSummary,
      verificationProof: rf.verificationDetails,
      beforeState: { ...rf.beforeState },
      afterState: rf.afterState ? { ...rf.afterState } : undefined,
    }));

    const stillPresentFindings = verification.stillPresentFindings.map((sf) => ({
      id: sf.finding.id,
      ruleId: sf.finding.ruleId,
      title: sf.finding.title,
      severity: sf.finding.severity,
      category: sf.finding.category,
      affectedNodes: [...sf.finding.affectedNodes],
      affectedEdges: [...sf.finding.affectedEdges],
      unchangedContext: sf.unchangedContext,
    }));

    const regressions = verification.newFindings.map((nf) => ({
      id: nf.finding.id,
      ruleId: nf.finding.ruleId,
      title: nf.finding.title,
      severity: nf.finding.severity,
      category: nf.finding.category,
      affectedNodes: [...nf.finding.affectedNodes],
      affectedEdges: [...nf.finding.affectedEdges],
      whyItAppeared: nf.whyItAppeared,
    }));

    const infrastructureChanges = verification.diff.changes.map((c) => ({
      id: c.id,
      type: c.type,
      targetId: c.targetId,
      targetType: c.targetType,
      label: c.label,
      description: c.description,
      fieldChanges: c.fieldChanges,
    }));

    return {
      metadata,
      environment: environmentIdentity,
      executiveSummary,
      securityDelta: verification.summaryDelta,
      resolvedFindings,
      stillPresentFindings,
      regressions,
      infrastructureChanges,
      remediation: remediationRecord,
      productionGate: executiveSummary.productionGate,
    };
  }

  // Case 2: Validation result without comparison baseline
  const isPassed = currentResult.summary.passed;
  const productionGate: ReportGateState = isPassed ? 'PASSED' : 'BLOCKED';

  const executiveSummary = {
    status: 'no-baseline' as const,
    headline: isPassed
      ? 'VALIDATION COMPLIANT — NO BASELINE'
      : 'PRODUCTION GATE BLOCKED — NO BASELINE',
    narrative:
      'No validated before-state baseline exists for comparison. Validate the environment to establish an initial baseline, then revalidate after remediation to verify eliminated findings.',
    baselineAvailable: false,
    evaluatedAt: currentResult.evaluatedAt,
    productionGate,
  };

  const stillPresentFindings = currentResult.findings.map((f) => ({
    id: f.id,
    ruleId: f.ruleId,
    title: f.title,
    severity: f.severity,
    category: f.category,
    affectedNodes: [...f.affectedNodes],
    affectedEdges: [...f.affectedEdges],
    unchangedContext: `Violation active on elements: [${[...f.affectedNodes, ...f.affectedEdges].join(', ')}]`,
  }));

  return {
    metadata,
    environment: environmentIdentity,
    executiveSummary,
    resolvedFindings: [],
    stillPresentFindings,
    regressions: [],
    infrastructureChanges: [],
    remediation: remediationRecord,
    productionGate,
  };
}
