import { NormalizedChangeSet } from '../change-ingestion/types.js';
import { IngestionBridgeResult } from '../change-ingestion/mapper.js';

/**
 * Supported comparison modes within a local Git repository.
 */
export type GitComparisonMode =
  | 'working-tree-vs-head'     // HEAD -> Working tree (unstaged modifications)
  | 'index-vs-head'            // HEAD -> Staged index
  | 'working-state-vs-head'    // HEAD -> Full working state (staged + unstaged)
  | 'commit-vs-commit'         // Base commit SHA -> Head commit SHA
  | 'branch-vs-branch';        // Base branch/ref -> Head branch/ref

/**
 * Inspection model representing a local Git repository.
 *
 * PRIVACY & SAFETY PRINCIPLE:
 * No remote credentials, tokens, or URL authentication data are stored or exposed.
 * The repository operates completely offline.
 */
export interface GitRepository {
  readonly rootPath: string;
  readonly currentBranch: string | null;
  readonly currentCommit: string;
  readonly isDirty: boolean;
  readonly stagedCount: number;
  readonly unstagedCount: number;
  readonly untrackedCount: number;
  readonly untrackedFiles: readonly string[];
  readonly isDetached: boolean;
  readonly remotePresence: boolean;
}

/**
 * Deterministic metadata for a Git commit.
 *
 * NOTE: Timestamps are preserved for human inspection only.
 * They NEVER participate in semantic change identity or deterministic security scoring.
 */
export interface GitCommit {
  readonly sha: string;
  readonly abbreviatedSha: string;
  readonly subject: string;
  readonly author: string;
  readonly authorEmail?: string;
  readonly timestamp: string;
  readonly parentShas: readonly string[];
  readonly branch?: string;
}

/**
 * Options for generating a deterministic Git diff.
 */
export interface GitDiffOptions {
  readonly mode: GitComparisonMode;
  readonly baseRef?: string;
  readonly headRef?: string;
  readonly includeUntracked?: boolean;
  readonly pathFilters?: readonly string[];
  readonly detectRenames?: boolean;
}

/**
 * Result of executing a read-only Git diff against the repository.
 */
export interface GitDiffResult {
  readonly rawDiff: string;
  readonly mode: GitComparisonMode;
  readonly baseDescription: string;
  readonly headDescription: string;
  readonly filesChangedCount: number;
  readonly untrackedFiles: readonly string[];
  readonly isClean: boolean;
}

/**
 * Complete analysis result pairing local Git inspection with Phase 3.2 ingestion and Phase 3.1 bridge.
 */
export interface GitAnalysisResult {
  readonly repository: GitRepository;
  readonly comparison: GitDiffResult;
  readonly normalizedChangeSet: NormalizedChangeSet;
  readonly bridgeResult: IngestionBridgeResult;
}

/**
 * Standard output result from a controlled, read-only Git command execution.
 */
export interface GitCommandResult {
  readonly success: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly error?: string;
}

/**
 * Options passed to the safe Git command executor.
 */
export interface GitCommandOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
}

/**
 * Extensible interface for executing controlled Git commands.
 * Allows process execution in Node.js and deterministic mock execution in tests/browsers.
 */
export interface GitCommandExecutor {
  execute(args: readonly string[], options?: GitCommandOptions): GitCommandResult;
}

/**
 * Structured Git error representation.
 */
export type GitErrorCode =
  | 'NOT_A_GIT_REPO'
  | 'GIT_NOT_FOUND'
  | 'INVALID_REVISION'
  | 'AMBIGUOUS_REVISION'
  | 'WORKING_TREE_DIRTY'
  | 'EXECUTION_FAILED'
  | 'UNSAFE_ARGUMENT';

export interface GitError {
  readonly code: GitErrorCode;
  readonly message: string;
  readonly details?: string;
}
