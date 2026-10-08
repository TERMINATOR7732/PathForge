import { ProductionReadinessStatus } from '../production-readiness/types.js';
import { DebtRating } from '../technical-debt/types.js';

/**
 * Deterministic status returned by the CI Engineering Gate.
 */
export type CiGateStatus =
  | 'PASS'
  | 'WARN'
  | 'BLOCK'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * Deterministic process exit code corresponding to gate status.
 * Standard CI conventions:
 * 0 = PASS (Success)
 * 1 = WARN (Warning threshold reached, non-blocking unless strict)
 * 2 = BLOCK (Hard policy violation)
 * 3 = INSUFFICIENT_EVIDENCE (Missing essential inputs or required baseline)
 */
export type CiGateExitCode = 0 | 1 | 2 | 3;

/**
 * Maps a gate status to its deterministic exit code.
 */
export function statusToExitCode(status: CiGateStatus): CiGateExitCode {
  switch (status) {
    case 'PASS':
      return 0;
    case 'WARN':
      return 1;
    case 'BLOCK':
      return 2;
    case 'INSUFFICIENT_EVIDENCE':
      return 3;
  }
}

/**
 * Maps an exit code back to its corresponding gate status.
 */
export function exitCodeToStatus(code: number): CiGateStatus {
  switch (code) {
    case 0:
      return 'PASS';
    case 1:
      return 'WARN';
    case 2:
      return 'BLOCK';
    default:
      return 'INSUFFICIENT_EVIDENCE';
  }
}

/**
 * Deterministic policy rules governing gate decisions.
 */
export interface CiGatePolicy {
  // Hard blocking controls
  readonly blockOnCriticalFindings: boolean;
  readonly blockOnHighRiskAttackPaths: boolean;
  readonly blockOnReadinessNotReady: boolean;
  readonly blockOnArchitectureCritical: boolean;
  readonly blockOnCriticalTechnicalDebt: boolean;
  readonly blockOnRegressions: boolean;

  // Warning controls
  readonly warnOnHighFindings: boolean;
  readonly warnOnModerateAttackPaths: boolean;
  readonly warnOnReadinessWarnings: boolean;
  readonly warnOnElevatedTechnicalDebt: boolean;

  // Evidence & Strictness controls
  readonly requireTestingEvidence: boolean;
  readonly requireBaselineForRegression: boolean;
  readonly allowWarnings: boolean; // if false, warnings promote status to BLOCK (exit code 2)

  // Numerical thresholds (optional)
  readonly minReadinessScore?: number; // 0-100 threshold
  readonly minDebtScore?: number;      // 0-100 threshold (higher is better health)
  readonly maxCriticalFindingsAllowed?: number; // default: 0
  readonly maxHighFindingsAllowed?: number;
}

/**
 * Categories of reasons participating in a gate evaluation.
 */
export type CiGateReasonCategory =
  | 'security'
  | 'attack-exposure'
  | 'architecture'
  | 'readiness'
  | 'testing'
  | 'debt'
  | 'regression'
  | 'evidence';

/**
 * Structured blocking or warning item.
 */
export interface CiGateReason {
  readonly id: string;
  readonly category: CiGateReasonCategory;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly title: string;
  readonly description: string;
  readonly evidence?: readonly string[];
}

/**
 * Verified control that successfully satisfied policy expectations.
 */
export interface CiGatePassedControl {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
}

/**
 * Explicit operational control not verifiable from modeled static topology.
 * Differentiated strictly from failed controls to maintain truthful governance.
 */
export interface CiGateEvidenceGap {
  readonly id: string;
  readonly controlId: string;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
}

/**
 * Aggregated metric counts and intelligence overview.
 */
export interface CiGateSummary {
  readonly totalPassedControls: number;
  readonly totalBlockingReasons: number;
  readonly totalWarnings: number;
  readonly totalEvidenceGaps: number;
  readonly securityFindings: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
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
 * Target identification metadata for the environment being gated.
 */
export interface CiGateTargetInfo {
  readonly targetType: 'environment-file' | 'scenario' | 'git-repository' | 'github-pr' | 'in-memory';
  readonly identifier: string;
  readonly environmentId: string;
  readonly environmentName: string;
  readonly revision?: string;
  readonly branch?: string;
}

/**
 * Complete machine-readable CI engineering gate result.
 */
export interface CiGateResult {
  readonly schemaVersion: 1;
  readonly status: CiGateStatus;
  readonly exitCode: CiGateExitCode;
  readonly score: number; // 0-100 composite engineering posture score
  readonly policy: CiGatePolicy;
  readonly blockingReasons: readonly CiGateReason[];
  readonly warnings: readonly CiGateReason[];
  readonly passedControls: readonly CiGatePassedControl[];
  readonly evidenceGaps: readonly CiGateEvidenceGap[];
  readonly summary: CiGateSummary;
  readonly target: CiGateTargetInfo;
  readonly evaluatedAt: string;
}
