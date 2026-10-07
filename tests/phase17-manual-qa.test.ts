import { describe, it, expect, beforeEach } from 'vitest';
import {
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

describe('Phase 1.7 — Exact 5-Step Manual QA Workflows', () => {
  let engine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  it('Workflow 1 — Secure scenario: Load Secure Web Application → Validate → Review findings → Confirm production gate', () => {
    const env = instantiateScenario('secure-web-app');
    const result = engine.evaluate(env);

    // Expected: No unexpected critical/high security findings, gate PASSED
    expect(result.summary.criticalCount).toBe(0);
    expect(result.summary.highCount).toBe(0);
    expect(result.summary.passed).toBe(true);
  });

  it('Workflow 2 — Public DB: Load Public DB Exposure → Validate → Open PF-001 → Apply Fix → Revalidate → Verify PASSED', () => {
    const env = instantiateScenario('public-db-exposure');
    const baselineResult = engine.evaluate(env);
    const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

    expect(baselineResult.summary.passed).toBe(false);
    expect(baselineResult.summary.criticalCount).toBeGreaterThanOrEqual(1);

    const pf001 = baselineResult.findings.find((f) => f.ruleId === 'PF-001');
    expect(pf001).toBeDefined();
    expect(pf001?.evidence?.sourceNode).toBe('node-internet');
    expect(pf001?.evidence?.targetNode).toBe('node-db');

    // Apply Fix (DENY edge)
    const actions = getRemediationActions(pf001!, env);
    const denyAction = actions.find((a) => a.type === 'deny-edge');
    expect(denyAction).toBeDefined();

    env.updateEdgeConfig(denyAction!.targetEdgeId!, { access: 'deny' });

    // Validate Topology (Revalidation)
    const revalidatedResult = engine.evaluate(env);
    expect(revalidatedResult.summary.criticalCount).toBe(0);

    // Open Fix Verification
    const verification = verifyFix(baselineSnapshot, env, revalidatedResult, {
      actionId: denyAction!.id,
      type: denyAction!.type,
      title: denyAction!.title,
    });

    // Expected: Finding resolved, Production Gate BLOCKED → PASSED, Verification: PASSED
    expect(verification.status).toBe('verified');
    expect(verification.summaryDelta.productionGate.before).toBe('BLOCKED');
    expect(verification.summaryDelta.productionGate.after).toBe('PASSED');
    expect(verification.resolvedFindings.some((r) => r.finding.ruleId === 'PF-001')).toBe(true);
    expect(verification.newFindings).toHaveLength(0);
  });

  it('Workflow 3 — Chaos: Load Secure Web Application → Add Database → Connect Internet → Database → Validate', () => {
    const env = instantiateScenario('secure-web-app');
    expect(engine.evaluate(env).summary.passed).toBe(true);

    // Add Database
    const newDb = env.createNode('database', { x: 500, y: 500 }, undefined, {
      zone: 'restricted',
      criticality: 'critical',
      service: { name: 'postgres', port: 5432 },
    });

    // Connect Internet -> Database (Anti-Pattern)
    const badEdge = env.createEdge('node-internet', newDb.id, {
      protocol: 'TCP',
      ports: '5432',
      access: 'allow',
    });

    // Expected: PathForge allows the connection and then identifies the security violation
    expect(badEdge).toBeDefined();
    expect(env.hasEdgeBetween('node-internet', newDb.id)).toBe(true);

    const result = engine.evaluate(env);
    expect(result.summary.passed).toBe(false);
    expect(result.findings.some((f) => f.ruleId === 'PF-001')).toBe(true);
  });

  it('Workflow 4 — Regression: Create a valid fix while introducing another insecure connection', () => {
    const env = instantiateScenario('public-db-exposure');
    const baselineResult = engine.evaluate(env);
    const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

    // Fix PF-001 by denying the database edge
    const badDbEdge = env.getEdges()[0];
    env.updateEdgeConfig(badDbEdge.id, { access: 'deny' });

    // BUT simultaneously introduce another insecure connection: Internet -> Admin (PF-002)
    const admin = env.createNode('admin', { x: 400, y: 400 }, undefined, {
      zone: 'management',
      service: { name: 'ssh', port: 22 },
    });
    env.createEdge('node-internet', admin.id, {
      protocol: 'SSH',
      ports: '22',
      access: 'allow',
    });

    const revalidatedResult = engine.evaluate(env);
    const verification = verifyFix(baselineSnapshot, env, revalidatedResult);

    // Expected: VERIFICATION REQUIRES ATTENTION and Production Gate: BLOCKED
    expect(verification.status).toBe('requires-attention');
    expect(verification.headline).toContain('REQUIRES ATTENTION');
    expect(verification.summaryDelta.productionGate.after).toBe('BLOCKED');
    expect(verification.newFindings.some((nf) => nf.finding.ruleId === 'PF-002')).toBe(true);
  });

  it('Workflow 5 — Reset: Load scenario → Modify topology → Reset Scenario', () => {
    // Load scenario
    const env = instantiateScenario('secure-web-app');
    expect(env.getNodes()).toHaveLength(7);
    expect(env.getEdges()).toHaveLength(6);

    // Modify topology
    env.createNode('database', { x: 999, y: 999 });
    env.removeEdge('edge-internet-to-fw');

    expect(env.getNodes()).toHaveLength(8);
    expect(env.getEdges()).toHaveLength(5);

    // Reset Scenario
    const resetEnv = instantiateScenario('secure-web-app');
    const resetResult = engine.evaluate(resetEnv);
    const resetSnapshot = createEnvironmentSnapshot(resetEnv, resetResult);

    // Expected: Clean scenario state with no stale baseline from the previous graph
    expect(resetEnv.getNodes()).toHaveLength(7);
    expect(resetEnv.getEdges()).toHaveLength(6);
    expect(diffEnvironments(resetSnapshot, resetEnv).hasChanges).toBe(false);

    const verification = verifyFix(resetSnapshot, resetEnv, resetResult);
    expect(verification.resolvedFindings).toHaveLength(0);
    expect(verification.newFindings).toHaveLength(0);
    expect(verification.status).toBe('still-present');
  });
});
