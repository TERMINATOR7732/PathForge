#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  deserializeEnvironment,
  analyzeAttackPaths,
  analyzeArchitecture,
  assessProductionReadiness,
  assessTestingIntelligence,
  assessTechnicalDebt,
  analyzeInfrastructureChanges,
  evaluateCiGate,
  resolveCiGatePolicy,
  formatCiGateHuman,
  formatCiGateJson,
  CiGatePolicy,
  CiGateTargetInfo,
  executeEngineeringRun,
  EngineeringRun,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
} from '@pathforge/validator';

interface ParsedCliArgs {
  command: 'gate' | 'analyze' | 'inspect' | 'help' | 'version';
  targetPath?: string;
  format: 'text' | 'json';
  policyPath?: string;
  baselinePath?: string;
  strict: boolean;
  requireBaseline: boolean;
  requireTesting: boolean;
  minReadiness?: number;
  minDebt?: number;
}

function printUsage(): void {
  console.log(`PathForge Engineering Gate CLI — Deterministic CI/CD Verification

USAGE:
  pathforge gate <environment.json> [options]
  pathforge analyze <environment.json> [options]
  pathforge inspect <environment.json> [options]

COMMANDS:
  gate       Evaluate engineering intelligence against policy and return CI exit code
  analyze    Run static intelligence analysis without policy gating (returns exit 0)
  inspect    Run unified continuous engineering workflow with full evidence matrix

OPTIONS:
  --format <text|json>       Output format (default: text)
  --policy <path>            Path to custom gate policy JSON file
  --baseline <path>          Path to baseline environment JSON for regression check
  --strict                   Strict mode: warnings are promoted to BLOCK (exit 2)
  --require-baseline         Require baseline snapshot; missing baseline produces exit 3
  --require-testing          Require testing intelligence; missing evidence produces exit 3
  --min-readiness <0-100>    Minimum production readiness score required to pass
  --min-debt <0-100>         Minimum technical debt health score required to pass
  -h, --help                 Show this help message
  -v, --version              Show PathForge version

EXIT CODES:
  0   PASS (Infrastructure verified against policy)
  1   WARN (Non-blocking warnings detected)
  2   BLOCK (Hard policy violation or critical risk detected)
  3   INSUFFICIENT_EVIDENCE (Missing target file or required baseline)
`);
}

function formatInspectHuman(run: EngineeringRun): string {
  const lines: string[] = [];
  lines.push('PATHFORGE CONTINUOUS ENGINEERING INSPECTION');
  lines.push('──────────────────────────────────────────────────────');
  lines.push(`Target:          ${run.source.identifier}`);
  lines.push(`Environment:     ${run.environmentName} (${run.environmentId})`);
  lines.push(`Status:          ${run.status}`);
  lines.push('');
  lines.push(`ENGINEERING DECISION: ${run.gateStatus}`);
  lines.push(`Composite Score:      ${run.compositeScore}/100`);
  lines.push(`Exit Code:            ${run.exitCode}`);
  lines.push('');
  lines.push('EVIDENCE MATRIX');
  lines.push('──────────────────────────────────────────────────────');
  for (const row of run.evidenceMatrix) {
    const padControl = row.control.padEnd(28, ' ');
    const padResult = row.result.padEnd(12, ' ');
    lines.push(`${padControl} ${padResult} ${row.evidence}`);
  }
  lines.push('');
  if (run.topReasons.length > 0) {
    lines.push('PRIMARY FACTORS (Why?)');
    lines.push('──────────────────────────────────────────────────────');
    for (const r of run.topReasons) {
      lines.push(`• ${r}`);
    }
    lines.push('');
  }
  lines.push('──────────────────────────────────────────────────────');
  lines.push(`Engineering Decision: ${run.gateStatus} (Exit code: ${run.exitCode})`);
  return lines.join('\n');
}

function parseArgs(args: string[]): ParsedCliArgs {
  const result: ParsedCliArgs = {
    command: 'gate',
    format: 'text',
    strict: false,
    requireBaseline: false,
    requireTesting: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.command = 'help';
      return result;
    }
    if (arg === '--version' || arg === '-v') {
      result.command = 'version';
      return result;
    }
    if (arg === '--format') {
      const next = args[++i];
      if (next === 'json' || next === 'text') {
        result.format = next;
      }
    } else if (arg === '--policy') {
      result.policyPath = args[++i];
    } else if (arg === '--baseline') {
      result.baselinePath = args[++i];
    } else if (arg === '--strict') {
      result.strict = true;
    } else if (arg === '--require-baseline') {
      result.requireBaseline = true;
    } else if (arg === '--require-testing') {
      result.requireTesting = true;
    } else if (arg === '--min-readiness') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) result.minReadiness = val;
    } else if (arg === '--min-debt') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) result.minDebt = val;
    } else if (arg === 'gate') {
      result.command = 'gate';
    } else if (arg === 'analyze') {
      result.command = 'analyze';
    } else if (arg === 'inspect') {
      result.command = 'inspect';
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    result.targetPath = positional[0];
  }

  return result;
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.command === 'help') {
    printUsage();
    return 0;
  }

  if (parsed.command === 'version') {
    console.log('PathForge v0.1.0 (Phase 3.7)');
    return 0;
  }

  const targetPath = parsed.targetPath;
  if (!targetPath) {
    if (parsed.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: 1,
            status: 'INSUFFICIENT_EVIDENCE',
            exitCode: 3,
            score: 0,
            blockingReasons: [
              {
                id: 'missing-target-arg',
                category: 'evidence',
                severity: 'critical',
                title: 'No Target Environment Provided',
                description: 'Please specify an environment file path to evaluate.',
              },
            ],
            warnings: [],
            passedControls: [],
            evidenceGaps: [],
            summary: {},
            target: { targetType: 'environment-file', identifier: 'unknown', environmentId: '', environmentName: '' },
            evaluatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } else {
      console.error('Error: No target environment file provided.');
      console.error('Usage: pathforge gate <environment.json>');
    }
    return 3;
  }

  // Verify target file existence
  const resolvedTarget = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(resolvedTarget)) {
    const errorMsg = `Environment file not found: '${targetPath}'`;
    if (parsed.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: 1,
            status: 'INSUFFICIENT_EVIDENCE',
            exitCode: 3,
            score: 0,
            blockingReasons: [
              {
                id: 'target-not-found',
                category: 'evidence',
                severity: 'critical',
                title: 'Target File Not Found',
                description: errorMsg,
              },
            ],
            warnings: [],
            passedControls: [],
            evidenceGaps: [],
            summary: {},
            target: {
              targetType: 'environment-file',
              identifier: targetPath,
              environmentId: 'unresolved',
              environmentName: 'Unresolved',
            },
            evaluatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } else {
      console.error(`Error: ${errorMsg}`);
    }
    return 3;
  }

  // Load and deserialize environment
  let envJson: string;
  try {
    envJson = fs.readFileSync(resolvedTarget, 'utf-8');
  } catch (err: any) {
    console.error(`Error: Unable to read environment file '${targetPath}': ${err.message}`);
    return 3;
  }

  let environment: any;
  try {
    environment = deserializeEnvironment(envJson);
  } catch (err: any) {
    const errorMsg = `Invalid environment schema: ${err.message}`;
    if (parsed.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: 1,
            status: 'INSUFFICIENT_EVIDENCE',
            exitCode: 3,
            score: 0,
            blockingReasons: [
              {
                id: 'deserialization-failed',
                category: 'evidence',
                severity: 'critical',
                title: 'Invalid Environment Schema',
                description: errorMsg,
              },
            ],
            warnings: [],
            passedControls: [],
            evidenceGaps: [],
            summary: {},
            target: {
              targetType: 'environment-file',
              identifier: targetPath,
              environmentId: 'invalid',
              environmentName: 'Invalid',
            },
            evaluatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } else {
      console.error(`Error: ${errorMsg}`);
    }
    return 3;
  }

  // Run deterministic intelligence pipeline
  const registry = createDefaultRuleRegistry();
  const validatorEngine = new ValidatorEngine(registry);
  const validationResult = validatorEngine.evaluate(environment);
  const attackPathAnalysis = analyzeAttackPaths(environment);
  const architectureAnalysis = analyzeArchitecture(environment);
  const productionReadiness = assessProductionReadiness(environment, {
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
  });
  const testingIntelligence = assessTestingIntelligence(environment, {
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
  });
  const technicalDebt = assessTechnicalDebt(environment, {
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
    productionReadiness,
    testingIntelligence,
  });

  // Check baseline if provided
  let changeAnalysis: any = null;
  if (parsed.baselinePath) {
    const resolvedBaseline = path.isAbsolute(parsed.baselinePath)
      ? parsed.baselinePath
      : path.resolve(process.cwd(), parsed.baselinePath);

    if (fs.existsSync(resolvedBaseline)) {
      try {
        const baseJson = fs.readFileSync(resolvedBaseline, 'utf-8');
        const baseEnv = deserializeEnvironment(baseJson);
        const baseVal = validatorEngine.evaluate(baseEnv);

        changeAnalysis = analyzeInfrastructureChanges(baseEnv, environment, {
          beforeValidationResult: baseVal,
          afterValidationResult: validationResult,
        });
      } catch (err: any) {
        console.error(`Warning: Failed to load baseline '${parsed.baselinePath}': ${err.message}`);
      }
    } else {
      console.error(`Warning: Baseline file not found: '${parsed.baselinePath}'`);
    }
  }

  // Resolve Policy
  const cliOverrides: Record<string, unknown> = {};
  if (parsed.strict) cliOverrides.allowWarnings = false;
  if (parsed.requireBaseline) cliOverrides.requireBaselineForRegression = true;
  if (parsed.requireTesting) cliOverrides.requireTestingEvidence = true;
  if (parsed.minReadiness !== undefined) cliOverrides.minReadinessScore = parsed.minReadiness;
  if (parsed.minDebt !== undefined) cliOverrides.minDebtScore = parsed.minDebt;

  const { policy, warnings: policyWarnings } = resolveCiGatePolicy({
    configPath: parsed.policyPath,
    cliOverrides: cliOverrides as Partial<CiGatePolicy>,
    workingDirectory: process.cwd(),
  });

  const targetInfo: CiGateTargetInfo = {
    targetType: 'environment-file',
    identifier: targetPath,
    environmentId: environment.id,
    environmentName: environment.name,
  };

  const gateResult = evaluateCiGate(
    {
      target: targetInfo,
      environment,
      validationResult,
      attackPathAnalysis,
      architectureAnalysis,
      productionReadiness,
      testingIntelligence,
      technicalDebt,
      changeAnalysis,
    },
    policy
  );

  if (parsed.command === 'inspect') {
    const run = executeEngineeringRun({
      environment,
      source: {
        type: 'local-git',
        identifier: targetPath,
        displayName: path.basename(targetPath),
      },
      validationResult,
      attackPathAnalysis,
      architectureAnalysis,
      productionReadiness,
      testingIntelligence,
      technicalDebt,
      changeAnalysis,
      policy,
    });

    if (parsed.format === 'json') {
      console.log(JSON.stringify(run, null, 2));
    } else {
      if (policyWarnings.length > 0) {
        for (const pw of policyWarnings) {
          console.warn(`[Policy Warning] ${pw}`);
        }
      }
      console.log(formatInspectHuman(run));
    }
    return run.exitCode;
  }

  // Output formatting
  if (parsed.format === 'json') {
    console.log(formatCiGateJson(gateResult));
  } else {
    if (policyWarnings.length > 0) {
      for (const pw of policyWarnings) {
        console.warn(`[Policy Warning] ${pw}`);
      }
    }
    console.log(formatCiGateHuman(gateResult));
  }

  if (parsed.command === 'analyze') {
    return 0;
  }

  return gateResult.exitCode;
}

// Execute if invoked directly from CLI
const isDirectRun =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('pathforge') ||
  process.argv[1]?.endsWith('index.js');

if (isDirectRun) {
  runCli().then((code) => {
    process.exit(code);
  });
}
