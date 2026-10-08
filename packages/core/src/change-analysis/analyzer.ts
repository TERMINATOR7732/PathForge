import { Finding, ValidationResult } from '@pathforge/shared';
import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot, createEnvironmentSnapshot } from '../comparison/snapshot.js';
import { diffEnvironments } from '../comparison/diff.js';
import { deserializeEnvironment } from '../serialization/serializer.js';
import { analyzeAttackPaths } from '../attack-path/analyzer.js';
import { AttackPath } from '../attack-path/types.js';
import { analyzeArchitecture } from '../architecture/analyzer.js';
import { assessProductionReadiness } from '../production-readiness/analyzer.js';
import { assessTechnicalDebt } from '../technical-debt/analyzer.js';
import {
  ChangeAnalysisOptions,
  ChangeAnalysisResult,
  ChangeAnalysisSummary,
  AttackPathDelta,
  AttackPathDeltaItem,
  ArchitectureDelta,
  ReadinessDelta,
  TechnicalDebtDelta,
} from './types.js';
import { classifyChanges } from './classification.js';
import { evaluateRegression, calculateChangeImpact } from './impact.js';

function createEmptyValidationResult(envId: string, timestamp: string): ValidationResult {
  return {
    environmentId: envId,
    evaluatedAt: timestamp,
    findings: [],
    summary: {
      totalFindings: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      passed: true,
    },
    rulesEvaluated: 0,
  };
}

/**
 * Deterministically constructs a canonical signature for a security finding
 * to allow accurate cross-state matching.
 */
function findingSignature(f: Finding): string {
  const nodes = (f.affectedNodes ?? []).slice().sort().join(',');
  const edges = (f.affectedEdges ?? []).slice().sort().join(',');
  return `${f.ruleId}::nodes:[${nodes}]::edges:[${edges}]`;
}

/**
 * Deterministically constructs a canonical signature for an attack path.
 */
function getPathSignature(path: AttackPath): string {
  if (path.steps && path.steps.length > 0) {
    const stepStr = path.steps
      .map((s) => `${s.sourceNodeId}->${s.targetNodeId}:${s.protocol}:${s.ports}`)
      .join('|');
    return `${path.entryPoint.id}=>${path.target.id}::steps:[${stepStr}]`;
  }
  const nodeSeq = path.nodes.map((n) => n.id).join('->');
  return `${path.entryPoint.id}=>${path.target.id}::nodes:[${nodeSeq}]`;
}

/**
 * Deterministically analyzes the security and architectural differences between
 * two infrastructure states (before and after), answering:
 * "What changed, and did that change make the environment more or less secure?"
 *
 * Position Independence Principle: Visual canvas coordinates (x, y) represent presentation
 * layout only and never impact security, attack path, architecture, or readiness conclusions.
 */
export function analyzeInfrastructureChanges(
  before: Environment | EnvironmentSnapshot,
  after: Environment,
  options: ChangeAnalysisOptions = {}
): ChangeAnalysisResult {
  const analyzedAt = options.analyzedAt ?? new Date().toISOString();

  // 1. Normalize before and after environments and snapshots
  let beforeSnapshot: EnvironmentSnapshot;
  let beforeEnv: Environment;

  if ('nodes' in before && Array.isArray(before.nodes) && 'edges' in before && Array.isArray(before.edges)) {
    // Before is an EnvironmentSnapshot
    beforeSnapshot = before as EnvironmentSnapshot;
    beforeEnv = deserializeEnvironment({
      id: beforeSnapshot.environmentId,
      name: beforeSnapshot.name,
      nodes: beforeSnapshot.nodes as any,
      edges: beforeSnapshot.edges as any,
      metadata: {
        version: '1.0.0',
        createdAt: beforeSnapshot.timestamp,
        updatedAt: beforeSnapshot.timestamp,
      },
    });
  } else {
    // Before is an Environment
    beforeEnv = before as Environment;
    const beforeVal =
      options.beforeValidationResult ??
      (options.evaluateValidation ? options.evaluateValidation(beforeEnv) : undefined) ??
      createEmptyValidationResult(beforeEnv.id, analyzedAt);
    beforeSnapshot = createEnvironmentSnapshot(beforeEnv, beforeVal);
  }

  const afterEnv = after;
  const afterValidationResult =
    options.afterValidationResult ??
    (options.evaluateValidation ? options.evaluateValidation(afterEnv) : undefined) ??
    createEmptyValidationResult(afterEnv.id, analyzedAt);
  const beforeValidationResult = options.beforeValidationResult ?? beforeSnapshot.validationResult;

  // 3. Diff infrastructure topology
  const rawDiff = diffEnvironments(beforeSnapshot, afterEnv);
  const changes = classifyChanges(rawDiff, beforeSnapshot, afterEnv);

  const securityIncreasingChanges = changes.filter((c) => c.classification === 'security-increasing');
  const securityDecreasingChanges = changes.filter((c) => c.classification === 'security-decreasing');
  const neutralChanges = changes.filter((c) => c.classification === 'security-neutral');
  const ambiguousChanges = changes.filter((c) => c.classification === 'security-ambiguous');

  // 4. Compare Security Findings (Risks)
  const beforeFindings = beforeValidationResult.findings;
  const afterFindings = afterValidationResult.findings;

  const beforeSigs = new Map(beforeFindings.map((f) => [findingSignature(f), f]));
  const beforeIdMap = new Map(beforeFindings.map((f) => [f.id, f]));

  const afterSigs = new Map(afterFindings.map((f) => [findingSignature(f), f]));
  const afterIdMap = new Map(afterFindings.map((f) => [f.id, f]));

  const newlyIntroducedRisks: Finding[] = [];
  const unchangedRisks: Finding[] = [];
  const resolvedRisks: Finding[] = [];

  for (const af of afterFindings) {
    const sig = findingSignature(af);
    if (beforeSigs.has(sig) || beforeIdMap.has(af.id)) {
      unchangedRisks.push(af);
    } else {
      newlyIntroducedRisks.push(af);
    }
  }

  for (const bf of beforeFindings) {
    const sig = findingSignature(bf);
    if (!afterSigs.has(sig) && !afterIdMap.has(bf.id)) {
      resolvedRisks.push(bf);
    }
  }

  // 5. Compare Attack Paths
  const beforeAttackResult = analyzeAttackPaths(beforeEnv);
  const afterAttackResult = analyzeAttackPaths(afterEnv);

  const beforePaths = beforeAttackResult.attackPaths;
  const afterPaths = afterAttackResult.attackPaths;

  const beforePathsMap = new Map(beforePaths.map((p) => [getPathSignature(p), p]));
  const afterPathsMap = new Map(afterPaths.map((p) => [getPathSignature(p), p]));

  const pathsAdded: AttackPathDeltaItem[] = [];
  const pathsRemoved: AttackPathDeltaItem[] = [];
  const pathsChanged: AttackPathDeltaItem[] = [];
  const pathsUnchanged: AttackPathDeltaItem[] = [];

  for (const [sig, ap] of afterPathsMap.entries()) {
    const bp = beforePathsMap.get(sig);
    if (!bp) {
      pathsAdded.push({
        signature: sig,
        changeType: 'added',
        afterPath: ap,
        afterRisk: ap.risk,
        afterRiskScore: ap.riskScore,
        summary: `New ${ap.risk.toUpperCase()} risk attack path discovered: ${ap.entryPoint.name} → ${ap.target.name}`,
        entryPointName: ap.entryPoint.name,
        targetName: ap.target.name,
        entryPointId: ap.entryPoint.id,
        targetId: ap.target.id,
      });
    } else {
      if (ap.riskScore > bp.riskScore) {
        pathsChanged.push({
          signature: sig,
          changeType: 'risk-increased',
          beforePath: bp,
          afterPath: ap,
          beforeRisk: bp.risk,
          afterRisk: ap.risk,
          beforeRiskScore: bp.riskScore,
          afterRiskScore: ap.riskScore,
          summary: `Attack path risk increased from ${bp.risk.toUpperCase()} (${bp.riskScore}) to ${ap.risk.toUpperCase()} (${ap.riskScore})`,
          entryPointName: ap.entryPoint.name,
          targetName: ap.target.name,
          entryPointId: ap.entryPoint.id,
          targetId: ap.target.id,
        });
      } else if (ap.riskScore < bp.riskScore) {
        pathsChanged.push({
          signature: sig,
          changeType: 'risk-decreased',
          beforePath: bp,
          afterPath: ap,
          beforeRisk: bp.risk,
          afterRisk: ap.risk,
          beforeRiskScore: bp.riskScore,
          afterRiskScore: ap.riskScore,
          summary: `Attack path hardened: risk decreased from ${bp.risk.toUpperCase()} (${bp.riskScore}) to ${ap.risk.toUpperCase()} (${ap.riskScore})`,
          entryPointName: ap.entryPoint.name,
          targetName: ap.target.name,
          entryPointId: ap.entryPoint.id,
          targetId: ap.target.id,
        });
      } else {
        pathsUnchanged.push({
          signature: sig,
          changeType: 'unchanged',
          beforePath: bp,
          afterPath: ap,
          beforeRisk: bp.risk,
          afterRisk: ap.risk,
          beforeRiskScore: bp.riskScore,
          afterRiskScore: ap.riskScore,
          summary: `Attack path remains active with unchanged ${ap.risk.toUpperCase()} risk (${ap.riskScore})`,
          entryPointName: ap.entryPoint.name,
          targetName: ap.target.name,
          entryPointId: ap.entryPoint.id,
          targetId: ap.target.id,
        });
      }
    }
  }

  for (const [sig, bp] of beforePathsMap.entries()) {
    if (!afterPathsMap.has(sig)) {
      pathsRemoved.push({
        signature: sig,
        changeType: 'removed',
        beforePath: bp,
        beforeRisk: bp.risk,
        beforeRiskScore: bp.riskScore,
        summary: `Attack path eliminated: ${bp.entryPoint.name} → ${bp.target.name}`,
        entryPointName: bp.entryPoint.name,
        targetName: bp.target.name,
        entryPointId: bp.entryPoint.id,
        targetId: bp.target.id,
      });
    }
  }

  const attackPathDelta: AttackPathDelta = {
    added: pathsAdded.sort((a, b) => (b.afterRiskScore ?? 0) - (a.afterRiskScore ?? 0)),
    removed: pathsRemoved.sort((a, b) => (b.beforeRiskScore ?? 0) - (a.beforeRiskScore ?? 0)),
    changed: pathsChanged.sort((a, b) => (b.afterRiskScore ?? 0) - (a.afterRiskScore ?? 0)),
    unchanged: pathsUnchanged,
    summary: `${pathsAdded.length} added, ${pathsRemoved.length} eliminated, ${pathsChanged.length} modified`,
  };

  // 6. Compare Architecture
  const beforeArch = analyzeArchitecture(beforeEnv);
  const afterArch = analyzeArchitecture(afterEnv);

  const hasTierBypassBefore = beforeArch.findings.some((f) => f.category === 'tier-separation');
  const hasTierBypassAfter = afterArch.findings.some((f) => f.category === 'tier-separation');

  const hasFlatBefore = beforeArch.findings.some((f) => f.category === 'flat-topology');
  const hasFlatAfter = afterArch.findings.some((f) => f.category === 'flat-topology');

  const isDataIngressFinding = (f: { category: string; title: string }) =>
    f.category === 'critical-asset-dependency' ||
    f.title.toLowerCase().includes('data') ||
    f.title.toLowerCase().includes('ingress');

  const hasDataIngressBefore = beforeArch.findings.some(isDataIngressFinding);
  const hasDataIngressAfter = afterArch.findings.some(isDataIngressFinding);

  const hasMgmtBefore = beforeArch.findings.some((f) => f.category === 'management-exposure');
  const hasMgmtAfter = afterArch.findings.some((f) => f.category === 'management-exposure');

  const concWeights: Record<string, number> = { low: 1, moderate: 2, high: 3 };
  const depConcBeforeWeight = concWeights[beforeArch.profile.dependencyConcentration] ?? 1;
  const depConcAfterWeight = concWeights[afterArch.profile.dependencyConcentration] ?? 1;

  const archObservations: string[] = [];
  if (!hasTierBypassBefore && hasTierBypassAfter) archObservations.push('Tier bypass introduced');
  if (hasTierBypassBefore && !hasTierBypassAfter) archObservations.push('Tier bypass eliminated');
  if (!hasFlatBefore && hasFlatAfter) archObservations.push('Flat network architecture introduced');
  if (hasFlatBefore && !hasFlatAfter) archObservations.push('Network segmentation established');
  if (!hasDataIngressBefore && hasDataIngressAfter) archObservations.push('Direct untrusted ingress to data tier introduced');
  if (hasDataIngressBefore && !hasDataIngressAfter) archObservations.push('Direct untrusted ingress to data tier removed');
  if (depConcAfterWeight > depConcBeforeWeight) archObservations.push('Dependency concentration increased');
  if (depConcAfterWeight < depConcBeforeWeight) archObservations.push('Dependency concentration decreased');

  const architectureDelta: ArchitectureDelta = {
    tierBypassIntroduced: !hasTierBypassBefore && hasTierBypassAfter,
    tierBypassResolved: hasTierBypassBefore && !hasTierBypassAfter,
    flatTopologyIntroduced: !hasFlatBefore && hasFlatAfter,
    flatTopologyResolved: hasFlatBefore && !hasFlatAfter,
    dataIngressIntroduced: !hasDataIngressBefore && hasDataIngressAfter,
    dataIngressResolved: hasDataIngressBefore && !hasDataIngressAfter,
    managementExposureIntroduced: !hasMgmtBefore && hasMgmtAfter,
    managementExposureResolved: hasMgmtBefore && !hasMgmtAfter,
    dependencyConcentrationIncreased: depConcAfterWeight > depConcBeforeWeight,
    dependencyConcentrationDecreased: depConcAfterWeight < depConcBeforeWeight,
    scoreDelta: afterArch.score.score - beforeArch.score.score,
    scoreBefore: beforeArch.score.score,
    scoreAfter: afterArch.score.score,
    ratingBefore: beforeArch.score.rating,
    ratingAfter: afterArch.score.rating,
    summary:
      archObservations.length > 0
        ? archObservations.join('; ')
        : `Architecture score ${afterArch.score.score >= beforeArch.score.score ? '+' : ''}${afterArch.score.score - beforeArch.score.score} points`,
    observations: archObservations,
  };

  // 7. Compare Production Readiness
  const beforeReadiness = assessProductionReadiness(beforeEnv, {
    validationResult: beforeValidationResult,
    attackPathAnalysis: beforeAttackResult,
    architectureAnalysis: beforeArch,
  });
  const afterReadiness = assessProductionReadiness(afterEnv, {
    validationResult: afterValidationResult,
    attackPathAnalysis: afterAttackResult,
    architectureAnalysis: afterArch,
  });

  const beforeBlockerIds = new Set(beforeReadiness.blockingReasons.map((b) => b.id));
  const afterBlockerIds = new Set(afterReadiness.blockingReasons.map((b) => b.id));
  const newBlockers = afterReadiness.blockingReasons.filter((b) => !beforeBlockerIds.has(b.id));
  const resolvedBlockers = beforeReadiness.blockingReasons.filter((b) => !afterBlockerIds.has(b.id));

  const beforeWarningIds = new Set(beforeReadiness.warnings.map((w) => w.id));
  const afterWarningIds = new Set(afterReadiness.warnings.map((w) => w.id));
  const newWarnings = afterReadiness.warnings.filter((w) => !beforeWarningIds.has(w.id));
  const resolvedWarnings = beforeReadiness.warnings.filter((w) => !afterWarningIds.has(w.id));

  const readinessDelta: ReadinessDelta = {
    scoreBefore: beforeReadiness.score,
    scoreAfter: afterReadiness.score,
    scoreDelta: afterReadiness.score - beforeReadiness.score,
    ratingBefore: beforeReadiness.rating,
    ratingAfter: afterReadiness.rating,
    statusBefore: beforeReadiness.status,
    statusAfter: afterReadiness.status,
    newBlockers,
    resolvedBlockers,
    newWarnings,
    resolvedWarnings,
    summary: `${afterReadiness.score - beforeReadiness.score >= 0 ? '+' : ''}${afterReadiness.score - beforeReadiness.score} readiness score (${beforeReadiness.rating} → ${afterReadiness.rating})`,
  };

  // 8. Compare Technical Debt
  const beforeDebt = assessTechnicalDebt(beforeEnv, {
    validationResult: beforeValidationResult,
    attackPathAnalysis: beforeAttackResult,
    architectureAnalysis: beforeArch,
    productionReadiness: beforeReadiness,
  });
  const afterDebt = assessTechnicalDebt(afterEnv, {
    validationResult: afterValidationResult,
    attackPathAnalysis: afterAttackResult,
    architectureAnalysis: afterArch,
    productionReadiness: afterReadiness,
  });

  const beforeDebtIds = new Set(beforeDebt.activeItems.map((d) => d.definitionId));
  const afterDebtIds = new Set(afterDebt.activeItems.map((d) => d.definitionId));
  const newDebt = afterDebt.activeItems.filter((d) => !beforeDebtIds.has(d.definitionId));
  const resolvedDebt = beforeDebt.activeItems.filter((d) => !afterDebtIds.has(d.definitionId));

  const technicalDebtDelta: TechnicalDebtDelta = {
    scoreBefore: beforeDebt.summary.overallScore,
    scoreAfter: afterDebt.summary.overallScore,
    scoreDelta: afterDebt.summary.overallScore - beforeDebt.summary.overallScore,
    ratingBefore: beforeDebt.summary.rating,
    ratingAfter: afterDebt.summary.rating,
    p0Before: beforeDebt.summary.p0Count,
    p0After: afterDebt.summary.p0Count,
    p0Delta: afterDebt.summary.p0Count - beforeDebt.summary.p0Count,
    p1Before: beforeDebt.summary.p1Count,
    p1After: afterDebt.summary.p1Count,
    p1Delta: afterDebt.summary.p1Count - beforeDebt.summary.p1Count,
    newDebt,
    resolvedDebt,
    summary: `${afterDebt.summary.overallScore - beforeDebt.summary.overallScore >= 0 ? '+' : ''}${afterDebt.summary.overallScore - beforeDebt.summary.overallScore} debt score points (${beforeDebt.summary.rating} → ${afterDebt.summary.rating})`,
  };

  // 9. Evaluate Regression and Net Category
  const regressionDetails = evaluateRegression(
    resolvedRisks,
    newlyIntroducedRisks,
    securityIncreasingChanges,
    securityDecreasingChanges
  );

  // 10. Calculate Impact Level and Reasons
  const { impactLevel, impactReasons } = calculateChangeImpact({
    changes,
    securityIncreasingChanges,
    securityDecreasingChanges,
    newlyIntroducedRisks,
    resolvedRisks,
    attackPathDelta,
    architectureDelta,
    readinessDelta,
    technicalDebtDelta,
  });

  // 11. Compile Deterministic Recommendations
  const recommendations: string[] = [];
  if (regressionDetails.isRegression) {
    recommendations.push(
      `Remediate newly introduced findings before promoting changes: ${newlyIntroducedRisks.map((r) => r.ruleId).join(', ')}.`
    );
  }
  if (newlyIntroducedRisks.length > 0) {
    const critAndHigh = newlyIntroducedRisks.filter((r) => r.severity === 'critical' || r.severity === 'high');
    if (critAndHigh.length > 0) {
      recommendations.push(
        `Address ${critAndHigh.length} critical/high security finding(s): ${critAndHigh.map((r) => r.title).join('; ')}.`
      );
    }
  }
  if (pathsAdded.length > 0) {
    recommendations.push(
      `Sever ${pathsAdded.length} newly discovered attack path(s) by inserting perimeter defenses or applying explicit DENY rules.`
    );
  }
  if (newBlockers.length > 0) {
    recommendations.push(
      `Resolve ${newBlockers.length} new production readiness blocker(s): ${newBlockers.map((b) => b.title).join('; ')}.`
    );
  }
  if (securityDecreasingChanges.length > 0) {
    recommendations.push(
      `Review ${securityDecreasingChanges.length} weakened security control(s) and apply least-privilege restrictions.`
    );
  }
  if (recommendations.length === 0) {
    if (resolvedRisks.length > 0 || securityIncreasingChanges.length > 0) {
      recommendations.push(
        'Infrastructure modifications successfully verified: security controls strengthened with zero regressions.'
      );
    } else {
      recommendations.push('Environment remains in stable architectural posture with zero observed regressions.');
    }
  }

  // 12. Compile Headline
  let headline = '';
  switch (regressionDetails.category) {
    case 'regression':
      headline = 'Security Regression Detected: New Vulnerabilities Introduced';
      break;
    case 'improvement':
      headline = 'Security Posture Improved: Risks Eliminated With Zero Regressions';
      break;
    case 'degradation':
      headline = 'Security Posture Degraded: New Risks Introduced';
      break;
    case 'mixed':
      headline = 'Mixed Security Impact: Balancing Strengthening and Weakening Controls';
      break;
    case 'neutral':
      headline = 'Neutral Infrastructure Changes: No Material Impact On Risk';
      break;
  }

  const summary: ChangeAnalysisSummary = {
    totalChanges: changes.length,
    securityIncreasing: securityIncreasingChanges.length,
    securityDecreasing: securityDecreasingChanges.length,
    neutral: neutralChanges.length,
    ambiguous: ambiguousChanges.length,
    risksIntroduced: newlyIntroducedRisks.length,
    risksResolved: resolvedRisks.length,
    risksUnchanged: unchangedRisks.length,
    attackPathsAdded: pathsAdded.length,
    attackPathsRemoved: pathsRemoved.length,
    attackPathsChanged: pathsChanged.length,
    regressionDetected: regressionDetails.isRegression,
    impactLevel,
    impactReasons,
    category: regressionDetails.category,
    headline,
  };

  return {
    environmentId: afterEnv.id,
    analyzedAt,
    summary,
    changes,
    securityIncreasingChanges,
    securityDecreasingChanges,
    neutralChanges,
    ambiguousChanges,
    newlyIntroducedRisks,
    resolvedRisks,
    unchangedRisks,
    regressionDetected: regressionDetails.isRegression,
    regressionDetails,
    attackPathDelta,
    architectureDelta,
    readinessDelta,
    technicalDebtDelta,
    recommendations,
  };
}
