/**
 * Types and interfaces for deterministic repository change ingestion and normalization.
 *
 * SCOPE PRINCIPLE:
 * This layer parses, normalizes, and classifies source repository / configuration diffs
 * into structured change sets and engineering signals. It does NOT claim or fabricate
 * infrastructure security posture changes; downstream Phase 3.1 change analysis remains
 * authoritative for proven security and architectural impact.
 */

/**
 * Deterministic types of file-level modifications.
 */
export type FileChangeType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED';

/**
 * Deterministic high-level engineering categories for changed files.
 */
export type FileCategory =
  | 'infrastructure'
  | 'cicd'
  | 'application'
  | 'security-config'
  | 'documentation'
  | 'tests'
  | 'dependencies'
  | 'unknown';

/**
 * Discrete engineering signal types derived from observed file changes.
 * Signals represent engineering observations, NEVER vulnerability findings.
 */
export type EngineeringSignalType =
  | 'security-config-modified'
  | 'network-exposure-modified'
  | 'authentication-modified'
  | 'authorization-modified'
  | 'encryption-modified'
  | 'secret-handling-modified'
  | 'infrastructure-manifest-modified'
  | 'dockerfile-modified'
  | 'kubernetes-manifest-modified'
  | 'terraform-modified'
  | 'network-config-modified'
  | 'service-config-modified'
  | 'cicd-workflow-modified'
  | 'cicd-security-step-modified'
  | 'tests-added'
  | 'tests-modified'
  | 'tests-deleted'
  | 'dependency-manifest-modified'
  | 'lockfile-modified';

/**
 * Category grouping for engineering signals.
 */
export type EngineeringSignalCategory =
  | 'security'
  | 'infrastructure'
  | 'cicd'
  | 'testing'
  | 'dependency';

/**
 * Structured engineering signal indicating a potentially relevant change.
 */
export interface EngineeringSignal {
  readonly id: string;
  readonly type: EngineeringSignalType;
  readonly category: EngineeringSignalCategory;
  readonly file: string;
  readonly description: string;
  readonly hint: string;
  readonly isSecuritySensitive: boolean;
}

/**
 * Single line within a unified diff hunk.
 */
export interface DiffHunkLine {
  readonly type: 'added' | 'deleted' | 'context';
  readonly content: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

/**
 * Single hunk in a unified diff.
 */
export interface DiffHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly header: string;
  readonly lines: readonly DiffHunkLine[];
}

/**
 * Normalized representation of a single file change within a repository.
 */
export interface NormalizedFileChange {
  readonly id: string;
  readonly path: string;
  readonly changeType: FileChangeType;
  readonly oldPath?: string;
  readonly newPath?: string;
  readonly linesAdded: number;
  readonly linesDeleted: number;
  readonly hunks: readonly DiffHunk[];
  readonly patch?: string;
  readonly signature: string;
  readonly category: FileCategory;
  readonly isBinary?: boolean;
}

/**
 * Summary metrics of an ingested and normalized change set.
 */
export interface ChangeIngestionSummary {
  readonly filesChanged: number;
  readonly filesAdded: number;
  readonly filesModified: number;
  readonly filesDeleted: number;
  readonly filesRenamed: number;
  readonly linesAdded: number;
  readonly linesDeleted: number;
  readonly categories: Record<FileCategory, number>;
  readonly signals: readonly EngineeringSignal[];
  readonly securitySensitiveSignalCount: number;
  readonly infrastructureSignalCount: number;
  readonly cicdSignalCount: number;
  readonly testingSignalCount: number;
  readonly dependencySignalCount: number;
  readonly unmappedCount: number;
  readonly parseWarnings: readonly string[];
  readonly parseErrors: readonly string[];
  readonly maskedSecretsCount: number;
}

/**
 * Canonical normalized change set returned by the ingestion layer.
 */
export interface NormalizedChangeSet {
  readonly sourceType: 'unified-diff' | 'structured-changes' | 'snapshot-comparison';
  readonly files: readonly NormalizedFileChange[];
  readonly signals: readonly EngineeringSignal[];
  readonly summary: ChangeIngestionSummary;
  readonly infrastructureRelevantFiles: readonly NormalizedFileChange[];
  readonly unmappedFiles: readonly NormalizedFileChange[];
}

/**
 * Source type: Unified diff text (e.g. from `git diff` or paste).
 */
export interface UnifiedDiffSource {
  readonly type: 'unified-diff';
  readonly rawDiff: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Source type: Pre-structured file change input.
 */
export interface StructuredFileChangeInput {
  readonly path: string;
  readonly changeType: FileChangeType;
  readonly oldPath?: string;
  readonly newPath?: string;
  readonly linesAdded?: number;
  readonly linesDeleted?: number;
  readonly content?: string;
  readonly isBinary?: boolean;
}

export interface StructuredChangeSetSource {
  readonly type: 'structured-changes';
  readonly files: readonly StructuredFileChangeInput[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Source type: In-memory file snapshots comparison (before vs after).
 */
export interface RepositorySnapshotSource {
  readonly type: 'snapshot-comparison';
  readonly beforeFiles: Record<string, string>;
  readonly afterFiles: Record<string, string>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Discriminated union of supported repository change sources.
 */
export type ChangeSource =
  | UnifiedDiffSource
  | StructuredChangeSetSource
  | RepositorySnapshotSource;

/**
 * Configuration options for the ingestion and normalization engine.
 */
export interface IngestionOptions {
  /**
   * Whether to mask API keys, private keys, and credential tokens.
   * Default: true
   */
  readonly maskSecrets?: boolean;

  /**
   * Maximum lines of patch to retain per hunk to prevent memory bloat.
   * Default: 500
   */
  readonly maxHunkLines?: number;
}
