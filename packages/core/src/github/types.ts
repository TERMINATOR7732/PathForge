import { NormalizedChangeSet, EngineeringSignal } from '../change-ingestion/types.js';
import { IngestionBridgeResult } from '../change-ingestion/mapper.js';
import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot } from '../comparison/snapshot.js';
import { ChangeAnalysisOptions } from '../change-analysis/types.js';

/**
 * Validated reference to a GitHub repository.
 *
 * PRIVACY MANDATE:
 * Only public coordinate identifiers (owner and repository) are stored.
 * Tokens, passwords, cookies, and PATs are strictly forbidden.
 */
export interface GitHubRepositoryReference {
  readonly owner: string;
  readonly repository: string;
  readonly fullName: string; // "owner/repository"
}

/**
 * Validated reference to a GitHub pull request.
 */
export interface GitHubPullRequestReference {
  readonly owner: string;
  readonly repository: string;
  readonly pullRequestNumber: number;
  readonly canonicalId: string; // "owner/repository#123"
}

/**
 * Lifecycle state of a GitHub pull request.
 */
export type PullRequestState = 'OPEN' | 'CLOSED' | 'MERGED';

/**
 * Metadata for a GitHub pull request.
 *
 * NOTE: Timestamps are preserved for human display and audit logging only.
 * They MUST NEVER participate in semantic change identity, security scoring,
 * or deterministic classification.
 */
export interface PullRequestMetadata {
  readonly prNumber: number;
  readonly title: string;
  readonly body: string | null;
  readonly author: string;
  readonly state: PullRequestState;
  readonly isDraft: boolean;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly changedFilesCount: number;
  readonly additions: number;
  readonly deletions: number;
}

/**
 * File modification status reported by GitHub.
 */
export type PullRequestFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

/**
 * File changed within a GitHub pull request.
 */
export interface PullRequestFile {
  readonly filename: string;
  readonly previousFilename?: string;
  readonly status: PullRequestFileStatus;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly patch?: string;
  readonly isBinary: boolean;
}

/**
 * Basic metadata for a GitHub repository.
 */
export interface GitHubRepositoryMetadata {
  readonly owner: string;
  readonly repository: string;
  readonly fullName: string;
  readonly defaultBranch: string;
  readonly isPrivate: boolean;
  readonly description?: string;
}

/**
 * Deterministic PR-level risk and engineering classification status.
 */
export type PullRequestRiskStatus =
  | 'NO_ENGINEERING_IMPACT'
  | 'ENGINEERING_CHANGE_DETECTED'
  | 'SECURITY_SENSITIVE_CHANGE'
  | 'SECURITY_REGRESSION'
  | 'SECURITY_IMPROVEMENT'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * Evidence model tying every PR conclusion to an explicit, verifiable source.
 */
export interface PullRequestEvidence {
  readonly observedChanges: readonly string[];
  readonly evidenceSource: 'GITHUB_PR_PATCH' | 'PATHFORGE_ENVIRONMENT_ANALYSIS' | 'STRUCTURED_PR_METADATA';
  readonly securityImpactProven: boolean;
  readonly conclusion: string;
  readonly limitationStatement: string;
}

/**
 * Options for analyzing a GitHub pull request.
 */
export interface GitHubAnalysisOptions {
  /**
   * Optional before-environment model to correlate against PR changes.
   */
  readonly beforeEnvironment?: Environment | EnvironmentSnapshot;

  /**
   * Optional after-environment model representing target topology after PR.
   */
  readonly afterEnvironment?: Environment;

  /**
   * Downstream Phase 3.1 analysis configuration.
   */
  readonly changeAnalysisOptions?: ChangeAnalysisOptions;

  /**
   * Whether to mask credentials in diff hunks. Default: true.
   */
  readonly maskSecrets?: boolean;
}

/**
 * Grouped engineering signals for a pull request.
 */
export interface PullRequestSignalsSummary {
  readonly securitySensitive: readonly EngineeringSignal[];
  readonly infrastructure: readonly EngineeringSignal[];
  readonly cicd: readonly EngineeringSignal[];
  readonly testing: readonly EngineeringSignal[];
  readonly dependency: readonly EngineeringSignal[];
}

/**
 * Full analysis result for a GitHub pull request.
 */
export interface GitHubAnalysisResult {
  readonly repository: GitHubRepositoryReference;
  readonly pullRequest: GitHubPullRequestReference;
  readonly metadata: PullRequestMetadata;
  readonly comparison: {
    readonly baseSha: string;
    readonly headSha: string;
    readonly baseBranch: string;
    readonly headBranch: string;
  };
  readonly files: readonly PullRequestFile[];
  readonly normalizedChangeSet: NormalizedChangeSet;
  readonly bridgeResult: IngestionBridgeResult;
  readonly riskStatus: PullRequestRiskStatus;
  readonly evidence: PullRequestEvidence;
  readonly signalsSummary: PullRequestSignalsSummary;
  readonly isAnalysisComplete: boolean;
  readonly error?: string;
}

/**
 * Standard error codes for GitHub operations.
 */
export type GitHubErrorCode =
  | 'AUTH_UNAVAILABLE'
  | 'REPOSITORY_NOT_FOUND'
  | 'PR_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NETWORK_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'PATCH_UNAVAILABLE'
  | 'API_UNAVAILABLE'
  | 'INVALID_INPUT';

/**
 * Structured GitHub error representation.
 */
export interface GitHubError {
  readonly code: GitHubErrorCode;
  readonly message: string;
  readonly details?: string;
}

/**
 * Abstract read-only GitHub provider interface.
 *
 * READ-ONLY MANDATE:
 * This interface exposes ONLY read/inspection methods.
 * Mutating methods (commenting, approvals, merging, closing, pushing, branch creation)
 * are strictly forbidden.
 */
export interface GitHubProvider {
  /**
   * Retrieves repository metadata.
   */
  getRepository(ref: GitHubRepositoryReference): Promise<GitHubRepositoryMetadata>;

  /**
   * Retrieves pull request metadata.
   */
  getPullRequest(ref: GitHubPullRequestReference): Promise<PullRequestMetadata>;

  /**
   * Retrieves files changed in a pull request.
   */
  getPullRequestFiles(ref: GitHubPullRequestReference): Promise<readonly PullRequestFile[]>;

  /**
   * Retrieves the raw unified diff/patch for a pull request.
   */
  getPullRequestDiff(ref: GitHubPullRequestReference): Promise<string>;
}
