import { describe, it, expect } from 'vitest';
import {
  Environment,
  instantiateScenario,
  analyzeBlastRadius,
  analyzeAllBlastRadii,
} from '../packages/core/src/index.js';

describe('Phase 2.2 — Blast Radius & Lateral Movement Analysis', () => {
  // Helper to build a clean synthetic environment
  function createTestEnvironment(name = 'Test Lab'): Environment {
    const env = new Environment({
      id: `env-${Math.random().toString(36).slice(2, 9)}`,
      name,
    });
    return env;
  }

  describe('1. Basic Traversal & Depth Calculation', () => {
    it('traverses linear path Web -> API -> DB from compromised Web server', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      web.updateConfig({ name: 'Web Server', zone: 'dmz', criticality: 'medium' });

      const api = env.createNode('api_server', { x: 300, y: 100 });
      api.updateConfig({ name: 'API Server', zone: 'internal', criticality: 'medium' });

      const db = env.createNode('database', { x: 500, y: 100 });
      db.updateConfig({ name: 'Database', zone: 'restricted', criticality: 'critical' });

      const e1 = env.createEdge(web.id, api.id);
      e1.updateConfig({ access: 'allow', protocol: 'HTTP', ports: '8080' });

      const e2 = env.createEdge(api.id, db.id);
      e2.updateConfig({ access: 'allow', protocol: 'TCP', ports: '5432' });

      const result = analyzeBlastRadius(env, web.id);
      const { blastRadius, summary } = result;

      expect(blastRadius.compromisedNode.id).toBe(web.id);
      expect(blastRadius.compromisedNode.name).toBe('Web Server');
      expect(blastRadius.reachableNodes.length).toBe(2);

      const reachableIds = blastRadius.reachableNodes.map((n) => n.id);
      expect(reachableIds).toContain(api.id);
      expect(reachableIds).toContain(db.id);

      const apiSummary = blastRadius.reachableNodes.find((n) => n.id === api.id);
      const dbSummary = blastRadius.reachableNodes.find((n) => n.id === db.id);

      expect(apiSummary?.depth).toBe(1);
      expect(dbSummary?.depth).toBe(2);
      expect(blastRadius.maxDepth).toBe(2);
      expect(summary.totalReachableAssets).toBe(2);
      expect(summary.maxLateralMovementDepth).toBe(2);
    });
  });

  describe('2. DENY Barrier Enforcement', () => {
    it('stops lateral movement at DENY barriers', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      const api = env.createNode('api_server', { x: 300, y: 100 });
      const db = env.createNode('database', { x: 500, y: 100 });
      db.updateConfig({ criticality: 'critical', zone: 'restricted' });

      const e1 = env.createEdge(web.id, api.id);
      e1.updateConfig({ access: 'allow' });

      const e2 = env.createEdge(api.id, db.id);
      e2.updateConfig({ access: 'deny' }); // DENY barrier

      const result = analyzeBlastRadius(env, web.id);
      expect(result.blastRadius.reachableNodes.length).toBe(1);
      expect(result.blastRadius.reachableNodes[0].id).toBe(api.id);
      expect(result.blastRadius.maxDepth).toBe(1);

      // DB is blocked
      const reachableIds = result.blastRadius.reachableNodes.map((n) => n.id);
      expect(reachableIds).not.toContain(db.id);
      expect(result.blastRadius.criticalAssetsReached).toBe(0);
    });
  });

  describe('3. Strict Directed Traversal', () => {
    it('never traverses against edge direction', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      const api = env.createNode('api_server', { x: 300, y: 100 });

      // Edge points API -> Web only
      const edge = env.createEdge(api.id, web.id);
      edge.updateConfig({ access: 'allow' });

      // If Web is compromised, API should NOT be reachable
      const result = analyzeBlastRadius(env, web.id);
      expect(result.blastRadius.reachableNodes.length).toBe(0);
      expect(result.blastRadius.maxDepth).toBe(0);
      expect(result.summary.totalReachableAssets).toBe(0);
    });
  });

  describe('4. Cycle & Self-Loop Termination', () => {
    it('terminates safely on circular topologies and does not self-count', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      const api = env.createNode('api_server', { x: 300, y: 100 });

      // Cycle: Web -> API -> Web
      const e1 = env.createEdge(web.id, api.id);
      e1.updateConfig({ access: 'allow' });
      const e2 = env.createEdge(api.id, web.id);
      e2.updateConfig({ access: 'allow' });

      const result = analyzeBlastRadius(env, web.id);
      expect(result.blastRadius.reachableNodes.length).toBe(1);
      expect(result.blastRadius.reachableNodes[0].id).toBe(api.id);
      expect(result.blastRadius.maxDepth).toBe(1);

      // Web itself is not in reachable nodes
      const reachableIds = result.blastRadius.reachableNodes.map((n) => n.id);
      expect(reachableIds).not.toContain(web.id);
    });
  });

  describe('5. Trust Boundary Transitions', () => {
    it('tracks distinct trust boundaries and reached zones', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      web.updateConfig({ zone: 'dmz' });

      const api = env.createNode('api_server', { x: 300, y: 100 });
      api.updateConfig({ zone: 'internal' });

      const db = env.createNode('database', { x: 500, y: 100 });
      db.updateConfig({ zone: 'restricted', criticality: 'critical' });

      env.createEdge(web.id, api.id).updateConfig({ access: 'allow' });
      env.createEdge(api.id, db.id).updateConfig({ access: 'allow' });

      const result = analyzeBlastRadius(env, web.id);
      const { blastRadius } = result;

      // 2 boundaries: dmz -> internal, internal -> restricted
      expect(blastRadius.trustBoundariesCrossed).toBe(2);
      expect(blastRadius.boundaryTransitions.length).toBe(2);
      expect(blastRadius.boundaryTransitions[0].fromZone).toBe('dmz');
      expect(blastRadius.boundaryTransitions[0].toZone).toBe('internal');
      expect(blastRadius.boundaryTransitions[1].fromZone).toBe('internal');
      expect(blastRadius.boundaryTransitions[1].toZone).toBe('restricted');

      expect(blastRadius.zonesReached).toEqual(['internal', 'restricted']);
    });

    it('aliases private zone to internal and does not double-count identical boundary transitions', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      web.updateConfig({ zone: 'dmz' });

      // Two servers in internal/private
      const s1 = env.createNode('api_server', { x: 300, y: 100 });
      s1.updateConfig({ zone: 'internal' });

      const s2 = env.createNode('api_server', { x: 300, y: 200 });
      s2.updateConfig({ zone: 'private' }); // Aliased to internal

      env.createEdge(web.id, s1.id).updateConfig({ access: 'allow' });
      env.createEdge(web.id, s2.id).updateConfig({ access: 'allow' });

      const result = analyzeBlastRadius(env, web.id);
      // Both are dmz -> internal; unique boundary count should be 1
      expect(result.blastRadius.trustBoundariesCrossed).toBe(1);
    });
  });

  describe('6. Critical Asset Reachability & Impact Scoring', () => {
    it('rates impact as CRITICAL when crown jewels are reached', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      web.updateConfig({ criticality: 'low', zone: 'dmz' });

      const db = env.createNode('database', { x: 300, y: 100 });
      db.updateConfig({ name: 'Prod DB', criticality: 'critical', zone: 'restricted' });

      env.createEdge(web.id, db.id).updateConfig({ access: 'allow' });

      const result = analyzeBlastRadius(env, web.id);
      expect(result.blastRadius.highestImpact).toBe('critical');
      expect(result.blastRadius.criticalAssetsReached).toBe(1);
      expect(result.blastRadius.riskFactors.some((rf) => rf.includes('critical asset'))).toBe(true);
      expect(result.blastRadius.riskFactors.some((rf) => rf.includes('RESTRICTED'))).toBe(true);
    });

    it('rates impact as HIGH when multiple non-critical internal assets are reached', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      web.updateConfig({ zone: 'dmz' });

      const n1 = env.createNode('internal_network', { x: 300, y: 50 });
      n1.updateConfig({ zone: 'internal', criticality: 'low' });

      const n2 = env.createNode('api_server', { x: 300, y: 150 });
      n2.updateConfig({ zone: 'internal', criticality: 'low' });

      const n3 = env.createNode('api_server', { x: 300, y: 250 });
      n3.updateConfig({ zone: 'internal', criticality: 'low' });

      env.createEdge(web.id, n1.id).updateConfig({ access: 'allow' });
      env.createEdge(web.id, n2.id).updateConfig({ access: 'allow' });
      env.createEdge(web.id, n3.id).updateConfig({ access: 'allow' });

      const result = analyzeBlastRadius(env, web.id);
      expect(result.blastRadius.highestImpact).toBe('high');
      expect(result.blastRadius.reachableNodes.length).toBe(3);
    });
  });

  describe('7. Multiple Branches & Fan-out', () => {
    it('discovers all reachable branches from a single pivot node', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 200 });

      const api = env.createNode('api_server', { x: 300, y: 100 });
      const redis = env.createNode('redis', { x: 300, y: 200 });
      const admin = env.createNode('admin', { x: 300, y: 300 });

      const db = env.createNode('database', { x: 500, y: 100 });

      env.createEdge(web.id, api.id).updateConfig({ access: 'allow' });
      env.createEdge(web.id, redis.id).updateConfig({ access: 'allow' });
      env.createEdge(web.id, admin.id).updateConfig({ access: 'allow' });
      env.createEdge(api.id, db.id).updateConfig({ access: 'allow' });

      const result = analyzeBlastRadius(env, web.id);
      expect(result.blastRadius.reachableNodes.length).toBe(4);
      expect(result.blastRadius.maxDepth).toBe(2);

      const reachableIds = result.blastRadius.reachableNodes.map((n) => n.id);
      expect(reachableIds).toContain(api.id);
      expect(reachableIds).toContain(redis.id);
      expect(reachableIds).toContain(admin.id);
      expect(reachableIds).toContain(db.id);
    });
  });

  describe('8. Isolated Compromise & DENY-only Outgoing', () => {
    it('returns 0 reachable assets and LOW impact for isolated node', () => {
      const env = createTestEnvironment();
      const isolated = env.createNode('database', { x: 100, y: 100 });

      const result = analyzeBlastRadius(env, isolated.id);
      expect(result.blastRadius.reachableNodes.length).toBe(0);
      expect(result.blastRadius.maxDepth).toBe(0);
      expect(result.blastRadius.trustBoundariesCrossed).toBe(0);
      expect(result.blastRadius.highestImpact).toBe('low');
      expect(result.summary.highestImpact).toBe('none');
      expect(result.blastRadius.riskFactors[0]).toContain('isolated');
    });

    it('returns 0 reachable assets when all outgoing edges are DENY', () => {
      const env = createTestEnvironment();
      const web = env.createNode('web_server', { x: 100, y: 100 });
      const api = env.createNode('api_server', { x: 300, y: 100 });

      const edge = env.createEdge(web.id, api.id);
      edge.updateConfig({ access: 'deny' });

      const result = analyzeBlastRadius(env, web.id);
      expect(result.blastRadius.reachableNodes.length).toBe(0);
      expect(result.blastRadius.maxDepth).toBe(0);
      expect(result.blastRadius.highestImpact).toBe('low');
    });
  });

  describe('9. Visual Coordinate Independence', () => {
    it('produces identical blast radius results regardless of (x, y) coordinates', () => {
      const envA = createTestEnvironment('A');
      const webA = envA.createNode('web_server', { x: 10, y: 20 });
      const apiA = envA.createNode('api_server', { x: 30, y: 40 });
      envA.createEdge(webA.id, apiA.id).updateConfig({ access: 'allow', ports: '8080' });

      const envB = createTestEnvironment('B');
      const webB = envB.createNode('web_server', { x: 9999, y: 8888 });
      const apiB = envB.createNode('api_server', { x: -500, y: -200 });
      envB.createEdge(webB.id, apiB.id).updateConfig({ access: 'allow', ports: '8080' });

      const resA = analyzeBlastRadius(envA, webA.id, { analyzedAt: '2026-01-01T00:00:00Z' });
      const resB = analyzeBlastRadius(envB, webB.id, { analyzedAt: '2026-01-01T00:00:00Z' });

      expect(resA.blastRadius.maxDepth).toBe(resB.blastRadius.maxDepth);
      expect(resA.blastRadius.reachableNodes.length).toBe(resB.blastRadius.reachableNodes.length);
      expect(resA.blastRadius.highestImpact).toBe(resB.blastRadius.highestImpact);
      expect(resA.blastRadius.trustBoundariesCrossed).toBe(resB.blastRadius.trustBoundariesCrossed);
    });
  });

  describe('10. Stable Ordering & Determinism', () => {
    it('consistently produces identical serialized JSON output across consecutive runs', () => {
      const env = createTestEnvironment();
      const n1 = env.createNode('web_server', { x: 100, y: 100 });
      const n2 = env.createNode('api_server', { x: 200, y: 100 });
      const n3 = env.createNode('database', { x: 300, y: 100 });

      env.createEdge(n1.id, n3.id).updateConfig({ access: 'allow' });
      env.createEdge(n1.id, n2.id).updateConfig({ access: 'allow' });

      const fixedTime = '2026-10-07T12:00:00.000Z';
      const run1 = JSON.stringify(analyzeBlastRadius(env, n1.id, { analyzedAt: fixedTime }));
      const run2 = JSON.stringify(analyzeBlastRadius(env, n1.id, { analyzedAt: fixedTime }));

      expect(run1).toBe(run2);
    });
  });

  describe('11. Catalog Scenarios Verification', () => {
    it('analyzes secure-web-app reference topology correctly', () => {
      const env = instantiateScenario('secure-web-app');

      // Find Web Server node
      const webNode = env.getNodes().find((n) => n.type === 'web_server');
      expect(webNode).toBeDefined();

      const result = analyzeBlastRadius(env, webNode!.id);
      // In secure-web-app, Web Server can reach API server -> which can reach DB and Redis
      expect(result.blastRadius.reachableNodes.length).toBeGreaterThanOrEqual(1);

      // Database is a leaf node; compromising Database yields 0 lateral movement
      const dbNode = env.getNodes().find((n) => n.type === 'database');
      expect(dbNode).toBeDefined();

      const dbResult = analyzeBlastRadius(env, dbNode!.id);
      expect(dbResult.blastRadius.reachableNodes.length).toBe(0);
      expect(dbResult.blastRadius.maxDepth).toBe(0);
    });

    it('analyzes public-db-exposure scenario correctly', () => {
      const env = instantiateScenario('public-db-exposure');
      const dbNode = env.getNodes().find((n) => n.type === 'database');
      expect(dbNode).toBeDefined();

      // Database has no outgoing edges
      const dbResult = analyzeBlastRadius(env, dbNode!.id);
      expect(dbResult.blastRadius.reachableNodes.length).toBe(0);

      // Internet node has direct exposure to database
      const internetNode = env.getNodes().find((n) => n.type === 'internet');
      expect(internetNode).toBeDefined();

      const internetResult = analyzeBlastRadius(env, internetNode!.id);
      expect(internetResult.blastRadius.reachableNodes.length).toBe(1);
      expect(internetResult.blastRadius.reachableNodes[0].id).toBe(dbNode!.id);
      expect(internetResult.blastRadius.highestImpact).toBe('critical');
    });

    it('analyzes flat-network unsegmented topology correctly', () => {
      const env = instantiateScenario('flat-network');
      const webNode = env.getNodes().find((n) => n.type === 'web_server');
      expect(webNode).toBeDefined();

      const result = analyzeBlastRadius(env, webNode!.id);
      // Flat network allows wide reachability
      expect(result.blastRadius.reachableNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('analyzes all blast radii across chaos-lab', () => {
      const env = instantiateScenario('chaos-lab');
      const allResults = analyzeAllBlastRadii(env);

      expect(allResults.size).toBe(env.getNodes().length);
      for (const node of env.getNodes()) {
        const res = allResults.get(node.id);
        expect(res).toBeDefined();
        expect(res?.compromisedNodeId).toBe(node.id);
      }
    });
  });
});
