import {
  ArchitectureRating,
} from '../architecture/types.js';
import {
  ProductionReadinessRating,
  ProductionReadinessStatus,
} from '../production-readiness/types.js';
import {
  CoverageLevel,
} from '../testing-intelligence/types.js';
import {
  DebtRating,
} from '../technical-debt/types.js';
import {
  ChangeImpactLevel,
} from '../change-analysis/types.js';

/**
 * Current schema version for persistent engineering history records.
 */
export const HISTORY_SCHEMA_VERSION = 1;

/**
 * Deterministic source types representing where an analysis snapshot originated.
 */
export type HistoryRecordSource = 'manual' | 'local-git' | 'github-pr' | 'scenario';

/**
 * Provenance identity for a manual user-triggered analysis snapshot.
 */
export interface ManualSourceIdentity {
  readonly type: 'manual';
  readonly environmentId: string;
  readonly name?: string;
}

/**
 * Provenance identity for a local Git repository inspection.
 */
export interface LocalGitSourceIdentity {
  readonly type: 'local-git';
  readonly repositoryPath: string;
  readonly commitSha: string;
  readonly branch?: string;
  readonly comparisonMode?: string;
}

/**
 * Provenance identity for a remote GitHub Pull Request inspection.
 * SAFETY MANDATE: Never stores credentials, tokens, or auth headers.
 */
export interface GitHubPrSourceIdentity {
  readonly type: 'github-pr';
  readonly owner: string;
  readonly repository: string;
  readonly prNumber: number;
  readonly baseSha: string;
  readonly headSha: string;
}

/**
 * Provenance identity for a built-in or custom simulation scenario.
 */
export interface ScenarioSourceIdentity {
  readonly type: 'scenario';
  readonly scenarioId: string;
  readonly scenarioName: string;
}

/**
 * Union of supported provenance source identities.
 */
export type HistorySourceIdentity =
  | ManualSourceIdentity
  | LocalGitSourceIdentity
  | GitHubPrSourceIdentity
  | ScenarioSourceIdentity;

/**
 * Summary metrics of the modeled topology.
 */
export interface HistoryTopologySummary {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly criticalNodeCount: number;
  readonly internetFacingNodeCount: number;
}

/**
 * Summary metrics of security validation findings.
 */
export interface HistoryValidationSummary {
  readonly findingCount: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly infoCount: number;
  readonly findingIds: readonly string[];
}

/**
 * Summary metrics of attack path & reachability intelligence.
 */
export interface HistoryAttackPathSummary {
  readonly pathCount: number;
  readonly criticalPathCount: number;
  readonly highRiskPathCount: number;
  readonly highestRiskScore: number;
  readonly highestRisk: string; // 'critical' | 'high' | 'medium' | 'low' | 'none'
  readonly reachableCriticalAssets: number;
  readonly mostExposedAssetId: string | null;
  readonly mostExposedAssetName: string | null;
}

/**
 * Summary metrics of architectural intelligence.
 */
export interface HistoryArchitectureSummary {
  readonly score: number; // 0-100 integer
  readonly rating: ArchitectureRating;
  readonly segmentation: string;
  readonly findingsCount: number;
}

/**
 * Summary metrics of production readiness assessment.
 */
export interface HistoryReadinessSummary {
  readonly score: number; // 0-100 integer
  readonly rating: ProductionReadinessRating;
  readonly status: ProductionReadinessStatus;
  readonly blockedGatesCount: number;
  readonly warningCount: number;
}

/**
 * Summary metrics of testing intelligence & verification coverage.
 */
export interface HistoryTestingSummary {
  readonly score: number; // 0-100 integer
  readonly level: CoverageLevel;
  readonly criticalCoverage: number; // 0-100 integer
  readonly highCoverage: number;     // 0-100 integer
  readonly unverifiedPropertiesCount: number;
}

/**
 * Summary metrics of technical debt & engineering risk.
 */
export interface HistoryTechnicalDebtSummary {
  readonly score: number; // 0-100 integer (100 = clean, 0 = severe debt)
  readonly rating: DebtRating;
  readonly activeCount: number;
  readonly p0Count: number;
  readonly p1Count: number;
}

/**
 * Optional summary metrics of continuous change analysis deltas.
 */
export interface HistoryChangeAnalysisSummary {
  readonly totalChanges: number;
  readonly impactLevel: ChangeImpactLevel;
  readonly regressionDetected: boolean;
  readonly risksIntroduced: number;
  readonly risksResolved: number;
}

/**
 * Authoritative deterministic historical analysis record.
 * Represents an immutable capture of all derived engineering intelligence
 * for a specific infrastructure state.
 */
export interface EngineeringHistoryRecord {
  readonly schemaVersion: number;
  readonly id: string; // Deterministic content-derived hash
  readonly environmentId: string;
  readonly environmentName: string;
  readonly timestamp: string; // ISO-8601 string; display and ordering only, NOT semantic identity
  readonly source: HistoryRecordSource;
  readonly sourceIdentity: HistorySourceIdentity;
  readonly revisionIdentity: string; // Git commit SHA, PR head SHA, or canonical topology hash
  readonly topology: HistoryTopologySummary;
  readonly validation: HistoryValidationSummary;
  readonly attackPath?: HistoryAttackPathSummary;
  readonly architecture?: HistoryArchitectureSummary;
  readonly readiness?: HistoryReadinessSummary;
  readonly testing?: HistoryTestingSummary;
  readonly technicalDebt?: HistoryTechnicalDebtSummary;
  readonly changeAnalysis?: HistoryChangeAnalysisSummary;
  readonly evidenceNotes: readonly string[];
}

/**
 * High-level verdict for a historical comparison between two snapshots.
 */
export type HistoricalComparisonVerdict =
  | 'ENGINEERING_POSTURE_IMPROVED'
  | 'ENGINEERING_POSTURE_DEGRADED'
  | 'NO_MEANINGFUL_CHANGE'
  | 'MIXED_ENGINEERING_IMPACT'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * Structured delta comparison between a baseline historical record and a current record.
 */
export interface HistoryComparisonResult {
  readonly baselineRecordId: string;
  readonly currentRecordId: string;
  readonly verdict: HistoricalComparisonVerdict;
  readonly verdictExplanation: string;
  readonly securityDelta: {
    readonly criticalDelta: number;
    readonly highDelta: number;
    readonly totalDelta: number;
    readonly introducedFindingIds: readonly string[];
    readonly resolvedFindingIds: readonly string[];
    readonly unchangedFindingIds: readonly string[];
  };
  readonly attackExposureDelta: {
    readonly pathCountDelta: number;
    readonly criticalPathDelta: number;
    readonly highestRiskScoreDelta: number;
    readonly reachableCriticalAssetsDelta: number;
  };
  readonly architectureDelta: {
    readonly scoreDelta: number;
    readonly ratingBefore: ArchitectureRating;
    readonly ratingAfter: ArchitectureRating;
  };
  readonly readinessDelta: {
    readonly scoreDelta: number;
    readonly statusBefore: ProductionReadinessStatus;
    readonly statusAfter: ProductionReadinessStatus;
    readonly blockedGatesDelta: number;
  };
  readonly testingDelta: {
    readonly scoreDelta: number;
    readonly criticalCoverageDelta: number;
    readonly unverifiedPropertiesDelta: number;
  };
  readonly technicalDebtDelta: {
    readonly scoreDelta: number;
    readonly ratingBefore: DebtRating;
    readonly ratingAfter: DebtRating;
    readonly activeCountDelta: number;
    readonly p0Delta: number;
    readonly p1Delta: number;
  };
}

/**
 * Deterministic direction of an engineering trend over time.
 */
export type TrendDirection = 'improving' | 'stable' | 'degrading' | 'insufficient-data';

/**
 * Single historical time-series data point for a trend metric.
 */
export interface HistoryTrendDataPoint {
  readonly timestamp: string;
  readonly recordId: string;
  readonly revision: string;
  readonly value: number;
}

/**
 * Trend analysis for an individual engineering dimension over time.
 */
export interface HistoryTrendMetric {
  readonly name: string;
  readonly direction: TrendDirection;
  readonly dataPoints: readonly HistoryTrendDataPoint[];
  readonly firstValue: number;
  readonly lastValue: number;
  readonly delta: number;
  readonly explanation: string;
}

/**
 * Comprehensive longitudinal trends calculated across multiple historical records.
 */
export interface HistoryTrendsSummary {
  readonly recordCount: number;
  readonly overallDirection: TrendDirection;
  readonly securityTrend: HistoryTrendMetric;
  readonly attackExposureTrend: HistoryTrendMetric;
  readonly architectureTrend: HistoryTrendMetric;
  readonly readinessTrend: HistoryTrendMetric;
  readonly testingTrend: HistoryTrendMetric;
  readonly technicalDebtTrend: HistoryTrendMetric;
  readonly summary: string;
}

/**
 * Query options for filtering historical records from storage.
 */
export interface HistoryStoreQueryOptions {
  readonly environmentId?: string;
  readonly limit?: number;
  readonly source?: HistoryRecordSource;
  readonly sinceTimestamp?: string;
}

/**
 * Result of saving a historical record to storage.
 */
export interface HistorySaveResult {
  readonly record: EngineeringHistoryRecord;
  readonly isDuplicate: boolean;
}

/**
 * Storage abstraction for persisting and retrieving engineering history.
 */
export interface EngineeringHistoryStore {
  save(record: EngineeringHistoryRecord): Promise<HistorySaveResult> | HistorySaveResult;
  get(id: string): Promise<EngineeringHistoryRecord | null> | (EngineeringHistoryRecord | null);
  list(options?: HistoryStoreQueryOptions): Promise<readonly EngineeringHistoryRecord[]> | readonly EngineeringHistoryRecord[];
  delete(id: string): Promise<boolean> | boolean;
  clear(environmentId?: string): Promise<void> | void;
}
