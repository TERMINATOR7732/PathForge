import {
  GitAnalysisResult,
  GitCommandExecutor,
  GitDiffOptions,
  GitDiffResult,
} from './types.js';
import { executeGitCommand } from './command.js';
import { getRepositoryState } from './repository.js';
import { validateGitRevision } from './refs.js';
import { ingestRepositoryChanges } from '../change-ingestion/ingest.js';
import { bridgeToChangeAnalysis } from '../change-ingestion/mapper.js';

/**
 * Deterministically generates a unified diff for a specified comparison mode in a local Git repository.
 *
 * REUSE PRINCIPLE:
 * Git outputs standard unified diff text, which is parsed by Phase 3.2's authoritative
 * parser and normalized into structured engineering change sets.
 */
export function generateGitDiff(
  repoPath: string,
  options: GitDiffOptions,
  executor?: GitCommandExecutor
): GitDiffResult {
  const normPath = repoPath.replace(/\\/g, '/');
  const repoState = getRepositoryState(normPath, executor);

  const args: string[] = ['diff'];

  // Enable rename detection by default
  if (options.detectRenames !== false) {
    args.push('-M');
  }

  let baseDesc = 'HEAD';
  let headDesc = 'Working Tree';

  switch (options.mode) {
    case 'working-tree-vs-head':
      // Diff between committed HEAD and all working tree changes
      args.push('HEAD');
      baseDesc = `HEAD (${repoState.currentCommit.slice(0, 7) || 'initial'})`;
      headDesc = 'Working Tree';
      break;

    case 'index-vs-head':
      // Diff between committed HEAD and staged index
      args.push('--cached', 'HEAD');
      baseDesc = `HEAD (${repoState.currentCommit.slice(0, 7) || 'initial'})`;
      headDesc = 'Staged Index';
      break;

    case 'working-state-vs-head':
      // Full working state vs HEAD
      args.push('HEAD');
      baseDesc = `HEAD (${repoState.currentCommit.slice(0, 7) || 'initial'})`;
      headDesc = 'Current Working State';
      break;

    case 'commit-vs-commit': {
      const base = options.baseRef || 'HEAD~1';
      const head = options.headRef || 'HEAD';

      const baseVal = validateGitRevision(base);
      if (!baseVal.isValid || !baseVal.sanitizedRef) {
        throw new Error(`Invalid base revision: ${baseVal.error || base}`);
      }
      const headVal = validateGitRevision(head);
      if (!headVal.isValid || !headVal.sanitizedRef) {
        throw new Error(`Invalid head revision: ${headVal.error || head}`);
      }

      args.push(baseVal.sanitizedRef, headVal.sanitizedRef);
      baseDesc = `Commit ${baseVal.sanitizedRef}`;
      headDesc = `Commit ${headVal.sanitizedRef}`;
      break;
    }

    case 'branch-vs-branch': {
      const base = options.baseRef || 'main';
      const head = options.headRef || repoState.currentBranch || 'HEAD';

      const baseVal = validateGitRevision(base);
      if (!baseVal.isValid || !baseVal.sanitizedRef) {
        throw new Error(`Invalid base branch/ref: ${baseVal.error || base}`);
      }
      const headVal = validateGitRevision(head);
      if (!headVal.isValid || !headVal.sanitizedRef) {
        throw new Error(`Invalid head branch/ref: ${headVal.error || head}`);
      }

      args.push(baseVal.sanitizedRef, headVal.sanitizedRef);
      baseDesc = `Branch ${baseVal.sanitizedRef}`;
      headDesc = `Branch ${headVal.sanitizedRef}`;
      break;
    }

    default:
      throw new Error(`Unsupported Git comparison mode: ${options.mode}`);
  }

  // Apply optional path filters
  if (options.pathFilters && options.pathFilters.length > 0) {
    args.push('--');
    for (const filter of options.pathFilters) {
      args.push(filter.replace(/\\/g, '/'));
    }
  }

  const diffRes = executeGitCommand(args, { cwd: normPath }, executor);
  let rawDiff = diffRes.success ? diffRes.stdout : '';

  // Handle untracked files explicitly if requested
  if (options.includeUntracked && repoState.untrackedFiles.length > 0) {
    const untrackedDiffBlocks: string[] = [];
    for (const file of repoState.untrackedFiles) {
      // Deterministic synthetic diff entry for untracked files
      untrackedDiffBlocks.push(
        `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,1 @@\n+[untracked file: ${file}]`
      );
    }
    if (rawDiff.trim().length > 0) {
      rawDiff = `${rawDiff}\n${untrackedDiffBlocks.join('\n')}`;
    } else {
      rawDiff = untrackedDiffBlocks.join('\n');
    }
  }

  const isClean = rawDiff.trim().length === 0;

  // Count files changed in diff
  const diffLines = rawDiff.split('\n');
  const filesChangedCount = diffLines.filter((l) => l.startsWith('diff --git ')).length;

  return {
    rawDiff,
    mode: options.mode,
    baseDescription: baseDesc,
    headDescription: headDesc,
    filesChangedCount,
    untrackedFiles: repoState.untrackedFiles,
    isClean,
  };
}

/**
 * High-level coordinator: Inspects local Git repository, generates a diff,
 * normalizes changes through Phase 3.2, and prepares the Phase 3.1 analysis bridge.
 */
export function analyzeGitChanges(
  repoPath: string,
  options: GitDiffOptions,
  executor?: GitCommandExecutor
): GitAnalysisResult {
  const normPath = repoPath.replace(/\\/g, '/');
  const repository = getRepositoryState(normPath, executor);
  const comparison = generateGitDiff(normPath, options, executor);

  // Ingest via Phase 3.2
  const normalizedChangeSet = ingestRepositoryChanges(comparison.rawDiff);

  // Bridge via Phase 3.2 mapper
  const bridgeResult = bridgeToChangeAnalysis(normalizedChangeSet);

  return {
    repository,
    comparison,
    normalizedChangeSet,
    bridgeResult,
  };
}
