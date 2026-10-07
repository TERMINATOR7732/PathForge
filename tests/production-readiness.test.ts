import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  assessProductionReadiness,
  instantiateScenario,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
} from '@pathforge/validator';

describe('Phase 2.5 — Production Readiness Assessment', () => {
  let validatorEngine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    validatorEngine = new ValidatorEngine(registry);
  });

  // Test 1: Secure scenario produces READY or READY_WITH_WARNINGS
  it('evaluates secure-web-app reference scenario as READY or READY_WITH_WARNINGS with high score', () => {
    const env = instantiateScenario('secure-web-app');
    const validationResult = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult });

    expect(['READY', 'READY_WITH_WARNINGS']).toContain(assessment.status);
    expect(assessment.score).toBeGreaterThanOrEqual(80);
    expect(['EXCELLENT', 'GOOD']).toContain(assessment.rating);
    expect(assessment.blockingReasons).toHaveLength(0);
    expect(assessment.gates.find((g) => g.id === 'critical-security')?.status).toBe('PASSED');
    expect(assessment.gates.find((g) => g.id === 'high-risk-exposure')?.status).not.toBe('BLOCKED');
  });

  // Test 2: Public DB scenario is NOT_READY
  it('evaluates public-db-exposure scenario as NOT_READY with blocked critical gates', () => {
    const env = instantiateScenario('public-db-exposure');
    const validationResult = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult });

    expect(assessment.status).toBe('NOT_READY');
    expect(assessment.gates.find((g) => g.id === 'critical-security')?.status).toBe('BLOCKED');
    expect(assessment.blockingReasons.length).toBeGreaterThan(0);
    expect(assessment.blockingReasons.some((b) => b.severity === 'critical')).toBe(true);
    expect(assessment.summary.blockedGates).toBeGreaterThan(0);
  });

  // Test 3: Critical attack path blocks readiness
  it('blocks readiness when a critical attack path reaches a database crown jewel', () => {
    const env = new Environment({ id: 'crit-path-env', name: 'Critical Path Test' });
    const inet = env.createNode('internet', { x: 0, y: 0 }, undefined, { zone: 'public' });
    const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
      zone: 'restricted',
      criticality: 'critical',
    });
    env.createEdge(inet.id, db.id, { access: 'allow', protocol: 'TCP', port: 5432, encrypted: false });

    const validationResult = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult });

    expect(assessment.status).toBe('NOT_READY');
    const critGate = assessment.gates.find((g) => g.id === 'critical-security');
    expect(critGate?.status).toBe('BLOCKED');
    expect(assessment.blockingReasons.some((r) => r.category === 'attack-exposure' || r.category === 'security')).toBe(true);
  });

  // Test 4: High-risk management exposure affects readiness
  it('blocks or warns on high-risk management exposure from untrusted ingress', () => {
    const env = new Environment({ id: 'mgmt-exp-env', name: 'Management Exposure' });
    const inet = env.createNode('internet', { x: 0, y: 0 }, undefined, { zone: 'public' });
    const admin = env.createNode('admin', { x: 300, y: 0 }, undefined, {
      zone: 'management',
      criticality: 'high',
    });
    env.createEdge(inet.id, admin.id, { access: 'allow', protocol: 'SSH', port: 22, encrypted: true });

    const validationResult = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult });

    const mgmtGate = assessment.gates.find((g) => g.id === 'high-risk-exposure');
    expect(mgmtGate?.status).toBe('BLOCKED');
    expect(assessment.status).toBe('NOT_READY');
  });

  // Test 5: Cleartext sensitive communication affects readiness
  it('blocks communication-security gate when sensitive traffic is unencrypted', () => {
    const env = new Environment({ id: 'cleartext-env', name: 'Cleartext Test' });
    const web = env.createNode('web_server', { x: 100, y: 0 }, undefined, { zone: 'internal' });
    const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
      zone: 'restricted',
      criticality: 'critical',
    });
    env.createEdge(web.id, db.id, { access: 'allow', protocol: 'TCP', port: 5432, encrypted: false });

    const validationResult = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult });

    const commGate = assessment.gates.find((g) => g.id === 'communication-security');
    expect(commGate?.status).toBe('BLOCKED');
    const commCat = assessment.categories.find((c) => c.id === 'communication');
    expect(commCat?.status).toBe('BLOCKED');
  });

  // Test 6: Flat topology reduces architecture readiness category
  it('reduces architecture category and generates warning on flat-network topology', () => {
    const env = instantiateScenario('flat-network');
    const validationResult = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult });

    const archGate = assessment.gates.find((g) => g.id === 'architecture');
    expect(['WARNING', 'BLOCKED']).toContain(archGate?.status);
    const archCat = assessment.categories.find((c) => c.id === 'architecture');
    expect(archCat?.score).toBeLessThan(80);
    expect(assessment.warnings.some((w) => w.id === 'WARN-FLAT-TOPOLOGY' || w.category === 'architecture')).toBe(true);
  });

  // Test 7: Potential SPOF creates resilience warning
  it('creates non-blocking resilience warning when single point of failure is modeled', () => {
    const env = new Environment({ id: 'spof-env', name: 'SPOF Test' });
    const lb = env.createNode('load_balancer', { x: 100, y: 0 }, undefined, { zone: 'dmz' });
    const web1 = env.createNode('web_server', { x: 300, y: -50 }, undefined, { zone: 'internal' });
    const web2 = env.createNode('web_server', { x: 300, y: 50 }, undefined, { zone: 'internal' });
    env.createEdge(lb.id, web1.id, { access: 'allow', protocol: 'HTTP', port: 80, encrypted: false });
    env.createEdge(lb.id, web2.id, { access: 'allow', protocol: 'HTTP', port: 80, encrypted: false });

    const assessment = assessProductionReadiness(env);
    const resGate = assessment.gates.find((g) => g.id === 'resilience');
    expect(resGate?.status).toBe('WARNING');
    expect(assessment.warnings.some((w) => w.category === 'resilience')).toBe(true);
  });

  // Test 8: High dependency concentration affects resilience
  it('detects high dependency concentration on centralized components in resilience category', () => {
    const env = new Environment({ id: 'dep-conc-env', name: 'Dependency Concentration' });
    const hub = env.createNode('database', { x: 300, y: 0 }, undefined, { zone: 'restricted', criticality: 'critical' });
    for (let i = 0; i < 6; i++) {
      const client = env.createNode('api_server', { x: 100, y: i * 50 }, undefined, { zone: 'internal' });
      env.createEdge(client.id, hub.id, { access: 'allow', protocol: 'TCP', port: 5432, encrypted: true });
    }

    const assessment = assessProductionReadiness(env);
    const resCat = assessment.categories.find((c) => c.id === 'resilience');
    expect(resCat?.deductions.length).toBeGreaterThan(0);
  });

  // Test 9: Unmodeled operational controls appear as evidence gaps, not false failures
  it('classifies unmodeled operational controls as UNVERIFIED evidence gaps without failing them', () => {
    const env = instantiateScenario('secure-web-app');
    const assessment = assessProductionReadiness(env);

    expect(assessment.limitations).toHaveLength(10);
    const backupControl = assessment.limitations.find((l) => l.id === 'backup');
    expect(backupControl).toBeDefined();
    expect(backupControl?.rationale).toContain('Evidence gap');

    const evGate = assessment.gates.find((g) => g.id === 'evidence-sufficiency');
    expect(evGate?.status).toBe('LIMITED');
  });

  // Test 10: Score is deterministic across repeated evaluations
  it('produces strictly identical score and ratings across multiple evaluations', () => {
    const env = instantiateScenario('chaos-lab');
    const valResult = validatorEngine.evaluate(env);

    const a1 = assessProductionReadiness(env, { validationResult: valResult, analyzedAt: '2026-01-01T00:00:00.000Z' });
    const a2 = assessProductionReadiness(env, { validationResult: valResult, analyzedAt: '2026-01-01T00:00:00.000Z' });

    expect(a1.score).toBe(a2.score);
    expect(a1.status).toBe(a2.status);
    expect(a1.rating).toBe(a2.rating);
    expect(a1.blockingReasons.length).toBe(a2.blockingReasons.length);
  });

  // Test 11: Result is independent of node coordinates
  it('produces identical readiness results regardless of visual canvas (x, y) coordinates', () => {
    const env1 = instantiateScenario('secure-web-app');
    const env2 = instantiateScenario('secure-web-app');

    // Scramble node visual positions in env2
    env2.getNodes().forEach((n, idx) => {
      n.setPosition({ x: idx * 999 + 50, y: idx * 333 + 70 });
    });

    const r1 = validatorEngine.evaluate(env1);
    const r2 = validatorEngine.evaluate(env2);

    const a1 = assessProductionReadiness(env1, { validationResult: r1, analyzedAt: '2026-01-01T00:00:00.000Z' });
    const a2 = assessProductionReadiness(env2, { validationResult: r2, analyzedAt: '2026-01-01T00:00:00.000Z' });

    expect(a1.score).toBe(a2.score);
    expect(a1.status).toBe(a2.status);
    expect(a1.blockingReasons).toEqual(a2.blockingReasons);
    expect(a1.warnings).toEqual(a2.warnings);
  });

  // Test 12: Same environment produces byte-for-byte equivalent JSON result
  it('produces byte-for-byte equivalent serialized JSON across repeated runs', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);

    const a1 = assessProductionReadiness(env, { validationResult: val, analyzedAt: '2026-01-01T00:00:00.000Z' });
    const a2 = assessProductionReadiness(env, { validationResult: val, analyzedAt: '2026-01-01T00:00:00.000Z' });

    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
  });

  // Test 13: Blocking reasons contain valid evidence and affected nodes
  it('ensures all blocking reasons contain non-empty evidence and sorted affectedNodeIds', () => {
    const env = instantiateScenario('chaos-lab');
    const val = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult: val });

    expect(assessment.blockingReasons.length).toBeGreaterThan(0);
    for (const reason of assessment.blockingReasons) {
      expect(reason.id).toBeDefined();
      expect(reason.title.length).toBeGreaterThan(0);
      expect(reason.evidence.length).toBeGreaterThan(0);
      expect(reason.recommendation.length).toBeGreaterThan(0);
      // Ensure sorted order
      const copy = reason.affectedNodeIds.slice().sort();
      expect(reason.affectedNodeIds).toEqual(copy);
    }
  });

  // Test 14: Strengths only appear when supported
  it('only includes strengths that are objectively verified by the modeled graph', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult: val });

    expect(assessment.strengths.length).toBeGreaterThan(0);
    expect(assessment.strengths).toContain('Zero critical security rule violations detected across the modeled graph.');
    expect(assessment.strengths).toContain('No direct or critical adversarial attack paths reach sensitive crown-jewel assets.');
  });

  // Test 15: Multiple simultaneous failures in chaos-lab are aggregated deterministically
  it('aggregates multiple simultaneous failures in chaos-lab deterministically', () => {
    const env = instantiateScenario('chaos-lab');
    const val = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult: val });

    expect(assessment.status).toBe('NOT_READY');
    expect(assessment.summary.blockedGates).toBeGreaterThanOrEqual(2);
    expect(assessment.blockingReasons.length).toBeGreaterThanOrEqual(2);
  });

  // Test 16: A secure environment with no findings receives an appropriate high readiness score
  it('awards a high readiness score (>= 85) to hardened architectures', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult: val });

    expect(assessment.score).toBeGreaterThanOrEqual(85);
    expect(assessment.summary.blockedGates).toBe(0);
  });

  // Test 17: Score alone cannot override a blocked critical gate
  it('enforces status NOT_READY even when score is high if a critical gate is blocked', () => {
    // Construct an environment with mostly hardened setup but one direct public DB bypass
    const env = instantiateScenario('secure-web-app');
    const inet = env.getNodes().find((n) => n.type === 'internet');
    const db = env.getNodes().find((n) => n.type === 'database');
    expect(inet).toBeDefined();
    expect(db).toBeDefined();

    // Add a single unauthorized link from internet to database
    env.createEdge(inet!.id, db!.id, { access: 'allow', protocol: 'TCP', port: 5432, encrypted: false });

    const val = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult: val });

    // Status MUST be NOT_READY even if score might otherwise be moderate/high
    expect(assessment.status).toBe('NOT_READY');
    expect(assessment.gates.find((g) => g.id === 'critical-security')?.status).toBe('BLOCKED');
  });

  // Test 18: Fixing a critical finding and re-running analysis improves readiness
  it('transitions from NOT_READY to READY_WITH_WARNINGS when critical flaw is fixed', () => {
    const env = instantiateScenario('public-db-exposure');
    const valBefore = validatorEngine.evaluate(env);
    const beforeAssessment = assessProductionReadiness(env, { validationResult: valBefore });
    expect(beforeAssessment.status).toBe('NOT_READY');

    // Fix: Remove the direct insecure edge
    const directEdge = env.getEdges()[0];
    env.removeEdge(directEdge.id);

    const valAfter = validatorEngine.evaluate(env);
    const afterAssessment = assessProductionReadiness(env, { validationResult: valAfter });

    expect(afterAssessment.status).not.toBe('NOT_READY');
    expect(afterAssessment.score).toBeGreaterThan(beforeAssessment.score);
  });

  // Test 19: DENY edges do not create false production exposure
  it('does not treat DENY edges as reachable production exposure', () => {
    const env = new Environment({ id: 'deny-test-env', name: 'DENY Test' });
    const inet = env.createNode('internet', { x: 0, y: 0 }, undefined, { zone: 'public' });
    const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
      zone: 'restricted',
      criticality: 'critical',
    });
    // Explicit DENY edge
    env.createEdge(inet.id, db.id, { access: 'deny', protocol: 'TCP', port: 5432, encrypted: false });

    const val = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult: val });

    const critGate = assessment.gates.find((g) => g.id === 'critical-security');
    expect(critGate?.status).toBe('PASSED');
  });

  // Test 20: Encrypted sensitive paths do not receive false communication-security failures
  it('passes communication security gate when all sensitive edges use TLS encryption', () => {
    const env = new Environment({ id: 'tls-test-env', name: 'TLS Test' });
    const web = env.createNode('web_server', { x: 100, y: 0 }, undefined, { zone: 'internal' });
    const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
      zone: 'restricted',
      criticality: 'critical',
    });
    // Explicit TLS encrypted edge
    env.createEdge(web.id, db.id, { access: 'allow', protocol: 'HTTPS', port: 5432, encrypted: true });

    const val = validatorEngine.evaluate(env);
    const assessment = assessProductionReadiness(env, { validationResult: val });

    const commGate = assessment.gates.find((g) => g.id === 'communication-security');
    expect(commGate?.status).toBe('PASSED');
    expect(assessment.categories.find((c) => c.id === 'communication')?.status).toBe('PASSED');
  });

  // Test 21: Insufficient evidence on empty or single-node environment
  it('returns INSUFFICIENT_EVIDENCE on single-node or empty environment', () => {
    const env = new Environment({ id: 'empty-env', name: 'Empty Test' });
    env.createNode('internet', { x: 0, y: 0 });

    const assessment = assessProductionReadiness(env);
    expect(assessment.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(assessment.summary.executiveVerdict).toContain('Insufficient topology components');
  });
});
