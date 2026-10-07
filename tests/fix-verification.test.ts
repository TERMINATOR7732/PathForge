import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  createEnvironmentSnapshot,
  diffEnvironments,
  verifyFix,
  EnvironmentSnapshot,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
  getRemediationActions,
} from '@pathforge/validator';

describe('Phase 1.6 — Fix Verification & Before/After Comparison', () => {
  let engine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  describe('Validated Baseline Snapshot Immutability', () => {
    it('creates an immutable, frozen snapshot independent of subsequent environment mutations', () => {
      const env = new Environment({ id: 'baseline-test', name: 'Baseline Test Env' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });
      const edge = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const initialResult = engine.evaluate(env);
      const snapshot: EnvironmentSnapshot = createEnvironmentSnapshot(env, initialResult);

      expect(snapshot.environmentId).toBe('baseline-test');
      expect(snapshot.nodes.length).toBe(2);
      expect(snapshot.edges.length).toBe(1);
      expect(snapshot.validationResult.findings.length).toBe(initialResult.findings.length);

      // Verify Object.isFrozen
      expect(Object.isFrozen(snapshot.nodes)).toBe(true);
      expect(Object.isFrozen(snapshot.edges)).toBe(true);
      expect(Object.isFrozen(snapshot.validationResult)).toBe(true);

      // Mutate live environment after snapshot
      const newWeb = env.createNode('web_server', { x: 150, y: 0 });
      env.removeEdge(edge.id);
      db.updateMetadata({ zone: 'internal' });

      // Live environment changed
      expect(env.getNodes().length).toBe(3);
      expect(env.getEdges().length).toBe(0);
      expect(db.zone).toBe('internal');

      // Baseline snapshot remains completely unaltered
      expect(snapshot.nodes.length).toBe(2);
      expect(snapshot.edges.length).toBe(1);
      expect(snapshot.nodes.find((n) => n.id === db.id)?.metadata?.zone).toBe('restricted');
      expect(snapshot.edges[0].id).toBe(edge.id);
    });
  });

  describe('Deterministic Infrastructure Diff Engine (diffEnvironments)', () => {
    it('detects node additions, node removals, and node configuration updates', () => {
      const env = new Environment({ id: 'diff-env', name: 'Diff Env' });
      const n1 = env.createNode('internet', { x: 0, y: 0 });
      const n2 = env.createNode('database', { x: 200, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
        service: { name: 'postgres', port: 5432, protocol: 'TCP' },
      });

      const initialResult = engine.evaluate(env);
      const snapshot = createEnvironmentSnapshot(env, initialResult);

      // 1. Add a node
      const n3 = env.createNode('web_server', { x: 100, y: 50 }, undefined, { zone: 'dmz' });
      // 2. Remove node 1
      env.removeNode(n1.id);
      // 3. Reconfigure node 2
      n2.updateMetadata({
        criticality: 'high',
        zone: 'internal',
        service: { name: 'postgres', port: 5433, protocol: 'TCP' },
      });

      const diff = diffEnvironments(snapshot, env);

      expect(diff.hasChanges).toBe(true);
      expect(diff.hasSecurityRelevantChanges).toBe(true);
      expect(diff.addedNodeIds).toContain(n3.id);
      expect(diff.removedNodeIds).toContain(n1.id);
      expect(diff.modifiedNodeIds).toContain(n2.id);

      const nodeConfigChange = diff.changes.find(
        (c) => c.type === 'node-config-changed' && c.targetId === n2.id
      );
      expect(nodeConfigChange).toBeDefined();
      expect(nodeConfigChange?.isSecurityRelevant).toBe(true);
      expect(nodeConfigChange?.fieldChanges?.some((fc) => fc.field === 'criticality')).toBe(true);
      expect(nodeConfigChange?.fieldChanges?.some((fc) => fc.field === 'zone')).toBe(true);
      expect(nodeConfigChange?.fieldChanges?.some((fc) => fc.field === 'service.port')).toBe(true);
    });

    it('isolates presentation coordinates: changing (x, y) yields 0 security diffs', () => {
      const env = new Environment({ id: 'layout-env', name: 'Layout Env' });
      const n1 = env.createNode('internet', { x: 10, y: 20 });
      const n2 = env.createNode('firewall', { x: 100, y: 200 });
      env.createEdge(n1.id, n2.id, { protocol: 'TCP', ports: '443', access: 'allow' });

      const initialResult = engine.evaluate(env);
      const snapshot = createEnvironmentSnapshot(env, initialResult);

      // Reposition both nodes purely on canvas
      env.updateNodePosition(n1.id, 500, 600);
      env.updateNodePosition(n2.id, 800, 950);

      const diff = diffEnvironments(snapshot, env);

      // Position changes MUST NOT trigger any configuration changes or security diffs
      expect(diff.hasChanges).toBe(false);
      expect(diff.hasSecurityRelevantChanges).toBe(false);
      expect(diff.changes.length).toBe(0);
      expect(diff.modifiedNodeIds.length).toBe(0);
    });

    it('detects edge additions, edge removals, and edge policy modifications', () => {
      const env = new Environment({ id: 'edge-diff-env', name: 'Edge Diff Env' });
      const n1 = env.createNode('internet', { x: 0, y: 0 });
      const n2 = env.createNode('web_server', { x: 200, y: 0 });
      const n3 = env.createNode('database', { x: 400, y: 0 });

      const e1 = env.createEdge(n1.id, n2.id, {
        protocol: 'HTTP',
        ports: '80',
        access: 'allow',
        encrypted: false,
      });
      const e2 = env.createEdge(n2.id, n3.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const initialResult = engine.evaluate(env);
      const snapshot = createEnvironmentSnapshot(env, initialResult);

      // 1. Remove e2
      env.removeEdge(e2.id);
      // 2. Modify e1 (allow -> deny, encrypted false -> true, port 80 -> 443)
      e1.updateMetadata({
        access: 'deny',
        encrypted: true,
        protocol: 'HTTPS',
        ports: '443',
      });
      // 3. Add e3
      const e3 = env.createEdge(n1.id, n3.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'deny',
      });

      const diff = diffEnvironments(snapshot, env);

      expect(diff.hasChanges).toBe(true);
      expect(diff.removedEdgeIds).toContain(e2.id);
      expect(diff.modifiedEdgeIds).toContain(e1.id);
      expect(diff.addedEdgeIds).toContain(e3.id);

      const edgeChange = diff.changes.find(
        (c) => c.type === 'edge-config-changed' && c.targetId === e1.id
      );
      expect(edgeChange).toBeDefined();
      expect(edgeChange?.fieldChanges?.some((fc) => fc.field === 'access')).toBe(true);
      expect(edgeChange?.fieldChanges?.some((fc) => fc.field === 'encrypted')).toBe(true);
      expect(edgeChange?.fieldChanges?.some((fc) => fc.field === 'ports')).toBe(true);
    });
  });

  describe('Fix Verification Engine (verifyFix)', () => {
    it('verifies resolution with policy-change when edge is switched to DENY', () => {
      const env = new Environment({ id: 'verify-pf001', name: 'PF001 Verify' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
        service: { name: 'postgres', port: 5432 },
      });
      const edge = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      // Baseline: PF-001 (plus associated boundary rules) active
      const baselineResult = engine.evaluate(env);
      expect(baselineResult.summary.criticalCount).toBeGreaterThanOrEqual(1);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Apply fix: Switch edge to DENY
      edge.updateMetadata({ access: 'deny' });

      // Revalidate
      const currentResult = engine.evaluate(env);
      expect(currentResult.summary.criticalCount).toBe(0);

      // Verify Fix
      const verification = verifyFix(baselineSnapshot, env, currentResult, {
        actionId: 'act-deny',
        type: 'deny-edge',
        title: 'Block Public Access (DENY)',
      });

      expect(verification.status).toBe('verified');
      expect(verification.headline).toContain('ZERO FINDINGS');
      expect(verification.resolvedFindings.length).toBe(baselineResult.findings.length);
      expect(verification.stillPresentFindings.length).toBe(0);
      expect(verification.newFindings.length).toBe(0);

      const resolvedPf001 = verification.resolvedFindings.find((r) => r.finding.ruleId === 'PF-001');
      expect(resolvedPf001).toBeDefined();
      expect(resolvedPf001?.resolutionType).toBe('policy-change');
      expect(resolvedPf001?.changeSummary).toBe('ALLOW → DENY');
      expect(resolvedPf001?.beforeState.access).toBe('allow');
      expect(resolvedPf001?.afterState?.access).toBe('deny');
      expect(verification.appliedRemediation?.title).toBe('Block Public Access (DENY)');

      // Summary delta checks
      expect(verification.summaryDelta.critical.before).toBeGreaterThanOrEqual(1);
      expect(verification.summaryDelta.critical.after).toBe(0);
      expect(verification.summaryDelta.critical.delta).toBeLessThanOrEqual(-1);
      expect(verification.summaryDelta.productionGate.before).toBe('BLOCKED');
      expect(verification.summaryDelta.productionGate.after).toBe('PASSED');
    });

    it('verifies resolution with edge-removal when insecure connection is deleted', () => {
      const env = new Environment({ id: 'verify-removal', name: 'Edge Removal Verify' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const firewall = env.createNode('firewall', { x: 150, y: 0 }, undefined, { zone: 'dmz' });
      const admin = env.createNode('admin', { x: 300, y: 0 }, undefined, {
        zone: 'management',
        service: { name: 'ssh', port: 22 },
      });

      // Legitimate path through firewall
      env.createEdge(internet.id, firewall.id, { protocol: 'TCP', ports: '443', access: 'allow' });
      env.createEdge(firewall.id, admin.id, { protocol: 'SSH', ports: '22', access: 'allow' });

      // Insecure direct exposure bypassing firewall
      const badEdge = env.createEdge(internet.id, admin.id, {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const baselineResult = engine.evaluate(env);
      expect(baselineResult.findings.some((f) => f.ruleId === 'PF-002')).toBe(true);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Apply fix: Delete bad bypass edge
      env.removeEdge(badEdge.id);

      const currentResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, currentResult);

      expect(verification.status).toBe('verified');
      const resolvedPf002 = verification.resolvedFindings.find((r) => r.finding.ruleId === 'PF-002');
      expect(resolvedPf002).toBeDefined();
      expect(resolvedPf002?.resolutionType).toBe('edge-removal');
      expect(resolvedPf002?.changeSummary).toBe('Connection Removed');
      expect(resolvedPf002?.afterState?.isRemoved).toBe(true);
    });

    it('verifies resolution with encryption-change for PF-008 cleartext sensitive data', () => {
      const env = new Environment({ id: 'verify-enc', name: 'Encryption Verify' });
      const web = env.createNode('web_server', { x: 0, y: 0 }, undefined, { zone: 'dmz' });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });
      const edge = env.createEdge(web.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      const baselineResult = engine.evaluate(env);
      expect(baselineResult.findings.some((f) => f.ruleId === 'PF-008')).toBe(true);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Apply fix: Enable TLS encryption
      edge.updateMetadata({ encrypted: true, protocol: 'TLS', ports: '5432' });

      const currentResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, currentResult);

      const resolvedPf008 = verification.resolvedFindings.find((r) => r.finding.ruleId === 'PF-008');
      expect(resolvedPf008).toBeDefined();
      expect(resolvedPf008?.resolutionType).toBe('encryption-change');
      expect(resolvedPf008?.changeSummary).toContain('Encrypted (TLS)');
    });

    it('verifies resolution with port-restriction for PF-007 wildcard ports', () => {
      const env = new Environment({ id: 'verify-ports', name: 'Port Restrict Verify' });
      const web = env.createNode('web_server', { x: 0, y: 0 }, undefined, { zone: 'dmz' });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        service: { name: 'postgres', port: 5432 },
      });
      const edge = env.createEdge(web.id, db.id, {
        protocol: 'TCP',
        ports: 'ANY',
        access: 'allow',
      });

      const baselineResult = engine.evaluate(env);
      expect(baselineResult.findings.some((f) => f.ruleId === 'PF-007')).toBe(true);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Apply fix: restrict port from ANY to 5432
      edge.updateMetadata({ ports: '5432', portConfig: { type: 'single', value: 5432 } });

      const currentResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, currentResult);

      const resolvedPf007 = verification.resolvedFindings.find((r) => r.finding.ruleId === 'PF-007');
      expect(resolvedPf007).toBeDefined();
      expect(resolvedPf007?.resolutionType).toBe('port-restriction');
      expect(resolvedPf007?.changeSummary).toContain('5432');
    });

    it('detects regressions: marks status as requires-attention when a fix introduces new findings', () => {
      const env = new Environment({ id: 'regression-env', name: 'Regression Test Env' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
        service: { name: 'postgres', port: 5432 },
      });
      const edge = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const baselineResult = engine.evaluate(env);
      expect(baselineResult.findings.some((f) => f.ruleId === 'PF-001')).toBe(true);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // User fixes PF-001 by changing edge to DENY...
      edge.updateMetadata({ access: 'deny' });

      // ...BUT simultaneously introduces a new public SSH connection to a newly added admin host (PF-002)
      const admin = env.createNode('admin', { x: 300, y: 150 }, undefined, {
        zone: 'management',
        service: { name: 'ssh', port: 22 },
      });
      env.createEdge(internet.id, admin.id, {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const currentResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, currentResult);

      // MUST NOT falsely report all-clear when a regression is introduced!
      expect(verification.status).toBe('requires-attention');
      expect(verification.headline).toContain('REQUIRES ATTENTION');
      expect(verification.resolvedFindings.length).toBeGreaterThanOrEqual(1);
      expect(verification.resolvedFindings.some((r) => r.finding.ruleId === 'PF-001')).toBe(true);

      expect(verification.newFindings.length).toBeGreaterThanOrEqual(1);
      const newPf002 = verification.newFindings.find((nf) => nf.finding.ruleId === 'PF-002');
      expect(newPf002).toBeDefined();
      expect(newPf002?.whyItAppeared).toBeDefined();

      expect(verification.summaryDelta.productionGate.after).toBe('BLOCKED');
    });

    it('accurately identifies still-present findings when only a subset of issues are fixed', () => {
      const env = new Environment({ id: 'partial-env', name: 'Partial Fix Env' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
        service: { name: 'postgres', port: 5432 },
      });
      const admin = env.createNode('admin', { x: 300, y: 100 }, undefined, {
        zone: 'management',
        service: { name: 'ssh', port: 22 },
      });

      const e1 = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });
      const e2 = env.createEdge(internet.id, admin.id, {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const baselineResult = engine.evaluate(env);
      expect(baselineResult.findings.length).toBeGreaterThanOrEqual(2);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Fix only e1 (database)
      e1.updateMetadata({ access: 'deny' });
      // Leave e2 (admin) untouched!

      const currentResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, currentResult);

      expect(verification.status).toBe('verified'); // Improved
      expect(verification.resolvedFindings.some((r) => r.finding.ruleId === 'PF-001')).toBe(true);
      expect(verification.stillPresentFindings.some((sf) => sf.finding.ruleId === 'PF-002')).toBe(
        true
      );
      expect(verification.newFindings.length).toBe(0);

      // Production gate is still BLOCKED because PF-002 (High severity) is still present
      expect(verification.summaryDelta.productionGate.after).toBe('BLOCKED');
    });
  });

  describe('End-to-End Validation & Baseline Advancement Lifecycle', () => {
    it('simulates the complete user workflow: validate -> remediate -> revalidate -> baseline updates', () => {
      // 1. Initial flawed environment
      const env = new Environment({ id: 'lifecycle-env', name: 'Lifecycle Environment' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
        service: { name: 'postgres', port: 5432 },
      });
      const edge = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      // Step 1: User runs Validate
      const initialResult = engine.evaluate(env);
      expect(initialResult.findings.length).toBeGreaterThanOrEqual(1);
      let baselineSnapshot = createEnvironmentSnapshot(env, initialResult);

      // Step 2: System suggests remediation for PF-001
      const pf001Finding = initialResult.findings.find((f) => f.ruleId === 'PF-001');
      expect(pf001Finding).toBeDefined();
      const actions = getRemediationActions(pf001Finding!, env);
      const denyAction = actions.find((a) => a.type === 'deny-edge');
      expect(denyAction).toBeDefined();

      // Step 3: User applies remediation action
      edge.updateMetadata({ access: 'deny' });

      // Step 4: User clicks Revalidate
      const revalidatedResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, revalidatedResult, {
        actionId: denyAction!.id,
        type: denyAction!.type,
        title: denyAction!.title,
      });

      expect(verification.status).toBe('verified');
      expect(verification.resolvedFindings.length).toBeGreaterThanOrEqual(1);
      expect(verification.resolvedFindings.some((r) => r.finding.ruleId === 'PF-001')).toBe(true);
      expect(verification.summaryDelta.productionGate.after).toBe('PASSED');

      // Step 5: Completed validation advances the baseline
      baselineSnapshot = createEnvironmentSnapshot(env, revalidatedResult);
      expect(baselineSnapshot.validationResult.summary.totalFindings).toBe(0);

      // Step 6: Subsequent verification against advanced baseline reports clean state
      const subsequentResult = engine.evaluate(env);
      const subsequentVerification = verifyFix(baselineSnapshot, env, subsequentResult);
      expect(subsequentVerification.resolvedFindings.length).toBe(0);
      expect(subsequentVerification.stillPresentFindings.length).toBe(0);
      expect(subsequentVerification.newFindings.length).toBe(0);
    });
  });
});
