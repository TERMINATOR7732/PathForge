import {
  GitHubError,
  GitHubProvider,
  GitHubPullRequestReference,
  GitHubRepositoryMetadata,
  GitHubRepositoryReference,
  PullRequestFile,
  PullRequestMetadata,
} from './types.js';

/**
 * Sanitizes any sensitive tokens or authorization secrets from error messages.
 *
 * SAFETY PRINCIPLE:
 * Error strings must never leak OAuth tokens, PATs, bearer headers, or credentials.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';

  return message
    .replace(/(ghp_[a-zA-Z0-9]{36})/g, '[REDACTED_GH_TOKEN]')
    .replace(/(gho_[a-zA-Z0-9]{36})/g, '[REDACTED_GH_TOKEN]')
    .replace(/(github_pat_[a-zA-Z0-9_]{50,})/g, '[REDACTED_GH_TOKEN]')
    .replace(/(Bearer\s+[a-zA-Z0-9._-]+)/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/(token\s+[a-zA-Z0-9._-]+)/gi, 'token [REDACTED_TOKEN]')
    .replace(/(sk-[a-zA-Z0-9_-]{20,})/g, '[REDACTED_SECRET]')
    .replace(/(AKIA[0-9A-Z]{16})/g, '[REDACTED_AWS_KEY]');
}

/**
 * Deterministic in-memory mock GitHub provider for testing, simulations, and browser demo.
 *
 * MANDATE:
 * Operates 100% offline with zero external network connectivity.
 * Implements ONLY read operations.
 */
export class MockGitHubProvider implements GitHubProvider {
  private readonly repositories = new Map<string, GitHubRepositoryMetadata>();
  private readonly pullRequests = new Map<string, PullRequestMetadata>();
  private readonly files = new Map<string, readonly PullRequestFile[]>();
  private readonly diffs = new Map<string, string>();
  private readonly errors = new Map<string, GitHubError>();

  /**
   * Registers a mock repository.
   */
  registerRepository(meta: GitHubRepositoryMetadata): this {
    const key = `${meta.owner.toLowerCase()}/${meta.repository.toLowerCase()}`;
    this.repositories.set(key, Object.freeze({ ...meta }));
    return this;
  }

  /**
   * Registers a mock pull request along with files and unified diff.
   */
  registerPullRequest(
    ref: { owner: string; repository: string; pullRequestNumber: number },
    meta: PullRequestMetadata,
    files: readonly PullRequestFile[] = [],
    diff = ''
  ): this {
    const key = `${ref.owner.toLowerCase()}/${ref.repository.toLowerCase()}#${ref.pullRequestNumber}`;
    this.pullRequests.set(key, Object.freeze({ ...meta }));
    this.files.set(key, Object.freeze([...files]));
    this.diffs.set(key, diff);
    return this;
  }

  /**
   * Simulates an error condition for a specific repository or pull request.
   */
  registerError(target: string, error: GitHubError): this {
    this.errors.set(target.toLowerCase(), error);
    return this;
  }

  async getRepository(ref: GitHubRepositoryReference): Promise<GitHubRepositoryMetadata> {
    const key = ref.fullName.toLowerCase();
    const error = this.errors.get(key);
    if (error) {
      throw new Error(`[${error.code}] ${sanitizeErrorMessage(error.message)}`);
    }

    const repo = this.repositories.get(key);
    if (!repo) {
      throw new Error(
        `[REPOSITORY_NOT_FOUND] Repository '${ref.fullName}' was not found in mock provider`
      );
    }
    return repo;
  }

  async getPullRequest(ref: GitHubPullRequestReference): Promise<PullRequestMetadata> {
    const key = ref.canonicalId.toLowerCase();
    const repoKey = `${ref.owner.toLowerCase()}/${ref.repository.toLowerCase()}`;

    const error = this.errors.get(key) || this.errors.get(repoKey);
    if (error) {
      throw new Error(`[${error.code}] ${sanitizeErrorMessage(error.message)}`);
    }

    const pr = this.pullRequests.get(key);
    if (!pr) {
      throw new Error(
        `[PR_NOT_FOUND] Pull request #${ref.pullRequestNumber} in '${ref.owner}/${ref.repository}' was not found`
      );
    }
    return pr;
  }

  async getPullRequestFiles(
    ref: GitHubPullRequestReference
  ): Promise<readonly PullRequestFile[]> {
    const key = ref.canonicalId.toLowerCase();
    const repoKey = `${ref.owner.toLowerCase()}/${ref.repository.toLowerCase()}`;

    const error = this.errors.get(key) || this.errors.get(repoKey);
    if (error) {
      throw new Error(`[${error.code}] ${sanitizeErrorMessage(error.message)}`);
    }

    const f = this.files.get(key);
    return f || Object.freeze([]);
  }

  async getPullRequestDiff(ref: GitHubPullRequestReference): Promise<string> {
    const key = ref.canonicalId.toLowerCase();
    const repoKey = `${ref.owner.toLowerCase()}/${ref.repository.toLowerCase()}`;

    const error = this.errors.get(key) || this.errors.get(repoKey);
    if (error) {
      throw new Error(`[${error.code}] ${sanitizeErrorMessage(error.message)}`);
    }

    return this.diffs.get(key) || '';
  }
}

/**
 * Creates an instance of MockGitHubProvider.
 */
export function createMockGitHubProvider(): MockGitHubProvider {
  return new MockGitHubProvider();
}

interface NodeProcessLike {
  versions?: { node?: string };
  getBuiltinModule?: (id: string) => unknown;
}

interface NodeGlobalLike {
  process?: NodeProcessLike;
  require?: (id: string) => unknown;
}

/**
 * Safely resolves Node's child_process.spawnSync if available.
 */
function getNativeSpawnSync(): ((
  cmd: string,
  args: readonly string[],
  options: Record<string, unknown>
) => {
  stdout: string | Uint8Array | null;
  stderr: string | Uint8Array | null;
  status: number | null;
  error?: Error;
}) | null {
  try {
    const g = globalThis as unknown as NodeGlobalLike;
    if (g.process && g.process.versions && Boolean(g.process.versions.node)) {
      if (typeof g.process.getBuiltinModule === 'function') {
        const cp = g.process.getBuiltinModule('node:child_process') as {
          spawnSync: (cmd: string, a: readonly string[], opts: Record<string, unknown>) => {
            stdout: string | Uint8Array | null;
            stderr: string | Uint8Array | null;
            status: number | null;
            error?: Error;
          };
        };
        if (cp && typeof cp.spawnSync === 'function') {
          return cp.spawnSync;
        }
      }

      if (typeof g.require === 'function') {
        const cp = g.require('node:child_process') as {
          spawnSync: (cmd: string, a: readonly string[], opts: Record<string, unknown>) => {
            stdout: string | Uint8Array | null;
            stderr: string | Uint8Array | null;
            status: number | null;
            error?: Error;
          };
        };
        if (cp && typeof cp.spawnSync === 'function') {
          return cp.spawnSync;
        }
      }
    }
  } catch {
    // Not running in Node.js
  }
  return null;
}

/**
 * System GitHub CLI (`gh`) provider for read-only repository and PR inspection.
 *
 * SAFETY MANDATE:
 * - Only read subcommands (`repo view`, `pr view`, `pr diff`) are executed.
 * - Does not accept, log, or persist user tokens.
 * - Non-shell execution prevents command injection.
 */
export class SystemGitHubCliProvider implements GitHubProvider {
  private executeGhCommand(args: readonly string[]): {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    const spawnSync = getNativeSpawnSync();
    if (!spawnSync) {
      return {
        success: false,
        stdout: '',
        stderr: 'GitHub CLI execution is unavailable in this environment (running in client/browser without Node.js child_process).',
        exitCode: 127,
      };
    }

    try {
      const result = spawnSync('gh', args, {
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
        shell: false,
        windowsHide: true,
        encoding: 'utf-8',
      });

      if (result.error) {
        const isNotFound = (result.error as { code?: string }).code === 'ENOENT';
        return {
          success: false,
          stdout: '',
          stderr: isNotFound
            ? 'GitHub CLI (gh) not found in PATH'
            : sanitizeErrorMessage(result.error.message || 'CLI execution error'),
          exitCode: isNotFound ? 127 : 1,
        };
      }

      const stdout = typeof result.stdout === 'string' ? result.stdout : '';
      const stderr = typeof result.stderr === 'string' ? sanitizeErrorMessage(result.stderr) : '';
      const exitCode = result.status ?? (stderr ? 1 : 0);

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        stdout: '',
        stderr: sanitizeErrorMessage(message),
        exitCode: 1,
      };
    }
  }

  async getRepository(ref: GitHubRepositoryReference): Promise<GitHubRepositoryMetadata> {
    const res = this.executeGhCommand([
      'repo',
      'view',
      ref.fullName,
      '--json',
      'nameWithOwner,defaultBranchRef,isPrivate,description',
    ]);

    if (!res.success) {
      const lower = res.stderr.toLowerCase();
      if (lower.includes('could not resolve to a repository') || lower.includes('not found')) {
        throw new Error(`[REPOSITORY_NOT_FOUND] Repository '${ref.fullName}' not found`);
      }
      if (lower.includes('authentication') || lower.includes('logged in')) {
        throw new Error(`[AUTH_UNAVAILABLE] GitHub authentication unavailable: ${res.stderr}`);
      }
      throw new Error(`[API_UNAVAILABLE] Failed to retrieve repository: ${res.stderr}`);
    }

    try {
      const data = JSON.parse(res.stdout);
      return Object.freeze({
        owner: ref.owner,
        repository: ref.repository,
        fullName: data.nameWithOwner || ref.fullName,
        defaultBranch: data.defaultBranchRef?.name || 'main',
        isPrivate: Boolean(data.isPrivate),
        description: data.description || undefined,
      });
    } catch {
      throw new Error('[MALFORMED_RESPONSE] Failed to parse repository JSON from GitHub CLI');
    }
  }

  async getPullRequest(ref: GitHubPullRequestReference): Promise<PullRequestMetadata> {
    const res = this.executeGhCommand([
      'pr',
      'view',
      String(ref.pullRequestNumber),
      '--repo',
      `${ref.owner}/${ref.repository}`,
      '--json',
      'number,title,body,author,state,isDraft,baseRefName,headRefName,baseRefOid,headRefOid,createdAt,updatedAt,changedFiles,additions,deletions',
    ]);

    if (!res.success) {
      const lower = res.stderr.toLowerCase();
      if (lower.includes('could not resolve to a pullrequest') || lower.includes('not found')) {
        throw new Error(
          `[PR_NOT_FOUND] Pull request #${ref.pullRequestNumber} in '${ref.owner}/${ref.repository}' not found`
        );
      }
      if (lower.includes('rate limit')) {
        throw new Error(`[RATE_LIMITED] GitHub API rate limit exceeded: ${res.stderr}`);
      }
      throw new Error(`[API_UNAVAILABLE] Failed to retrieve pull request: ${res.stderr}`);
    }

    try {
      const data = JSON.parse(res.stdout);
      return Object.freeze({
        prNumber: data.number || ref.pullRequestNumber,
        title: data.title || '',
        body: data.body || null,
        author: data.author?.login || 'unknown',
        state: (data.state as 'OPEN' | 'CLOSED' | 'MERGED') || 'OPEN',
        isDraft: Boolean(data.isDraft),
        baseBranch: data.baseRefName || 'main',
        headBranch: data.headRefName || 'feature',
        baseSha: data.baseRefOid || '0000000000000000000000000000000000000000',
        headSha: data.headRefOid || '0000000000000000000000000000000000000000',
        createdAt: data.createdAt || new Date(0).toISOString(),
        updatedAt: data.updatedAt || new Date(0).toISOString(),
        changedFilesCount: Number(data.changedFiles) || 0,
        additions: Number(data.additions) || 0,
        deletions: Number(data.deletions) || 0,
      });
    } catch {
      throw new Error('[MALFORMED_RESPONSE] Failed to parse pull request JSON from GitHub CLI');
    }
  }

  async getPullRequestFiles(
    ref: GitHubPullRequestReference
  ): Promise<readonly PullRequestFile[]> {
    const res = this.executeGhCommand([
      'pr',
      'view',
      String(ref.pullRequestNumber),
      '--repo',
      `${ref.owner}/${ref.repository}`,
      '--json',
      'files',
    ]);

    if (!res.success) {
      return Object.freeze([]);
    }

    try {
      const data = JSON.parse(res.stdout);
      const filesArray = Array.isArray(data.files) ? data.files : [];
      return filesArray.map((f: { path: string; additions?: number; deletions?: number }) =>
        Object.freeze({
          filename: f.path,
          status: 'modified' as const,
          additions: Number(f.additions) || 0,
          deletions: Number(f.deletions) || 0,
          changes: (Number(f.additions) || 0) + (Number(f.deletions) || 0),
          isBinary: false,
        })
      );
    } catch {
      return Object.freeze([]);
    }
  }

  async getPullRequestDiff(ref: GitHubPullRequestReference): Promise<string> {
    const res = this.executeGhCommand([
      'pr',
      'diff',
      String(ref.pullRequestNumber),
      '--repo',
      `${ref.owner}/${ref.repository}`,
    ]);

    if (!res.success) {
      throw new Error(`[PATCH_UNAVAILABLE] Failed to retrieve pull request diff: ${res.stderr}`);
    }

    return res.stdout;
  }
}

/**
 * Creates an instance of SystemGitHubCliProvider.
 */
export function createSystemGitHubCliProvider(): SystemGitHubCliProvider {
  return new SystemGitHubCliProvider();
}

let defaultProvider: GitHubProvider | null = null;

export function getDefaultGitHubProvider(): GitHubProvider {
  if (!defaultProvider) {
    defaultProvider = createSystemGitHubCliProvider();
  }
  return defaultProvider;
}

export function setDefaultGitHubProvider(provider: GitHubProvider | null): void {
  defaultProvider = provider;
}
