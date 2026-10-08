import {
  EngineeringHistoryRecord,
  HistoryComparisonResult,
  HistoricalComparisonVerdict,
} from './types.js';

/**
 * Deterministically compares two historical engineering records to produce
 * explainable security and architectural deltas.
 */
export function compareHistoricalRecords(
  baseline: EngineeringHistoryRecord,
  current: EngineeringHistoryRecord
): HistoryComparisonResult {
  // 1. Security Findings Delta
  const baselineFindings = new Set(baseline.validation.findingIds);
  const currentFindings = new Set(current.validation.findingIds);

  const introducedFindingIds = current.validation.findingIds.filter(
    (id) => !baselineFindings.has(id)
  );
  const resolvedFindingIds = baseline.validation.findingIds.filter(
    (id) => !currentFindings.has(id)
  );
  const unchangedFindingIds = current.validation.findingIds.filter((id) =>
    baselineFindings.has(id)
  );

  const securityDelta = Object.freeze({
    criticalDelta: current.validation.criticalCount - baseline.validation.criticalCount,
    highDelta: current.validation.highCount - baseline.validation.highCount,
    totalDelta: current.validation.findingCount - baseline.validation.findingCount,
    introducedFindingIds: Object.freeze(introducedFindingIds),
    resolvedFindingIds: Object.freeze(resolvedFindingIds),
    unchangedFindingIds: Object.freeze(unchangedFindingIds),
  });

  // 2. Attack Exposure Delta
  const baselineAp = baseline.attackPath;
  const currentAp = current.attackPath;
  const attackExposureDelta = Object.freeze({
    pathCountDelta: (currentAp?.pathCount ?? 0) - (baselineAp?.pathCount ?? 0),
    criticalPathDelta:
      (currentAp?.criticalPathCount ?? 0) - (baselineAp?.criticalPathCount ?? 0),
    highestRiskScoreDelta:
      (currentAp?.highestRiskScore ?? 0) - (baselineAp?.highestRiskScore ?? 0),
    reachableCriticalAssetsDelta:
      (currentAp?.reachableCriticalAssets ?? 0) - (baselineAp?.reachableCriticalAssets ?? 0),
  });

  // 3. Architecture Delta
  const baselineArch = baseline.architecture;
  const currentArch = current.architecture;
  const architectureDelta = Object.freeze({
    scoreDelta: (currentArch?.score ?? 0) - (baselineArch?.score ?? 0),
    ratingBefore: baselineArch?.rating ?? 'needs-attention',
    ratingAfter: currentArch?.rating ?? 'needs-attention',
  });

  // 4. Production Readiness Delta
  const baselinePr = baseline.readiness;
  const currentPr = current.readiness;
  const readinessDelta = Object.freeze({
    scoreDelta: (currentPr?.score ?? 0) - (baselinePr?.score ?? 0),
    statusBefore: baselinePr?.status ?? 'INSUFFICIENT_EVIDENCE',
    statusAfter: currentPr?.status ?? 'INSUFFICIENT_EVIDENCE',
    blockedGatesDelta:
      (currentPr?.blockedGatesCount ?? 0) - (baselinePr?.blockedGatesCount ?? 0),
  });

  // 5. Testing Delta
  const baselineTest = baseline.testing;
  const currentTest = current.testing;
  const testingDelta = Object.freeze({
    scoreDelta: (currentTest?.score ?? 0) - (baselineTest?.score ?? 0),
    criticalCoverageDelta:
      (currentTest?.criticalCoverage ?? 0) - (baselineTest?.criticalCoverage ?? 0),
    unverifiedPropertiesDelta:
      (currentTest?.unverifiedPropertiesCount ?? 0) -
      (baselineTest?.unverifiedPropertiesCount ?? 0),
  });

  // 6. Technical Debt Delta
  const baselineDebt = baseline.technicalDebt;
  const currentDebt = current.technicalDebt;
  const technicalDebtDelta = Object.freeze({
    scoreDelta: (currentDebt?.score ?? 0) - (baselineDebt?.score ?? 0),
    ratingBefore: baselineDebt?.rating ?? 'ELEVATED',
    ratingAfter: currentDebt?.rating ?? 'ELEVATED',
    activeCountDelta:
      (currentDebt?.activeCount ?? 0) - (baselineDebt?.activeCount ?? 0),
    p0Delta: (currentDebt?.p0Count ?? 0) - (baselineDebt?.p0Count ?? 0),
    p1Delta: (currentDebt?.p1Count ?? 0) - (baselineDebt?.p1Count ?? 0),
  });

  // 7. Evaluate Improvements vs Degradations
  let improvements = 0;
  let degradations = 0;

  // Security dimension
  if (
    securityDelta.criticalDelta < 0 ||
    securityDelta.highDelta < 0 ||
    resolvedFindingIds.length > 0
  ) {
    improvements++;
  }
  if (
    securityDelta.criticalDelta > 0 ||
    securityDelta.highDelta > 0 ||
    introducedFindingIds.length > 0
  ) {
    degradations++;
  }

  // Attack exposure dimension
  if (
    attackExposureDelta.pathCountDelta < 0 ||
    attackExposureDelta.highestRiskScoreDelta < 0 ||
    attackExposureDelta.reachableCriticalAssetsDelta < 0
  ) {
    improvements++;
  }
  if (
    attackExposureDelta.pathCountDelta > 0 ||
    attackExposureDelta.highestRiskScoreDelta > 0 ||
    attackExposureDelta.reachableCriticalAssetsDelta > 0
  ) {
    degradations++;
  }

  // Architecture dimension
  if (architectureDelta.scoreDelta > 0) improvements++;
  if (architectureDelta.scoreDelta < 0) degradations++;

  // Production Readiness dimension
  if (readinessDelta.scoreDelta > 0 || readinessDelta.blockedGatesDelta < 0) {
    improvements++;
  }
  if (readinessDelta.scoreDelta < 0 || readinessDelta.blockedGatesDelta > 0) {
    degradations++;
  }

  // Testing dimension
  if (
    testingDelta.scoreDelta > 0 ||
    testingDelta.criticalCoverageDelta > 0 ||
    testingDelta.unverifiedPropertiesDelta < 0
  ) {
    improvements++;
  }
  if (
    testingDelta.scoreDelta < 0 ||
    testingDelta.criticalCoverageDelta < 0 ||
    testingDelta.unverifiedPropertiesDelta > 0
  ) {
    degradations++;
  }

  // Technical Debt dimension (higher debt score = cleaner)
  if (
    technicalDebtDelta.scoreDelta > 0 ||
    technicalDebtDelta.activeCountDelta < 0 ||
    technicalDebtDelta.p0Delta < 0
  ) {
    improvements++;
  }
  if (
    technicalDebtDelta.scoreDelta < 0 ||
    technicalDebtDelta.activeCountDelta > 0 ||
    technicalDebtDelta.p0Delta > 0
  ) {
    degradations++;
  }

  // 8. Verdict Evaluation
  let verdict: HistoricalComparisonVerdict;
  let verdictExplanation: string;

  const hasMissingCore =
    !baseline.validation ||
    !current.validation ||
    (baseline.topology.nodeCount === 0 && current.topology.nodeCount === 0);

  if (hasMissingCore) {
    verdict = 'INSUFFICIENT_EVIDENCE';
    verdictExplanation =
      'Insufficient topology or validation evidence to determine posture delta.';
  } else if (improvements > 0 && degradations === 0) {
    verdict = 'ENGINEERING_POSTURE_IMPROVED';
    verdictExplanation = `Observed ${improvements} positive engineering dimension(s) with zero regressions across security, readiness, and debt.`;
  } else if (degradations > 0 && improvements === 0) {
    verdict = 'ENGINEERING_POSTURE_DEGRADED';
    verdictExplanation = `Observed ${degradations} degraded engineering dimension(s) introducing security risks or technical debt.`;
  } else if (improvements > 0 && degradations > 0) {
    verdict = 'MIXED_ENGINEERING_IMPACT';
    verdictExplanation = `Mixed outcome: ${improvements} dimension(s) improved while ${degradations} dimension(s) degraded across security, architecture, or debt metrics.`;
  } else {
    verdict = 'NO_MEANINGFUL_CHANGE';
    verdictExplanation =
      'Zero observable engineering or security deltas between baseline and current snapshots.';
  }

  return Object.freeze({
    baselineRecordId: baseline.id,
    currentRecordId: current.id,
    verdict,
    verdictExplanation,
    securityDelta,
    attackExposureDelta,
    architectureDelta,
    readinessDelta,
    testingDelta,
    technicalDebtDelta,
  });
}
