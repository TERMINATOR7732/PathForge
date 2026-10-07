import { describe, it, expect } from 'vitest';
import {
  Environment,
  analyzeAttackPaths,
  generateAttackPathId,
  isPotentialEntryPoint,
  isSensitiveTarget,
  isTrustBoundaryCrossing,
  instantiateScenario,
} from '@pathforge/core';

describe('Phase 2.1 — Attack Path Analysis Foundation', () => {
  describe('Entry Point & Sensitive Target Semantics', () => {
    it('accurately identifies potential entry points based on public zone and internet type', () => {
      const env = new Environment({ id: 'ep-test', name: 'Entry Point Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const publicWeb = env.createNode('web_server', { x: 100, y: 0 }, undefined, { zone: 'public' });
      const internalApi = env.createNode('api_server', { x: 200, y: 0 }, undefined, { zone: 'internal' });
      const externalNet = env.createNode('external_network', { x: 300, y: 0 });

      expect(isPotentialEntryPoint(internet)).toBe(true);
      expect(isPotentialEntryPoint(publicWeb)).toBe(true);
      expect(isPotentialEntryPoint(externalNet)).toBe(true);
      expect(isPotentialEntryPoint(internalApi)).toBe(false);
    });

    it('identifies sensitive targets based on criticality, restricted zone, or sensitive asset type', () => {
      const env = new Environment({ id: 'target-test', name: 'Target Classification Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 }); // Public entry point
      const ordinaryWeb = env.createNode('web_server', { x: 100, y: 0 }, undefined, {
        zone: 'dmz',
        criticality: 'low',
      });
      const criticalService = env.createNode('web_server', { x: 200, y: 0 }, undefined, {
        zone: 'internal',
        criticality: 'critical',
      });
      const restrictedNode = env.createNode('api_server', { x: 300, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'medium',
      });
      const dbNode = env.createNode('database', { x: 400, y: 0 }, undefined, {
        zone: 'internal',
        criticality: 'medium',
      });
      const adminNode = env.createNode('admin', { x: 500, y: 0 });

      // Entry points must NEVER be treated as sensitive targets
      expect(isSensitiveTarget(internet)).toBe(false);

      // Ordinary low-criticality web server in DMZ is not sensitive
      expect(isSensitiveTarget(ordinaryWeb)).toBe(false);

      // Criticality, restricted zone, and database/admin types are sensitive
      expect(isSensitiveTarget(criticalService)).toBe(true);
      expect(isSensitiveTarget(restrictedNode)).toBe(true);
      expect(isSensitiveTarget(dbNode)).toBe(true);
      expect(isSensitiveTarget(adminNode)).toBe(true);
    });

    it('correctly calculates trust boundary crossings across distinct network zones', () => {
      expect(isTrustBoundaryCrossing('public', 'dmz')).toBe(true);
      expect(isTrustBoundaryCrossing('dmz', 'internal')).toBe(true);
      expect(isTrustBoundaryCrossing('internal', 'restricted')).toBe(true);
      expect(isTrustBoundaryCrossing('dmz', 'dmz')).toBe(false);
      expect(isTrustBoundaryCrossing('internal', 'internal')).toBe(false);
      // 'private' is treated as an alias for 'internal'
      expect(isTrustBoundaryCrossing('internal', 'private')).toBe(false);
    });
  });

  describe('Deterministic Traversal & Directionality', () => {
    it('discovers a single-hop direct attack path from public ingress to database', () => {
      const env = new Environment({ id: 'direct-attack-env', name: 'Direct Public Exposure' });
      const internet = env.createNode('internet', { x: 0, y: 0 }, 'Public Internet');
      const db = env.createNode('database', { x: 200, y: 0 }, 'Primary DB', {
        zone: 'restricted',
        criticality: 'critical',
      });
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const result = analyzeAttackPaths(env);

      expect(result.summary.entryPointCount).toBe(1);
      expect(result.summary.attackPathCount).toBe(1);
      expect(result.summary.sensitiveAssetsReached).toBe(1);
      expect(result.summary.criticalAssetsReached).toBe(1);
      expect(result.summary.highestRisk).toBe('critical');

      const path = result.attackPaths[0];
      expect(path.entryPoint.id).toBe(internet.id);
      expect(path.target.id).toBe(db.id);
      expect(path.hopCount).toBe(1);
      expect(path.trustBoundariesCrossed).toBe(1); // public -> restricted
      expect(path.risk).toBe('critical');
      expect(path.steps.length).toBe(1);
      expect(path.steps[0].protocol).toBe('TCP');
      expect(path.steps[0].ports).toBe('5432');
      expect(path.whyItExists.length).toBeGreaterThan(1);
      expect(path.riskFactors).toContain('Direct 1-hop exposure to attacker');
    });

    it('respects edge direction: does not traverse backwards without reverse edge', () => {
      const env = new Environment({ id: 'direction-env', name: 'Directional Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 200, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });

      // Reverse edge: DB -> Internet (e.g. egress), but NO edge from Internet -> DB
      env.createEdge(db.id, internet.id, {
        protocol: 'TCP',
        ports: '443',
        access: 'allow',
      });

      const result = analyzeAttackPaths(env);
      // Attacker starting at internet cannot traverse backwards to DB
      expect(result.attackPaths.length).toBe(0);
      expect(result.summary.sensitiveAssetsReached).toBe(0);
    });

    it('traverses multi-hop path and computes exact hop count and boundary crossings', () => {
      const env = new Environment({ id: 'multihop-env', name: 'Multi-Hop Architecture' });
      const internet = env.createNode('internet', { x: 0, y: 0 }, 'Internet'); // public
      const fw = env.createNode('firewall', { x: 150, y: 0 }, 'Firewall', { zone: 'dmz' });
      const web = env.createNode('web_server', { x: 300, y: 0 }, 'Web', { zone: 'dmz' });
      const api = env.createNode('api_server', { x: 450, y: 0 }, 'API', { zone: 'internal' });
      const db = env.createNode('database', { x: 600, y: 0 }, 'DB', {
        zone: 'restricted',
        criticality: 'critical',
      });

      // Internet -> FW -> Web -> API -> DB (4 hops)
      env.createEdge(internet.id, fw.id, { protocol: 'HTTPS', ports: '443', access: 'allow', encrypted: true });
      env.createEdge(fw.id, web.id, { protocol: 'HTTP', ports: '8080', access: 'allow', encrypted: false });
      env.createEdge(web.id, api.id, { protocol: 'HTTP', ports: '3000', access: 'allow', encrypted: false });
      env.createEdge(api.id, db.id, { protocol: 'TCP', ports: '5432', access: 'allow', encrypted: true });

      const result = analyzeAttackPaths(env);

      expect(result.attackPaths.length).toBe(1);
      const path = result.attackPaths[0];

      expect(path.hopCount).toBe(4);
      // public -> dmz (+1), dmz -> dmz (+0), dmz -> internal (+1), internal -> restricted (+1) = 3 boundaries
      expect(path.trustBoundariesCrossed).toBe(3);
      expect(path.nodes.map((n) => n.id)).toEqual([internet.id, fw.id, web.id, api.id, db.id]);
      expect(path.edges.length).toBe(4);
      expect(path.risk).toBe('high'); // Multi-tier public path reaching critical database across 3 boundaries
      expect(path.whyItExists.length).toBe(6); // 1 premise + 4 hops + 1 conclusion
    });

    it('discovers multiple reachable sensitive targets from a single entry point', () => {
      const env = new Environment({ id: 'multi-target-env', name: 'Multi Target Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const web = env.createNode('web_server', { x: 200, y: 0 }, undefined, { zone: 'dmz' });
      const db = env.createNode('database', { x: 400, y: -100 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });
      const admin = env.createNode('admin', { x: 400, y: 100 }, undefined, {
        zone: 'management',
        criticality: 'high',
      });

      env.createEdge(internet.id, web.id, { protocol: 'HTTPS', ports: '443', access: 'allow' });
      env.createEdge(web.id, db.id, { protocol: 'TCP', ports: '5432', access: 'allow' });
      env.createEdge(web.id, admin.id, { protocol: 'SSH', ports: '22', access: 'allow' });

      const result = analyzeAttackPaths(env);

      expect(result.attackPaths.length).toBe(2);
      expect(result.summary.sensitiveAssetsReached).toBe(2);

      const targetIds = result.attackPaths.map((p) => p.target.id);
      expect(targetIds).toContain(db.id);
      expect(targetIds).toContain(admin.id);
    });
  });

  describe('Barrier Semantics & DENY Edge Enforcement', () => {
    it('blocks traversal through DENY edges and eliminates attack paths', () => {
      const env = new Environment({ id: 'deny-barrier-env', name: 'DENY Barrier Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const web = env.createNode('web_server', { x: 200, y: 0 }, undefined, { zone: 'dmz' });
      const db = env.createNode('database', { x: 400, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });

      env.createEdge(internet.id, web.id, { protocol: 'HTTPS', ports: '443', access: 'allow' });
      // Ingress to DB is explicitly DENIED
      env.createEdge(web.id, db.id, { protocol: 'TCP', ports: '5432', access: 'deny' });

      const result = analyzeAttackPaths(env);

      // Traversal reaches web, but cannot cross the DENY barrier into DB
      expect(result.reachableAssets).toContain(web.id);
      expect(result.reachableAssets).not.toContain(db.id);
      expect(result.attackPaths.length).toBe(0);
      expect(result.summary.sensitiveAssetsReached).toBe(0);
    });

    it('eliminates attack path when remediation changes ALLOW edge to DENY', () => {
      const env = new Environment({ id: 'remediation-env', name: 'Remediation Dynamic Test' });
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

      // Before remediation: Path exists
      const beforeResult = analyzeAttackPaths(env);
      expect(beforeResult.attackPaths.length).toBe(1);

      // Apply remediation: change edge to DENY
      env.updateEdgeConfig(edge.id, { access: 'deny' });

      // After remediation: Path is eliminated
      const afterResult = analyzeAttackPaths(env);
      expect(afterResult.attackPaths.length).toBe(0);
      expect(afterResult.summary.sensitiveAssetsReached).toBe(0);
    });
  });

  describe('Cycle Termination & Self-Loops', () => {
    it('terminates safely on graphs with cyclic feedback loops without infinite traversal', () => {
      const env = new Environment({ id: 'cyclic-env', name: 'Cyclic Graph Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 });
      const web = env.createNode('web_server', { x: 200, y: 0 }, undefined, { zone: 'dmz' });
      const api = env.createNode('api_server', { x: 400, y: 0 }, undefined, { zone: 'internal' });
      const db = env.createNode('database', { x: 600, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });

      // Forward edges
      env.createEdge(internet.id, web.id, { protocol: 'HTTPS', ports: '443', access: 'allow' });
      env.createEdge(web.id, api.id, { protocol: 'HTTP', ports: '8080', access: 'allow' });
      env.createEdge(api.id, db.id, { protocol: 'TCP', ports: '5432', access: 'allow' });

      // Cycle edge: API -> Web (backwards loop)
      env.createEdge(api.id, web.id, { protocol: 'HTTP', ports: '8080', access: 'allow' });

      // Self loop on web
      env.createEdge(web.id, web.id, { protocol: 'TCP', ports: '9000', access: 'allow' });

      const result = analyzeAttackPaths(env);

      // Traversal must terminate and find exactly 1 shortest path to DB
      expect(result.attackPaths.length).toBe(1);
      expect(result.attackPaths[0].hopCount).toBe(3); // Internet -> Web -> API -> DB
      expect(result.attackPaths[0].target.id).toBe(db.id);
    });
  });

  describe('Deterministic Identity & Layout Isolation', () => {
    it('produces identical deterministic path IDs across runs for identical graphs', () => {
      const env1 = instantiateScenario('public-db-exposure');
      const env2 = instantiateScenario('public-db-exposure');

      const result1 = analyzeAttackPaths(env1);
      const result2 = analyzeAttackPaths(env2);

      expect(result1.attackPaths.length).toBeGreaterThan(0);
      expect(result1.attackPaths.length).toBe(result2.attackPaths.length);

      for (let i = 0; i < result1.attackPaths.length; i++) {
        expect(result1.attackPaths[i].id).toBe(result2.attackPaths[i].id);
        expect(result1.attackPaths[i].risk).toBe(result2.attackPaths[i].risk);
        expect(result1.attackPaths[i].hopCount).toBe(result2.attackPaths[i].hopCount);
      }
    });

    it('isolates presentation layout: modifying node coordinates does not change attack paths', () => {
      const env = new Environment({ id: 'layout-isolation', name: 'Layout Isolation Test' });
      const internet = env.createNode('internet', { x: 50, y: 100 });
      const db = env.createNode('database', { x: 300, y: 100 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });
      env.createEdge(internet.id, db.id, { protocol: 'TCP', ports: '5432', access: 'allow' });

      const initialResult = analyzeAttackPaths(env);

      // Reposition both nodes purely in visual space
      env.updateNodePosition(internet.id, 9999, 8888);
      env.updateNodePosition(db.id, 1234, 5678);

      const afterResult = analyzeAttackPaths(env);

      expect(afterResult.attackPaths.length).toBe(initialResult.attackPaths.length);
      expect(afterResult.attackPaths[0].id).toBe(initialResult.attackPaths[0].id);
      expect(afterResult.attackPaths[0].risk).toBe(initialResult.attackPaths[0].risk);
      expect(afterResult.summary).toEqual(initialResult.summary);
    });
  });

  describe('Catalog Scenario Integrations', () => {
    it('accurately analyzes public-db-exposure scenario', () => {
      const env = instantiateScenario('public-db-exposure');
      const result = analyzeAttackPaths(env);

      expect(result.summary.entryPointCount).toBe(1);
      expect(result.summary.attackPathCount).toBe(1);
      expect(result.summary.highestRisk).toBe('critical');

      const path = result.attackPaths[0];
      expect(path.target.type).toBe('database');
      expect(path.hopCount).toBe(1);
      expect(path.risk).toBe('critical');
    });

    it('accurately analyzes secure-web-app scenario', () => {
      const env = instantiateScenario('secure-web-app');
      const result = analyzeAttackPaths(env);

      // Both DB and Redis are sensitive targets reached from public internet via multi-tier allowed chain
      expect(result.summary.entryPointCount).toBe(1);
      expect(result.summary.attackPathCount).toBe(2);

      const targets = result.attackPaths.map((p) => p.target.name);
      expect(targets.some((t) => t.includes('DB') || t.includes('PostgreSQL'))).toBe(true);
      expect(targets.some((t) => t.includes('Redis'))).toBe(true);

      for (const path of result.attackPaths) {
        expect(path.hopCount).toBe(5); // Internet -> FW -> LB -> Web -> API -> DB/Redis
        expect(path.trustBoundariesCrossed).toBeGreaterThanOrEqual(2);
      }
    });

    it('accurately analyzes chaos-lab scenario discovering multiple severe attack paths', () => {
      const env = instantiateScenario('chaos-lab');
      const result = analyzeAttackPaths(env);

      // Chaos lab has direct internet connections to DB, Admin, and Internal net
      expect(result.summary.attackPathCount).toBeGreaterThanOrEqual(2);
      expect(result.summary.highestRisk).toBe('critical');

      const directPaths = result.attackPaths.filter((p) => p.hopCount === 1);
      expect(directPaths.length).toBeGreaterThan(0);
    });
  });
});
