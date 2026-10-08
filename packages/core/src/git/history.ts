import { GitCommandExecutor, GitCommit } from './types.js';
import { executeGitCommand } from './command.js';
import { validateGitRevision } from './refs.js';

export interface CommitHistoryOptions {
  readonly maxCount?: number;
  readonly ref?: string;
}

/**
 * Deterministically retrieves recent commit history from a local Git repository.
 *
 * NOTE: Commit timestamps are captured strictly for informational display.
 * They NEVER participate in semantic change identity or deterministic security scoring.
 */
export function getCommitHistory(
  repoPath: string,
  options?: CommitHistoryOptions,
  executor?: GitCommandExecutor
): GitCommit[] {
  const normPath = repoPath.replace(/\\/g, '/');
  const count = Math.max(1, Math.min(options?.maxCount ?? 20, 100));

  const args: string[] = [
    'log',
    `-n`,
    String(count),
    '--format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P',
  ];

  if (options?.ref) {
    const val = validateGitRevision(options.ref);
    if (!val.isValid || !val.sanitizedRef) {
      throw new Error(`Invalid revision for commit history: ${val.error || options.ref}`);
    }
    args.push(val.sanitizedRef);
  }

  const result = executeGitCommand(args, { cwd: normPath }, executor);
  if (!result.success || !result.stdout.trim()) {
    return [];
  }

  return parseCommitLogOutput(result.stdout);
}

/**
 * Retrieves detailed metadata for a single specific Git commit.
 */
export function getCommitMetadata(
  repoPath: string,
  ref: string,
  executor?: GitCommandExecutor
): GitCommit | null {
  const normPath = repoPath.replace(/\\/g, '/');
  const val = validateGitRevision(ref);
  if (!val.isValid || !val.sanitizedRef) {
    throw new Error(`Invalid revision for commit metadata: ${val.error || ref}`);
  }

  const args = [
    'show',
    '-s',
    '--format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P',
    val.sanitizedRef,
  ];

  const result = executeGitCommand(args, { cwd: normPath }, executor);
  if (!result.success || !result.stdout.trim()) {
    return null;
  }

  const commits = parseCommitLogOutput(result.stdout);
  return commits.length > 0 ? commits[0] : null;
}

/**
 * Parses structured git log output formatted with \x1f field delimiters.
 */
function parseCommitLogOutput(rawOutput: string): GitCommit[] {
  const lines = rawOutput.replace(/\r\n/g, '\n').split('\n');
  const commits: GitCommit[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split('\x1f');
    if (parts.length < 6) continue;

    const sha = parts[0].trim();
    const abbreviatedSha = parts[1].trim();
    const author = parts[2].trim();
    const authorEmail = parts[3].trim() || undefined;
    const timestamp = parts[4].trim();
    const subject = parts[5].trim();
    const parentShasRaw = parts[6] ? parts[6].trim() : '';
    const parentShas = parentShasRaw ? parentShasRaw.split(/\s+/).filter(Boolean) : [];

    commits.push({
      sha,
      abbreviatedSha,
      subject,
      author,
      authorEmail,
      timestamp,
      parentShas: Object.freeze(parentShas),
    });
  }

  return commits;
}
