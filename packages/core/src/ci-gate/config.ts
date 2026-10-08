import { CiGatePolicy } from './types.js';
import { DEFAULT_CI_GATE_POLICY, validateCiGatePolicy, mergeCiGatePolicy } from './policy.js';

// Safe dynamic access to Node builtins without breaking Vite browser bundling
function getNodeBuiltin<T>(moduleName: string): T | null {
  try {
    const proc = (globalThis as any).process;
    if (proc && typeof proc.getBuiltinModule === 'function') {
      return proc.getBuiltinModule(moduleName);
    }
    if (typeof (globalThis as any).require === 'function') {
      return (globalThis as any).require(moduleName);
    }
    const createReq = (globalThis as any).createRequire;
    if (typeof createReq === 'function') {
      const req = createReq(import.meta.url);
      return req(moduleName);
    }
  } catch {
    // runtime does not support Node modules
  }
  return null;
}

export interface ResolvePolicyOptions {
  configPath?: string;
  cliOverrides?: Partial<CiGatePolicy>;
  workingDirectory?: string;
}

export interface ResolvedPolicyResult {
  policy: CiGatePolicy;
  source: 'built-in-default' | 'config-file' | 'cli-overridden';
  configFilePath?: string;
  warnings: string[];
}

/**
 * Resolves CI gate policy applying deterministic precedence:
 * Built-in Defaults → Configuration File (.pathforge/gate.json) → CLI Overrides.
 */
export function resolveCiGatePolicy(options: ResolvePolicyOptions = {}): ResolvedPolicyResult {
  const defaultCwd =
    typeof (globalThis as any).process?.cwd === 'function' ? (globalThis as any).process.cwd() : '.';
  const { configPath, cliOverrides, workingDirectory = defaultCwd } = options;
  const warnings: string[] = [];

  let activePolicy = { ...DEFAULT_CI_GATE_POLICY };
  let source: 'built-in-default' | 'config-file' | 'cli-overridden' = 'built-in-default';
  let resolvedConfigPath: string | undefined;

  const fs = getNodeBuiltin<any>('node:fs') || getNodeBuiltin<any>('fs');
  const path = getNodeBuiltin<any>('node:path') || getNodeBuiltin<any>('path');

  if (fs && path) {
    // Determine target config path: explicit path or default .pathforge/gate.json
    const candidatePath = configPath
      ? (path.isAbsolute(configPath) ? configPath : path.resolve(workingDirectory, configPath))
      : path.resolve(workingDirectory, '.pathforge', 'gate.json');

    if (fs.existsSync(candidatePath)) {
      try {
        const fileContent = fs.readFileSync(candidatePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        const valRes = validateCiGatePolicy(parsed);

        if (!valRes.valid) {
          warnings.push(
            `Invalid policy configuration in '${candidatePath}': ${valRes.errors.join('; ')}. Using defaults.`
          );
        } else if (valRes.policy) {
          activePolicy = valRes.policy;
          source = 'config-file';
          resolvedConfigPath = candidatePath;
        }
      } catch (err: any) {
        warnings.push(`Failed to read policy configuration file '${candidatePath}': ${err.message}`);
      }
    } else if (configPath) {
      warnings.push(`Specified policy configuration file not found: '${candidatePath}'`);
    }
  }

  // Apply CLI overrides if present
  if (cliOverrides && Object.keys(cliOverrides).length > 0) {
    activePolicy = mergeCiGatePolicy(activePolicy, cliOverrides);
    source = 'cli-overridden';
  }

  return {
    policy: activePolicy,
    source,
    configFilePath: resolvedConfigPath,
    warnings,
  };
}
