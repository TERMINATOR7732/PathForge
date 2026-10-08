import { GitCommandExecutor, GitRepository } from './types.js';
import { executeGitCommand } from './command.js';

export interface RepositoryDiscoveryResult {
  readonly repository: GitRepository | null;
  readonly isGitRepo: boolean;
  readonly rootPath?: string;
  readonly error?: string;
}

/**
 * Discovers if a specified directory belongs to a local Git repository.
 * Supports repository root and nested subdirectories.
 */
export function discoverRepository(
  targetPath: string,
  executor?: GitCommandExecutor
): RepositoryDiscoveryResult {
  if (!targetPath || typeof targetPath !== 'string') {
    return {
      repository: null,
      isGitRepo: false,
      error: 'Invalid or empty directory path',
    };
  }

  const result = executeGitCommand(
    ['rev-parse', '--show-toplevel'],
    { cwd: targetPath },
    executor
  );

  if (!result.success || !result.stdout.trim()) {
    const errorMsg = result.stderr.toLowerCase().includes('not a git repository')
      ? 'Not a Git repository'
      : result.stderr.trim() || 'Directory does not belong to a Git repository';
    return {
      repository: null,
      isGitRepo: false,
      error: errorMsg,
    };
  }

  const rootPath = result.stdout.trim().replace(/\\/g, '/');
  try {
    const repoState = getRepositoryState(rootPath, executor);
    return {
      repository: repoState,
      isGitRepo: true,
      rootPath,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      repository: null,
      isGitRepo: true,
      rootPath,
      error: `Failed to inspect repository state: ${message}`,
    };
  }
}

/**
 * Deterministically inspects the full state of a verified local Git repository.
 */
export function getRepositoryState(
  repoPath: string,
  executor?: GitCommandExecutor
): GitRepository {
  const normPath = repoPath.replace(/\\/g, '/');

  // 1. Current Commit SHA
  const commitRes = executeGitCommand(
    ['rev-parse', 'HEAD'],
    { cwd: normPath },
    executor
  );
  const currentCommit = commitRes.success ? commitRes.stdout.trim() : '';

  // 2. Current Branch & Detached HEAD Check
  const branchRes = executeGitCommand(
    ['branch', '--show-current'],
    { cwd: normPath },
    executor
  );

  let currentBranch: string | null = null;
  let isDetached = false;

  if (branchRes.success && branchRes.stdout.trim().length > 0) {
    currentBranch = branchRes.stdout.trim();
    isDetached = false;
  } else {
    // Branch output is empty: check if detached HEAD or unborn branch
    const symRefRes = executeGitCommand(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: normPath },
      executor
    );
    if (symRefRes.success && symRefRes.stdout.trim() === 'HEAD') {
      isDetached = true;
      currentBranch = null;
    } else if (symRefRes.success && symRefRes.stdout.trim().length > 0) {
      currentBranch = symRefRes.stdout.trim();
    }
  }

  // 3. Status inspection (staged, unstaged, untracked)
  const statusRes = executeGitCommand(
    ['status', '--porcelain=v1', '-uall'],
    { cwd: normPath },
    executor
  );

  let stagedCount = 0;
  let unstagedCount = 0;
  const untrackedFiles: string[] = [];

  if (statusRes.success && statusRes.stdout.length > 0) {
    const lines = statusRes.stdout.replace(/\r\n/g, '\n').split('\n');
    for (const line of lines) {
      if (!line || line.length < 3) continue;

      const indexStatus = line[0];
      const worktreeStatus = line[1];
      const filePath = line.slice(3).trim().replace(/\\/g, '/');

      if (line.startsWith('??')) {
        untrackedFiles.push(filePath);
      } else {
        if ('MADRC'.includes(indexStatus)) {
          stagedCount++;
        }
        if ('MADRC'.includes(worktreeStatus)) {
          unstagedCount++;
        }
      }
    }
  }

  // Sort untracked files deterministically
  untrackedFiles.sort();

  const isDirty = stagedCount > 0 || unstagedCount > 0;

  // 4. Remote Presence (boolean presence ONLY, never leaking credentials or URLs)
  const remoteRes = executeGitCommand(
    ['remote'],
    { cwd: normPath },
    executor
  );
  const remotePresence = remoteRes.success && remoteRes.stdout.trim().length > 0;

  return {
    rootPath: normPath,
    currentBranch,
    currentCommit,
    isDirty,
    stagedCount,
    unstagedCount,
    untrackedCount: untrackedFiles.length,
    untrackedFiles: Object.freeze(untrackedFiles),
    isDetached,
    remotePresence,
  };
}
