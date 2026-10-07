import { describe, it, expect } from 'vitest';
import {
  Environment,
  analyzeArchitecture,
  inferNodeTier,
  instantiateScenario,
} from '@pathforge/core';

describe('Phase 2.4 — Architecture Analysis Intelligence', () => {
  describe('Tier Inference & Separation', () => {
    it('correctly infers standard node tiers with high confidence', () => {
      const env = new Environment({ id: 'tier-test-env', name: 'Tier Test' });
      const inet = env.createNode('internet', { x: 0, y: 0 });
      const fw = env.createNode('firewall', { x: 100, y: 0 });
      const web = env.createNode('web_server', { x: 200, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 });
      const admin = env.createNode('admin', { x: 400, y: 0 });
      const internalNet = env.createNode('internal_network', { x: 500, y: 0 });

      expect(inferNodeTier(inet).tier).toBe('edge');
      expect(inferNodeTier(fw).tier).toBe('perimeter');
      expect(inferNodeTier(web).tier).toBe('application');
      expect(inferNodeTier(db).tier).toBe('data');
      expect(inferNodeTier(admin).tier).toBe('management');
      expect(inferNodeTier(internalNet).tier).toBe('internal');
    });

    it('assigns tier "unknown" with low confidence for unrecognized component types', () => {
      const env = new Environment({ id: 'unknown-tier-env', name: 'Unknown Tier Test' });
      const customNode = env.createNode('custom_iot_sensor', { x: 0, y: 0 });

      const assignment = inferNodeTier(customNode);
      expect(assignment.tier).toBe('unknown');
      expect(assignment.confidence).toBe('low');
      expect(assignment.rationale).toContain('Unrecognized');
    });

    it('identifies strong tier separation in a coherent multi-tier layered architecture', () => {
      const env = new Environment({ id: 'layered-env', name: 'Layered Architecture' });
      const inet = env.createNode('internet', { x: 0, y: 0 });
      const fw = env.createNode('firewall', { x: 150, y: 0 }, undefined, { zone: 'dmz' });
      const lb = env.createNode('load_balancer', { x: 300, y: 0 }, undefined, { zone: 'dmz' });
      const web = env.createNode('web_server', { x: 450, y: 0 }, undefined, { zone: 'dmz' });
      const api = env.createNode('api_server', { x: 600, y: 0 }, undefined, { zone: 'internal' });
      const db = env.createNode('database', { x: 750, y: 0 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });

      env.createEdge(inet.id, fw.id);
      env.createEdge(fw.id, lb.id);
      env.createEdge(lb.id, web.id);
      env.createEdge(web.id, api.id);
      env.createEdge(api.id, db.id);

      const result = analyzeArchitecture(env);

      expect(result.tierAnalysis.separationQuality).toBe('strong');
      expect(result.tierAnalysis.hasDirectEdgeToData).toBe(false);
      expect(result.tierAnalysis.tierCounts.edge).toBe(1);
      expect(result.tierAnalysis.tierCounts.perimeter).toBe(2);
      expect(result.tierAnalysis.tierCounts.application).toBe(2);
      expect(result.tierAnalysis.tierCounts.data).toBe(1);
      expect(result.findings.some((f) => f.id === 'ARCH-001')).toBe(false);
    });

    it('detects direct data exposure when edge directly connects to data tier', () => {
      const env = new Environment({ id: 'exposed-db-env', name: 'Direct Data Exposure' });
      const inet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 300, y: 0 }, 'Customer Database', {
        zone: 'restricted',
        criticality: 'critical',
      });

      env.createEdge(inet.id, db.id);

      const result = analyzeArchitecture(env);

      expect(result.tierAnalysis.hasDirectEdgeToData).toBe(true);
      expect(result.tierAnalysis.separationQuality).toBe('none');

      const arch001 = result.findings.find((f) => f.id === 'ARCH-001');
      expect(arch001).toBeDefined();
      expect(arch001?.severity).toBe('critical');
      expect(arch001?.affectedNodeIds).toContain(db.id);
      expect(result.score.deductions.some((d) => d.category === 'tier-separation')).toBe(true);
    });
  });

  describe('Topology & Segmentation Analysis', () => {
    it('detects flat internal network topology with broad peer connectivity', () => {
      const env = new Environment({ id: 'flat-env', name: 'Flat Topology' });
      const web = env.createNode('web_server', { x: 0, y: 0 }, 'Web App', { zone: 'internal' });
      const api = env.createNode('api_server', { x: 150, y: 0 }, 'API', { zone: 'internal' });
      const db = env.createNode('database', { x: 300, y: 0 }, 'DB', { zone: 'internal' });
      const redis = env.createNode('redis', { x: 450, y: 0 }, 'Cache', { zone: 'internal' });
      const admin = env.createNode('admin', { x: 600, y: 0 }, 'Admin Host', { zone: 'internal' });

      // Direct peer connections within the internal zone
      env.createEdge(web.id, api.id);
      env.createEdge(api.id, db.id);
      env.createEdge(api.id, redis.id);
      env.createEdge(admin.id, db.id);

      const result = analyzeArchitecture(env);

      expect(result.topologyAnalysis.isFlatTopology).toBe(true);
      expect(result.topologyAnalysis.segmentationQuality).toBe('flat');

      const arch002 = result.findings.find((f) => f.id === 'ARCH-002');
      expect(arch002).toBeDefined();
      expect(arch002?.severity).toBe('high');
      expect(arch002?.recommendation).toContain('Segment internal workloads');
    });

    it('correctly summarizes network zones, asset distribution, and cross-zone transitions', () => {
      const env = new Environment({ id: 'zone-test-env', name: 'Zone Summary Test' });
      const inet = env.createNode('internet', { x: 0, y: 0 }); // public
      const fw = env.createNode('firewall', { x: 150, y: 0 }, undefined, { zone: 'dmz' });
      const api = env.createNode('api_server', { x: 300, y: 0 }, undefined, { zone: 'internal' });
      const db = env.createNode('database', { x: 450, y: 0 }, undefined, { zone: 'restricted' });

      env.createEdge(inet.id, fw.id);
      env.createEdge(fw.id, api.id);
      env.createEdge(api.id, db.id);

      const result = analyzeArchitecture(env);
      const topo = result.topologyAnalysis;

      expect(topo.totalZones).toBe(4); // public, dmz, internal, restricted
      expect(topo.crossZoneTransitions.length).toBe(3); // public->dmz, dmz->internal, internal->restricted

      const dmzZone = topo.zones.find((z) => z.zone === 'dmz');
      expect(dmzZone).toBeDefined();
      expect(dmzZone?.assetCount).toBe(1);
      expect(dmzZone?.inboundCrossZoneEdgesCount).toBe(1);
      expect(dmzZone?.outboundCrossZoneEdgesCount).toBe(1);
    });

    it('flags privileged management plane directly exposed to external edge', () => {
      const env = new Environment({ id: 'mgmt-exposure-env', name: 'Management Exposure' });
      const inet = env.createNode('internet', { x: 0, y: 0 });
      const admin = env.createNode('admin', { x: 200, y: 0 }, 'Admin Bastion', {
        zone: 'management',
        criticality: 'high',
      });

      env.createEdge(inet.id, admin.id);

      const result = analyzeArchitecture(env);
      const arch006 = result.findings.find((f) => f.id === 'ARCH-006');

      expect(arch006).toBeDefined();
      expect(arch006?.severity).toBe('high');
      expect(arch006?.affectedNodeIds).toContain(admin.id);
    });
  });

  describe('Dependency Analysis & Single Points of Failure', () => {
    it('identifies critical asset dependency concentration when multiple services depend on 1 database', () => {
      const env = new Environment({ id: 'dep-conc-env', name: 'Dependency Concentration' });
      const web1 = env.createNode('web_server', { x: 0, y: -100 });
      const web2 = env.createNode('web_server', { x: 0, y: 0 });
      const api = env.createNode('api_server', { x: 0, y: 100 });
      const db = env.createNode('database', { x: 300, y: 0 }, 'Customer Primary DB', {
        zone: 'restricted',
        criticality: 'critical',
      });

      env.createEdge(web1.id, db.id);
      env.createEdge(web2.id, db.id);
      env.createEdge(api.id, db.id);

      const result = analyzeArchitecture(env);
      const depAnalysis = result.dependencyAnalysis;

      expect(depAnalysis.criticalAssetDependencies.length).toBeGreaterThan(0);
      const dbDep = depAnalysis.criticalAssetDependencies.find((d) => d.nodeId === db.id);
      expect(dbDep).toBeDefined();
      expect(dbDep?.inDegree).toBe(3);

      const arch003 = result.findings.find((f) => f.category === 'critical-asset-dependency');
      expect(arch003).toBeDefined();
      expect(arch003?.severity).toBe('high');
      expect(arch003?.affectedNodeIds).toContain(db.id);
    });

    it('identifies potential single point of failure with cautious engineering language', () => {
      const env = new Environment({ id: 'spof-env', name: 'SPOF Test' });
      const inet = env.createNode('internet', { x: 0, y: 0 });
      const fw = env.createNode('firewall', { x: 150, y: 0 }, 'Edge Firewall', { zone: 'dmz' });
      const web1 = env.createNode('web_server', { x: 300, y: -50 }, 'Web 1', { zone: 'dmz' });
      const web2 = env.createNode('web_server', { x: 300, y: 50 }, 'Web 2', { zone: 'dmz' });

      env.createEdge(inet.id, fw.id);
      env.createEdge(fw.id, web1.id);
      env.createEdge(fw.id, web2.id);

      const result = analyzeArchitecture(env);
      const spofs = result.dependencyAnalysis.singlePointsOfFailure;

      expect(spofs.length).toBeGreaterThan(0);
      const fwSpof = spofs.find((s) => s.nodeId === fw.id);
      expect(fwSpof).toBeDefined();
      expect(fwSpof?.role).toContain('Sole Perimeter Firewall');
      expect(fwSpof?.riskDescription).toContain('Potential');

      const arch004 = result.findings.find((f) => f.category === 'single-point-of-failure');
      expect(arch004).toBeDefined();
      expect(arch004?.title).toContain('Potential Single Point of Failure');
    });
  });

  describe('Architecture Scoring & Explainability', () => {
    it('produces a significantly higher score for layered architecture compared to flat or exposed architecture', () => {
      const layeredEnv = instantiateScenario('secure-web-app');
      const flatEnv = instantiateScenario('flat-network');
      const exposedEnv = instantiateScenario('public-db-exposure');

      const layeredResult = analyzeArchitecture(layeredEnv);
      const flatResult = analyzeArchitecture(flatEnv);
      const exposedResult = analyzeArchitecture(exposedEnv);

      expect(layeredResult.score.score).toBeGreaterThan(flatResult.score.score);
      expect(layeredResult.score.score).toBeGreaterThan(exposedResult.score.score);

      expect(layeredResult.score.rating).toMatch(/strong|good/);
      expect(exposedResult.score.rating).toMatch(/needs-attention|weak/);
      expect(flatResult.score.deductions.some((d) => d.category === 'flat-topology')).toBe(true);
      expect(exposedResult.score.deductions.some((d) => d.category === 'tier-separation')).toBe(true);
    });

    it('guarantees presentation coordinates (x, y) do not affect architecture analysis', () => {
      const env = new Environment({ id: 'coord-arch-test', name: 'Coord Arch Test' });
      const inet = env.createNode('internet', { x: 10, y: 20 });
      const fw = env.createNode('firewall', { x: 100, y: 200 });
      const db = env.createNode('database', { x: 300, y: 400 });

      env.createEdge(inet.id, fw.id);
      env.createEdge(fw.id, db.id);

      const initialResult = analyzeArchitecture(env, { analyzedAt: '2026-10-07T00:00:00.000Z' });

      // Move nodes around the visual canvas
      env.updateNodePosition(inet.id, 9999, -8888);
      env.updateNodePosition(fw.id, -5555, 4444);
      env.updateNodePosition(db.id, 1234, 5678);

      const afterResult = analyzeArchitecture(env, { analyzedAt: '2026-10-07T00:00:00.000Z' });

      expect(afterResult.score.score).toBe(initialResult.score.score);
      expect(afterResult.profile).toEqual(initialResult.profile);
      expect(afterResult.findings.length).toBe(initialResult.findings.length);
      expect(JSON.stringify(afterResult)).toBe(JSON.stringify(initialResult));
    });

    it('guarantees byte-for-byte deterministic repeated analysis', () => {
      const run = () => {
        const env = instantiateScenario('chaos-lab');
        return analyzeArchitecture(env, { analyzedAt: '2026-10-07T00:00:00.000Z' });
      };

      const res1 = run();
      const res2 = run();

      expect(JSON.stringify(res1)).toBe(JSON.stringify(res2));
    });
  });

  describe('Catalog Scenario Integrations', () => {
    it('analyzes secure-web-app with strong multi-tier profile and high score', () => {
      const env = instantiateScenario('secure-web-app');
      const result = analyzeArchitecture(env);

      expect(result.profile.segmentation).toBe('strong');
      expect(result.profile.tierSeparation).toBe('strong');
      expect(result.findings.some((f) => f.id === 'ARCH-001')).toBe(false);
      expect(result.findings.some((f) => f.id === 'ARCH-002')).toBe(false);
      expect(result.score.score).toBeGreaterThanOrEqual(80);
    });

    it('analyzes public-db-exposure surfacing immediate critical ARCH-001 finding', () => {
      const env = instantiateScenario('public-db-exposure');
      const result = analyzeArchitecture(env);

      expect(result.tierAnalysis.hasDirectEdgeToData).toBe(true);
      expect(result.findings.some((f) => f.id === 'ARCH-001')).toBe(true);
      expect(result.score.score).toBeLessThanOrEqual(75);
    });

    it('analyzes flat-network surfacing flat-topology and weak segmentation findings', () => {
      const env = instantiateScenario('flat-network');
      const result = analyzeArchitecture(env);

      expect(result.topologyAnalysis.isFlatTopology).toBe(true);
      expect(result.findings.some((f) => f.id === 'ARCH-002')).toBe(true);
    });

    it('analyzes chaos-lab surfacing multiple severe architectural weaknesses', () => {
      const env = instantiateScenario('chaos-lab');
      const result = analyzeArchitecture(env);

      expect(result.findings.length).toBeGreaterThanOrEqual(2);
      expect(result.score.score).toBeLessThan(60);
      expect(result.score.rating).toMatch(/needs-attention|weak/);
    });
  });
});
