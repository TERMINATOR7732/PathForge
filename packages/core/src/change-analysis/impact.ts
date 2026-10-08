import { Finding } from '@pathforge/shared';
import {
  ChangeImpactLevel,
  ChangeCategory,
  RegressionDetails,
  AttackPathDelta,
  ArchitectureDelta,
  ReadinessDelta,
  TechnicalDebtDelta,
  InfrastructureChangeItem,
} from './types.js';

export interface EvaluateImpactInput {
  changes: InfrastructureChangeItem[];
  securityIncreasingChanges: InfrastructureChangeItem[];
  securityDecreasingChanges: InfrastructureChangeItem[];
  newlyIntroducedRisks: Finding[];
  resolvedRisks: Finding[];
  attackPathDelta: AttackPathDelta;
  architectureDelta: ArchitectureDelta;
  readinessDelta: ReadinessDelta;
  technicalDebtDelta: TechnicalDebtDelta;
}

/**
 * Deterministically evaluates whether a regression occurred and classifies
 * the net direction of the change set.
 */
export function evaluateRegression(
  resolvedRisks: Finding[],
  newRisks: Finding[],
  securityIncreasingChanges: InfrastructureChangeItem[],
  securityDecreasingChanges: InfrastructureChangeItem[]
): RegressionDetails {
  const isRegression = resolvedRisks.length > 0 && newRisks.length > 0;

  let category: ChangeCategory;
  let explanation = '';

  if (isRegression) {
    category = 'regression';
    const resolvedIds = Array.from(new Set(resolvedRisks.map((r) => r.ruleId))).join(', ');
    const newIds = Array.from(new Set(newRisks.map((r) => r.ruleId))).join(', ');
    explanation = `Security regression detected: ${resolvedRisks.length} finding(s) resolved (${resolvedIds}), but ${newRisks.length} new finding(s) introduced (${newIds}).`;
  } else if (resolvedRisks.length > 0 && newRisks.length === 0) {
    category = 'improvement';
    const resolvedIds = Array.from(new Set(resolvedRisks.map((r) => r.ruleId))).join(', ');
    explanation = `Security posture improved: ${resolvedRisks.length} finding(s) resolved (${resolvedIds}) with zero new vulnerabilities introduced.`;
  } else if (resolvedRisks.length === 0 && newRisks.length > 0) {
    category = 'degradation';
    const newIds = Array.from(new Set(newRisks.map((r) => r.ruleId))).join(', ');
    explanation = `Security degradation: ${newRisks.length} new finding(s) introduced (${newIds}).`;
  } else if (securityIncreasingChanges.length > 0 && securityDecreasingChanges.length > 0) {
    category = 'mixed';
    explanation = 'Mixed security changes: topology modifications contain both security-strengthening and security-weakening adjustments.';
  } else if (securityIncreasingChanges.length > 0) {
    category = 'improvement';
    explanation = 'Security controls strengthened with zero regressions detected.';
  } else if (securityDecreasingChanges.length > 0) {
    category = 'degradation';
    explanation = 'Security controls weakened across modified infrastructure components.';
  } else {
    category = 'neutral';
    explanation = 'No material change to security posture or architectural risks.';
  }

  return {
    isRegression,
    category,
    resolvedRisks,
    newRisks,
    explanation,
  };
}

/**
 * Deterministically calculates the change impact level and collects transparent reasons.
 */
export function calculateChangeImpact(input: EvaluateImpactInput): {
  impactLevel: ChangeImpactLevel;
  impactReasons: string[];
} {
  const reasons: string[] = [];

  const hasCritRisk = input.newlyIntroducedRisks.some((r) => r.severity === 'critical');
  const hasHighRisk = input.newlyIntroducedRisks.some((r) => r.severity === 'high');
  const hasMedRisk = input.newlyIntroducedRisks.some((r) => r.severity === 'medium');

  const hasCritPath = input.attackPathDelta.added.some((p) => p.afterRisk === 'critical');
  const hasHighPath = input.attackPathDelta.added.some((p) => p.afterRisk === 'high');
  const hasPathRiskIncrease = input.attackPathDelta.changed.some((p) => p.changeType === 'risk-increased');

  const hasNewBlockers = input.readinessDelta.newBlockers.length > 0;
  const hasNewWarnings = input.readinessDelta.newWarnings.length > 0;

  const hasNewP0Debt = input.technicalDebtDelta.p0Delta > 0;
  const hasNewP1Debt = input.technicalDebtDelta.p1Delta > 0;

  const hasArchBypass = input.architectureDelta.tierBypassIntroduced;
  const hasDataIngress = input.architectureDelta.dataIngressIntroduced;
  const hasFlatTopology = input.architectureDelta.flatTopologyIntroduced;

  // 1. Critical impact factors
  if (hasCritRisk) {
    const critRuleIds = Array.from(
      new Set(input.newlyIntroducedRisks.filter((r) => r.severity === 'critical').map((r) => r.ruleId))
    ).join(', ');
    reasons.push(`New critical security finding introduced (${critRuleIds})`);
  }
  if (hasCritPath) {
    reasons.push('New critical-risk attack path discovered reaching sensitive asset');
  }
  if (hasNewP0Debt) {
    reasons.push(`New P0 technical debt introduced (${input.technicalDebtDelta.p0Delta} item(s))`);
  }

  // 2. High impact factors
  if (hasHighRisk) {
    const highRuleIds = Array.from(
      new Set(input.newlyIntroducedRisks.filter((r) => r.severity === 'high').map((r) => r.ruleId))
    ).join(', ');
    reasons.push(`New high-severity security finding introduced (${highRuleIds})`);
  }
  if (hasHighPath) {
    reasons.push('New high-risk attack path discovered');
  }
  if (hasPathRiskIncrease) {
    reasons.push('Existing attack path risk elevated due to relaxed controls');
  }
  if (hasNewBlockers) {
    reasons.push(`Production readiness gate blocked (${input.readinessDelta.newBlockers.length} blocker(s))`);
  }
  if (hasNewP1Debt) {
    reasons.push(`New P1 technical debt introduced (${input.technicalDebtDelta.p1Delta} item(s))`);
  }
  if (hasArchBypass) {
    reasons.push('Architectural tier bypass introduced across security boundaries');
  }
  if (hasDataIngress) {
    reasons.push('Direct untrusted ingress link to data tier created');
  }
  if (hasFlatTopology) {
    reasons.push('Flat network architecture anti-pattern introduced');
  }

  // 3. Medium impact factors
  if (hasMedRisk) {
    reasons.push('New medium-severity security finding introduced');
  }
  if (hasNewWarnings) {
    reasons.push(`New production readiness warning(s) raised (${input.readinessDelta.newWarnings.length})`);
  }
  if (input.securityDecreasingChanges.length > 0 && !hasCritRisk && !hasHighRisk) {
    reasons.push(`${input.securityDecreasingChanges.length} security-decreasing configuration change(s) observed`);
  }

  // 4. Positive impact factors (for improvement)
  if (input.resolvedRisks.length > 0) {
    reasons.push(`${input.resolvedRisks.length} security risk(s) eliminated`);
  }
  if (input.attackPathDelta.removed.length > 0) {
    reasons.push(`${input.attackPathDelta.removed.length} attack path(s) completely severed`);
  }
  if (input.readinessDelta.resolvedBlockers.length > 0) {
    reasons.push(`${input.readinessDelta.resolvedBlockers.length} production readiness blocker(s) resolved`);
  }

  // Determine Level
  let impactLevel: ChangeImpactLevel;
  if (hasCritRisk || hasCritPath || hasNewP0Debt) {
    impactLevel = 'CRITICAL';
  } else if (hasHighRisk || hasHighPath || hasNewBlockers || hasNewP1Debt || hasArchBypass || hasDataIngress) {
    impactLevel = 'HIGH';
  } else if (hasMedRisk || hasNewWarnings || input.securityDecreasingChanges.length > 0 || hasPathRiskIncrease) {
    impactLevel = 'MEDIUM';
  } else {
    impactLevel = 'LOW';
    if (reasons.length === 0) {
      if (input.changes.length > 0) {
        reasons.push('Minor infrastructure configuration updates without elevated security impact');
      } else {
        reasons.push('Zero infrastructure changes detected');
      }
    }
  }

  return {
    impactLevel,
    impactReasons: reasons,
  };
}
