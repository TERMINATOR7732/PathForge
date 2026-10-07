import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllScenarios,
  getScenarioById,
  instantiateScenario,
  createEnvironmentSnapshot,
  verifyFix,
  diffEnvironments,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
  getRemediationActions,
} from '@pathforge/validator';

describe('Phase 1.7 — Scenario Lab & Chaos Workflows', () => {
  let engine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  describe('Scenario Library Structural Integrity', () => {
    const scenarios = getAllScenarios();

    it('contains all 4 required scenarios in catalog', () => {
      expect(scenarios).toHaveLength(4);
      const ids = scenarios.map((s) => s.id);
      expect(ids).toContain('secure-web-app');
      expect(ids).toContain('public-db-exposure');
      expect(ids).toContain('flat-network');
      expect(ids).toContain('chaos-lab');
    });

    it('verifies every scenario definition has valid metadata, purpose, and learning objective', () => {
      for (const scenario of scenarios) {
        expect(scenario.name).toBeTruthy();
        expect(scenario.shortDescription).toBeTruthy();
        expect(scenario.purpose).toBeTruthy();
        expect(scenario.learningObjective).toBeTruthy();
        expect(scenario.topologyPreview).toBeTruthy();
        expect(['hardened', 'critical', 'high', 'chaos']).toContain(scenario.riskLevel);
      }
    });

    it('verifies structural validity for every scenario (unique IDs and valid endpoints)', () => {
      for (const scenario of scenarios) {
        const env = instantiateScenario(scenario.id);

        // Unique Node IDs
        const nodes = env.getNodes();
        const nodeIds = nodes.map((n) => n.id);
        const uniqueNodeIds = new Set(nodeIds);
        expect(uniqueNodeIds.size).toBe(nodes.length);

        // Unique Edge IDs
        const edges = env.getEdges();
        const edgeIds = edges.map((e) => e.id);
        const uniqueEdgeIds = new Set(edgeIds);
        expect(uniqueEdgeIds.size).toBe(edges.length);

        // Valid Edge endpoints
        for (const edge of edges) {
          expect(uniqueNodeIds.has(edge.source)).toBe(true);
          expect(uniqueNodeIds.has(edge.target)).toBe(true);
        }

        // Graph adjacency consistency
        expect(env.graph.getNodes().length).toBe(nodes.length);
        expect(env.graph.getEdges().length).toBe(edges.length);
      }
    });
  });

  describe('Expected Security States per Scenario', () => {
    it('Scenario A: Secure Web Application produces zero critical/high findings and passes validation', () => {
      const env = instantiateScenario('secure-web-app');
      const result = engine.evaluate(env);

      expect(result.summary.criticalCount).toBe(0);
      expect(result.summary.highCount).toBe(0);
      expect(result.summary.passed).toBe(true);
    });

    it('Scenario B: Public Database Exposure triggers PF-001 and PF-008 and blocks production gate', () => {
      const env = instantiateScenario('public-db-exposure');
      const result = engine.evaluate(env);

      expect(result.summary.passed).toBe(false);
      expect(result.summary.criticalCount).toBeGreaterThanOrEqual(1);

      // Verify specific expected rules
      const pf001 = result.findings.find((f) => f.ruleId === 'PF-001');
      const pf008 = result.findings.find((f) => f.ruleId === 'PF-008');

      expect(pf001).toBeDefined();
      expect(pf001?.severity).toBe('critical');
      expect(pf008).toBeDefined();
    });

    it('Scenario C: Flat Network triggers PF-004, PF-005, PF-007 and blocks production gate', () => {
      const env = instantiateScenario('flat-network');
      const result = engine.evaluate(env);

      expect(result.summary.passed).toBe(false);

      // Untrusted to internal network
      const pf004 = result.findings.find((f) => f.ruleId === 'PF-004');
      // Overly broad access
      const pf007 = result.findings.find((f) => f.ruleId === 'PF-007');
      // Excessive trust bypass
      const pf005 = result.findings.find((f) => f.ruleId === 'PF-005');

      expect(pf004).toBeDefined();
      expect(pf007).toBeDefined();
      expect(pf005).toBeDefined();
    });

    it('Scenario D: Chaos Lab triggers multiple critical and high findings for broad experimentation', () => {
      const env = instantiateScenario('chaos-lab');
      const result = engine.evaluate(env);

      expect(result.summary.passed).toBe(false);
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(4);

      // Exposure of DB (PF-001), Admin (PF-002), and Internal Network (PF-004)
      const ruleIds = result.findings.map((f) => f.ruleId);
      expect(ruleIds).toContain('PF-001');
      expect(ruleIds).toContain('PF-002');
      expect(ruleIds).toContain('PF-004');
      expect(ruleIds).toContain('PF-007');
    });
  });

  describe('Scenario Reset & Baseline Isolation', () => {
    it('cleanly resets modified environment without retaining old baseline or verification artifacts', () => {
      // 1. Load Scenario B
      const env = instantiateScenario('public-db-exposure');
      const initialResult = engine.evaluate(env);
      let baselineSnapshot = createEnvironmentSnapshot(env, initialResult);

      expect(env.getNodes()).toHaveLength(2);
      expect(env.getEdges()).toHaveLength(1);

      // 2. User heavily modifies topology
      const rogueNode = env.createNode('admin', { x: 300, y: 100 });
      env.createEdge('node-internet', rogueNode.id, { protocol: 'SSH', ports: '22', access: 'allow' });
      env.updateNodePosition('node-db', 900, 900);

      expect(env.getNodes()).toHaveLength(3);
      expect(env.getEdges()).toHaveLength(2);

      // 3. User executes Reset Scenario
      const freshEnv = instantiateScenario('public-db-exposure');
      const freshResult = engine.evaluate(freshEnv);

      // Re-initialize fresh baseline for the reset scenario
      baselineSnapshot = createEnvironmentSnapshot(freshEnv, freshResult);

      // 4. Verification against the reset environment shows ZERO residual diffs
      const diff = diffEnvironments(baselineSnapshot, freshEnv);
      expect(diff.hasChanges).toBe(false);
      expect(diff.changes).toHaveLength(0);

      // 5. Verify fix engine against fresh baseline shows no stale comparison
      const verification = verifyFix(baselineSnapshot, freshEnv, freshResult);
      expect(verification.resolvedFindings).toHaveLength(0);
      expect(verification.newFindings).toHaveLength(0);
      expect(verification.status).toBe('still-present');
    });

    it('switching scenarios cleanly resets baseline and prevents cross-scenario false verifications', () => {
      // User is on Scenario B (vulnerable DB)
      const envB = instantiateScenario('public-db-exposure');
      const resultB = engine.evaluate(envB);
      const snapshotB = createEnvironmentSnapshot(envB, resultB);

      // User switches to Scenario A (secure web app)
      const envA = instantiateScenario('secure-web-app');
      const resultA = engine.evaluate(envA);

      // If incorrectly compared against snapshotB, it would falsely report PF-001 resolved
      // Correct behavior: snapshot must be re-initialized to envA!
      const snapshotA = createEnvironmentSnapshot(envA, resultA);
      const cleanVerification = verifyFix(snapshotA, envA, resultA);

      expect(cleanVerification.resolvedFindings).toHaveLength(0);
      expect(cleanVerification.newFindings).toHaveLength(0);
      expect(cleanVerification.diff.hasChanges).toBe(false);
    });
  });

  describe('Chaos Lab Permissive Interaction Principle', () => {
    it('accepts dangerous connections without blocking and detects violations deterministically', () => {
      // Start with clean secure web app
      const env = instantiateScenario('secure-web-app');
      expect(engine.evaluate(env).summary.passed).toBe(true);

      // 1. Intentionally connect Internet directly to Database (Anti-Pattern)
      const badDbEdge = env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      // System ALLOWS the mutation!
      expect(badDbEdge).toBeDefined();
      expect(env.getEdge(badDbEdge.id)).toBeDefined();

      // Validator deterministically catches it
      let result = engine.evaluate(env);
      expect(result.summary.passed).toBe(false);
      expect(result.findings.some((f) => f.ruleId === 'PF-001')).toBe(true);

      // 2. Add an Admin console and expose it directly to Internet
      const adminNode = env.createNode('admin', { x: 500, y: 500 }, undefined, {
        zone: 'management',
        service: { name: 'ssh', port: 22 },
      });
      const badAdminEdge = env.createEdge('node-internet', adminNode.id, {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      // System ALLOWS the mutation!
      expect(badAdminEdge).toBeDefined();

      // Validator catches PF-002
      result = engine.evaluate(env);
      expect(result.findings.some((f) => f.ruleId === 'PF-002')).toBe(true);

      // 3. User remediates both bad edges
      env.removeEdge(badDbEdge.id);
      env.removeEdge(badAdminEdge);
      env.removeNode(adminNode.id);

      // Revalidate: Returns to green state
      result = engine.evaluate(env);
      expect(result.summary.criticalCount).toBe(0);
      expect(result.summary.highCount).toBe(0);
      expect(result.summary.passed).toBe(true);
    });

    it('executes full Build → Break → Explain → Fix → Prove loop in Scenario B', () => {
      // 1. Load Scenario B (Public Database Exposure)
      const env = instantiateScenario('public-db-exposure');
      const baselineResult = engine.evaluate(env);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      expect(baselineResult.summary.criticalCount).toBeGreaterThanOrEqual(1);

      // 2. Identify finding & get remediation
      const pf001 = baselineResult.findings.find((f) => f.ruleId === 'PF-001');
      expect(pf001).toBeDefined();

      const actions = getRemediationActions(pf001!, env);
      const denyAction = actions.find((a) => a.type === 'deny-edge');
      expect(denyAction).toBeDefined();

      // 3. Apply fix: DENY edge
      env.updateEdgeConfig(denyAction!.targetEdgeId!, { access: 'deny' });

      // 4. Revalidate
      const revalidatedResult = engine.evaluate(env);
      expect(revalidatedResult.summary.criticalCount).toBe(0);

      // 5. Prove fix
      const verification = verifyFix(baselineSnapshot, env, revalidatedResult, {
        actionId: denyAction!.id,
        type: denyAction!.type,
        title: denyAction!.title,
      });

      expect(verification.status).toBe('verified');
      expect(verification.summaryDelta.productionGate.before).toBe('BLOCKED');
      expect(verification.summaryDelta.productionGate.after).toBe('PASSED');
      expect(verification.resolvedFindings.some((r) => r.finding.ruleId === 'PF-001')).toBe(true);
    });
  });
});
