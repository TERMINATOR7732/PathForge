import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  Environment,
  instantiateScenario,
  getDefaultScenario,
  analyzeAttackPaths,
  analyzeArchitecture,
  assessProductionReadiness,
  assessTestingIntelligence,
  assessTechnicalDebt,
  evaluateCiGate,
  DEFAULT_CI_GATE_POLICY,
  validateCiGatePolicy,
  mergeCiGatePolicy,
  resolveCiGatePolicy,
  formatCiGateHuman,
  formatCiGateJson,
  statusToExitCode,
  exitCodeToStatus,
  CiGatePolicy,
  deserializeEnvironment,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
} from '@pathforge/validator';
import { runCli } from '../apps/cli/src/index.js';

describe('Phase 3.6 — CI/CD Engineering Gates & Automated Verification', () => {
  let validatorEngine: ValidatorEngine;
  let standardEnv: Environment;
  let tempDir: string;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    validatorEngine = new ValidatorEngine(registry);
    standardEnv = instantiateScenario(getDefaultScenario().id);
    tempDir = path.join(
      os.tmpdir(),
      `pathforge-ci-gate-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  });

  // ==========================================
  // 1. Policy Models, Validation & Precedence
  // ==========================================
  describe('Gate Policy Model & Configuration', () => {
    it('1. provides conservative default policy settings', () => {
      expect(DEFAULT_CI_GATE_POLICY.blockOnCriticalFindings).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.blockOnHighRiskAttackPaths).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.blockOnReadinessNotReady).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.blockOnArchitectureCritical).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.blockOnCriticalTechnicalDebt).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.blockOnRegressions).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.warnOnHighFindings).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.allowWarnings).toBe(true);
      expect(DEFAULT_CI_GATE_POLICY.minReadinessScore).toBe(60);
      expect(DEFAULT_CI_GATE_POLICY.minDebtScore).toBe(40);
      expect(DEFAULT_CI_GATE_POLICY.maxCriticalFindingsAllowed).toBe(0);
    });

    it('2. validates a valid custom policy successfully', () => {
      const custom = {
        blockOnCriticalFindings: true,
        allowWarnings: false,
        minReadinessScore: 75,
      };
      const res = validateCiGatePolicy(custom);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.policy?.allowWarnings).toBe(false);
      expect(res.policy?.minReadinessScore).toBe(75);
      expect(res.policy?.blockOnCriticalFindings).toBe(true);
    });

    it('3. rejects invalid policy fields with descriptive errors', () => {
      const invalid = {
        blockOnCriticalFindings: 'yes', // should be boolean
        minReadinessScore: 150,        // should be 0-100
        maxCriticalFindingsAllowed: -2, // should be non-negative integer
      };
      const res = validateCiGatePolicy(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(3);
      expect(res.errors.some((e) => e.includes('blockOnCriticalFindings'))).toBe(true);
      expect(res.errors.some((e) => e.includes('minReadinessScore'))).toBe(true);
      expect(res.errors.some((e) => e.includes('maxCriticalFindingsAllowed'))).toBe(true);
    });

    it('4. rejects non-object inputs', () => {
      expect(validateCiGatePolicy(null).valid).toBe(false);
      expect(validateCiGatePolicy('string').valid).toBe(false);
      expect(validateCiGatePolicy([1, 2, 3]).valid).toBe(false);
    });

    it('5. merges policy overrides cleanly', () => {
      const merged = mergeCiGatePolicy(DEFAULT_CI_GATE_POLICY, {
        allowWarnings: false,
        minReadinessScore: 80,
      });
      expect(merged.allowWarnings).toBe(false);
      expect(merged.minReadinessScore).toBe(80);
      expect(merged.blockOnCriticalFindings).toBe(true); // preserved
    });

    it('6. resolves policy file with proper precedence: Defaults → File → CLI', () => {
      const policyFilePath = path.join(tempDir, 'gate.json');
      fs.writeFileSync(
        policyFilePath,
        JSON.stringify({
          minReadinessScore: 70,
          allowWarnings: true,
        })
      );

      // 1. Without overrides -> loads from file
      const fromFile = resolveCiGatePolicy({
        configPath: policyFilePath,
        workingDirectory: tempDir,
      });
      expect(fromFile.source).toBe('config-file');
      expect(fromFile.policy.minReadinessScore).toBe(70);
      expect(fromFile.policy.allowWarnings).toBe(true);

      // 2. With CLI overrides -> overrides file settings
      const overridden = resolveCiGatePolicy({
        configPath: policyFilePath,
        cliOverrides: { allowWarnings: false, minReadinessScore: 85 },
        workingDirectory: tempDir,
      });
      expect(overridden.source).toBe('cli-overridden');
      expect(overridden.policy.allowWarnings).toBe(false);
      expect(overridden.policy.minReadinessScore).toBe(85);
    });

    it('7. falls back to defaults when config file is missing or invalid', () => {
      const missing = resolveCiGatePolicy({
        configPath: path.join(tempDir, 'nonexistent-gate.json'),
        workingDirectory: tempDir,
      });
      expect(missing.source).toBe('built-in-default');
      expect(missing.warnings.length).toBeGreaterThan(0);
      expect(missing.policy).toEqual(DEFAULT_CI_GATE_POLICY);
    });
  });

  // ==========================================
  // 2. Exit Code & Status Mapping Contracts
  // ==========================================
  describe('Exit Code & Status Contracts', () => {
    it('8. adheres strictly to the defined exit code contract', () => {
      expect(statusToExitCode('PASS')).toBe(0);
      expect(statusToExitCode('WARN')).toBe(1);
      expect(statusToExitCode('BLOCK')).toBe(2);
      expect(statusToExitCode('INSUFFICIENT_EVIDENCE')).toBe(3);

      expect(exitCodeToStatus(0)).toBe('PASS');
      expect(exitCodeToStatus(1)).toBe('WARN');
      expect(exitCodeToStatus(2)).toBe('BLOCK');
      expect(exitCodeToStatus(3)).toBe('INSUFFICIENT_EVIDENCE');
      expect(exitCodeToStatus(99)).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  // ==========================================
  // 3. Deterministic Gate Evaluation
  // ==========================================
  describe('Deterministic Evaluator (evaluateCiGate)', () => {
    it('9. evaluates standard environment to PASS or WARN based on policy', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const attack = analyzeAttackPaths(standardEnv);
      const arch = analyzeArchitecture(standardEnv);
      const ready = assessProductionReadiness(standardEnv, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });
      const testIntel = assessTestingIntelligence(standardEnv, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });
      const debt = assessTechnicalDebt(standardEnv, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
        productionReadiness: ready,
        testingIntelligence: testIntel,
      });

      // Default policy allows warnings -> returns WARN (exit 1) due to operational readiness warnings
      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'standard-web-app',
          environmentId: standardEnv.id,
          environmentName: standardEnv.name,
        },
        environment: standardEnv,
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
        productionReadiness: ready,
        testingIntelligence: testIntel,
        technicalDebt: debt,
      });

      expect(res.status).toBe('WARN');
      expect(res.exitCode).toBe(1);
      expect(res.blockingReasons).toHaveLength(0);
      expect(res.warnings.length).toBeGreaterThan(0);
      expect(res.passedControls.length).toBeGreaterThan(0);
      expect(res.score).toBeGreaterThanOrEqual(80);
    });

    it('10. promotes warnings to BLOCK (exit 2) under strict mode (allowWarnings: false)', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const attack = analyzeAttackPaths(standardEnv);
      const arch = analyzeArchitecture(standardEnv);
      const ready = assessProductionReadiness(standardEnv, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });

      const strictPolicy: CiGatePolicy = {
        ...DEFAULT_CI_GATE_POLICY,
        allowWarnings: false,
      };

      const res = evaluateCiGate(
        {
          target: {
            targetType: 'scenario',
            identifier: 'standard-web-app',
            environmentId: standardEnv.id,
            environmentName: standardEnv.name,
          },
          environment: standardEnv,
          validationResult: val,
          attackPathAnalysis: attack,
          architectureAnalysis: arch,
          productionReadiness: ready,
        },
        strictPolicy
      );

      expect(res.status).toBe('BLOCK');
      expect(res.exitCode).toBe(2);
      expect(res.warnings.length).toBeGreaterThan(0);
    });

    it('11. returns PASS (exit 0) when all warning triggers are satisfied or disabled', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const attack = analyzeAttackPaths(standardEnv);
      const arch = analyzeArchitecture(standardEnv);

      const permissivePolicy: CiGatePolicy = {
        ...DEFAULT_CI_GATE_POLICY,
        warnOnHighFindings: false,
        warnOnModerateAttackPaths: false,
        warnOnReadinessWarnings: false,
        warnOnElevatedTechnicalDebt: false,
      };

      const res = evaluateCiGate(
        {
          target: {
            targetType: 'scenario',
            identifier: 'standard-web-app',
            environmentId: standardEnv.id,
            environmentName: standardEnv.name,
          },
          environment: standardEnv,
          validationResult: val,
          attackPathAnalysis: attack,
          architectureAnalysis: arch,
        },
        permissivePolicy
      );

      expect(res.status).toBe('PASS');
      expect(res.exitCode).toBe(0);
      expect(res.blockingReasons).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });

    it('12. blocks with exit code 2 when critical security findings exist', () => {
      const chaosEnv = instantiateScenario('chaos-lab');
      const val = validatorEngine.evaluate(chaosEnv);
      const attack = analyzeAttackPaths(chaosEnv);

      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'chaos-lab',
          environmentId: chaosEnv.id,
          environmentName: chaosEnv.name,
        },
        environment: chaosEnv,
        validationResult: val,
        attackPathAnalysis: attack,
      });

      expect(res.status).toBe('BLOCK');
      expect(res.exitCode).toBe(2);
      expect(
        res.blockingReasons.some((r) => r.category === 'security' && r.severity === 'critical')
      ).toBe(true);
    });

    it('13. blocks with exit code 2 when critical attack paths exist', () => {
      const chaosEnv = instantiateScenario('chaos-lab');
      const val = validatorEngine.evaluate(chaosEnv);
      const attack = analyzeAttackPaths(chaosEnv);

      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'chaos-lab',
          environmentId: chaosEnv.id,
          environmentName: chaosEnv.name,
        },
        environment: chaosEnv,
        validationResult: val,
        attackPathAnalysis: attack,
      });

      expect(
        res.blockingReasons.some((r) => r.category === 'attack-exposure' && r.severity === 'critical')
      ).toBe(true);
    });

    it('14. blocks when readiness score is below configured minimum threshold', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const attack = analyzeAttackPaths(standardEnv);
      const arch = analyzeArchitecture(standardEnv);
      const ready = assessProductionReadiness(standardEnv, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });

      const highThresholdPolicy: CiGatePolicy = {
        ...DEFAULT_CI_GATE_POLICY,
        minReadinessScore: 99, // standard env is ~91
      };

      const res = evaluateCiGate(
        {
          target: {
            targetType: 'scenario',
            identifier: 'standard-web-app',
            environmentId: standardEnv.id,
            environmentName: standardEnv.name,
          },
          environment: standardEnv,
          validationResult: val,
          attackPathAnalysis: attack,
          architectureAnalysis: arch,
          productionReadiness: ready,
        },
        highThresholdPolicy
      );

      expect(res.status).toBe('BLOCK');
      expect(res.exitCode).toBe(2);
      expect(res.blockingReasons.some((r) => r.id === 'block-readiness-score-threshold')).toBe(true);
    });

    it('15. returns INSUFFICIENT_EVIDENCE (exit 3) when baseline is required but missing', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const policy: CiGatePolicy = {
        ...DEFAULT_CI_GATE_POLICY,
        requireBaselineForRegression: true,
      };

      const res = evaluateCiGate(
        {
          target: {
            targetType: 'scenario',
            identifier: 'standard-web-app',
            environmentId: standardEnv.id,
            environmentName: standardEnv.name,
          },
          environment: standardEnv,
          validationResult: val,
        },
        policy
      );

      expect(res.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(res.exitCode).toBe(3);
      expect(res.blockingReasons.some((r) => r.id === 'missing-baseline-evidence')).toBe(true);
    });

    it('16. returns INSUFFICIENT_EVIDENCE (exit 3) when testing evidence is required but missing', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const policy: CiGatePolicy = {
        ...DEFAULT_CI_GATE_POLICY,
        requireTestingEvidence: true,
      };

      const res = evaluateCiGate(
        {
          target: {
            targetType: 'scenario',
            identifier: 'standard-web-app',
            environmentId: standardEnv.id,
            environmentName: standardEnv.name,
          },
          environment: standardEnv,
          validationResult: val,
          testingIntelligence: null,
        },
        policy
      );

      expect(res.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(res.exitCode).toBe(3);
      expect(res.blockingReasons.some((r) => r.id === 'missing-testing-evidence')).toBe(true);
    });

    it('17. blocks when proven security regression is provided via historical comparison', () => {
      const val = validatorEngine.evaluate(standardEnv);

      const fakeDegradedComparison: any = {
        baselineRecordId: 'base-1',
        currentRecordId: 'curr-1',
        verdict: 'ENGINEERING_POSTURE_DEGRADED',
        verdictExplanation: 'Critical findings increased and 2 new attack paths opened.',
      };

      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'standard-web-app',
          environmentId: standardEnv.id,
          environmentName: standardEnv.name,
        },
        environment: standardEnv,
        validationResult: val,
        historicalComparison: fakeDegradedComparison,
      });

      expect(res.status).toBe('BLOCK');
      expect(res.exitCode).toBe(2);
      expect(res.blockingReasons.some((r) => r.id === 'block-security-regression')).toBe(true);
    });

    it('18. truthfulness: code-only signals without proven topology delta do not block on regression', () => {
      const val = validatorEngine.evaluate(standardEnv);

      // Normal change without regression
      const fakeNeutralChange: any = {
        summary: { totalChanges: 1 },
        regressionDetected: false,
      };

      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'standard-web-app',
          environmentId: standardEnv.id,
          environmentName: standardEnv.name,
        },
        environment: standardEnv,
        validationResult: val,
        changeAnalysis: fakeNeutralChange,
      });

      expect(res.blockingReasons.some((r) => r.id === 'block-security-regression')).toBe(false);
      expect(res.passedControls.some((c) => c.id === 'control-zero-security-regression')).toBe(true);
    });

    it('19. distinguishes unverified controls under evidenceGaps rather than failing controls', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const attack = analyzeAttackPaths(standardEnv);
      const arch = analyzeArchitecture(standardEnv);
      const ready = assessProductionReadiness(standardEnv, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });

      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'standard-web-app',
          environmentId: standardEnv.id,
          environmentName: standardEnv.name,
        },
        environment: standardEnv,
        validationResult: val,
        productionReadiness: ready,
      });

      expect(res.evidenceGaps.length).toBeGreaterThan(0);
      // Unverified operational controls (like backup, monitoring) are in evidenceGaps
      expect(res.evidenceGaps.some((g) => g.controlId === 'backup')).toBe(true);
      // And not in blockingReasons
      expect(res.blockingReasons.some((r) => r.id === 'backup')).toBe(false);
    });
  });

  // ==========================================
  // 4. Output Formatting & Privacy / Redaction
  // ==========================================
  describe('Formatters & Privacy Redaction', () => {
    it('20. generates valid machine-readable JSON satisfying schema version 1', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'standard-web-app',
          environmentId: standardEnv.id,
          environmentName: standardEnv.name,
        },
        environment: standardEnv,
        validationResult: val,
      });

      const jsonStr = formatCiGateJson(res);
      expect(typeof jsonStr).toBe('string');

      const parsed = JSON.parse(jsonStr);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.status).toBeDefined();
      expect(parsed.exitCode).toBeDefined();
      expect(Array.isArray(parsed.blockingReasons)).toBe(true);
      expect(Array.isArray(parsed.warnings)).toBe(true);
      expect(Array.isArray(parsed.passedControls)).toBe(true);
      expect(Array.isArray(parsed.evidenceGaps)).toBe(true);
      expect(parsed.summary).toBeDefined();
    });

    it('21. scrubs tokens and credentials from human and JSON outputs', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const res = evaluateCiGate({
        target: {
          targetType: 'environment-file',
          identifier: 'https://user:supersecretpassword@github.com/org/repo',
          environmentId: standardEnv.id,
          environmentName: 'Secret ghp_1234567890abcdef1234567890 Environment',
        },
        environment: standardEnv,
        validationResult: val,
      });

      const human = formatCiGateHuman(res);
      const json = formatCiGateJson(res);

      expect(human).not.toContain('supersecretpassword');
      expect(human).not.toContain('ghp_1234567890abcdef1234567890');
      expect(human).toContain('***REDACTED***');

      expect(json).not.toContain('supersecretpassword');
      expect(json).not.toContain('ghp_1234567890abcdef1234567890');
      expect(json).toContain('***REDACTED***');
    });

    it('22. produces clean, aligned terminal human output without decorative emojis', () => {
      const val = validatorEngine.evaluate(standardEnv);
      const res = evaluateCiGate({
        target: {
          targetType: 'scenario',
          identifier: 'standard-web-app',
          environmentId: standardEnv.id,
          environmentName: standardEnv.name,
        },
        environment: standardEnv,
        validationResult: val,
      });

      const human = formatCiGateHuman(res);
      expect(human).toContain('PATHFORGE ENGINEERING GATE');
      expect(human).toContain('STATUS:');
      expect(human).toContain('Exit Code:');
      expect(human).toContain('Evidence Summary');
      expect(human).not.toContain('🚀');
      expect(human).not.toContain('❌');
      expect(human).not.toContain('✨');
    });
  });

  // ==========================================
  // 5. CLI Execution & End-to-End Tests
  // ==========================================
  describe('CLI Integration (runCli)', () => {
    it('23. CLI exits with 0 for help and version flags', async () => {
      expect(await runCli(['--help'])).toBe(0);
      expect(await runCli(['-h'])).toBe(0);
      expect(await runCli(['--version'])).toBe(0);
      expect(await runCli(['-v'])).toBe(0);
    });

    it('24. CLI exits with 3 when no target path is provided', async () => {
      const exitCode = await runCli([]);
      expect(exitCode).toBe(3);
    });

    it('25. CLI exits with 3 when target file does not exist', async () => {
      const exitCode = await runCli(['gate', 'nonexistent-environment.json']);
      expect(exitCode).toBe(3);
    });

    it('26. CLI exits with 3 when target file contains malformed JSON', async () => {
      const malformedPath = path.join(tempDir, 'malformed.json');
      fs.writeFileSync(malformedPath, '{ "id": "bad", syntax_error ');

      const exitCode = await runCli(['gate', malformedPath]);
      expect(exitCode).toBe(3);
    });

    it('27. CLI evaluates standard demo environment and returns exit code 1 (WARN)', async () => {
      const demoPath = path.resolve(process.cwd(), 'environments/demo/standard-web-app.json');
      const exitCode = await runCli(['gate', demoPath]);
      expect(exitCode).toBe(1);
    });

    it('28. CLI evaluates chaos lab demo environment and returns exit code 2 (BLOCK)', async () => {
      const chaosPath = path.resolve(process.cwd(), 'environments/demo/compromised-direct-db.json');
      const exitCode = await runCli(['gate', chaosPath]);
      expect(exitCode).toBe(2);
    });

    it('29. CLI supports --strict mode and elevates warnings to BLOCK (exit 2)', async () => {
      const demoPath = path.resolve(process.cwd(), 'environments/demo/standard-web-app.json');
      const exitCode = await runCli(['gate', demoPath, '--strict']);
      expect(exitCode).toBe(2);
    });

    it('30. CLI supports analyze command without gating (returns exit 0)', async () => {
      const demoPath = path.resolve(process.cwd(), 'environments/demo/standard-web-app.json');
      const exitCode = await runCli(['analyze', demoPath]);
      expect(exitCode).toBe(0);
    });

    it('31. CLI outputs valid JSON when --format json is specified', async () => {
      const demoPath = path.resolve(process.cwd(), 'environments/demo/standard-web-app.json');
      // Capture stdout
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        const exitCode = await runCli(['gate', demoPath, '--format', 'json']);
        expect(exitCode).toBe(1);
        expect(logs.length).toBeGreaterThan(0);
        const parsed = JSON.parse(logs[0]);
        expect(parsed.schemaVersion).toBe(1);
        expect(parsed.status).toBe('WARN');
      } finally {
        console.log = origLog;
      }
    });

    it('32. CLI supports custom policy file via --policy', async () => {
      const customPolicyPath = path.join(tempDir, 'strict-policy.json');
      fs.writeFileSync(
        customPolicyPath,
        JSON.stringify({
          allowWarnings: false,
        })
      );

      const demoPath = path.resolve(process.cwd(), 'environments/demo/standard-web-app.json');
      const exitCode = await runCli(['gate', demoPath, '--policy', customPolicyPath]);
      expect(exitCode).toBe(2); // strict policy causes BLOCK
    });
  });
});
