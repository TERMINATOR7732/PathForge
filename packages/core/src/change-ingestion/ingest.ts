import {
  ChangeIngestionSummary,
  ChangeSource,
  FileCategory,
  FileChangeType,
  IngestionOptions,
  NormalizedChangeSet,
  NormalizedFileChange,
  RepositorySnapshotSource,
  StructuredChangeSetSource,
  UnifiedDiffSource,
} from './types.js';
import { parseUnifiedDiff } from './parser.js';
import {
  generateFileChangeId,
  generateFileSignature,
  maskSensitiveContent,
  normalizeRepositoryPath,
} from './normalizer.js';
import { classifyFile } from './classifier.js';
import { extractEngineeringSignals } from './signals.js';
import {
  filterInfrastructureRelevantFiles,
  filterUnmappedFiles,
} from './mapper.js';

/**
 * Deterministically ingests, normalizes, and classifies repository/configuration changes.
 *
 * Accepts unified diff text, structured file changes, or before/after snapshot dictionaries.
 * Returns a canonical NormalizedChangeSet enriched with engineering signals and category summaries.
 */
export function ingestRepositoryChanges(
  source: ChangeSource | string,
  options?: IngestionOptions
): NormalizedChangeSet {
  // 1. Normalize source into internal structures
  let sourceType: 'unified-diff' | 'structured-changes' | 'snapshot-comparison' = 'unified-diff';
  let files: readonly NormalizedFileChange[] = [];
  let parseWarnings: readonly string[] = [];
  let parseErrors: readonly string[] = [];
  let maskedSecretsCount = 0;

  if (typeof source === 'string') {
    sourceType = 'unified-diff';
    const parsed = parseUnifiedDiff(source, options);
    files = parsed.files;
    parseWarnings = parsed.warnings;
    parseErrors = parsed.errors;
    maskedSecretsCount = parsed.maskedSecretsCount;
  } else if (source.type === 'unified-diff') {
    sourceType = 'unified-diff';
    const parsed = parseUnifiedDiff((source as UnifiedDiffSource).rawDiff, options);
    files = parsed.files;
    parseWarnings = parsed.warnings;
    parseErrors = parsed.errors;
    maskedSecretsCount = parsed.maskedSecretsCount;
  } else if (source.type === 'structured-changes') {
    sourceType = 'structured-changes';
    const structResult = ingestStructuredChanges(
      (source as StructuredChangeSetSource).files,
      options
    );
    files = structResult.files;
    parseWarnings = structResult.warnings;
    parseErrors = structResult.errors;
    maskedSecretsCount = structResult.maskedSecretsCount;
  } else if (source.type === 'snapshot-comparison') {
    sourceType = 'snapshot-comparison';
    const snapResult = ingestSnapshotComparison(
      source as RepositorySnapshotSource,
      options
    );
    files = snapResult.files;
    parseWarnings = snapResult.warnings;
    parseErrors = snapResult.errors;
    maskedSecretsCount = snapResult.maskedSecretsCount;
  }

  // 2. Extract deterministic engineering signals
  const signals = extractEngineeringSignals(files);

  // 3. Count categories
  const categoryCounts: Record<FileCategory, number> = {
    infrastructure: 0,
    cicd: 0,
    application: 0,
    'security-config': 0,
    documentation: 0,
    tests: 0,
    dependencies: 0,
    unknown: 0,
  };

  let filesAdded = 0;
  let filesModified = 0;
  let filesDeleted = 0;
  let filesRenamed = 0;
  let linesAdded = 0;
  let linesDeleted = 0;

  for (const f of files) {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
    if (f.changeType === 'ADDED') filesAdded++;
    else if (f.changeType === 'MODIFIED') filesModified++;
    else if (f.changeType === 'DELETED') filesDeleted++;
    else if (f.changeType === 'RENAMED') filesRenamed++;

    linesAdded += f.linesAdded;
    linesDeleted += f.linesDeleted;
  }

  // Count signals by category
  let securitySensitiveSignalCount = 0;
  let infrastructureSignalCount = 0;
  let cicdSignalCount = 0;
  let testingSignalCount = 0;
  let dependencySignalCount = 0;

  for (const s of signals) {
    if (s.isSecuritySensitive) securitySensitiveSignalCount++;
    if (s.category === 'infrastructure') infrastructureSignalCount++;
    else if (s.category === 'cicd') cicdSignalCount++;
    else if (s.category === 'testing') testingSignalCount++;
    else if (s.category === 'dependency') dependencySignalCount++;
  }

  const infrastructureRelevantFiles = Object.freeze(filterInfrastructureRelevantFiles(files));
  const unmappedFiles = Object.freeze(filterUnmappedFiles(files));

  const summary: ChangeIngestionSummary = Object.freeze({
    filesChanged: files.length,
    filesAdded,
    filesModified,
    filesDeleted,
    filesRenamed,
    linesAdded,
    linesDeleted,
    categories: Object.freeze(categoryCounts),
    signals: Object.freeze(signals),
    securitySensitiveSignalCount,
    infrastructureSignalCount,
    cicdSignalCount,
    testingSignalCount,
    dependencySignalCount,
    unmappedCount: unmappedFiles.length,
    parseWarnings: Object.freeze(parseWarnings),
    parseErrors: Object.freeze(parseErrors),
    maskedSecretsCount,
  });

  return Object.freeze({
    sourceType,
    files: Object.freeze(files),
    signals: Object.freeze(signals),
    summary,
    infrastructureRelevantFiles,
    unmappedFiles,
  });
}

function ingestStructuredChanges(
  rawInputs: readonly {
    path: string;
    changeType: FileChangeType;
    oldPath?: string;
    newPath?: string;
    linesAdded?: number;
    linesDeleted?: number;
    content?: string;
    isBinary?: boolean;
  }[],
  options?: IngestionOptions
): {
  files: readonly NormalizedFileChange[];
  warnings: readonly string[];
  errors: readonly string[];
  maskedSecretsCount: number;
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  let maskedSecretsCount = 0;
  const fileMap = new Map<string, NormalizedFileChange>();

  for (const item of rawInputs) {
    const norm = normalizeRepositoryPath(item.path);
    if (norm.error) {
      errors.push(norm.error);
      continue;
    }

    let processedContent = item.content;
    if (processedContent && options?.maskSecrets !== false) {
      const masked = maskSensitiveContent(processedContent);
      processedContent = masked.maskedText;
      maskedSecretsCount += masked.secretsCount;
    }

    const added = item.linesAdded ?? 0;
    const deleted = item.linesDeleted ?? 0;
    const category = classifyFile(norm.path);
    const id = generateFileChangeId(norm.path, item.changeType);
    const signature = generateFileSignature(
      norm.path,
      item.changeType,
      added,
      deleted,
      processedContent || ''
    );

    const change: NormalizedFileChange = {
      id,
      path: norm.path,
      changeType: item.changeType,
      oldPath: item.oldPath ? normalizeRepositoryPath(item.oldPath).path : undefined,
      newPath: item.newPath ? normalizeRepositoryPath(item.newPath).path : undefined,
      linesAdded: added,
      linesDeleted: deleted,
      hunks: [],
      patch: processedContent,
      signature,
      category,
      isBinary: item.isBinary,
    };

    fileMap.set(norm.path, Object.freeze(change));
  }

  const sortedFiles = Array.from(fileMap.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  return {
    files: Object.freeze(sortedFiles),
    warnings: Object.freeze(warnings),
    errors: Object.freeze(errors),
    maskedSecretsCount,
  };
}

function ingestSnapshotComparison(
  source: RepositorySnapshotSource,
  options?: IngestionOptions
): {
  files: readonly NormalizedFileChange[];
  warnings: readonly string[];
  errors: readonly string[];
  maskedSecretsCount: number;
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  let maskedSecretsCount = 0;
  const fileMap = new Map<string, NormalizedFileChange>();

  const allPaths = new Set([
    ...Object.keys(source.beforeFiles),
    ...Object.keys(source.afterFiles),
  ]);

  for (const rawPath of allPaths) {
    const norm = normalizeRepositoryPath(rawPath);
    if (norm.error) {
      errors.push(norm.error);
      continue;
    }

    const beforeContent = source.beforeFiles[rawPath];
    const afterContent = source.afterFiles[rawPath];

    let changeType: FileChangeType;
    let added = 0;
    let deleted = 0;
    let contentForSig = '';

    if (beforeContent === undefined && afterContent !== undefined) {
      changeType = 'ADDED';
      added = afterContent.split('\n').length;
      contentForSig = afterContent;
    } else if (beforeContent !== undefined && afterContent === undefined) {
      changeType = 'DELETED';
      deleted = beforeContent.split('\n').length;
      contentForSig = beforeContent;
    } else if (beforeContent !== afterContent) {
      changeType = 'MODIFIED';
      added = afterContent?.split('\n').length || 0;
      deleted = beforeContent?.split('\n').length || 0;
      contentForSig = afterContent || '';
    } else {
      // Unchanged file
      continue;
    }

    if (options?.maskSecrets !== false) {
      const masked = maskSensitiveContent(contentForSig);
      contentForSig = masked.maskedText;
      maskedSecretsCount += masked.secretsCount;
    }

    const category = classifyFile(norm.path);
    const id = generateFileChangeId(norm.path, changeType);
    const signature = generateFileSignature(norm.path, changeType, added, deleted, contentForSig);

    const change: NormalizedFileChange = {
      id,
      path: norm.path,
      changeType,
      linesAdded: added,
      linesDeleted: deleted,
      hunks: [],
      signature,
      category,
    };

    fileMap.set(norm.path, Object.freeze(change));
  }

  const sortedFiles = Array.from(fileMap.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  return {
    files: Object.freeze(sortedFiles),
    warnings: Object.freeze(warnings),
    errors: Object.freeze(errors),
    maskedSecretsCount,
  };
}
