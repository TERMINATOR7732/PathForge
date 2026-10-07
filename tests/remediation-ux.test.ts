import { describe, it, expect, beforeEach } from 'vitest';
import { Environment } from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
  getRemediationActions,
  getPrimaryRemediationAction,
} from '@pathforge/validator';
import { Finding } from '@pathforge/shared';

describe('Phase 1.5 — Finding Explanation & Remediation UX', () => {
  let engine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  describe('Deterministic Remediation Actions Generation', () => {
    it('generates deny-edge and remove-edge actions for PF-001 (Public Database Exposure)', () => {
      const env = new Environment({ id: 'test-pf001', name: 'PF001 Env' });
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

      const result = engine.evaluate(env);
      const pf001Finding = result.findings.find((f) => f.ruleId === 'PF-001');
      expect(pf001Finding).toBeDefined();

      const actions = getRemediationActions(pf001Finding!, env);
      expect(actions.length).toBeGreaterThanOrEqual(2);

      const denyAction = actions.find((a) => a.type === 'deny-edge');
      const removeAction = actions.find((a) => a.type === 'remove-edge');

      expect(denyAction).toBeDefined();
      expect(denyAction?.isAutomated).toBe(true);
      expect(denyAction?.targetEdgeId).toBe(edge.id);
      expect(denyAction?.impactSummary).toContain('ALLOW to DENY');

      expect(removeAction).toBeDefined();
      expect(removeAction?.isAutomated).toBe(true);

      const primary = getPrimaryRemediationAction(pf001Finding!, env);
      expect(primary?.type).toBe('deny-edge');
    });

    it('generates deny-edge and remove-edge actions for PF-002 (Public Admin Exposure)', () => {
      const env = new Environment({ id: 'test-pf002', name: 'PF002 Env' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const admin = env.createNode('admin', { x: 300, y: 0 }, undefined, {
        zone: 'management',
        service: { name: 'ssh', port: 22 },
      });
      const edge = env.createEdge(internet.id, admin.id, {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const result = engine.evaluate(env);
      const pf002Finding = result.findings.find((f) => f.ruleId === 'PF-002');
      expect(pf002Finding).toBeDefined();

      const actions = getRemediationActions(pf002Finding!, env);
      const denyAction = actions.find((a) => a.type === 'deny-edge');
      expect(denyAction).toBeDefined();
      expect(denyAction?.targetEdgeId).toBe(edge.id);
    });

    it('generates least-privilege port restriction for PF-007 wildcard ports', () => {
      const env = new Environment({ id: 'test-pf007', name: 'PF007 Env' });
      const web = env.createNode('web_server', { x: 0, y: 0 }, undefined, { zone: 'dmz' });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        service: { name: 'postgres', port: 5432 },
      });
      const edge = env.createEdge(web.id, db.id, {
        protocol: 'TCP',
        ports: 'ANY',
        portConfig: { type: 'any' },
        access: 'allow',
      });

      const result = engine.evaluate(env);
      const pf007Finding = result.findings.find(
        (f) => f.ruleId === 'PF-007' && f.id.includes('wildcard')
      );
      expect(pf007Finding).toBeDefined();

      const actions = getRemediationActions(pf007Finding!, env);
      const restrictAction = actions.find((a) => a.type === 'restrict-port');
      expect(restrictAction).toBeDefined();
      expect(restrictAction?.title).toContain('5432');
    });

    it('generates transport encryption upgrade for PF-008 unencrypted communication', () => {
      const env = new Environment({ id: 'test-pf008', name: 'PF008 Env' });
      const web = env.createNode('web_server', { x: 0, y: 0 }, undefined, { zone: 'internal' });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'high',
        service: { port: 5432 },
      });
      const edge = env.createEdge(web.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        encrypted: false,
        access: 'allow',
      });

      const result = engine.evaluate(env);
      const pf008Finding = result.findings.find((f) => f.ruleId === 'PF-008');
      expect(pf008Finding).toBeDefined();

      const actions = getRemediationActions(pf008Finding!, env);
      const tlsAction = actions.find((a) => a.type === 'enable-encryption');
      expect(tlsAction).toBeDefined();
      expect(tlsAction?.targetEdgeId).toBe(edge.id);
    });

    it('generates port alignment action for PF-009 service mismatch', () => {
      const env = new Environment({ id: 'test-pf009', name: 'PF009 Env' });
      const web = env.createNode('web_server', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        service: { name: 'postgres', port: 5432 },
      });
      const edge = env.createEdge(web.id, db.id, {
        protocol: 'TCP',
        ports: '8080',
        portConfig: { type: 'single', value: 8080 },
        access: 'allow',
      });

      const result = engine.evaluate(env);
      const pf009Finding = result.findings.find((f) => f.ruleId === 'PF-009');
      expect(pf009Finding).toBeDefined();

      const actions = getRemediationActions(pf009Finding!, env);
      const alignAction = actions.find((a) => a.type === 'align-port');
      expect(alignAction).toBeDefined();
      expect(alignAction?.title).toContain('5432');
    });

    it('provides clear manual architecture guidance for PF-003 missing security boundary', () => {
      const env = new Environment({ id: 'test-pf003', name: 'PF003 Env' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const web = env.createNode('web_server', { x: 300, y: 0 }, undefined, { zone: 'internal' });
      env.createEdge(internet.id, web.id, {
        protocol: 'HTTP',
        ports: '80',
        access: 'allow',
      });

      const result = engine.evaluate(env);
      const pf003Finding = result.findings.find((f) => f.ruleId === 'PF-003');
      expect(pf003Finding).toBeDefined();

      const actions = getRemediationActions(pf003Finding!, env);
      const manualAction = actions.find((a) => a.type === 'manual');
      expect(manualAction).toBeDefined();
      expect(manualAction?.isAutomated).toBe(false);
      expect(manualAction?.description).toContain('Firewall');
    });
  });

  describe('Remediation Execution and Domain Mutation Discipline', () => {
    it('executes deny-edge remediation and resolves PF-001 violation upon revalidation', () => {
      const env = new Environment({ id: 'test-deny', name: 'Deny Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        service: { port: 5432 },
      });
      const edge = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      // Initial validation detects PF-001
      const initialResult = engine.evaluate(env);
      const finding = initialResult.findings.find((f) => f.ruleId === 'PF-001')!;
      expect(finding).toBeDefined();

      // Get primary action
      const action = getPrimaryRemediationAction(finding, env)!;
      expect(action.type).toBe('deny-edge');

      // Apply remediation to domain model
      const success = action.apply!(env);
      expect(success).toBe(true);

      // Verify domain state updated
      const updatedEdge = env.getEdge(edge.id);
      expect(updatedEdge?.access).toBe('deny');

      // Revalidate: PF-001 violation is eliminated
      const revalidatedResult = engine.evaluate(env);
      const resolvedPf001 = revalidatedResult.findings.find((f) => f.ruleId === 'PF-001');
      expect(resolvedPf001).toBeUndefined();
    });

    it('executes enable-encryption remediation and resolves PF-008 upon revalidation', () => {
      const env = new Environment({ id: 'test-encrypt', name: 'Encrypt Test' });
      const app = env.createNode('api_server', { x: 0, y: 0 }, undefined, { zone: 'internal' });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
        service: { port: 5432 },
      });
      const edge = env.createEdge(app.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        encrypted: false,
        access: 'allow',
      });

      const initialResult = engine.evaluate(env);
      const pf008 = initialResult.findings.find((f) => f.ruleId === 'PF-008')!;
      expect(pf008).toBeDefined();

      const action = getPrimaryRemediationAction(pf008, env)!;
      expect(action.type).toBe('enable-encryption');

      const success = action.apply!(env);
      expect(success).toBe(true);
      expect(env.getEdge(edge.id)?.encrypted).toBe(true);

      const revalidatedResult = engine.evaluate(env);
      expect(revalidatedResult.findings.find((f) => f.ruleId === 'PF-008')).toBeUndefined();
    });

    it('executes restrict-port remediation and resolves PF-007 wildcard upon revalidation', () => {
      const env = new Environment({ id: 'test-port-restrict', name: 'Port Test' });
      const web = env.createNode('web_server', { x: 0, y: 0 }, undefined, { zone: 'dmz' });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        service: { port: 5432 },
      });
      const edge = env.createEdge(web.id, db.id, {
        protocol: 'TCP',
        ports: 'ANY',
        portConfig: { type: 'any' },
        access: 'allow',
        encrypted: true,
      });

      const initialResult = engine.evaluate(env);
      const wildcardFinding = initialResult.findings.find(
        (f) => f.ruleId === 'PF-007' && f.id.includes('wildcard')
      )!;
      expect(wildcardFinding).toBeDefined();

      const action = getPrimaryRemediationAction(wildcardFinding, env)!;
      expect(action.type).toBe('restrict-port');

      const success = action.apply!(env);
      expect(success).toBe(true);
      expect(env.getEdge(edge.id)?.ports).toBe('5432');
      expect(env.getEdge(edge.id)?.portConfig).toEqual({ type: 'single', value: 5432 });

      const revalidatedResult = engine.evaluate(env);
      expect(
        revalidatedResult.findings.find(
          (f) => f.ruleId === 'PF-007' && f.id.includes('wildcard')
        )
      ).toBeUndefined();
    });

    it('executes remove-edge remediation safely without side-effects on unrelated elements', () => {
      const env = new Environment({ id: 'test-remove', name: 'Remove Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const firewall = env.createNode('firewall', { x: 150, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        service: { port: 5432 },
      });

      const legitEdge = env.createEdge(internet.id, firewall.id, { protocol: 'HTTPS', ports: '443' });
      const dangerousEdge = env.createEdge(internet.id, db.id, { protocol: 'TCP', ports: '5432' });

      const pf001 = engine.evaluate(env).findings.find((f) => f.ruleId === 'PF-001')!;
      const removeAction = getRemediationActions(pf001, env).find((a) => a.type === 'remove-edge')!;

      const success = removeAction.apply!(env);
      expect(success).toBe(true);

      expect(env.getEdge(dangerousEdge.id)).toBeUndefined();
      expect(env.getEdge(legitEdge.id)).toBeDefined();
      expect(env.getNode(internet.id)).toBeDefined();
      expect(env.getNode(db.id)).toBeDefined();
      expect(env.getNodes().length).toBe(3);
    });

    it('safely handles non-existent edge gracefully without crashing', () => {
      const env = new Environment({ id: 'test-safe', name: 'Safe Test' });
      const fakeFinding: Finding = {
        id: 'fake-finding',
        ruleId: 'PF-001',
        severity: 'critical',
        category: 'exposure',
        title: 'Fake Finding',
        description: 'Test',
        whyItMatters: 'Test',
        impact: 'Test',
        affectedNodes: ['node-1'],
        affectedEdges: ['non-existent-edge-123'],
        recommendation: 'Fix',
        remediation: 'Fix',
      };

      const actions = getRemediationActions(fakeFinding, env);
      expect(actions.length).toBe(0);
    });
  });

  describe('Full Remediation Lifecycle & Resolution Tracking', () => {
    it('tracks resolved findings across validation cycles', () => {
      const env = new Environment({ id: 'test-lifecycle', name: 'Lifecycle Env' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        service: { port: 5432 },
      });
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      // Step 1: Initial evaluation
      const initialResult = engine.evaluate(env);
      const initialPf001 = initialResult.findings.find((f) => f.ruleId === 'PF-001')!;
      expect(initialPf001).toBeDefined();

      // Step 2: User applies remediation action
      const action = getPrimaryRemediationAction(initialPf001, env)!;
      action.apply!(env);

      // Step 3: Revalidate and calculate resolved findings
      const newResult = engine.evaluate(env);
      const newFindingIds = new Set(newResult.findings.map((f) => f.id));
      const newlyResolved = initialResult.findings.filter((f) => !newFindingIds.has(f.id));

      expect(newlyResolved.length).toBeGreaterThanOrEqual(1);
      expect(newlyResolved.some((f) => f.ruleId === 'PF-001')).toBe(true);
    });
  });

  describe('Finding Filtering Logic', () => {
    const mockFindings: Finding[] = [
      {
        id: 'f-1',
        ruleId: 'PF-001',
        severity: 'critical',
        category: 'exposure',
        title: 'Critical Database Exposure',
        description: 'd1',
        whyItMatters: 'w1',
        impact: 'i1',
        affectedNodes: ['internet-1', 'db-1'],
        affectedEdges: ['e-1'],
        recommendation: 'r1',
        remediation: 'fix1',
      },
      {
        id: 'f-2',
        ruleId: 'PF-007',
        severity: 'high',
        category: 'access_control',
        title: 'Wildcard Port Ingress',
        description: 'd2',
        whyItMatters: 'w2',
        impact: 'i2',
        affectedNodes: ['web-1', 'api-1'],
        affectedEdges: ['e-2'],
        recommendation: 'r2',
        remediation: 'fix2',
      },
      {
        id: 'f-3',
        ruleId: 'PF-008',
        severity: 'medium',
        category: 'access_control',
        title: 'Unencrypted Internal Link',
        description: 'd3',
        whyItMatters: 'w3',
        impact: 'i3',
        affectedNodes: ['api-1', 'db-1'],
        affectedEdges: ['e-3'],
        recommendation: 'r3',
        remediation: 'fix3',
      },
    ];

    it('filters correctly by severity', () => {
      const crit = mockFindings.filter((f) => f.severity === 'critical');
      const high = mockFindings.filter((f) => f.severity === 'high');
      const med = mockFindings.filter((f) => f.severity === 'medium');

      expect(crit).toHaveLength(1);
      expect(crit[0].id).toBe('f-1');
      expect(high).toHaveLength(1);
      expect(high[0].id).toBe('f-2');
      expect(med).toHaveLength(1);
      expect(med[0].id).toBe('f-3');
    });

    it('filters correctly by category', () => {
      const exposure = mockFindings.filter((f) => f.category === 'exposure');
      const access = mockFindings.filter((f) => f.category === 'access_control');

      expect(exposure).toHaveLength(1);
      expect(access).toHaveLength(2);
    });

    it('filters correctly by affected asset', () => {
      const dbFindings = mockFindings.filter((f) => f.affectedNodes.includes('db-1'));
      expect(dbFindings).toHaveLength(2);
      expect(dbFindings.map((f) => f.id)).toEqual(['f-1', 'f-3']);

      const webFindings = mockFindings.filter((f) => f.affectedNodes.includes('web-1'));
      expect(webFindings).toHaveLength(1);
      expect(webFindings[0].id).toBe('f-2');
    });

    it('handles combined filters and produces empty state when no findings match', () => {
      const combined = mockFindings.filter(
        (f) => f.severity === 'critical' && f.category === 'access_control'
      );
      expect(combined).toHaveLength(0);
    });
  });
});
