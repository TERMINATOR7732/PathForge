import { describe, it, expect } from 'vitest';
import {
  Environment,
  analyzeAttackPaths,
  evaluateAttackPathRisk,
  instantiateScenario,
} from '@pathforge/core';

describe('Phase 2.3 — Risk-Weighted Attack Paths & Reachability Intelligence', () => {
  describe('Risk Scoring Formulation & Factor Attribution', () => {
    it('rates direct public-to-critical database path as CRITICAL with high score', () => {
      const env = new Environment({ id: 'direct-db-env', name: 'Direct Public DB Exposure' });
      const internet = env.createNode('internet', { x: 0, y: 0 }, 'Public Internet');
      const db = env.createNode('database', { x: 200, y: 0 }, 'Production Database', {
        zone: 'restricted',
        criticality: 'critical',
      });
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      const result = analyzeAttackPaths(env);
      expect(result.attackPaths.length).toBe(1);

      const path = result.attackPaths[0];
      expect(path.risk).toBe('critical');
      expect(path.riskScore).toBeGreaterThanOrEqual(85);
      expect(path.riskScore).toBeLessThanOrEqual(100);

      // Verify assessment details
      expect(path.riskAssessment.level).toBe('critical');
      expect(path.riskAssessment.factors.some((f) => f.category === 'entry-exposure')).toBe(true);
      expect(path.riskAssessment.factors.some((f) => f.category === 'target-criticality')).toBe(true);
      expect(path.riskAssessment.factors.some((f) => f.category === 'path-depth')).toBe(true);
      expect(path.riskAssessment.dominantFactors.length).toBeGreaterThan(0);
    });

    it('rates internal-to-low asset path with significantly lower risk score', () => {
      const env = new Environment({ id: 'internal-low-env', name: 'Internal Low Exposure' });
      const internalClient = env.createNode('web_server', { x: 0, y: 0 }, 'Internal Client', {
        zone: 'internal',
        criticality: 'low',
      });
      const lowAsset = env.createNode('internal_network', { x: 200, y: 0 }, 'Shared Storage', {
        zone: 'internal',
        criticality: 'low',
      });
      env.createEdge(internalClient.id, lowAsset.id, {
        protocol: 'TCP',
        ports: '445',
        access: 'allow',
        encrypted: true,
      });

      // Analyze from internal entry point
      const result = analyzeAttackPaths(env, { entryPointIds: [internalClient.id] });
      expect(result.attackPaths.length).toBe(1);

      const path = result.attackPaths[0];
      expect(path.risk).not.toBe('critical');
      expect(path.riskScore).toBeLessThan(50);
      expect(path.riskAssessment.mitigatingFactors.length).toBeGreaterThan(0);
    });

    it('materially increases risk when target criticality is upgraded', () => {
      const createEnvWithCrit = (crit: 'low' | 'critical') => {
        const env = new Environment({ id: `crit-${crit}`, name: `Crit ${crit}` });
        const internet = env.createNode('internet', { x: 0, y: 0 });
        const target = env.createNode('database', { x: 200, y: 0 }, 'Target Service', {
          zone: 'internal',
          criticality: crit,
        });
        env.createEdge(internet.id, target.id, { protocol: 'HTTPS', ports: '443', access: 'allow', encrypted: true });
        return analyzeAttackPaths(env).attackPaths[0];
      };

      const lowPath = createEnvWithCrit('low');
      const critPath = createEnvWithCrit('critical');

      expect(critPath.riskScore).toBeGreaterThan(lowPath.riskScore);
      expect(critPath.riskAssessment.factors.some((f) => f.reason.includes('CRITICAL'))).toBe(true);
    });

    it('materially increases risk for public internet ingress compared to internal origin', () => {
      const envPublic = new Environment({ id: 'pub-test', name: 'Public Ingress' });
      const internet = envPublic.createNode('internet', { x: 0, y: 0 });
      const db1 = envPublic.createNode('database', { x: 200, y: 0 }, 'DB', { zone: 'internal', criticality: 'high' });
      envPublic.createEdge(internet.id, db1.id, { protocol: 'TCP', ports: '5432', access: 'allow' });

      const envInternal = new Environment({ id: 'int-test', name: 'Internal Ingress' });
      const internalHost = envInternal.createNode('web_server', { x: 0, y: 0 }, 'Host', { zone: 'internal' });
      const db2 = envInternal.createNode('database', { x: 200, y: 0 }, 'DB', { zone: 'internal', criticality: 'high' });
      envInternal.createEdge(internalHost.id, db2.id, { protocol: 'TCP', ports: '5432', access: 'allow' });

      const publicPath = analyzeAttackPaths(envPublic).attackPaths[0];
      const internalPath = analyzeAttackPaths(envInternal, { entryPointIds: [internalHost.id] }).attackPaths[0];

      expect(publicPath.riskScore).toBeGreaterThan(internalPath.riskScore);
      expect(publicPath.riskAssessment.factors.some((f) => f.category === 'entry-exposure' && f.weight === 20)).toBe(true);
    });

    it('penalizes unencrypted cleartext sensitive communication compared to TLS encryption', () => {
      const envClear = new Environment({ id: 'clear-test', name: 'Cleartext Test' });
      const inet1 = envClear.createNode('internet', { x: 0, y: 0 });
      const db1 = envClear.createNode('database', { x: 200, y: 0 }, 'DB', { zone: 'restricted', criticality: 'critical' });
      envClear.createEdge(inet1.id, db1.id, { protocol: 'TCP', ports: '5432', access: 'allow', encrypted: false });

      const envTls = new Environment({ id: 'tls-test', name: 'TLS Test' });
      const inet2 = envTls.createNode('internet', { x: 0, y: 0 });
      const db2 = envTls.createNode('database', { x: 200, y: 0 }, 'DB', { zone: 'restricted', criticality: 'critical' });
      envTls.createEdge(inet2.id, db2.id, { protocol: 'TCP', ports: '5432', access: 'allow', encrypted: true });

      const clearPath = analyzeAttackPaths(envClear).attackPaths[0];
      const tlsPath = analyzeAttackPaths(envTls).attackPaths[0];

      expect(clearPath.riskScore).toBeGreaterThan(tlsPath.riskScore);
      expect(tlsPath.riskAssessment.mitigatingFactors.some((m) => m.id === 'mit-tls-enforced')).toBe(true);
      expect(clearPath.riskAssessment.factors.some((f) => f.category === 'encryption')).toBe(true);
    });

    it('penalizes wildcard ANY ports and unrestricted protocols', () => {
      const envSpecific = new Environment({ id: 'spec-test', name: 'Specific Port' });
      const inet1 = envSpecific.createNode('internet', { x: 0, y: 0 });
      const app1 = envSpecific.createNode('database', { x: 200, y: 0 }, 'DB', { zone: 'internal', criticality: 'high' });
      envSpecific.createEdge(inet1.id, app1.id, { protocol: 'HTTPS', ports: '443', access: 'allow', encrypted: true });

      const envWildcard = new Environment({ id: 'wild-test', name: 'Wildcard Port' });
      const inet2 = envWildcard.createNode('internet', { x: 0, y: 0 });
      const app2 = envWildcard.createNode('database', { x: 200, y: 0 }, 'DB', { zone: 'internal', criticality: 'high' });
      envWildcard.createEdge(inet2.id, app2.id, { protocol: 'ANY', ports: 'ANY', access: 'allow', encrypted: true });

      const specPath = analyzeAttackPaths(envSpecific).attackPaths[0];
      const wildPath = analyzeAttackPaths(envWildcard).attackPaths[0];

      expect(wildPath.riskScore).toBeGreaterThan(specPath.riskScore);
      expect(wildPath.riskAssessment.factors.some((f) => f.id === 'access-wildcard-port')).toBe(true);
      expect(wildPath.riskAssessment.factors.some((f) => f.id === 'access-any-protocol')).toBe(true);
    });

    it('verifies exact score calculation for a known baseline path formula', () => {
      // 1 hop: Internet (public) -> Database (critical, restricted), cleartext, specific port 5432
      // Base: 5
      // Public entry: +20
      // Target critical: +25
      // Target restricted: +10
      // Target DB role: +10
      // Direct 1-hop: +20
      // 1 trust boundary (public -> restricted): +5
      // Cleartext sensitive: +15
      // Mitigations:
      // - restricted ports: -5
      // Raw: 5 + 20 + 25 + 10 + 10 + 20 + 5 + 15 - 5 = 105 -> clamped to 100
      const assessment = evaluateAttackPathRisk({
        entryPoint: { id: 'ep', name: 'Internet', type: 'internet', zone: 'public', criticality: 'low' },
        target: { id: 'tgt', name: 'DB', type: 'database', zone: 'restricted', criticality: 'critical' },
        nodes: [
          { id: 'ep', name: 'Internet', type: 'internet', zone: 'public', criticality: 'low' },
          { id: 'tgt', name: 'DB', type: 'database', zone: 'restricted', criticality: 'critical' },
        ],
        edges: [
          { id: 'e1', source: 'ep', target: 'tgt', protocol: 'TCP', ports: '5432', access: 'allow', encrypted: false },
        ],
        hopCount: 1,
        trustBoundariesCrossed: 1,
      });

      expect(assessment.score).toBe(100);
      expect(assessment.level).toBe('critical');
      expect(assessment.dominantFactors.length).toBe(3);
    });
  });

  describe('Reachability Intelligence & Prioritization', () => {
    it('correctly identifies the most dangerous path and most exposed asset in a multi-entry topology', () => {
      const env = new Environment({ id: 'intel-env', name: 'Reachability Intelligence Test' });
      const internet = env.createNode('internet', { x: 0, y: 0 }, 'Internet');
      const partnerNet = env.createNode('external_network', { x: 0, y: 200 }, 'Partner Network');

      const dmzWeb = env.createNode('web_server', { x: 200, y: 0 }, 'Web DMZ', { zone: 'dmz', criticality: 'low' });
      const primaryDb = env.createNode('database', { x: 400, y: 100 }, 'Core Customer DB', {
        zone: 'restricted',
        criticality: 'critical',
      });
      const internalCache = env.createNode('redis', { x: 400, y: -100 }, 'Internal Cache', {
        zone: 'internal',
        criticality: 'medium',
      });

      // Path 1: Internet -> Web -> DB (2 hops, TLS on hop 1, cleartext on hop 2)
      env.createEdge(internet.id, dmzWeb.id, { protocol: 'HTTPS', ports: '443', access: 'allow', encrypted: true });
      env.createEdge(dmzWeb.id, primaryDb.id, { protocol: 'TCP', ports: '5432', access: 'allow', encrypted: false });

      // Path 2: Direct Partner Net -> DB (1 hop, direct cleartext to critical DB)
      env.createEdge(partnerNet.id, primaryDb.id, { protocol: 'TCP', ports: '5432', access: 'allow', encrypted: false });

      // Path 3: Internet -> Web -> Cache
      env.createEdge(dmzWeb.id, internalCache.id, { protocol: 'TCP', ports: '6379', access: 'allow', encrypted: true });

      const result = analyzeAttackPaths(env);
      const intel = result.intelligence;

      expect(intel.totalAttackPaths).toBe(3);
      expect(intel.reachableCriticalAssets).toBe(1);

      // Most dangerous path must be the direct 1-hop path from partner net to critical DB
      expect(intel.mostDangerousPath).not.toBeNull();
      expect(intel.mostDangerousPath?.entryPoint.id).toBe(partnerNet.id);
      expect(intel.mostDangerousPath?.target.id).toBe(primaryDb.id);
      expect(intel.mostDangerousPath?.hopCount).toBe(1);

      // Most exposed asset must be primaryDb reachable from 2 distinct entry points (Internet and Partner Net)
      expect(intel.mostExposedAsset).not.toBeNull();
      expect(intel.mostExposedAsset?.asset.id).toBe(primaryDb.id);
      expect(intel.mostExposedAsset?.entryPointCount).toBe(2);
      expect(intel.mostExposedAsset?.entryPoints.map((ep) => ep.id).sort()).toEqual(
        [internet.id, partnerNet.id].sort()
      );

      // Summary matches intelligence
      expect(result.summary.mostDangerousPathId).toBe(intel.mostDangerousPath?.id);
      expect(result.summary.mostExposedAssetId).toBe(intel.mostExposedAsset?.asset.id);
    });

    it('computes accurate entry point exposures across all entry points', () => {
      const env = new Environment({ id: 'ep-exposure-env', name: 'Entry Point Exposures' });
      const inet = env.createNode('internet', { x: 0, y: 0 });
      const db = env.createNode('database', { x: 200, y: 0 }, 'DB', { zone: 'restricted', criticality: 'critical' });
      env.createEdge(inet.id, db.id, { protocol: 'TCP', ports: '5432', access: 'allow' });

      const result = analyzeAttackPaths(env);
      const epExp = result.intelligence.entryPointExposures.find((e) => e.entryPoint.id === inet.id);

      expect(epExp).toBeDefined();
      expect(epExp?.sensitiveAssetCount).toBe(1);
      expect(epExp?.criticalAssetCount).toBe(1);
      expect(epExp?.restrictedAssetCount).toBe(1);
      expect(epExp?.highestRiskLevel).toBe('critical');
    });
  });

  describe('Strict Determinism & Repeatability', () => {
    it('produces byte-for-byte identical JSON output across multiple executions', () => {
      const runAnalysis = () => {
        const env = instantiateScenario('chaos-lab');
        return analyzeAttackPaths(env, { analyzedAt: '2026-10-07T00:00:00.000Z' });
      };

      const result1 = runAnalysis();
      const result2 = runAnalysis();

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('guarantees presentation coordinates (x, y) do not affect risk scoring or reachability intelligence', () => {
      const env = new Environment({ id: 'coord-test', name: 'Coordinate Test' });
      const inet = env.createNode('internet', { x: 10, y: 20 });
      const db = env.createNode('database', { x: 30, y: 40 }, 'DB', { zone: 'restricted', criticality: 'critical' });
      env.createEdge(inet.id, db.id, { protocol: 'TCP', ports: '5432', access: 'allow' });

      const initialResult = analyzeAttackPaths(env, { analyzedAt: '2026-10-07T00:00:00.000Z' });

      // Shift positions wildly on the canvas
      env.updateNodePosition(inet.id, 9999, -5000);
      env.updateNodePosition(db.id, -3000, 8888);

      const afterResult = analyzeAttackPaths(env, { analyzedAt: '2026-10-07T00:00:00.000Z' });

      expect(afterResult.attackPaths[0].riskScore).toBe(initialResult.attackPaths[0].riskScore);
      expect(afterResult.intelligence.mostDangerousPath?.id).toBe(initialResult.intelligence.mostDangerousPath?.id);
      expect(afterResult.intelligence.mostExposedAsset?.asset.id).toBe(
        initialResult.intelligence.mostExposedAsset?.asset.id
      );
      expect(JSON.stringify(afterResult)).toBe(JSON.stringify(initialResult));
    });
  });

  describe('Catalog Scenario Integrations', () => {
    it('evaluates secure-web-app with lower priority risk scores and defensive mitigations', () => {
      const env = instantiateScenario('secure-web-app');
      const result = analyzeAttackPaths(env);

      // Traversal reaches DB & Redis through 5 multi-tier segmented hops
      expect(result.attackPaths.length).toBe(2);
      for (const path of result.attackPaths) {
        expect(path.hopCount).toBe(5);
        // Multi-tier segmentation mitigating factor must be present
        expect(path.riskAssessment.mitigatingFactors.some((m) => m.id === 'mit-multi-tier-defense')).toBe(true);
        expect(path.riskAssessment.mitigatingFactors.some((m) => m.id === 'mit-restricted-ports')).toBe(true);
      }
    });

    it('evaluates public-db-exposure surfacing immediate critical risk and high prioritization', () => {
      const env = instantiateScenario('public-db-exposure');
      const result = analyzeAttackPaths(env);

      expect(result.summary.highestRisk).toBe('critical');
      expect(result.intelligence.mostDangerousPath).not.toBeNull();
      expect(result.intelligence.mostDangerousPath?.risk).toBe('critical');
      expect(result.intelligence.mostDangerousPath?.riskScore).toBeGreaterThanOrEqual(85);
      expect(result.intelligence.mostDangerousPath?.target.type).toBe('database');
    });

    it('evaluates flat-network exposing unsegmented reachability across tiers', () => {
      const env = instantiateScenario('flat-network');
      const result = analyzeAttackPaths(env);

      expect(result.attackPaths.length).toBeGreaterThan(0);
      // Flat network paths have 0 or minimal boundary crossings
      const flatPaths = result.attackPaths.filter((p) => p.trustBoundariesCrossed <= 1);
      expect(flatPaths.length).toBeGreaterThan(0);
      expect(result.intelligence.mostDangerousPath).not.toBeNull();
    });

    it('evaluates chaos-lab surfacing multiple critical attack paths and elevated average risk', () => {
      const env = instantiateScenario('chaos-lab');
      const result = analyzeAttackPaths(env);

      expect(result.summary.highestRisk).toBe('critical');
      expect(result.intelligence.criticalAttackPaths).toBeGreaterThanOrEqual(1);
      expect(result.summary.averageRiskScore).toBeGreaterThan(50);
      expect(result.intelligence.mostDangerousPath?.risk).toBe('critical');
    });
  });
});
