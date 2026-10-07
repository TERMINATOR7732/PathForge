import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { BlastRadiusAnalysisResult } from '../blast-radius/types.js';
import { FixVerificationResult } from '../comparison/verification.js';

/**
 * High-level production readiness status.
 * Gate-driven: independent of score alone.
 */
export type ProductionReadinessStatus =
  | 'READY'
  | 'READY_WITH_WARNINGS'
  | 'NOT_READY'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * Qualitative health rating based on 0-100 readiness score.
 */
export type ProductionReadinessRating =
  | 'EXCELLENT'
  | 'GOOD'
  | 'NEEDS_ATTENTION'
  | 'POOR'
  | 'CRITICAL';

/**
 * Status of an individual deterministic production gate.
 */
export type ProductionGateStatus = 'PASSED' | 'WARNING' | 'BLOCKED' | 'LIMITED';

/**
 * Primary categories evaluated for production readiness.
 */
export type ReadinessCategoryId =
  | 'security'
  | 'attack-exposure'
  | 'architecture'
  | 'access-control'
  | 'communication'
  | 'resilience'
  | 'evidence-coverage';

/**
 * Status of an individual category assessment.
 */
export type CategoryStatus = 'PASSED' | 'WARNING' | 'BLOCKED' | 'UNVERIFIED';

/**
 * Provenance source for observable evidence.
 */
export type EvidenceSource =
  | 'validation'
  | 'attack-path'
  | 'blast-radius'
  | 'architecture'
  | 'topology'
  | 'configuration'
  | 'model-coverage';

/**
 * Deterministic production gate evaluation.
 */
export interface ProductionGate {
  readonly id: string;
  readonly name: string;
  readonly status: ProductionGateStatus;
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly evidenceSources: readonly EvidenceSource[];
}

/**
 * Explainable deduction contributing to a category score.
 */
export interface ReadinessScoreDeduction {
  readonly category: ReadinessCategoryId;
  readonly points: number;
  readonly reason: string;
  readonly evidence?: string;
}

/**
 * Evaluation of an individual readiness category.
 */
export interface ReadinessCategoryAssessment {
  readonly id: ReadinessCategoryId;
  readonly name: string;
  readonly weight: number; // e.g. 30 for 30%
  readonly score: number;  // 0-100 integer
  readonly status: CategoryStatus;
  readonly summary: string;
  readonly observations: readonly string[];
  readonly deductions: readonly ReadinessScoreDeduction[];
}

/**
 * Structured blocking reason preventing safe production deployment.
 */
export interface BlockingReason {
  readonly id: string;
  readonly title: string;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly category: ReadinessCategoryId;
  readonly explanation: string;
  readonly evidence: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly affectedEdgeIds: readonly string[];
  readonly recommendation: string;
}

/**
 * Structured warning highlighting potential operational or resilience risk.
 */
export interface ReadinessWarning {
  readonly id: string;
  readonly title: string;
  readonly category: ReadinessCategoryId;
  readonly explanation: string;
  readonly evidence: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly affectedEdgeIds: readonly string[];
  readonly recommendation: string;
}

/**
 * Explicit operational control not verifiable from the modeled graph.
 */
export interface UnverifiedControl {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly rationale: string;
}

/**
 * Traceable evidence record supporting an assessment conclusion.
 */
export interface ReadinessEvidenceRecord {
  readonly id: string;
  readonly source: EvidenceSource;
  readonly category: ReadinessCategoryId;
  readonly item: string;
  readonly details: string;
}

/**
 * Summary counts and flags for the assessment.
 */
export interface ProductionReadinessSummary {
  readonly totalGates: number;
  readonly passedGates: number;
  readonly warningGates: number;
  readonly blockedGates: number;
  readonly limitedGates: number;
  readonly blockingReasonCount: number;
  readonly warningCount: number;
  readonly strengthCount: number;
  readonly unverifiedControlCount: number;
  readonly executiveVerdict: string;
}

/**
 * Complete production readiness assessment result for an environment.
 */
export interface ProductionReadinessAssessment {
  readonly environmentId: string;
  readonly analyzedAt: string;
  readonly status: ProductionReadinessStatus;
  readonly score: number; // 0-100 integer
  readonly rating: ProductionReadinessRating;
  readonly summary: ProductionReadinessSummary;
  readonly gates: readonly ProductionGate[];
  readonly categories: readonly ReadinessCategoryAssessment[];
  readonly blockingReasons: readonly BlockingReason[];
  readonly warnings: readonly ReadinessWarning[];
  readonly strengths: readonly string[];
  readonly limitations: readonly UnverifiedControl[];
  readonly evidence: readonly ReadinessEvidenceRecord[];
  readonly recommendedNextSteps: readonly string[];
}

/**
 * Options for running production readiness assessment.
 */
export interface ProductionReadinessOptions {
  readonly analyzedAt?: string;
  readonly validationResult?: ValidationResult | null;
  readonly attackPathAnalysis?: AttackPathAnalysisResult | null;
  readonly architectureAnalysis?: ArchitectureAnalysisResult | null;
  readonly blastRadiusAnalysis?: BlastRadiusAnalysisResult | null;
  readonly fixVerification?: FixVerificationResult | null;
}
