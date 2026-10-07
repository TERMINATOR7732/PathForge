import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { BlastRadiusAnalysisResult } from '../blast-radius/types.js';
import { FixVerificationResult } from '../comparison/verification.js';

/**
 * Functional category for testable infrastructure properties.
 */
export type PropertyCategory =
  | 'network-security'
  | 'communication-security'
  | 'access-control'
  | 'attack-resistance'
  | 'architecture'
  | 'remediation';

/**
 * Security importance level of an infrastructure property.
 */
export type PropertyImportance = 'critical' | 'high' | 'normal';

/**
 * Status of verification evidence for an infrastructure property.
 */
export type PropertyVerificationStatus = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';

/**
 * Provenance source for verification evidence.
 */
export type TestingEvidenceSource =
  | 'unit-test'
  | 'scenario'
  | 'fix-verification'
  | 'regression-test'
  | 'model-invariant'
  | 'manual-verification';

/**
 * High-level qualitative coverage level rating.
 */
export type CoverageLevel =
  | 'EXCELLENT'
  | 'GOOD'
  | 'MODERATE'
  | 'WEAK'
  | 'INSUFFICIENT';

/**
 * Definition of an important infrastructure security property.
 */
export interface SecurityPropertyDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: PropertyCategory;
  readonly description: string;
  readonly importance: PropertyImportance;
  readonly relatedRules: readonly string[];
  readonly relatedAnalysis: readonly string[];
  readonly verificationStrategy: string;
}

/**
 * Piece of verification evidence supporting a property.
 */
export interface PropertyEvidence {
  readonly id: string;
  readonly propertyId: string;
  readonly source: TestingEvidenceSource;
  readonly status: PropertyVerificationStatus;
  readonly description: string;
  readonly evidence: readonly string[];
}

/**
 * Alias for PropertyEvidence matching prompt terminology.
 */
export type TestingEvidence = PropertyEvidence;

/**
 * Evaluated testing property result with score contribution and evidence.
 */
export interface PropertyEvaluation {
  readonly property: SecurityPropertyDefinition;
  readonly status: PropertyVerificationStatus;
  readonly weight: number; // 3 for critical, 2 for high, 1 for normal
  readonly scoreContribution: number;
  readonly evidenceList: readonly PropertyEvidence[];
  readonly notes: string;
  readonly affectedNodeIds: readonly string[];
  readonly affectedEdgeIds: readonly string[];
}

/**
 * Identified gap in verification or test coverage.
 */
export interface CoverageGap {
  readonly id: string;
  readonly propertyId: string;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly title: string;
  readonly whyItMatters: string;
  readonly recommendedTest: string;
  readonly relatedNodeIds: readonly string[];
  readonly relatedEdgeIds: readonly string[];
}

/**
 * Category-level coverage summary.
 */
export interface CategoryCoverageSummary {
  readonly category: PropertyCategory;
  readonly name: string;
  readonly score: number; // 0-100 integer
  readonly totalProperties: number;
  readonly verified: number;
  readonly partial: number;
  readonly unverified: number;
}

/**
 * Regression detection status and intelligence.
 */
export interface RegressionIntelligence {
  readonly hasBaseline: boolean;
  readonly baselineTimestamp: string | null;
  readonly status: 'healthy' | 'regressions-detected' | 'no-baseline';
  readonly summary: string;
  readonly resolvedPropertiesCount: number;
  readonly regressedPropertiesCount: number;
  readonly regressedFindings: readonly string[];
  readonly remediationVerified: boolean;
}

/**
 * Summary metrics of testing coverage across tiers.
 */
export interface TestingCoverageSummary {
  readonly totalProperties: number;
  readonly verifiedProperties: number;
  readonly partialProperties: number;
  readonly unverifiedProperties: number;
  readonly criticalCoverage: number; // 0-100 integer
  readonly highCoverage: number;     // 0-100 integer
  readonly normalCoverage: number;   // 0-100 integer
  readonly overallCoverage: number;  // 0-100 integer
}

/**
 * Complete testing intelligence analysis result for an environment.
 */
export interface TestingIntelligenceResult {
  readonly environmentId: string;
  readonly analyzedAt: string;
  readonly score: number; // 0-100 integer
  readonly level: CoverageLevel;
  readonly summary: string;
  readonly coverage: TestingCoverageSummary;
  readonly categories: readonly CategoryCoverageSummary[];
  readonly properties: readonly PropertyEvaluation[];
  readonly verifiedProperties: readonly PropertyEvaluation[];
  readonly partialProperties: readonly PropertyEvaluation[];
  readonly unverifiedProperties: readonly PropertyEvaluation[];
  readonly gaps: readonly CoverageGap[];
  readonly recommendations: readonly string[];
  readonly regressions: RegressionIntelligence;
}

/**
 * Options for running testing intelligence assessment.
 */
export interface TestingIntelligenceOptions {
  readonly analyzedAt?: string;
  readonly validationResult?: ValidationResult | null;
  readonly attackPathAnalysis?: AttackPathAnalysisResult | null;
  readonly architectureAnalysis?: ArchitectureAnalysisResult | null;
  readonly blastRadiusAnalysis?: BlastRadiusAnalysisResult | null;
  readonly fixVerification?: FixVerificationResult | null;
  readonly scenarioId?: string | null;
}
