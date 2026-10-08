import {
  Finding,
  ValidationResult,
} from '@pathforge/shared';
import { Environment } from '../domain/environment.js';
import { AttackPath, AttackPathRisk } from '../attack-path/types.js';
import { ArchitectureRating } from '../architecture/types.js';
import {
  ProductionReadinessRating,
  ProductionReadinessStatus,
  BlockingReason,
  ReadinessWarning,
} from '../production-readiness/types.js';
import { DebtRating, TechnicalDebtItem } from '../technical-debt/types.js';
import { EnvironmentSnapshot } from '../comparison/snapshot.js';

/**
 * Deterministic types of atomic infrastructure modifications.
 */
export type EngineeringChangeType =
  | 'NODE_ADDED'
  | 'NODE_REMOVED'
  | 'NODE_CONFIG_CHANGED'
  | 'EDGE_ADDED'
  | 'EDGE_REMOVED'
  | 'EDGE_CONFIG_CHANGED';

/**
 * Deterministic classification of the security significance of a change.
 */
export type SecuritySignificance =
  | 'security-increasing'
  | 'security-decreasing'
  | 'security-neutral'
  | 'security-ambiguous';

/**
 * Deterministic change impact classification.
 * Reflects engineering significance of observed structural change, NOT a probability.
 */
export type ChangeImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Overall classification of the net direction of the change set.
 */
export type ChangeCategory =
  | 'improvement'
  | 'regression'
  | 'degradation'
  | 'mixed'
  | 'neutral';

/**
 * Observable field-level diff for configuration mutations.
 */
export interface InfrastructureChangeFieldDiff {
  field: string;
  before: unknown;
  after: unknown;
  description: string;
}

/**
 * Single deterministic change item representing an added, removed,
 * or reconfigured infrastructure element with explanatory security classification.
 */
export interface InfrastructureChangeItem {
  id: string;
  type: EngineeringChangeType;
  targetId: string;
  targetType: 'node' | 'edge';
  label: string;
  description: string;
  classification: SecuritySignificance;
  classificationReason: string;
  fieldChanges?: InfrastructureChangeFieldDiff[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
}

/**
 * Attack path change tracking between before and after states.
 */
export interface AttackPathDeltaItem {
  signature: string;
  changeType: 'added' | 'removed' | 'risk-increased' | 'risk-decreased' | 'unchanged';
  beforePath?: AttackPath;
  afterPath?: AttackPath;
  beforeRisk?: AttackPathRisk;
  afterRisk?: AttackPathRisk;
  beforeRiskScore?: number;
  afterRiskScore?: number;
  summary: string;
  entryPointName: string;
  targetName: string;
  entryPointId: string;
  targetId: string;
}

export interface AttackPathDelta {
  added: AttackPathDeltaItem[];
  removed: AttackPathDeltaItem[];
  changed: AttackPathDeltaItem[];
  unchanged: AttackPathDeltaItem[];
  summary: string;
}

/**
 * Structural architecture changes tracked across analysis states.
 */
export interface ArchitectureDelta {
  tierBypassIntroduced: boolean;
  tierBypassResolved: boolean;
  flatTopologyIntroduced: boolean;
  flatTopologyResolved: boolean;
  dataIngressIntroduced: boolean;
  dataIngressResolved: boolean;
  managementExposureIntroduced: boolean;
  managementExposureResolved: boolean;
  dependencyConcentrationIncreased: boolean;
  dependencyConcentrationDecreased: boolean;
  scoreDelta: number;
  scoreBefore: number;
  scoreAfter: number;
  ratingBefore: ArchitectureRating;
  ratingAfter: ArchitectureRating;
  summary: string;
  observations: string[];
}

/**
 * Production readiness delta tracking score, gates, blockers, and warnings.
 */
export interface ReadinessDelta {
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  ratingBefore: ProductionReadinessRating;
  ratingAfter: ProductionReadinessRating;
  statusBefore: ProductionReadinessStatus;
  statusAfter: ProductionReadinessStatus;
  newBlockers: BlockingReason[];
  resolvedBlockers: BlockingReason[];
  newWarnings: ReadinessWarning[];
  resolvedWarnings: ReadinessWarning[];
  summary: string;
}

/**
 * Technical debt delta tracking health score, P0/P1 items, and resolved items.
 */
export interface TechnicalDebtDelta {
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  ratingBefore: DebtRating;
  ratingAfter: DebtRating;
  p0Before: number;
  p0After: number;
  p0Delta: number;
  p1Before: number;
  p1After: number;
  p1Delta: number;
  newDebt: TechnicalDebtItem[];
  resolvedDebt: TechnicalDebtItem[];
  summary: string;
}

/**
 * Structured regression details highlighting introduced vs resolved findings.
 */
export interface RegressionDetails {
  isRegression: boolean;
  category: ChangeCategory;
  resolvedRisks: Finding[];
  newRisks: Finding[];
  explanation: string;
}

/**
 * Compact change summary metrics contract.
 */
export interface ChangeAnalysisSummary {
  totalChanges: number;
  securityIncreasing: number;
  securityDecreasing: number;
  neutral: number;
  ambiguous: number;
  risksIntroduced: number;
  risksResolved: number;
  risksUnchanged: number;
  attackPathsAdded: number;
  attackPathsRemoved: number;
  attackPathsChanged: number;
  regressionDetected: boolean;
  impactLevel: ChangeImpactLevel;
  impactReasons: string[];
  category: ChangeCategory;
  headline: string;
}

/**
 * Authoritative complete change analysis result comparing two infrastructure states.
 */
export interface ChangeAnalysisResult {
  environmentId: string;
  analyzedAt: string;
  summary: ChangeAnalysisSummary;
  changes: InfrastructureChangeItem[];
  securityIncreasingChanges: InfrastructureChangeItem[];
  securityDecreasingChanges: InfrastructureChangeItem[];
  neutralChanges: InfrastructureChangeItem[];
  ambiguousChanges: InfrastructureChangeItem[];
  newlyIntroducedRisks: Finding[];
  resolvedRisks: Finding[];
  unchangedRisks: Finding[];
  regressionDetected: boolean;
  regressionDetails: RegressionDetails;
  attackPathDelta: AttackPathDelta;
  architectureDelta: ArchitectureDelta;
  readinessDelta: ReadinessDelta;
  technicalDebtDelta: TechnicalDebtDelta;
  recommendations: string[];
}

/**
 * Options for change analysis.
 */
export interface ChangeAnalysisOptions {
  beforeSnapshot?: EnvironmentSnapshot;
  beforeValidationResult?: ValidationResult;
  afterValidationResult?: ValidationResult;
  evaluateValidation?: (env: Environment) => ValidationResult;
  analyzedAt?: string;
}
