import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { BlastRadiusAnalysisResult } from '../blast-radius/types.js';
import { ProductionReadinessAssessment } from '../production-readiness/types.js';
import { TestingIntelligenceResult } from '../testing-intelligence/types.js';
import { FixVerificationResult } from '../comparison/verification.js';

/**
 * Functional category for technical debt and engineering risk.
 */
export type DebtCategory =
  | 'security-debt'
  | 'architecture-debt'
  | 'resilience-debt'
  | 'access-control-debt'
  | 'testing-debt'
  | 'operational-debt'
  | 'complexity-debt';

/**
 * Technical debt severity rating.
 */
export type DebtSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Deterministic engineering priority rank.
 */
export type DebtPriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Status of an identified debt item.
 */
export type DebtStatus = 'ACTIVE' | 'MITIGATED' | 'UNVERIFIED';

/**
 * The category of long-term engineering or security risk imposed.
 */
export type DebtImpactType =
  | 'security-risk'
  | 'change-risk'
  | 'regression-risk'
  | 'operational-risk'
  | 'resilience-risk'
  | 'complexity-risk';

/**
 * Expected engineering cost or disruption during future infrastructure changes.
 */
export type FutureChangeImpact = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Provenance analysis layer providing evidence for the debt item.
 */
export type DebtSourceAnalysis =
  | 'validation'
  | 'attack-path'
  | 'blast-radius'
  | 'architecture'
  | 'production-readiness'
  | 'testing-intelligence'
  | 'topology'
  | 'configuration';

/**
 * Contributing score factor explaining deterministic prioritization.
 */
export interface PriorityFactor {
  readonly id: string;
  readonly label: string;
  readonly points: number;
}

/**
 * Authoritative definition of a technical debt pattern.
 */
export interface TechnicalDebtDefinition {
  readonly id: string;
  readonly title: string;
  readonly category: DebtCategory;
  readonly baseSeverity: DebtSeverity;
  readonly summary: string;
  readonly whyItMatters: string;
  readonly debtImpact: DebtImpactType;
  readonly futureChangeImpact: FutureChangeImpact;
  readonly defaultSource: DebtSourceAnalysis;
  readonly recommendation: string;
}

/**
 * Contextualized technical debt item identified in the modeled infrastructure.
 */
export interface TechnicalDebtItem {
  readonly id: string;
  readonly definitionId: string;
  readonly title: string;
  readonly category: DebtCategory;
  readonly severity: DebtSeverity;
  readonly priority: DebtPriority;
  readonly priorityScore: number; // 0-100 integer
  readonly priorityFactors: readonly PriorityFactor[];
  readonly status: DebtStatus;
  readonly summary: string;
  readonly whyItMatters: string;
  readonly debtImpact: DebtImpactType;
  readonly futureChangeImpact: FutureChangeImpact;
  readonly evidence: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly affectedEdgeIds: readonly string[];
  readonly sourceAnalysis: DebtSourceAnalysis;
  readonly causedBy: readonly string[];
  readonly recommendation: string;
}

/**
 * Qualitative debt health rating for the modeled environment.
 */
export type DebtRating =
  | 'LOW_DEBT'
  | 'MANAGEABLE'
  | 'ELEVATED'
  | 'HIGH'
  | 'SEVERE';

/**
 * High-level summary metrics of modeled technical debt.
 */
export interface TechnicalDebtSummary {
  readonly overallScore: number; // 0-100 integer (100 = clean/minimal debt, 0 = severe debt)
  readonly rating: DebtRating;
  readonly totalItems: number;
  readonly activeCount: number;
  readonly mitigatedCount: number;
  readonly unverifiedCount: number;
  readonly p0Count: number;
  readonly p1Count: number;
  readonly p2Count: number;
  readonly p3Count: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly byCategory: Record<DebtCategory, number>;
  readonly topPriorities: readonly TechnicalDebtItem[];
}

/**
 * Complete technical debt and engineering risk assessment result.
 */
export interface TechnicalDebtAssessment {
  readonly environmentId: string;
  readonly analyzedAt: string;
  readonly summary: TechnicalDebtSummary;
  readonly items: readonly TechnicalDebtItem[];
  readonly activeItems: readonly TechnicalDebtItem[];
  readonly mitigatedItems: readonly TechnicalDebtItem[];
  readonly unverifiedItems: readonly TechnicalDebtItem[];
  readonly recommendations: readonly string[];
}

/**
 * Options for technical debt evaluation.
 */
export interface TechnicalDebtOptions {
  readonly analyzedAt?: string;
  readonly validationResult?: ValidationResult | null;
  readonly attackPathAnalysis?: AttackPathAnalysisResult | null;
  readonly architectureAnalysis?: ArchitectureAnalysisResult | null;
  readonly blastRadiusAnalysis?: BlastRadiusAnalysisResult | null;
  readonly productionReadiness?: ProductionReadinessAssessment | null;
  readonly testingIntelligence?: TestingIntelligenceResult | null;
  readonly fixVerification?: FixVerificationResult | null;
  readonly scenarioId?: string | null;
}
