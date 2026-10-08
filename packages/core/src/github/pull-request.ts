import {
  GitHubProvider,
  GitHubPullRequestReference,
  PullRequestFile,
  PullRequestFileStatus,
  PullRequestMetadata,
  PullRequestState,
} from './types.js';
import { validateRepositoryReference } from './repository.js';
import { normalizeRepositoryPath } from '../change-ingestion/normalizer.js';

/**
 * Validates a Pull Request reference.
 */
export function validatePullRequestReference(input: unknown): {
  isValid: boolean;
  error?: string;
  value?: GitHubPullRequestReference;
} {
  if (!input) {
    return { isValid: false, error: 'Pull request reference cannot be empty' };
  }

  let owner = '';
  let repository = '';
  let prNumber: number | null = null;

  if (typeof input === 'string') {
    let clean = input.trim();
    if (clean.includes('\0')) {
      return { isValid: false, error: 'Pull request reference cannot contain null bytes' };
    }

    // Handle full URLs like https://github.com/owner/repo/pull/123
    clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
    clean = clean.replace(/\/+$/, '');

    // Pattern 1: owner/repo#123
    const hashMatch = clean.match(/^([^/]+)\/([^#]+)#(\d+)$/);
    if (hashMatch) {
      owner = hashMatch[1].trim();
      repository = hashMatch[2].trim();
      prNumber = parseInt(hashMatch[3], 10);
    } else {
      // Pattern 2: owner/repo/pull/123
      const pullMatch = clean.match(/^([^/]+)\/([^/]+)\/pull\/(\d+)$/i);
      if (pullMatch) {
        owner = pullMatch[1].trim();
        repository = pullMatch[2].trim();
        prNumber = parseInt(pullMatch[3], 10);
      } else {
        return {
          isValid: false,
          error: `Invalid pull request format '${input}'. Expected 'owner/repository#number' or 'owner/repository/pull/number'`,
        };
      }
    }
  } else if (typeof input === 'object' && input !== null) {
    const obj = input as { owner?: unknown; repository?: unknown; pullRequestNumber?: unknown };
    if (typeof obj.owner !== 'string' || typeof obj.repository !== 'string') {
      return {
        isValid: false,
        error: 'Pull request reference object must specify owner and repository as strings',
      };
    }
    owner = obj.owner.trim();
    repository = obj.repository.trim();

    if (
      typeof obj.pullRequestNumber !== 'number' ||
      !Number.isInteger(obj.pullRequestNumber) ||
      obj.pullRequestNumber < 1
    ) {
      return {
        isValid: false,
        error: `Pull request number must be a positive integer, received: ${String(obj.pullRequestNumber)}`,
      };
    }
    prNumber = obj.pullRequestNumber;
  } else {
    return { isValid: false, error: 'Invalid pull request reference type' };
  }

  if (prNumber === null || !Number.isInteger(prNumber) || prNumber < 1 || isNaN(prNumber)) {
    return {
      isValid: false,
      error: `Pull request number must be a positive integer >= 1`,
    };
  }

  const repoValidation = validateRepositoryReference({ owner, repository });
  if (!repoValidation.isValid || !repoValidation.value) {
    return { isValid: false, error: repoValidation.error };
  }

  const value: GitHubPullRequestReference = Object.freeze({
    owner: repoValidation.value.owner,
    repository: repoValidation.value.repository,
    pullRequestNumber: prNumber,
    canonicalId: `${repoValidation.value.fullName}#${prNumber}`,
  });

  return { isValid: true, value };
}

/**
 * Parses and returns a validated GitHub pull request reference, throwing on error.
 */
export function parsePullRequestReference(input: unknown): GitHubPullRequestReference {
  const result = validatePullRequestReference(input);
  if (!result.isValid || !result.value) {
    throw new Error(result.error || 'Invalid pull request reference');
  }
  return result.value;
}

/**
 * Normalizes a raw PR state string into the standard PullRequestState enum.
 */
export function normalizePullRequestState(rawState: string | undefined): PullRequestState {
  if (!rawState) return 'OPEN';
  const upper = rawState.trim().toUpperCase();
  if (upper === 'MERGED') return 'MERGED';
  if (upper === 'CLOSED') return 'CLOSED';
  return 'OPEN';
}

/**
 * Normalizes raw file status into the standard PullRequestFileStatus enum.
 */
export function normalizeFileStatus(rawStatus: string | undefined): PullRequestFileStatus {
  if (!rawStatus) return 'modified';
  const lower = rawStatus.trim().toLowerCase();
  if (lower === 'added') return 'added';
  if (lower === 'deleted' || lower === 'removed') return 'deleted';
  if (lower === 'renamed') return 'renamed';
  return 'modified';
}

/**
 * Retrieves and validates Pull Request metadata using the provided provider.
 */
export async function getPullRequestMetadata(
  ref: GitHubPullRequestReference,
  provider: GitHubProvider
): Promise<PullRequestMetadata> {
  const rawMeta = await provider.getPullRequest(ref);
  if (!rawMeta || typeof rawMeta.prNumber !== 'number') {
    throw new Error(`Failed to retrieve metadata for pull request ${ref.canonicalId}`);
  }

  return Object.freeze({
    prNumber: rawMeta.prNumber,
    title: rawMeta.title || `PR #${ref.pullRequestNumber}`,
    body: rawMeta.body || null,
    author: rawMeta.author || 'unknown',
    state: normalizePullRequestState(rawMeta.state),
    isDraft: Boolean(rawMeta.isDraft),
    baseBranch: rawMeta.baseBranch || 'main',
    headBranch: rawMeta.headBranch || 'feature',
    baseSha: rawMeta.baseSha || '0000000000000000000000000000000000000000',
    headSha: rawMeta.headSha || '0000000000000000000000000000000000000000',
    createdAt: rawMeta.createdAt || new Date(0).toISOString(),
    updatedAt: rawMeta.updatedAt || new Date(0).toISOString(),
    changedFilesCount: Number.isInteger(rawMeta.changedFilesCount) ? rawMeta.changedFilesCount : 0,
    additions: Number.isInteger(rawMeta.additions) ? rawMeta.additions : 0,
    deletions: Number.isInteger(rawMeta.deletions) ? rawMeta.deletions : 0,
  });
}

/**
 * Retrieves and validates the files changed by a pull request, sorted deterministically.
 */
export async function getPullRequestFiles(
  ref: GitHubPullRequestReference,
  provider: GitHubProvider
): Promise<readonly PullRequestFile[]> {
  const rawFiles = await provider.getPullRequestFiles(ref);
  if (!Array.isArray(rawFiles)) {
    return Object.freeze([]);
  }

  const normalized: PullRequestFile[] = [];

  for (const f of rawFiles) {
    if (!f || typeof f.filename !== 'string') continue;

    const normResult = normalizeRepositoryPath(f.filename);
    const normPath = normResult.error ? f.filename.replace(/\\/g, '/').replace(/^\.\//, '') : normResult.path;
    const prevResult = f.previousFilename ? normalizeRepositoryPath(f.previousFilename) : undefined;
    const prevPath = prevResult ? (prevResult.error ? f.previousFilename?.replace(/\\/g, '') : prevResult.path) : undefined;
    const status = normalizeFileStatus(f.status);

    const isBinary =
      Boolean(f.isBinary) ||
      Boolean(f.patch && (f.patch.includes('Binary files') || f.patch.includes('GIT binary patch')));

    normalized.push(
      Object.freeze({
        filename: normPath,
        previousFilename: prevPath,
        status,
        additions: Number.isInteger(f.additions) ? f.additions : 0,
        deletions: Number.isInteger(f.deletions) ? f.deletions : 0,
        changes: Number.isInteger(f.changes) ? f.changes : (f.additions || 0) + (f.deletions || 0),
        patch: f.patch,
        isBinary,
      })
    );
  }

  // Sort deterministically by canonical filename
  normalized.sort((a, b) => a.filename.localeCompare(b.filename));

  return Object.freeze(normalized);
}
