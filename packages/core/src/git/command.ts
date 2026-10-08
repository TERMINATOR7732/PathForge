import { GitCommandExecutor, GitCommandOptions, GitCommandResult } from './types.js';

/**
 * Whitelist of permitted read-only Git subcommands.
 *
 * SAFETY MANDATE:
 * Only safe inspection commands are permitted.
 * All mutating, state-altering, or network-fetching operations are strictly forbidden.
 */
export const ALLOWED_GIT_SUBCOMMANDS = Object.freeze([
  'rev-parse',
  'status',
  'branch',
  'log',
  'diff',
  'show',
  'ls-files',
  'remote',
  'version',
] as const);

export type AllowedGitSubcommand = (typeof ALLOWED_GIT_SUBCOMMANDS)[number];

/**
 * Checks if a given Git subcommand is on the permitted read-only whitelist.
 */
export function isAllowedGitSubcommand(command: string): command is AllowedGitSubcommand {
  return (ALLOWED_GIT_SUBCOMMANDS as readonly string[]).includes(command);
}

/**
 * Validates structured Git command arguments to ensure safety.
 *
 * Rules:
 * 1. Must contain at least one argument (the subcommand).
 * 2. Subcommand must be in ALLOWED_GIT_SUBCOMMANDS.
 * 3. Arguments must not contain flag injection for shell execution (e.g. --exec, --ext-cmd).
 * 4. Must not contain null bytes or control characters.
 */
export function validateGitCommandArgs(
  args: readonly string[]
): { isValid: boolean; error?: string } {
  if (!args || args.length === 0) {
    return { isValid: false, error: 'Git command arguments cannot be empty' };
  }

  const subcommand = args[0].trim();
  if (!isAllowedGitSubcommand(subcommand)) {
    return {
      isValid: false,
      error: `Forbidden Git subcommand: '${subcommand}'. PathForge only allows read-only operations: ${ALLOWED_GIT_SUBCOMMANDS.join(', ')}`,
    };
  }

  // Dangerous flags that can invoke external commands or alter repositories
  const dangerousFlags = [
    '--exec',
    '--ext-cmd',
    '--upload-pack',
    '--receive-pack',
    '--config',
    '-c',
  ];

  for (const arg of args) {
    if (typeof arg !== 'string') {
      return { isValid: false, error: 'All Git arguments must be strings' };
    }
    if (arg.includes('\0')) {
      return { isValid: false, error: 'Git arguments cannot contain null bytes' };
    }
    const lower = arg.toLowerCase().trim();
    for (const dangerous of dangerousFlags) {
      if (lower === dangerous || lower.startsWith(`${dangerous}=`)) {
        return {
          isValid: false,
          error: `Forbidden dangerous Git flag: '${arg}'`,
        };
      }
    }
  }

  return { isValid: true };
}

interface NodeProcessLike {
  versions?: { node?: string };
  cwd?: () => string;
  getBuiltinModule?: (id: string) => unknown;
}

interface NodeGlobalLike {
  process?: NodeProcessLike;
  require?: (id: string) => unknown;
}

/**
 * Tries to safely obtain Node's child_process.spawnSync in a runtime-resilient manner.
 * If running in a web browser where child_process is not available, returns null.
 */
function getNativeNodeSpawnSync(): ((
  command: string,
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
      // 1. Try process.getBuiltinModule (Node 20+)
      if (typeof g.process.getBuiltinModule === 'function') {
        const cp = g.process.getBuiltinModule('node:child_process') as {
          spawnSync: (
            cmd: string,
            a: readonly string[],
            opts: Record<string, unknown>
          ) => {
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

      // 2. Try global require if available
      if (typeof g.require === 'function') {
        const cp = g.require('node:child_process') as {
          spawnSync: (
            cmd: string,
            a: readonly string[],
            opts: Record<string, unknown>
          ) => {
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

      // 3. Try runtime require resolver
      try {
        const reqResolver = new Function(
          'return typeof require !== "undefined" ? require : null'
        )();
        if (typeof reqResolver === 'function') {
          const cp = reqResolver('node:child_process');
          if (cp && typeof cp.spawnSync === 'function') {
            return cp.spawnSync;
          }
        }
      } catch {
        // Ignored
      }
    }
  } catch {
    // Not in Node or require not available
  }
  return null;
}

/**
 * Creates the standard Node.js Git command executor.
 * Safely executes `git` with structured arguments, no shell wrapping, and strict timeout.
 */
export function createNodeGitExecutor(): GitCommandExecutor {
  return {
    execute(args: readonly string[], options?: GitCommandOptions): GitCommandResult {
      const validation = validateGitCommandArgs(args);
      if (!validation.isValid) {
        return {
          success: false,
          stdout: '',
          stderr: validation.error || 'Invalid Git arguments',
          exitCode: 1,
          error: validation.error,
        };
      }

      const spawnSync = getNativeNodeSpawnSync();
      if (!spawnSync) {
        return {
          success: false,
          stdout: '',
          stderr:
            'Native Git process execution is unavailable in this environment (running in client/browser without Node.js child_process).',
          exitCode: 127,
          error: 'GIT_ENVIRONMENT_UNAVAILABLE',
        };
      }

      const g = globalThis as unknown as NodeGlobalLike;
      const defaultCwd = g.process?.cwd ? g.process.cwd() : '.';

      try {
        const result = spawnSync('git', args, {
          cwd: options?.cwd || defaultCwd,
          timeout: options?.timeoutMs ?? 10000,
          maxBuffer: options?.maxBufferBytes ?? 10 * 1024 * 1024,
          shell: false,
          windowsHide: true,
          encoding: 'utf-8',
        });

        if (result.error) {
          const err = result.error as { code?: string; message?: string };
          const isNotFound = err.code === 'ENOENT';
          return {
            success: false,
            stdout: '',
            stderr: isNotFound
              ? 'Git executable not found in PATH'
              : (err.message || 'Git execution error'),
            exitCode: isNotFound ? 127 : 1,
            error: isNotFound ? 'GIT_NOT_FOUND' : (err.message || 'EXECUTION_ERROR'),
          };
        }

        const stdout = typeof result.stdout === 'string' ? result.stdout : result.stdout ? String(result.stdout) : '';
        const stderr = typeof result.stderr === 'string' ? result.stderr : result.stderr ? String(result.stderr) : '';
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
          stderr: message,
          exitCode: 1,
          error: message,
        };
      }
    },
  };
}

/**
 * Creates a deterministic mock executor for unit testing and simulations.
 */
export function createMockGitExecutor(
  responses: Record<string, Partial<GitCommandResult>>
): GitCommandExecutor {
  return {
    execute(args: readonly string[]): GitCommandResult {
      const validation = validateGitCommandArgs(args);
      if (!validation.isValid) {
        return {
          success: false,
          stdout: '',
          stderr: validation.error || 'Invalid Git arguments',
          exitCode: 1,
          error: validation.error,
        };
      }

      const key = args.join(' ');
      const match = responses[key];

      if (!match) {
        return {
          success: false,
          stdout: '',
          stderr: `Mock executor: no response registered for 'git ${key}'`,
          exitCode: 1,
        };
      }

      return {
        success: match.success ?? (match.exitCode === undefined || match.exitCode === 0),
        stdout: match.stdout ?? '',
        stderr: match.stderr ?? '',
        exitCode: match.exitCode ?? 0,
        error: match.error,
      };
    },
  };
}

// Default singleton instance
let defaultExecutor: GitCommandExecutor | null = null;

export function getDefaultGitExecutor(): GitCommandExecutor {
  if (!defaultExecutor) {
    defaultExecutor = createNodeGitExecutor();
  }
  return defaultExecutor;
}

export function setDefaultGitExecutor(executor: GitCommandExecutor | null): void {
  defaultExecutor = executor;
}

/**
 * Executes a controlled read-only Git command.
 */
export function executeGitCommand(
  args: readonly string[],
  options?: GitCommandOptions,
  customExecutor?: GitCommandExecutor
): GitCommandResult {
  const executor = customExecutor || getDefaultGitExecutor();
  return executor.execute(args, options);
}
