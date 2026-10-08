import { ValidationResult } from '@pathforge/shared';
import { Environment } from '../domain/environment.js';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { ProductionReadinessAssessment } from '../production-readiness/types.js';
import { TestingIntelligenceResult } from '../testing-intelligence/types.js';
import { TechnicalDebtAssessment } from '../technical-debt/types.js';
import { ChangeAnalysisResult } from '../change-analysis/types.js';
import { HistoryComparisonResult } from '../history/types.js';
import {
  CiGatePolicy,
  CiGateResult,
  CiGateStatus,
  CiGateReason,
  CiGatePassedControl,
  CiGateEvidenceGap,
  CiGateSummary,
  CiGateTargetInfo,
  statusToExitCode,
} from './types.js';
import { DEFAULT_CI_GATE_POLICY } from './policy.js';

export interface CiGateEvaluationInput {
  readonly target: CiGateTargetInfo;
  readonly environment: Environment;
  readonly validationResult: ValidationResult | null;
  readonly attackPathAnalysis?: AttackPathAnalysisResult | null;
  readonly architectureAnalysis?: ArchitectureAnalysisResult | null;
  readonly productionReadiness?: ProductionReadinessAssessment | null;
  readonly testingIntelligence?: TestingIntelligenceResult | null;
  readonly technicalDebt?: TechnicalDebtAssessment | null;
  readonly changeAnalysis?: ChangeAnalysisResult | null;
  readonly historicalComparison?: HistoryComparisonResult | null;
  readonly evaluatedAt?: string;
}

/**
 * Pure, deterministic evaluation of the CI Engineering Gate.
 * Consumes pre-computed analysis results and evaluates policy rules.
 */
export function evaluateCiGate(
  input: CiGateEvaluationInput,
  policy: CiGatePolicy = DEFAULT_CI_GATE_POLICY
): CiGateResult {
  const {
    target,
    environment,
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
    productionReadiness,
    testingIntelligence,
    technicalDebt,
    changeAnalysis,
    historicalComparison,
    evaluatedAt = new Date().toISOString(),
  } = input;

  const blockingReasons: CiGateReason[] = [];
  const warnings: CiGateReason[] = [];
  const passedControls: CiGatePassedControl[] = [];
  const evidenceGaps: CiGateEvidenceGap[] = [];

  // ==========================================
  // 1. Evidence Completeness & Prerequisite Checks
  // ==========================================
  let isInsufficientEvidence = false;

  if (!environment || !environment.id) {
    blockingReasons.push({
      id: 'missing-environment',
      category: 'evidence',
      severity: 'critical',
      title: 'Missing Environment Model',
      description: 'No valid infrastructure environment graph was provided for evaluation.',
    });
    isInsufficientEvidence = true;
  }

  // Regression gating requirement check
  const hasBaseline = Boolean(
    (changeAnalysis && changeAnalysis.summary) ||
    historicalComparison
  );

  if (policy.requireBaselineForRegression && !hasBaseline) {
    blockingReasons.push({
      id: 'missing-baseline-evidence',
      category: 'evidence',
      severity: 'high',
      title: 'Missing Baseline For Regression Verification',
      description:
        'Policy requires baseline regression verification, but no baseline snapshot or prior environment state was provided.',
    });
    isInsufficientEvidence = true;
  }

  // Testing evidence requirement check
  if (policy.requireTestingEvidence && !testingIntelligence) {
    blockingReasons.push({
      id: 'missing-testing-evidence',
      category: 'evidence',
      severity: 'high',
      title: 'Missing Testing Intelligence Evidence',
      description:
        'Policy requires testing intelligence evidence, but no verification coverage assessment is available.',
    });
    isInsufficientEvidence = true;
  }

  // If prerequisites are missing, return INSUFFICIENT_EVIDENCE immediately
  if (isInsufficientEvidence) {
    const summary: CiGateSummary = {
      totalPassedControls: 0,
      totalBlockingReasons: blockingReasons.length,
      totalWarnings: 0,
      totalEvidenceGaps: 1,
      securityFindings: {
        critical: validationResult?.summary.criticalCount ?? 0,
        high: validationResult?.summary.highCount ?? 0,
        medium: validationResult?.summary.mediumCount ?? 0,
        low: validationResult?.summary.lowCount ?? 0,
      },
      attackPathsCount: attackPathAnalysis?.attackPaths.length ?? 0,
      criticalAttackPathsCount:
        attackPathAnalysis?.attackPaths.filter((p) => p.risk === 'critical').length ?? 0,
      architectureScore: architectureAnalysis?.score.score ?? 0,
      readinessScore: productionReadiness?.score ?? 0,
      readinessStatus: productionReadiness?.status ?? 'UNEVALUATED',
      debtScore: technicalDebt?.summary.overallScore ?? 0,
      debtRating: technicalDebt?.summary.rating ?? 'UNRATED',
      testingCoveragePercent: testingIntelligence?.coverage.overallCoverage,
      regressionDetected: false,
      baselineAvailable: hasBaseline,
    };

    evidenceGaps.push({
      id: 'unverified-gate-input',
      controlId: 'prerequisite-evidence',
      title: 'Incomplete Input Evidence',
      description: 'The gate was unable to render a conclusive decision due to missing required inputs.',
      rationale: 'Truthful governance prevents fabricating pass/fail decisions without required evidence.',
    });

    return {
      schemaVersion: 1,
      status: 'INSUFFICIENT_EVIDENCE',
      exitCode: statusToExitCode('INSUFFICIENT_EVIDENCE'),
      score: 0,
      policy,
      blockingReasons,
      warnings,
      passedControls,
      evidenceGaps,
      summary,
      target,
      evaluatedAt,
    };
  }

  // ==========================================
  // 2. Security Validation Findings Evaluation
  // ==========================================
  const findings = validationResult?.findings ?? [];
  const criticalFindings = findings.filter((f) => f.severity === 'critical');
  const highFindings = findings.filter((f) => f.severity === 'high');

  const maxCritical = policy.maxCriticalFindingsAllowed ?? 0;
  if (policy.blockOnCriticalFindings && criticalFindings.length > maxCritical) {
    blockingReasons.push({
      id: 'block-critical-findings',
      category: 'security',
      severity: 'critical',
      title: `${criticalFindings.length} Critical Security Finding(s)`,
      description: `Detected ${criticalFindings.length} critical vulnerability finding(s), exceeding policy maximum of ${maxCritical}.`,
      evidence: criticalFindings.map((f) => `${f.ruleId}: ${f.title}`),
    });
  } else if (criticalFindings.length === 0) {
    passedControls.push({
      id: 'control-zero-critical-findings',
      name: 'Zero Critical Security Findings',
      category: 'security',
      description: 'No critical security violations detected in the active topology graph.',
    });
  }

  const maxHigh = policy.maxHighFindingsAllowed;
  if (policy.warnOnHighFindings && highFindings.length > (maxHigh ?? 0)) {
    warnings.push({
      id: 'warn-high-findings',
      category: 'security',
      severity: 'high',
      title: `${highFindings.length} High-Severity Finding(s)`,
      description: `Detected ${highFindings.length} high-severity finding(s) that require engineering remediation.`,
      evidence: highFindings.map((f) => `${f.ruleId}: ${f.title}`),
    });
  } else if (highFindings.length === 0) {
    passedControls.push({
      id: 'control-zero-high-findings',
      name: 'Zero High Security Findings',
      category: 'security',
      description: 'No high-severity security violations detected in the active topology graph.',
    });
  }

  // ==========================================
  // 3. Attack Path Intelligence Evaluation
  // ==========================================
  const attackPaths = attackPathAnalysis?.attackPaths ?? [];
  const criticalAttackPaths = attackPaths.filter((p) => p.risk === 'critical');
  const elevatedAttackPaths = attackPaths.filter((p) => p.risk === 'high' || p.risk === 'medium');

  if (policy.blockOnHighRiskAttackPaths && criticalAttackPaths.length > 0) {
    blockingReasons.push({
      id: 'block-critical-attack-paths',
      category: 'attack-exposure',
      severity: 'critical',
      title: `${criticalAttackPaths.length} Critical Attack Path(s)`,
      description: `${criticalAttackPaths.length} multi-hop critical attack path(s) reach restricted assets or sensitive databases.`,
      evidence: criticalAttackPaths.map((p) => `Path ${p.id}: ${p.entryPoint.name} → ${p.target.name}`),
    });
  } else if (criticalAttackPaths.length === 0) {
    passedControls.push({
      id: 'control-zero-critical-attack-paths',
      name: 'Zero Critical Attack Paths',
      category: 'attack-exposure',
      description: 'No adversarial attack paths with critical impact can reach high-value assets.',
    });
  }

  if (policy.warnOnModerateAttackPaths && elevatedAttackPaths.length > 0) {
    warnings.push({
      id: 'warn-elevated-attack-paths',
      category: 'attack-exposure',
      severity: 'high',
      title: `${elevatedAttackPaths.length} Elevated/High Attack Path(s)`,
      description: `Detected ${elevatedAttackPaths.length} elevated attack path(s) with lateral traversal opportunities.`,
      evidence: elevatedAttackPaths.slice(0, 5).map((p) => `Path ${p.id}: ${p.entryPoint.name} → ${p.target.name}`),
    });
  }

  // ==========================================
  // 4. Production Readiness Evaluation
  // ==========================================
  if (productionReadiness) {
    if (policy.blockOnReadinessNotReady && productionReadiness.status === 'NOT_READY') {
      blockingReasons.push({
        id: 'block-readiness-not-ready',
        category: 'readiness',
        severity: 'critical',
        title: 'Production Readiness Hard Gate Blocked',
        description: `Production readiness status is NOT_READY (${productionReadiness.blockingReasons.length} blocker(s)).`,
        evidence: productionReadiness.blockingReasons.map((b) => `${b.title}: ${b.explanation}`),
      });
    }

    if (
      policy.minReadinessScore !== undefined &&
      productionReadiness.score < policy.minReadinessScore
    ) {
      blockingReasons.push({
        id: 'block-readiness-score-threshold',
        category: 'readiness',
        severity: 'high',
        title: `Production Readiness Score (${productionReadiness.score}) Below Threshold (${policy.minReadinessScore})`,
        description: `Readiness score of ${productionReadiness.score} does not satisfy minimum requirement of ${policy.minReadinessScore}.`,
      });
    }

    if (
      policy.warnOnReadinessWarnings &&
      productionReadiness.status === 'READY_WITH_WARNINGS'
    ) {
      warnings.push({
        id: 'warn-readiness-warnings',
        category: 'readiness',
        severity: 'medium',
        title: `Production Readiness Warnings (${productionReadiness.warnings.length})`,
        description: 'Environment exhibits operational or resilience warnings that should be resolved.',
        evidence: productionReadiness.warnings.map((w) => `${w.title}: ${w.explanation}`),
      });
    }

    if (productionReadiness.status === 'READY') {
      passedControls.push({
        id: 'control-production-readiness-ready',
        name: 'Production Readiness Verified',
        category: 'readiness',
        description: 'Environment satisfied all deterministic production gates with status READY.',
      });
    }

    // Collect unverified operational controls as evidence gaps
    for (const limit of productionReadiness.limitations) {
      evidenceGaps.push({
        id: limit.id,
        controlId: limit.id,
        title: limit.name,
        description: limit.description,
        rationale: limit.rationale,
      });
    }
  }

  // ==========================================
  // 5. Architecture Intelligence Evaluation
  // ==========================================
  if (architectureAnalysis) {
    if (
      policy.blockOnArchitectureCritical &&
      (architectureAnalysis.score.rating === 'weak' || architectureAnalysis.score.score < 40)
    ) {
      blockingReasons.push({
        id: 'block-architecture-critical',
        category: 'architecture',
        severity: 'critical',
        title: 'Critical Architecture Violations',
        description: `Architecture rating is weak (score: ${architectureAnalysis.score.score}) due to severe structural anomalies.`,
        evidence: architectureAnalysis.findings.map((f) => `${f.title}: ${f.summary}`),
      });
    } else if (architectureAnalysis.score.score >= 70) {
      passedControls.push({
        id: 'control-healthy-architecture',
        name: 'Healthy Architecture Topology',
        category: 'architecture',
        description: `Architecture structural integrity score is ${architectureAnalysis.score.score} (${architectureAnalysis.score.rating}).`,
      });
    }
  }

  // ==========================================
  // 6. Technical Debt Evaluation
  // ==========================================
  if (technicalDebt) {
    const isDebtCritical = technicalDebt.summary.rating === 'SEVERE' || technicalDebt.summary.p0Count > 0;
    if (policy.blockOnCriticalTechnicalDebt && isDebtCritical) {
      blockingReasons.push({
        id: 'block-critical-technical-debt',
        category: 'debt',
        severity: 'critical',
        title: `Critical Technical Debt (${technicalDebt.summary.p0Count} P0 Items)`,
        description: `Environment has accumulated critical technical debt (rating: ${technicalDebt.summary.rating}, score: ${technicalDebt.summary.overallScore}).`,
        evidence: technicalDebt.items
          .filter((i) => i.priority === 'P0')
          .map((i) => `${i.title}: ${i.summary}`),
      });
    }

    if (
      policy.minDebtScore !== undefined &&
      technicalDebt.summary.overallScore < policy.minDebtScore
    ) {
      blockingReasons.push({
        id: 'block-debt-score-threshold',
        category: 'debt',
        severity: 'high',
        title: `Technical Debt Health Score (${technicalDebt.summary.overallScore}) Below Threshold (${policy.minDebtScore})`,
        description: `Technical debt health score of ${technicalDebt.summary.overallScore} is below minimum requirement of ${policy.minDebtScore}.`,
      });
    }

    if (
      policy.warnOnElevatedTechnicalDebt &&
      technicalDebt.summary.p1Count > 0
    ) {
      warnings.push({
        id: 'warn-p1-technical-debt',
        category: 'debt',
        severity: 'high',
        title: `${technicalDebt.summary.p1Count} P1 Technical Debt Items`,
        description: 'Significant architecture or operational debt identified requiring scheduled refactoring.',
        evidence: technicalDebt.items
          .filter((i) => i.priority === 'P1')
          .map((i) => `${i.title}: ${i.summary}`),
      });
    }

    if (technicalDebt.summary.p0Count === 0 && technicalDebt.summary.overallScore >= 75) {
      passedControls.push({
        id: 'control-manageable-technical-debt',
        name: 'Manageable Technical Debt',
        category: 'debt',
        description: `Zero P0 debt items detected; technical debt score is ${technicalDebt.summary.overallScore} (${technicalDebt.summary.rating}).`,
      });
    }
  }

  // ==========================================
  // 7. Testing Intelligence Evaluation
  // ==========================================
  if (testingIntelligence) {
    if (testingIntelligence.coverage.overallCoverage < 50) {
      warnings.push({
        id: 'warn-testing-coverage-low',
        category: 'testing',
        severity: 'medium',
        title: `Testing Verification Coverage Low (${testingIntelligence.coverage.overallCoverage}%)`,
        description: `Only ${testingIntelligence.coverage.overallCoverage}% of modeled infrastructure components have verified test coverage.`,
      });
    } else {
      passedControls.push({
        id: 'control-sufficient-testing-coverage',
        name: 'Sufficient Verification Coverage',
        category: 'testing',
        description: `Verified test coverage across infrastructure components is ${testingIntelligence.coverage.overallCoverage}%.`,
      });
    }
  }

  // ==========================================
  // 8. Regression Gating & Truthful Governance
  // ==========================================
  const regressionDetected = Boolean(
    (changeAnalysis && changeAnalysis.regressionDetected) ||
    (historicalComparison && historicalComparison.verdict === 'ENGINEERING_POSTURE_DEGRADED')
  );

  if (policy.blockOnRegressions && regressionDetected) {
    const regReasons: string[] = [];
    if (changeAnalysis && changeAnalysis.regressionDetails) {
      regReasons.push(changeAnalysis.regressionDetails.explanation);
    }
    if (historicalComparison) {
      regReasons.push(historicalComparison.verdictExplanation);
    }

    blockingReasons.push({
      id: 'block-security-regression',
      category: 'regression',
      severity: 'critical',
      title: 'Proven Security Regression Detected',
      description: 'Infrastructure change introduced new vulnerabilities or reopened attack paths compared to baseline.',
      evidence: regReasons.length > 0 ? regReasons : ['Observable security posture degradation compared to baseline.'],
    });
  } else if (hasBaseline && !regressionDetected) {
    passedControls.push({
      id: 'control-zero-security-regression',
      name: 'Zero Security Regression',
      category: 'regression',
      description: 'Infrastructure changes verified against baseline with zero introduced security vulnerabilities.',
    });
  }

  // ==========================================
  // 9. Composite Score & Verdict Computation
  // ==========================================
  let compositeScore = 100;
  if (productionReadiness || architectureAnalysis || testingIntelligence || technicalDebt) {
    const components: { score: number; weight: number }[] = [];
    if (productionReadiness) components.push({ score: productionReadiness.score, weight: 0.4 });
    if (architectureAnalysis) components.push({ score: architectureAnalysis.score.score, weight: 0.2 });
    if (technicalDebt) components.push({ score: technicalDebt.summary.overallScore, weight: 0.2 });
    if (testingIntelligence) components.push({ score: testingIntelligence.coverage.overallCoverage, weight: 0.2 });

    const totalWeight = components.reduce((acc, c) => acc + c.weight, 0);
    const weightedSum = components.reduce((acc, c) => acc + c.score * c.weight, 0);
    compositeScore = Math.round(weightedSum / totalWeight);
  } else {
    // Score based on findings
    compositeScore = Math.max(0, 100 - (criticalFindings.length * 40 + highFindings.length * 15));
  }

  let status: CiGateStatus = 'PASS';

  if (blockingReasons.length > 0) {
    status = 'BLOCK';
  } else if (warnings.length > 0) {
    if (!policy.allowWarnings) {
      // Strict mode: warnings promote to BLOCK
      status = 'BLOCK';
    } else {
      status = 'WARN';
    }
  } else {
    status = 'PASS';
  }

  const summary: CiGateSummary = {
    totalPassedControls: passedControls.length,
    totalBlockingReasons: blockingReasons.length,
    totalWarnings: warnings.length,
    totalEvidenceGaps: evidenceGaps.length,
    securityFindings: {
      critical: criticalFindings.length,
      high: highFindings.length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    attackPathsCount: attackPaths.length,
    criticalAttackPathsCount: criticalAttackPaths.length,
    architectureScore: architectureAnalysis?.score.score ?? 0,
    readinessScore: productionReadiness?.score ?? 0,
    readinessStatus: productionReadiness?.status ?? 'UNEVALUATED',
    debtScore: technicalDebt?.summary.overallScore ?? 0,
    debtRating: technicalDebt?.summary.rating ?? 'UNRATED',
    testingCoveragePercent: testingIntelligence?.coverage.overallCoverage,
    regressionDetected,
    baselineAvailable: hasBaseline,
  };

  return {
    schemaVersion: 1,
    status,
    exitCode: statusToExitCode(status),
    score: compositeScore,
    policy,
    blockingReasons,
    warnings,
    passedControls,
    evidenceGaps,
    summary,
    target,
    evaluatedAt,
  };
}
