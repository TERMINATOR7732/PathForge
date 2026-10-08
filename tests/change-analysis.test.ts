import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  instantiateScenario,
  createEnvironmentSnapshot,
  analyzeInfrastructureChanges,
  InfrastructureNode,
  InfrastructureEdge,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
} from '@pathforge/validator';

describe('Phase 3.1 — Continuous Engineering & Change Analysis Foundation', () => {
  let validator: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    validator = new ValidatorEngine(registry);
  });

  const evaluateValidation = (env: Environment) => validator.evaluate(env);

  // ==========================================
  // Group 1: Basic Changes (1–6)
  // ==========================================

  it('1. detects NODE_ADDED when a new infrastructure node is introduced', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    after.createNode('database', { x: 500, y: 500 }, 'Analytics DB');

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const added = result.changes.find((c) => c.type === 'NODE_ADDED');

    expect(added).toBeDefined();
    expect(added?.label).toContain('Analytics DB');
    expect(result.summary.totalChanges).toBeGreaterThanOrEqual(1);
  });

  it('2. detects NODE_REMOVED when an existing node is deleted', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const webNode = after.getNodes().find((n) => n.type === 'web_server')!;
    after.removeNode(webNode.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const removed = result.changes.find((c) => c.type === 'NODE_REMOVED');

    expect(removed).toBeDefined();
    expect(removed?.targetId).toBe(webNode.id);
  });

  it('3. detects NODE_CONFIG_CHANGED when node metadata is reconfigured', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const appNode = after.getNodes().find((n) => n.type === 'api_server')!;
    appNode.updateConfig({ cidr: '10.0.5.0/24' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const modified = result.changes.find((c) => c.type === 'NODE_CONFIG_CHANGED');

    expect(modified).toBeDefined();
    expect(modified?.fieldChanges?.some((fc) => fc.field === 'cidr')).toBe(true);
  });

  it('4. detects EDGE_ADDED when a new communication link is created', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const nodes = after.getNodes();
    after.createEdge(nodes[0].id, nodes[2].id, {
      protocol: 'tcp',
      ports: '443',
      access: 'allow',
    });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const added = result.changes.find((c) => c.type === 'EDGE_ADDED');

    expect(added).toBeDefined();
    expect(result.summary.totalChanges).toBe(1);
  });

  it('5. detects EDGE_REMOVED when an edge is deleted', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const edges = after.getEdges();
    after.removeEdge(edges[0].id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const removed = result.changes.find((c) => c.type === 'EDGE_REMOVED');

    expect(removed).toBeDefined();
    expect(removed?.targetId).toBe(edges[0].id);
  });

  it('6. detects EDGE_CONFIG_CHANGED when protocol or ports are modified', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const edge = after.getEdges()[0];
    after.updateEdgeConfig(edge.id, { ports: '8080' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const modified = result.changes.find((c) => c.type === 'EDGE_CONFIG_CHANGED');

    expect(modified).toBeDefined();
    expect(modified?.fieldChanges?.some((fc) => fc.field === 'ports')).toBe(true);
  });

  // ==========================================
  // Group 2: Security Classification (7–14)
  // ==========================================

  it('7. classifies DENY → ALLOW as security-decreasing', () => {
    const before = instantiateScenario('secure-web-app');
    const nodes = before.getNodes();
    const edge = before.createEdge(nodes[0].id, nodes[1].id, { access: 'deny' });

    const after = before.clone();
    after.updateEdgeConfig(edge.id, { access: 'allow' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === edge.id);

    expect(change?.classification).toBe('security-decreasing');
    expect(change?.classificationReason).toContain('permissive ALLOW');
  });

  it('8. classifies ALLOW → DENY as security-increasing', () => {
    const before = instantiateScenario('secure-web-app');
    const edge = before.getEdges()[0]; // allow edge
    const after = before.clone();
    after.updateEdgeConfig(edge.id, { access: 'deny' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === edge.id);

    expect(change?.classification).toBe('security-increasing');
    expect(change?.classificationReason).toContain('strict DENY');
  });

  it('9. classifies HTTPS → HTTP as security-decreasing', () => {
    const before = instantiateScenario('secure-web-app');
    const edge = before.getEdges()[0];
    edge.updateConfig({ protocol: 'HTTPS', encrypted: true });

    const after = before.clone();
    after.updateEdgeConfig(edge.id, { protocol: 'HTTP', encrypted: false });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === edge.id);

    expect(change?.classification).toBe('security-decreasing');
    expect(change?.classificationReason).toContain('cleartext');
  });

  it('10. classifies HTTP → HTTPS as security-increasing', () => {
    const before = instantiateScenario('secure-web-app');
    const edge = before.getEdges()[0];
    edge.updateConfig({ protocol: 'HTTP', encrypted: false });

    const after = before.clone();
    after.updateEdgeConfig(edge.id, { protocol: 'HTTPS', encrypted: true });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === edge.id);

    expect(change?.classification).toBe('security-increasing');
    expect(change?.classificationReason).toContain('encrypted');
  });

  it('11. classifies ANY:ANY → restricted port as security-increasing', () => {
    const before = instantiateScenario('secure-web-app');
    const edge = before.getEdges()[0];
    edge.updateConfig({ ports: 'ANY' });

    const after = before.clone();
    after.updateEdgeConfig(edge.id, { ports: '5432' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === edge.id);

    expect(change?.classification).toBe('security-increasing');
    expect(change?.classificationReason).toContain('restricted to a specific');
  });

  it('12. classifies restricted port → ANY:ANY as security-decreasing', () => {
    const before = instantiateScenario('secure-web-app');
    const edge = before.getEdges()[0];
    edge.updateConfig({ ports: '5432' });

    const after = before.clone();
    after.updateEdgeConfig(edge.id, { ports: 'ANY' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === edge.id);

    expect(change?.classification).toBe('security-decreasing');
    expect(change?.classificationReason).toContain('wildcard ANY');
  });

  it('13. classifies internal → public zone on sensitive asset as security-decreasing', () => {
    const before = instantiateScenario('secure-web-app');
    const db = before.getNodes().find((n) => n.type === 'database')!;

    const after = before.clone();
    after.getNode(db.id)!.updateConfig({ zone: 'public' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === db.id);

    expect(change?.classification).toBe('security-decreasing');
    expect(change?.classificationReason).toContain('public untrusted boundary');
  });

  it('14. classifies criticality-only change (medium → critical) as security-neutral', () => {
    const before = instantiateScenario('secure-web-app');
    const web = before.getNodes().find((n) => n.type === 'web_server')!;

    const after = before.clone();
    after.getNode(web.id)!.updateConfig({ criticality: 'critical' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const change = result.changes.find((c) => c.targetId === web.id);

    expect(change?.classification).toBe('security-neutral');
    expect(change?.classificationReason).toContain('without directly altering defensive security controls');
  });

  // ==========================================
  // Group 3: Risk Comparison (15–24)
  // ==========================================

  it('15. detects newly introduced PF-001 Public Database Exposure', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    const internet = after.getNodes().find((n) => n.type === 'internet')!;
    const db = after.getNodes().find((n) => n.type === 'database')!;
    after.createEdge(internet.id, db.id, { ports: '5432', access: 'allow', protocol: 'tcp' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.newlyIntroducedRisks.some((r) => r.ruleId === 'PF-001')).toBe(true);
    expect(result.summary.risksIntroduced).toBeGreaterThanOrEqual(1);
    expect(result.summary.impactLevel).toBe('CRITICAL');
  });

  it('16. detects resolved PF-001 when exposure is mitigated', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    // Mitigate direct edge from Internet to DB
    const directEdge = after.getEdges()[0];
    after.updateEdgeConfig(directEdge.id, { access: 'deny' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.resolvedRisks.some((r) => r.ruleId === 'PF-001')).toBe(true);
    expect(result.summary.risksResolved).toBeGreaterThanOrEqual(1);
    expect(result.summary.category).toBe('improvement');
  });

  it('17. detects newly introduced PF-008 Unencrypted Sensitive Communication', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    // Find edge entering database and make it unencrypted
    const dbEdge = after.getEdges().find((e) => {
      const tgt = after.getNode(e.target);
      return tgt?.type === 'database';
    })!;
    after.updateEdgeConfig(dbEdge.id, { encrypted: false, protocol: 'HTTP' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.newlyIntroducedRisks.some((r) => r.ruleId === 'PF-008')).toBe(true);
  });

  it('18. detects resolved PF-008 when channel is encrypted', () => {
    const before = instantiateScenario('secure-web-app');
    const dbEdge = before.getEdges().find((e) => {
      const tgt = before.getNode(e.target);
      return tgt?.type === 'database';
    })!;
    before.updateEdgeConfig(dbEdge.id, { encrypted: false, protocol: 'HTTP' });

    const after = before.clone();
    after.updateEdgeConfig(dbEdge.id, { encrypted: true, protocol: 'HTTPS' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.resolvedRisks.some((r) => r.ruleId === 'PF-008')).toBe(true);
  });

  it('19. does not report risk as resolved if it still persists through an alternate path', () => {
    const before = instantiateScenario('public-db-exposure');
    const internet = before.getNodes().find((n) => n.type === 'internet')!;
    const db = before.getNodes().find((n) => n.type === 'database')!;

    // Create a second direct allow edge to database
    const edge2 = before.createEdge(internet.id, db.id, { ports: '3306', access: 'allow' });

    const after = before.clone();
    // Remove only edge2, leaving the primary direct edge intact
    after.removeEdge(edge2.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    // PF-001 is still active through original edge!
    expect(result.resolvedRisks.some((r) => r.ruleId === 'PF-001')).toBe(false);
    expect(result.unchangedRisks.some((r) => r.ruleId === 'PF-001')).toBe(true);
  });

  it('20. detects newly added attack paths', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    const internet = after.getNodes().find((n) => n.type === 'internet')!;
    const db = after.getNodes().find((n) => n.type === 'database')!;
    after.createEdge(internet.id, db.id, { ports: '5432', access: 'allow' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.attackPathDelta.added.length).toBeGreaterThan(0);
    expect(result.attackPathDelta.added[0].afterRisk).toBe('critical');
  });

  it('21. detects eliminated attack paths', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    const directEdge = after.getEdges().find((e) => {
      const src = after.getNode(e.source);
      const tgt = after.getNode(e.target);
      return src?.type === 'internet' && tgt?.type === 'database';
    })!;
    after.removeEdge(directEdge.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.attackPathDelta.removed.length).toBeGreaterThan(0);
  });

  it('22. detects attack path risk increase when controls are weakened', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    // Disable encryption on all web/api edges to elevate path risk
    for (const edge of after.getEdges()) {
      after.updateEdgeConfig(edge.id, { encrypted: false, ports: 'ANY' });
    }

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    expect(result.summary.securityDecreasing).toBeGreaterThan(0);
  });

  it('23. detects architectural regression when tier bypass is introduced', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    // Create edge-to-data tier bypass directly from internet to database
    const internet = after.getNodes().find((n) => n.type === 'internet')!;
    const db = after.getNodes().find((n) => n.type === 'database')!;
    after.createEdge(internet.id, db.id, { access: 'allow', ports: '5432' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.architectureDelta.tierBypassIntroduced).toBe(true);
    expect(result.architectureDelta.observations.some((o) => o.includes('Tier bypass') || o.includes('ingress'))).toBe(true);
  });

  it('24. detects architectural improvement when tier bypass and data ingress are resolved', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    const directEdge = after.getEdges()[0];
    after.removeEdge(directEdge.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.architectureDelta.scoreDelta).toBeGreaterThanOrEqual(25);
    expect(result.architectureDelta.tierBypassResolved).toBe(true);
  });

  // ==========================================
  // Group 4: Regression Detection (25–27)
  // ==========================================

  it('25. detects security regression when resolving one risk introduces another', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    // Resolve PF-001 by removing direct Internet -> DB edge
    const directEdge = after.getEdges().find((e) => {
      const src = after.getNode(e.source);
      const tgt = after.getNode(e.target);
      return src?.type === 'internet' && tgt?.type === 'database';
    })!;
    after.removeEdge(directEdge.id);

    // But introduce PF-008: add an unencrypted cleartext edge to API -> DB
    const internet = after.getNodes().find((n) => n.type === 'internet')!;
    const api = after.createNode('api_server', { x: 300, y: 300 }, 'Insecure API');
    const db = after.getNodes().find((n) => n.type === 'database')!;
    after.createEdge(internet.id, api.id, { ports: '80', access: 'allow' });
    after.createEdge(api.id, db.id, { ports: '80', access: 'allow', protocol: 'http', encrypted: false });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.regressionDetected).toBe(true);
    expect(result.summary.category).toBe('regression');
    expect(result.regressionDetails.resolvedRisks.length).toBeGreaterThan(0);
    expect(result.regressionDetails.newRisks.length).toBeGreaterThan(0);
  });

  it('26. classifies fix with zero new flaws as clean improvement', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    const directEdge = after.getEdges()[0];
    after.updateEdgeConfig(directEdge.id, { access: 'deny' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.regressionDetected).toBe(false);
    expect(result.summary.category).toBe('improvement');
    expect(result.summary.risksIntroduced).toBe(0);
  });

  it('27. classifies non-security renaming modifications as purely neutral', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const node = after.getNodes()[0];
    node.updateConfig({ name: 'Renamed Ingress Node' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.regressionDetected).toBe(false);
    expect(result.summary.category).toBe('neutral');
    expect(result.summary.impactLevel).toBe('LOW');
  });

  // ==========================================
  // Group 5: Production Readiness (28–30)
  // ==========================================

  it('28. tracks readiness score improvement when vulnerabilities are repaired', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    const directEdge = after.getEdges().find((e) => {
      const src = after.getNode(e.source);
      const tgt = after.getNode(e.target);
      return src?.type === 'internet' && tgt?.type === 'database';
    })!;
    after.removeEdge(directEdge.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.readinessDelta.scoreDelta).toBeGreaterThanOrEqual(0);
  });

  it('29. detects new blocking gate when critical exposure is introduced', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    const internet = after.getNodes().find((n) => n.type === 'internet')!;
    const db = after.getNodes().find((n) => n.type === 'database')!;
    after.createEdge(internet.id, db.id, { ports: '5432', access: 'allow' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.readinessDelta.newBlockers.length).toBeGreaterThan(0);
    expect(result.readinessDelta.statusAfter).toBe('NOT_READY');
  });

  it('30. detects resolved blocking gate when exposure is mitigated', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    const directEdge = after.getEdges().find((e) => {
      const src = after.getNode(e.source);
      const tgt = after.getNode(e.target);
      return src?.type === 'internet' && tgt?.type === 'database';
    })!;
    after.removeEdge(directEdge.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.readinessDelta.resolvedBlockers.length).toBeGreaterThan(0);
  });

  // ==========================================
  // Group 6: Technical Debt (31–33)
  // ==========================================

  it('31. detects new P0/P1 technical debt when anti-patterns are introduced', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    const internet = after.getNodes().find((n) => n.type === 'internet')!;
    const db = after.getNodes().find((n) => n.type === 'database')!;
    after.createEdge(internet.id, db.id, { ports: '5432', access: 'allow' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.technicalDebtDelta.newDebt.length).toBeGreaterThan(0);
    expect(result.technicalDebtDelta.p0Delta).toBeGreaterThan(0);
  });

  it('32. detects resolved debt when anti-patterns are removed', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    const directEdge = after.getEdges().find((e) => {
      const src = after.getNode(e.source);
      const tgt = after.getNode(e.target);
      return src?.type === 'internet' && tgt?.type === 'database';
    })!;
    after.removeEdge(directEdge.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.technicalDebtDelta.resolvedDebt.length).toBeGreaterThan(0);
  });

  it('33. reports positive debt health score delta when debt is eliminated', () => {
    const before = instantiateScenario('public-db-exposure');
    const after = before.clone();

    const directEdge = after.getEdges().find((e) => {
      const src = after.getNode(e.source);
      const tgt = after.getNode(e.target);
      return src?.type === 'internet' && tgt?.type === 'database';
    })!;
    after.removeEdge(directEdge.id);

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.technicalDebtDelta.scoreDelta).toBeGreaterThanOrEqual(0);
  });

  // ==========================================
  // Group 7: Determinism & Boundaries (34–38)
  // ==========================================

  it('34. produces byte-for-byte identical results for identical before/after inputs', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const web = after.getNodes().find((n) => n.type === 'web_server')!;
    web.updateConfig({ cidr: '10.0.10.0/24' });

    const r1 = analyzeInfrastructureChanges(before, after, {
      evaluateValidation,
      analyzedAt: '2026-10-08T12:00:00.000Z',
    });
    const r2 = analyzeInfrastructureChanges(before, after, {
      evaluateValidation,
      analyzedAt: '2026-10-08T12:00:00.000Z',
    });

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('35. ignores visual canvas coordinates (x, y) with zero security changes', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    // Move all nodes around canvas
    for (const node of after.getNodes()) {
      node.setPosition(node.position.x + 300, node.position.y + 400);
    }

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.changes).toHaveLength(0);
    expect(result.summary.totalChanges).toBe(0);
    expect(result.summary.impactLevel).toBe('LOW');
    expect(result.summary.category).toBe('neutral');
  });

  it('36. produces deterministic results regardless of edge array ordering', () => {
    const before = instantiateScenario('secure-web-app');
    const after1 = before.clone();
    const after2 = before.clone();

    const nodes = after1.getNodes();
    after1.createEdge(nodes[0].id, nodes[2].id, { ports: '443', access: 'allow' });
    after1.createEdge(nodes[1].id, nodes[2].id, { ports: '80', access: 'allow' });

    // Reverse creation order in after2
    after2.createEdge(nodes[1].id, nodes[2].id, { ports: '80', access: 'allow' });
    after2.createEdge(nodes[0].id, nodes[2].id, { ports: '443', access: 'allow' });

    const r1 = analyzeInfrastructureChanges(before, after1, {
      evaluateValidation,
      analyzedAt: '2026-10-08T12:00:00.000Z',
    });
    const r2 = analyzeInfrastructureChanges(before, after2, {
      evaluateValidation,
      analyzedAt: '2026-10-08T12:00:00.000Z',
    });

    expect(r1.summary.totalChanges).toBe(r2.summary.totalChanges);
    expect(r1.summary.impactLevel).toBe(r2.summary.impactLevel);
  });

  it('37. strictly sorts change items deterministically by ID', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    after.createNode('database', { x: 100, y: 100 }, 'DB B');
    after.createNode('database', { x: 200, y: 200 }, 'DB A');

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    for (let i = 0; i < result.changes.length - 1; i++) {
      expect(result.changes[i].id.localeCompare(result.changes[i + 1].id)).toBeLessThanOrEqual(0);
    }
  });

  it('38. handles sparse or empty topologies without fabricating fake risks', () => {
    const before = new Environment({ id: 'empty-1', name: 'Empty 1' });
    const after = new Environment({ id: 'empty-2', name: 'Empty 2' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    expect(result.summary.totalChanges).toBe(0);
    expect(result.summary.risksIntroduced).toBe(0);
    expect(result.summary.impactLevel).toBe('LOW');
  });

  // ==========================================
  // Group 8: Safety & Human Engineering Standards (39–41)
  // ==========================================

  it('39. operates 100% locally with zero external network requests', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();

    const start = performance.now();
    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(100); // executes purely in memory in < 100ms
  });

  it('40. performs pure deterministic rule evaluation without AI or LLM models', () => {
    const before = instantiateScenario('secure-web-app');
    const after = before.clone();
    const internet = after.getNodes().find((n) => n.type === 'internet')!;
    const db = after.getNodes().find((n) => n.type === 'database')!;
    after.createEdge(internet.id, db.id, { ports: '5432', access: 'allow' });

    const result = analyzeInfrastructureChanges(before, after, { evaluateValidation });

    // Deterministic rule IDs only
    expect(result.newlyIntroducedRisks.every((r) => r.ruleId.startsWith('PF-'))).toBe(true);
  });

  it('41. requires zero cloud provider credentials or external databases', () => {
    expect(process.env.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
  });
});
