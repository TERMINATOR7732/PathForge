import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { ProductionReadinessAssessment, ProductionReadinessStatus } from '../production-readiness/types.js';
import { TestingIntelligenceResult } from '../testing-intelligence/types.js';
import { TechnicalDebtAssessment, DebtRating } from '../technical-debt/types.js';
import { ChangeAnalysisResult } from '../change-analysis/types.js';
import {
  CiGateResult,
  CiGateStatus,
  CiGateExitCode,
  CiGatePolicy,
} from '../ci-gate/types.js';

/**
 * Current schema version for continuous engineering run models.
 */
export const ENGINEERING_RUN_SCHEMA_VERSION = 1;

/**
 * Origin source for a continuous engineering run.
 */
export type EngineeringRunSource = 'local-git' | 'github-pr' | 'raw-diff' | 'manual' | 'scenario';

/**
 * Technical state of the engineering run evaluation.
 */
export type EngineeringRunStatus = 'CURRENT' | 'STALE' | 'ERROR' | 'INSUFFICIENT_EVIDENCE';

/**
 * Traceable element pointer on the canvas or in the source configuration.
 */
export interface ElementTargetRef {
  readonly id: string;
  readonly type: 'node' | 'edge';
  readonly label: string;
}

/**
 * Explicit evidence lineage mapping a gate decision or control to underlying findings and concrete canvas elements.
 */
export interface EvidenceLineageItem {
  readonly id: string;
  readonly controlId: string;
  readonly controlName: string;
  readonly category: string;
  readonly verdict: 'PASS' | 'WARN' | 'BLOCK' | 'INSUFFICIENT_EVIDENCE';
  readonly description: string;
  readonly affectedNodeIds: readonly string[];
  readonly affectedEdgeIds: readonly string[];
  readonly targetElements: readonly ElementTargetRef[];
  readonly rationale: string;
  readonly sourceDiffLines?: readonly string[];
}

/**
 * Row representation for the compact evidence matrix.
 */
export interface EvidenceMatrixRow {
  readonly control: string;
  readonly category: string;
  readonly result: 'PASS' | 'WARN' | 'BLOCK' | 'UNVERIFIED';
  readonly evidence: string;
  readonly targetElements: readonly ElementTargetRef[];
}

/**
 * High-level summary of intelligence signals for the run.
 */
export interface RunIntelligenceSummary {
  readonly securityFindingsCount: number;
  readonly criticalFindingsCount: number;
  readonly highFindingsCount: number;
  readonly attackPathsCount: number;
  readonly criticalAttackPathsCount: number;
  readonly architectureScore: number;
  readonly readinessScore: number;
  readonly readinessStatus: ProductionReadinessStatus | 'UNEVALUATED';
  readonly debtScore: number;
  readonly debtRating: DebtRating | 'UNRATED';
  readonly testingCoveragePercent?: number;
  readonly regressionDetected: boolean;
  readonly baselineAvailable: boolean;
}

/**
 * High-level changes summary for the run.
 */
export interface RunChangesSummary {
  readonly filesCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly impact: string;
  readonly securitySensitiveCount: number;
  readonly topologyChangeCount: number;
}

/**
 * Source provenance descriptor for an engineering run.
 */
export interface EngineeringRunSourceInfo {
  readonly type: EngineeringRunSource;
  readonly identifier: string;
  readonly displayName: string;
  readonly revision?: string;
  readonly branch?: string;
  readonly baseRef?: string;
  readonly headRef?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Complete, immutable representation of a continuous engineering run evaluation.
 */
export interface EngineeringRun {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly timestamp: string;
  readonly source: EngineeringRunSourceInfo;
  readonly status: EngineeringRunStatus;
  readonly environmentId: string;
  readonly environmentName: string;
  readonly compositeScore: number; // 0-100
  readonly gateStatus: CiGateStatus;
  readonly exitCode: CiGateExitCode;
  readonly topReasons: readonly string[];
  readonly intelligenceSummary: RunIntelligenceSummary;
  readonly changesSummary?: RunChangesSummary;
  readonly evidenceMatrix: readonly EvidenceMatrixRow[];
  readonly evidenceLineage: readonly EvidenceLineageItem[];
  readonly gateResult: CiGateResult;
  readonly historyRecordId?: string;
  readonly isBaselineAvailable: boolean;
  readonly staleReason?: string;
}

/**
 * Options for orchestrating an engineering run.
 */
export interface ExecuteEngineeringRunOptions {
  readonly environment: any;
  readonly source: EngineeringRunSourceInfo;
  readonly validationResult?: ValidationResult | null;
  readonly attackPathAnalysis?: AttackPathAnalysisResult | null;
  readonly architectureAnalysis?: ArchitectureAnalysisResult | null;
  readonly productionReadiness?: ProductionReadinessAssessment | null;
  readonly testingIntelligence?: TestingIntelligenceResult | null;
  readonly technicalDebt?: TechnicalDebtAssessment | null;
  readonly changeAnalysis?: ChangeAnalysisResult | null;
  readonly policy?: CiGatePolicy;
  readonly isStale?: boolean;
  readonly staleReason?: string;
}
