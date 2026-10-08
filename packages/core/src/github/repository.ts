import {
  GitHubProvider,
  GitHubRepositoryMetadata,
  GitHubRepositoryReference,
} from './types.js';

const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Validates whether a given owner string is a valid GitHub username/organization.
 */
export function isValidGitHubOwner(owner: string): boolean {
  if (!owner || typeof owner !== 'string') return false;
  const trimmed = owner.trim();
  if (trimmed.length < 1 || trimmed.length > 39) return false;
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) return false;
  if (trimmed.includes('--')) return false; // GitHub disallows consecutive hyphens in usernames
  return GITHUB_OWNER_REGEX.test(trimmed);
}

/**
 * Validates whether a given repository string is a valid GitHub repository name.
 */
export function isValidGitHubRepositoryName(repo: string): boolean {
  if (!repo || typeof repo !== 'string') return false;
  const trimmed = repo.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) return false;
  return GITHUB_REPO_REGEX.test(trimmed);
}

/**
 * Validates a repository reference structure.
 */
export function validateRepositoryReference(input: unknown): {
  isValid: boolean;
  error?: string;
  value?: GitHubRepositoryReference;
} {
  if (!input) {
    return { isValid: false, error: 'Repository reference cannot be empty' };
  }

  let owner = '';
  let repository = '';

  if (typeof input === 'string') {
    let clean = input.trim();
    if (clean.includes('\0')) {
      return { isValid: false, error: 'Repository reference cannot contain null bytes' };
    }

    // Handle full URLs like https://github.com/owner/repo or github.com/owner/repo
    clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
    clean = clean.replace(/\.git$/i, ''); // Strip trailing .git
    clean = clean.replace(/\/+$/, ''); // Strip trailing slashes

    const parts = clean.split('/');
    if (parts.length !== 2) {
      return {
        isValid: false,
        error: `Invalid repository reference '${input}'. Expected format: 'owner/repository'`,
      };
    }
    owner = parts[0].trim();
    repository = parts[1].trim();
  } else if (typeof input === 'object' && input !== null) {
    const obj = input as { owner?: unknown; repository?: unknown };
    if (typeof obj.owner !== 'string' || typeof obj.repository !== 'string') {
      return {
        isValid: false,
        error: 'Repository reference object must contain string owner and repository fields',
      };
    }
    owner = obj.owner.trim();
    repository = obj.repository.trim();
  } else {
    return { isValid: false, error: 'Invalid repository reference type' };
  }

  if (!isValidGitHubOwner(owner)) {
    return {
      isValid: false,
      error: `Invalid GitHub owner '${owner}'. Must be 1-39 alphanumeric characters or single hyphens.`,
    };
  }

  if (!isValidGitHubRepositoryName(repository)) {
    return {
      isValid: false,
      error: `Invalid GitHub repository '${repository}'. Must be 1-100 alphanumeric characters, dots, hyphens, or underscores.`,
    };
  }

  const value: GitHubRepositoryReference = Object.freeze({
    owner,
    repository,
    fullName: `${owner}/${repository}`,
  });

  return { isValid: true, value };
}

/**
 * Parses and returns a validated GitHub repository reference, throwing on error.
 */
export function parseRepositoryReference(
  input: string | { owner: string; repository: string }
): GitHubRepositoryReference {
  const result = validateRepositoryReference(input);
  if (!result.isValid || !result.value) {
    throw new Error(result.error || 'Invalid repository reference');
  }
  return result.value;
}

/**
 * Retrieves repository metadata using the provided read-only GitHub provider.
 */
export async function getRepositoryMetadata(
  ref: GitHubRepositoryReference,
  provider: GitHubProvider
): Promise<GitHubRepositoryMetadata> {
  const meta = await provider.getRepository(ref);
  if (!meta || !meta.fullName) {
    throw new Error(`Failed to retrieve repository metadata for '${ref.fullName}'`);
  }
  return Object.freeze({
    owner: meta.owner,
    repository: meta.repository,
    fullName: meta.fullName,
    defaultBranch: meta.defaultBranch || 'main',
    isPrivate: Boolean(meta.isPrivate),
    description: meta.description,
  });
}
