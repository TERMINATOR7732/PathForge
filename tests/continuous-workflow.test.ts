import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import {
  instantiateScenario,
  analyzeAttackPaths,
  analyzeArchitecture,
  assessProductionReadiness,
  assessTestingIntelligence,
  assessTechnicalDebt,
  analyzeInfrastructureChanges,
  createEnvironmentSnapshot,
  executeEngineeringRun,
  captureRunToHistory,
  buildEvidenceLineage,
  buildEvidenceMatrix,
  InMemoryHistoryStore,
  DEFAULT_CI_GATE_POLICY,
  EngineeringRun,
} from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine } from '@pathforge/validator';
import { runCli } from '../apps/cli/src/index.js';

describe('Phase 3.7 — Continuous Engineering Workflow & Release Hardening', () => {
  let validatorEngine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    validatorEngine = new ValidatorEngine(registry);
  });

  // ========================================================
  // 1. End-to-End Local Git Workflow
  // ========================================================
  describe('Local Git Continuous Workflow', () => {
    it('1. executes end-to-end Local Git run from environment to gate verdict', () => {
      const env = instantiateScenario('secure-web-app');
      const val = validatorEngine.evaluate(env);
      const attack = analyzeAttackPaths(env);
      const arch = analyzeArchitecture(env);
      const ready = assessProductionReadiness(env, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });
      const testIntel = assessTestingIntelligence(env, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });
      const debt = assessTechnicalDebt(env, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
        productionReadiness: ready,
        testingIntelligence: testIntel,
      });

      const run = executeEngineeringRun({
        environment: env,
        source: {
          type: 'local-git',
          identifier: 'e:/repo (master)',
          displayName: 'Local Git (master)',
          branch: 'master',
          revision: '71b91ac',
          baseRef: 'HEAD',
          headRef: 'working-tree',
          details: {
            repoPath: 'e:/repo',
            branch: 'master',
            isDirty: false,
          },
        },
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
        productionReadiness: ready,
        testingIntelligence: testIntel,
        technicalDebt: debt,
      });

      expect(run.schemaVersion).toBe(1);
      expect(run.status).toBe('CURRENT');
      expect(run.source.type).toBe('local-git');
      expect(run.source.displayName).toBe('Local Git (master)');
      expect(run.gateStatus).toBe('WARN');
      expect(run.exitCode).toBe(1);
      expect(run.compositeScore).toBeGreaterThanOrEqual(80);
      expect(run.intelligenceSummary.securityFindingsCount).toBe(0);
      expect(run.evidenceMatrix.length).toBe(9);
      expect(run.evidenceLineage.length).toBeGreaterThan(0);
    });

    it('2. captures Local Git engineering run to persistent history store with source provenance', async () => {
      const env = instantiateScenario('secure-web-app');
      const val = validatorEngine.evaluate(env);
      const run = executeEngineeringRun({
        environment: env,
        source: {
          type: 'local-git',
          identifier: 'repo-local',
          displayName: 'Local Git',
          branch: 'feature/hardening',
          revision: 'abc1234',
        },
        validationResult: val,
      });

      const store = new InMemoryHistoryStore();
      const saveResult = await captureRunToHistory(run, env, val, store);

      expect(saveResult.isDuplicate).toBe(false);
      expect(saveResult.record.source).toBe('local-git');
      expect(saveResult.record.environmentId).toBe(env.id);

      const records = store.list();
      expect(records.length).toBe(1);
      expect(records[0].source).toBe('local-git');

      // Duplicate capture is handled idempotently
      const dupResult = await captureRunToHistory(run, env, val, store);
      expect(dupResult.isDuplicate).toBe(true);
      expect(store.list().length).toBe(1);
    });
  });

  // ========================================================
  // 2. End-to-End GitHub PR Workflow
  // ========================================================
  describe('GitHub Pull Request Continuous Workflow', () => {
    it('3. executes end-to-end GitHub PR run with provenance and signals', () => {
      const env = instantiateScenario('secure-web-app');
      const val = validatorEngine.evaluate(env);

      const run = executeEngineeringRun({
        environment: env,
        source: {
          type: 'github-pr',
          identifier: 'acme-corp/infra#102',
          displayName: 'GitHub PR #102 (acme-corp/infra)',
          revision: 'b92e81a',
          branch: 'feature/security-fix',
          baseRef: 'main @ a83f2d1',
          headRef: 'feature/security-fix @ b92e81a',
          details: {
            owner: 'acme-corp',
            repo: 'infra',
            prNumber: 102,
            filesCount: 3,
            additions: 45,
            deletions: 12,
          },
        },
        validationResult: val,
      });

      expect(run.source.type).toBe('github-pr');
      expect(run.source.identifier).toBe('acme-corp/infra#102');
      expect(run.source.details?.prNumber).toBe(102);
      expect(run.gateStatus).toBeDefined();
    });
  });

  // ========================================================
  // 3. Security Regression & Safe Change Scenarios
  // ========================================================
  describe('Continuous Change Decisions (Regression vs Improvement)', () => {
    it('4. blocks with exit code 2 when security regression is detected against baseline', () => {
      const baseEnv = instantiateScenario('public-db-exposure');
      const baseVal = validatorEngine.evaluate(baseEnv);
      const baseSnap = createEnvironmentSnapshot(baseEnv, baseVal);

      // Regress: resolve PF-001 by removing direct Internet -> DB edge,
      // but introduce unencrypted communication PF-008
      const currentEnv = baseEnv.clone();
      const directEdge = currentEnv.getEdges().find((e) => {
        const src = currentEnv.getNode(e.source);
        const tgt = currentEnv.getNode(e.target);
        return src?.type === 'internet' && tgt?.type === 'database';
      })!;
      currentEnv.removeEdge(directEdge.id);

      const internet = currentEnv.getNodes().find((n) => n.type === 'internet')!;
      const api = currentEnv.createNode('api_server', { x: 300, y: 300 }, 'Insecure API');
      const db = currentEnv.getNodes().find((n) => n.type === 'database')!;
      currentEnv.createEdge(internet.id, api.id, { ports: '80', access: 'allow' });
      currentEnv.createEdge(api.id, db.id, { ports: '80', access: 'allow', protocol: 'http', encrypted: false });

      const currentVal = validatorEngine.evaluate(currentEnv);

      const changeAnalysis = analyzeInfrastructureChanges(baseSnap, currentEnv, {
        beforeValidationResult: baseVal,
        afterValidationResult: currentVal,
      });

      expect(changeAnalysis.regressionDetected).toBe(true);

      const run = executeEngineeringRun({
        environment: currentEnv,
        source: {
          type: 'local-git',
          identifier: 'local-repo',
          displayName: 'Local Git (regressed)',
        },
        validationResult: currentVal,
        changeAnalysis,
      });

      expect(run.gateStatus).toBe('BLOCK');
      expect(run.exitCode).toBe(2);
      expect(run.intelligenceSummary.regressionDetected).toBe(true);
      expect(run.topReasons.some((r) => r.toLowerCase().includes('critical') || r.toLowerCase().includes('regression'))).toBe(true);
    });

    it('5. passes with exit code 0 when dangerous environment is fixed and conforms to policy', () => {
      // Start with compromised environment
      const baseEnv = instantiateScenario('public-db-exposure');
      const baseVal = validatorEngine.evaluate(baseEnv);
      const baseSnap = createEnvironmentSnapshot(baseEnv, baseVal);

      // Fix it: clean standard web app
      const fixedEnv = instantiateScenario('secure-web-app');
      const fixedVal = validatorEngine.evaluate(fixedEnv);

      const changeAnalysis = analyzeInfrastructureChanges(baseSnap, fixedEnv, {
        beforeValidationResult: baseVal,
        afterValidationResult: fixedVal,
      });

      expect(changeAnalysis.regressionDetected).toBe(false);
      expect(changeAnalysis.summary.risksResolved).toBeGreaterThan(0);

      const run = executeEngineeringRun({
        environment: fixedEnv,
        source: {
          type: 'local-git',
          identifier: 'local-repo',
          displayName: 'Local Git (fixed)',
        },
        validationResult: fixedVal,
        changeAnalysis,
        policy: {
          ...DEFAULT_CI_GATE_POLICY,
          warnOnReadinessWarnings: false,
          warnOnModerateAttackPaths: false,
        },
      });

      expect(run.gateStatus).toBe('PASS');
      expect(run.exitCode).toBe(0);
      expect(run.compositeScore).toBeGreaterThanOrEqual(90);
    });

    it('6. produces INSUFFICIENT_EVIDENCE (exit 3) when required baseline is missing under strict policy', () => {
      const env = instantiateScenario('secure-web-app');
      const val = validatorEngine.evaluate(env);

      const strictPolicy = {
        ...DEFAULT_CI_GATE_POLICY,
        requireBaselineForRegression: true,
      };

      const run = executeEngineeringRun({
        environment: env,
        source: {
          type: 'local-git',
          identifier: 'local-repo',
          displayName: 'Local Git',
        },
        validationResult: val,
        changeAnalysis: null, // No baseline provided!
        policy: strictPolicy,
      });

      expect(run.gateStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(run.exitCode).toBe(3);
      expect(run.status).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  // ========================================================
  // 4. Evidence Lineage & Evidence Matrix
  // ========================================================
  describe('Evidence Lineage & Evidence Matrix', () => {
    it('7. builds evidence lineage tracing gate reasons directly to concrete affected nodes and edges', () => {
      const env = instantiateScenario('public-db-exposure');
      const val = validatorEngine.evaluate(env);
      const attack = analyzeAttackPaths(env);
      const arch = analyzeArchitecture(env);

      const run = executeEngineeringRun({
        environment: env,
        source: {
          type: 'local-git',
          identifier: 'local-repo',
          displayName: 'Local Git',
        },
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });

      expect(run.gateStatus).toBe('BLOCK');
      expect(run.evidenceLineage.length).toBeGreaterThan(0);

      const blockingItems = run.evidenceLineage.filter((l) => l.verdict === 'BLOCK');
      expect(blockingItems.length).toBeGreaterThan(0);

      // Verify that blocking item references affected nodes/edges
      const hasTargetElements = blockingItems.some((b) => b.targetElements.length > 0);
      expect(hasTargetElements).toBe(true);

      const sampleItem = blockingItems.find((b) => b.targetElements.length > 0)!;
      expect(sampleItem.targetElements[0].id).toBeDefined();
      expect(sampleItem.targetElements[0].label).toBeDefined();
    });

    it('8. builds complete evidence matrix across all 9 deterministic controls', () => {
      const env = instantiateScenario('secure-web-app');
      const val = validatorEngine.evaluate(env);
      const attack = analyzeAttackPaths(env);
      const arch = analyzeArchitecture(env);
      const ready = assessProductionReadiness(env, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });
      const testIntel = assessTestingIntelligence(env, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
      });
      const debt = assessTechnicalDebt(env, {
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
        productionReadiness: ready,
        testingIntelligence: testIntel,
      });

      const matrix = buildEvidenceMatrix({
        environment: env,
        gateResult: runCli ? ({} as any) : ({} as any), // mocked or real
        validationResult: val,
        attackPathAnalysis: attack,
        architectureAnalysis: arch,
        productionReadiness: ready,
        testingIntelligence: testIntel,
        technicalDebt: debt,
      });

      expect(matrix.length).toBe(9);
      const controlNames = matrix.map((m) => m.control);
      expect(controlNames).toContain('Critical Security Findings');
      expect(controlNames).toContain('High Security Findings');
      expect(controlNames).toContain('Attack Path Exposure');
      expect(controlNames).toContain('Architecture Quality');
      expect(controlNames).toContain('Production Readiness');
      expect(controlNames).toContain('Testing Intelligence');
      expect(controlNames).toContain('Technical Debt Health');
      expect(controlNames).toContain('Continuous Regression Delta');
      expect(controlNames).toContain('CI Engineering Gate');
    });
  });

  // ========================================================
  // 5. State Discipline & Invalidation
  // ========================================================
  describe('State Discipline & Invalidation', () => {
    it('9. marks engineering run as STALE when isStale flag and reason are passed', () => {
      const env = instantiateScenario('secure-web-app');
      const val = validatorEngine.evaluate(env);

      const staleRun = executeEngineeringRun({
        environment: env,
        source: {
          type: 'local-git',
          identifier: 'local-repo',
          displayName: 'Local Git',
        },
        validationResult: val,
        isStale: true,
        staleReason: 'Source parameters changed to QA Scenario B',
      });

      expect(staleRun.status).toBe('STALE');
      expect(staleRun.staleReason).toBe('Source parameters changed to QA Scenario B');

      // Re-running clears stale state
      const freshRun = executeEngineeringRun({
        environment: env,
        source: {
          type: 'local-git',
          identifier: 'local-repo',
          displayName: 'Local Git',
        },
        validationResult: val,
        isStale: false,
      });

      expect(freshRun.status).toBe('CURRENT');
      expect(freshRun.staleReason).toBeUndefined();
    });
  });

  // ========================================================
  // 6. CLI inspect Command Integration
  // ========================================================
  describe('CLI inspect Command Integration', () => {
    const demoPath = path.resolve(process.cwd(), 'environments/demo/standard-web-app.json');

    it('10. CLI inspect executes successfully and returns exit code 1 (WARN on standard demo)', async () => {
      const code = await runCli(['inspect', demoPath]);
      expect(code).toBe(1);
    });

    it('11. CLI inspect supports --format json returning valid EngineeringRun schema v1', async () => {
      let outputJson = '';
      const originalLog = console.log;
      console.log = (msg: string) => {
        outputJson += msg;
      };

      try {
        const code = await runCli(['inspect', demoPath, '--format', 'json']);
        expect(code).toBe(1);

        const parsed: EngineeringRun = JSON.parse(outputJson);
        expect(parsed.schemaVersion).toBe(1);
        expect(parsed.compositeScore).toBeGreaterThan(0);
        expect(parsed.evidenceMatrix.length).toBe(9);
        expect(parsed.evidenceLineage.length).toBeGreaterThan(0);
      } finally {
        console.log = originalLog;
      }
    });

    it('12. CLI inspect supports --strict promoting warnings to exit code 2 (BLOCK)', async () => {
      const code = await runCli(['inspect', demoPath, '--strict']);
      expect(code).toBe(2);
    });

    it('13. CLI inspect returns exit code 3 when target file does not exist', async () => {
      const code = await runCli(['inspect', 'non-existent-target.json']);
      expect(code).toBe(3);
    });
  });
});
