import { Environment } from '../domain/environment.js';
import { analyzeAttackPaths } from '../attack-path/analyzer.js';
import { analyzeArchitecture } from '../architecture/analyzer.js';
import { evaluateProductionGates } from './gates.js';
import { calculateReadinessScore } from './scoring.js';
import {
  buildBlockingReasons,
  buildReadinessWarnings,
  buildReadinessStrengths,
  getUnverifiedControls,
  buildEvidenceRecords,
  buildRecommendedNextSteps,
  buildExecutiveVerdict,
} from './assessment.js';
import {
  ProductionReadinessAssessment,
  ProductionReadinessOptions,
  ProductionReadinessStatus,
  ProductionReadinessSummary,
} from './types.js';

/**
 * Deterministically evaluates whether a modeled infrastructure environment is ready
 * for production deployment by composing validation rules, adversarial attack paths,
 * architectural integrity, and resilience intelligence.
 *
 * Core Principle: Compose existing intelligence without duplicating graph traversals.
 * Cautious Language: Distinguish modeled graph facts from unobservable runtime operational controls.
 */
export function assessProductionReadiness(
  environment: Environment,
  options: ProductionReadinessOptions = {}
): ProductionReadinessAssessment {
  const analyzedAt = options.analyzedAt ?? new Date().toISOString();
  const nodes = environment.getNodes();

  // 1. Compose or run underlying domain analyses
  const validationResult = options.validationResult ?? null;
  const attackPathAnalysis =
    options.attackPathAnalysis ?? analyzeAttackPaths(environment);
  const architectureAnalysis =
    options.architectureAnalysis ?? analyzeArchitecture(environment);

  const context = {
    environment,
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
  };

  // 2. Evaluate Deterministic Production Gates
  const gates = evaluateProductionGates(context);

  // 3. Compute Categorical and Overall Readiness Score
  const { score, rating, categories } = calculateReadinessScore(context);

  // 4. Build Structured Findings, Strengths, and Evidence Gaps
  const blockingReasons = buildBlockingReasons(context);
  const warnings = buildReadinessWarnings(context);
  const strengths = buildReadinessStrengths(context);
  const limitations = getUnverifiedControls();
  const evidence = buildEvidenceRecords(context);
  const recommendedNextSteps = buildRecommendedNextSteps(blockingReasons, warnings);

  // 5. Determine Overall Production Readiness Status (Gate-Driven)
  let status: ProductionReadinessStatus;
  const hasBlockedGate = gates.some((g) => g.status === 'BLOCKED');
  const hasWarningGate = gates.some((g) => g.status === 'WARNING');

  if (nodes.length <= 1) {
    status = 'INSUFFICIENT_EVIDENCE';
  } else if (hasBlockedGate || blockingReasons.length > 0) {
    status = 'NOT_READY';
  } else if (hasWarningGate || warnings.length > 0) {
    status = 'READY_WITH_WARNINGS';
  } else {
    status = 'READY';
  }

  // 6. Formulate Executive Summary
  const summary: ProductionReadinessSummary = {
    totalGates: gates.length,
    passedGates: gates.filter((g) => g.status === 'PASSED').length,
    warningGates: gates.filter((g) => g.status === 'WARNING').length,
    blockedGates: gates.filter((g) => g.status === 'BLOCKED').length,
    limitedGates: gates.filter((g) => g.status === 'LIMITED').length,
    blockingReasonCount: blockingReasons.length,
    warningCount: warnings.length,
    strengthCount: strengths.length,
    unverifiedControlCount: limitations.length,
    executiveVerdict: buildExecutiveVerdict(status, score, rating, blockingReasons, warnings),
  };

  return {
    environmentId: environment.id,
    analyzedAt,
    status,
    score,
    rating,
    summary,
    gates,
    categories,
    blockingReasons,
    warnings,
    strengths,
    limitations,
    evidence,
    recommendedNextSteps,
  };
}
