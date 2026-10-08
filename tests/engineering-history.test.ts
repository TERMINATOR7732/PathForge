import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  Environment,
  instantiateScenario,
  getDefaultScenario,
  createEnvironmentSnapshot,
  analyzeAttackPaths,
  analyzeArchitecture,
  assessProductionReadiness,
  assessTestingIntelligence,
  assessTechnicalDebt,
  analyzeInfrastructureChanges,
  captureEngineeringHistoryRecord,
  generateHistoryRecordId,
  computeCanonicalTopologyHash,
  compareHistoricalRecords,
  calculateEngineeringTrends,
  InMemoryHistoryStore,
  FileSystemHistoryStore,
  createDefaultHistoryStore,
  queryHistory,
  compareLatestHistory,
  getHistoryTrends,
  EngineeringHistoryRecord,
  HISTORY_SCHEMA_VERSION,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
} from '@pathforge/validator';

describe('Phase 3.5 — Persistent Engineering History & Trends', () => {
  let validatorEngine: ValidatorEngine;
  let baseEnv: Environment;
  let tempHistoryDir: string;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    validatorEngine = new ValidatorEngine(registry);
    baseEnv = instantiateScenario(getDefaultScenario().id);
    tempHistoryDir = path.join(
      os.tmpdir(),
      `pathforge-history-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempHistoryDir)) {
      try {
        fs.rmSync(tempHistoryDir, { recursive: true, force: true });
      } catch {
        // cleanup ignore
      }
    }
  });

  describe('Deterministic Identity & Hashing', () => {
    it('1. generates identical record ID for identical semantic topology', () => {
      const val1 = validatorEngine.evaluate(baseEnv);
      const rec1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'manual',
      });

      const rec2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'manual',
      });

      expect(rec1.id).toBe(rec2.id);
      expect(rec1.id).toMatch(/^hist-manual-[a-f0-9]{16}$/);
    });

    it('2. ignores canvas coordinate movement in canonical topology hash and record ID', () => {
      const val1 = validatorEngine.evaluate(baseEnv);
      const hashBefore = computeCanonicalTopologyHash(baseEnv);
      const recBefore = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'manual',
      });

      // Move a node across the canvas by 150 pixels
      const firstNode = baseEnv.getNodes()[0];
      baseEnv.updateNodePosition(firstNode.id, {
        x: firstNode.position.x + 150,
        y: firstNode.position.y + 200,
      });

      const hashAfter = computeCanonicalTopologyHash(baseEnv);
      const recAfter = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'manual',
      });

      expect(hashBefore).toBe(hashAfter);
      expect(recBefore.id).toBe(recAfter.id);
    });

    it('3. timestamps do not alter semantic record identity', () => {
      const val1 = validatorEngine.evaluate(baseEnv);
      const rec1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'manual',
        timestamp: '2026-01-01T00:00:00.000Z',
      });

      const rec2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'manual',
        timestamp: '2026-10-08T15:00:00.000Z',
      });

      expect(rec1.id).toBe(rec2.id);
      expect(rec1.timestamp).not.toBe(rec2.timestamp);
    });

    it('4. topological mutations alter canonical topology hash and record ID', () => {
      const val1 = validatorEngine.evaluate(baseEnv);
      const rec1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'manual',
      });

      // Add a new node
      baseEnv.addNode({
        id: 'new-cache-node',
        name: 'Redis Cache',
        type: 'redis',
        zone: 'internal',
        criticality: 'medium',
      });

      const val2 = validatorEngine.evaluate(baseEnv);
      const rec2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val2,
        source: 'manual',
      });

      expect(rec1.id).not.toBe(rec2.id);
    });

    it('5. changes to revision identity produce distinct record IDs', () => {
      const val1 = validatorEngine.evaluate(baseEnv);
      const rec1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'local-git',
        revisionIdentity: 'commit-aaaa1111',
      });

      const rec2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val1,
        source: 'local-git',
        revisionIdentity: 'commit-bbbb2222',
      });

      expect(rec1.id).not.toBe(rec2.id);
    });
  });

  describe('Historical Snapshot Capture & Composition', () => {
    it('6. captures complete multi-layer engineering intelligence into a single record', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const ap = analyzeAttackPaths(baseEnv);
      const arch = analyzeArchitecture(baseEnv);
      const pr = assessProductionReadiness(baseEnv, {
        validationResult: val,
        attackPathAnalysis: ap,
        architectureAnalysis: arch,
      });
      const ti = assessTestingIntelligence(baseEnv, {
        validationResult: val,
        attackPathAnalysis: ap,
        architectureAnalysis: arch,
      });
      const td = assessTechnicalDebt(baseEnv, {
        validationResult: val,
        attackPathAnalysis: ap,
        architectureAnalysis: arch,
        productionReadiness: pr,
        testingIntelligence: ti,
      });

      const record = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        attackPathAnalysis: ap,
        architectureAnalysis: arch,
        productionReadiness: pr,
        testingIntelligence: ti,
        technicalDebt: td,
      });

      expect(record.schemaVersion).toBe(HISTORY_SCHEMA_VERSION);
      expect(record.topology.nodeCount).toBe(baseEnv.getNodes().length);
      expect(record.topology.edgeCount).toBe(baseEnv.getEdges().length);
      expect(record.validation.findingCount).toBe(val.findings.length);
      expect(record.attackPath?.pathCount).toBe(ap.summary.attackPathCount);
      expect(record.architecture?.score).toBe(arch.score.score);
      expect(record.readiness?.score).toBe(pr.score);
      expect(record.testing?.score).toBe(ti.score);
      expect(record.technicalDebt?.score).toBe(td.summary.overallScore);
      expect(record.evidenceNotes.length).toBe(0);
    });

    it('7. truthful governance: omits unmeasured layers without fabricating zeros', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const record = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        // Omit attackPath, architecture, readiness, testing, technicalDebt
      });

      expect(record.attackPath).toBeUndefined();
      expect(record.architecture).toBeUndefined();
      expect(record.readiness).toBeUndefined();
      expect(record.testing).toBeUndefined();
      expect(record.technicalDebt).toBeUndefined();
      expect(record.evidenceNotes).toContain('Attack path analysis omitted');
      expect(record.evidenceNotes).toContain('Production readiness omitted');
    });

    it('8. supports capture directly from immutable EnvironmentSnapshot', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const snapshot = createEnvironmentSnapshot(baseEnv, val);

      const record = captureEngineeringHistoryRecord({
        environment: snapshot,
        validationResult: val,
        source: 'scenario',
        sourceIdentity: {
          type: 'scenario',
          scenarioId: 'std-web-app',
          scenarioName: 'Standard Web Application',
        },
      });

      expect(record.source).toBe('scenario');
      expect(record.environmentId).toBe(snapshot.environmentId);
      expect(record.topology.nodeCount).toBe(snapshot.nodes.length);
      expect(record.topology.edgeCount).toBe(snapshot.edges.length);
    });
  });

  describe('Storage & Persistence Boundary', () => {
    describe('InMemoryHistoryStore', () => {
      let store: InMemoryHistoryStore;

      beforeEach(() => {
        store = new InMemoryHistoryStore();
      });

      it('9. saves and retrieves records by ID', () => {
        const val = validatorEngine.evaluate(baseEnv);
        const record = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
        });

        const saveRes = store.save(record);
        expect(saveRes.isDuplicate).toBe(false);
        expect(saveRes.record.id).toBe(record.id);

        const fetched = store.get(record.id);
        expect(fetched).not.toBeNull();
        expect(fetched?.id).toBe(record.id);
      });

      it('10. deduplicates identical records deterministically', () => {
        const val = validatorEngine.evaluate(baseEnv);
        const record = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
        });

        const firstSave = store.save(record);
        expect(firstSave.isDuplicate).toBe(false);

        const secondSave = store.save(record);
        expect(secondSave.isDuplicate).toBe(true);

        const list = store.list();
        expect(list.length).toBe(1);
      });

      it('11. lists records sorted chronologically descending', () => {
        const val = validatorEngine.evaluate(baseEnv);

        const rec1 = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
          revisionIdentity: 'rev-1',
          timestamp: '2026-05-01T10:00:00.000Z',
        });
        const rec2 = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
          revisionIdentity: 'rev-2',
          timestamp: '2026-05-02T10:00:00.000Z',
        });
        const rec3 = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
          revisionIdentity: 'rev-3',
          timestamp: '2026-05-03T10:00:00.000Z',
        });

        store.save(rec1);
        store.save(rec3);
        store.save(rec2);

        const list = store.list();
        expect(list.length).toBe(3);
        expect(list[0].id).toBe(rec3.id);
        expect(list[1].id).toBe(rec2.id);
        expect(list[2].id).toBe(rec1.id);
      });

      it('12. applies query limits and environment filters', () => {
        const val = validatorEngine.evaluate(baseEnv);
        for (let i = 0; i < 5; i++) {
          const rec = captureEngineeringHistoryRecord({
            environment: baseEnv,
            validationResult: val,
            source: 'manual',
            revisionIdentity: `rev-${i}`,
            timestamp: `2026-05-0${i + 1}T10:00:00.000Z`,
          });
          store.save(rec);
        }

        const limited = store.list({ limit: 2 });
        expect(limited.length).toBe(2);

        const filtered = store.list({ environmentId: 'non-existent' });
        expect(filtered.length).toBe(0);
      });

      it('13. deletes and clears records', () => {
        const val = validatorEngine.evaluate(baseEnv);
        const rec = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
        });
        store.save(rec);

        expect(store.delete(rec.id)).toBe(true);
        expect(store.get(rec.id)).toBeNull();

        store.save(rec);
        store.clear();
        expect(store.list().length).toBe(0);
      });
    });

    describe('FileSystemHistoryStore', () => {
      it('14. creates storage directory recursively if missing', () => {
        expect(fs.existsSync(tempHistoryDir)).toBe(false);
        const fileStore = new FileSystemHistoryStore(tempHistoryDir);
        expect(fs.existsSync(tempHistoryDir)).toBe(true);
      });

      it('15. persists records to local JSON files atomically', () => {
        const fileStore = new FileSystemHistoryStore(tempHistoryDir);
        const val = validatorEngine.evaluate(baseEnv);
        const record = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'local-git',
          revisionIdentity: 'commit-1234abcd',
        });

        fileStore.save(record);

        const files = fs.readdirSync(tempHistoryDir);
        expect(files.length).toBe(1);
        expect(files[0]).toBe(`${record.id}.json`);

        const readBack = fileStore.get(record.id);
        expect(readBack).not.toBeNull();
        expect(readBack?.id).toBe(record.id);
        expect(readBack?.schemaVersion).toBe(HISTORY_SCHEMA_VERSION);
      });

      it('16. gracefully ignores malformed or corrupted JSON files without crashing list()', () => {
        const fileStore = new FileSystemHistoryStore(tempHistoryDir);
        const val = validatorEngine.evaluate(baseEnv);
        const validRec = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
        });
        fileStore.save(validRec);

        // Write a corrupt file manually into the directory
        fs.writeFileSync(
          path.join(tempHistoryDir, 'corrupt-file.json'),
          '{{{not valid json syntax!}}}',
          'utf-8'
        );

        // Write an unsupported schema file
        fs.writeFileSync(
          path.join(tempHistoryDir, 'unsupported-schema.json'),
          JSON.stringify({ schemaVersion: 999, id: 'bad' }),
          'utf-8'
        );

        const records = fileStore.list();
        expect(records.length).toBe(1);
        expect(records[0].id).toBe(validRec.id);
      });

      it('17. deletes persistent file on delete() and clear()', () => {
        const fileStore = new FileSystemHistoryStore(tempHistoryDir);
        const val = validatorEngine.evaluate(baseEnv);
        const rec = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
        });
        fileStore.save(rec);

        expect(fileStore.delete(rec.id)).toBe(true);
        expect(fs.existsSync(path.join(tempHistoryDir, `${rec.id}.json`))).toBe(false);

        fileStore.save(rec);
        fileStore.clear();
        expect(fileStore.list().length).toBe(0);
      });
    });
  });

  describe('Historical Comparison Engine', () => {
    it('18. declares NO_MEANINGFUL_CHANGE when comparing identical records', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const recA = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'baseline',
      });
      const recB = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'current',
      });

      const comparison = compareHistoricalRecords(recA, recB);
      expect(comparison.verdict).toBe('NO_MEANINGFUL_CHANGE');
      expect(comparison.securityDelta.criticalDelta).toBe(0);
      expect(comparison.securityDelta.totalDelta).toBe(0);
    });

    it('19. detects ENGINEERING_POSTURE_IMPROVED when findings are resolved and score increases', () => {
      // Baseline: with exposure
      const inetId = baseEnv.getNodes().find((n) => n.type === 'internet')?.id ?? 'internet-1';
      const dbId = baseEnv.getNodes().find((n) => n.type === 'database')?.id ?? 'db-1';
      baseEnv.addEdge({
        id: 'bad-edge',
        source: inetId,
        target: dbId,
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });
      const valBefore = validatorEngine.evaluate(baseEnv);
      const archBefore = analyzeArchitecture(baseEnv);
      const recBefore = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valBefore,
        architectureAnalysis: archBefore,
        source: 'manual',
        revisionIdentity: 'v1',
      });

      // Remediate: remove bad edge
      baseEnv.removeEdge('bad-edge');
      const valAfter = validatorEngine.evaluate(baseEnv);
      const archAfter = analyzeArchitecture(baseEnv);
      const recAfter = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valAfter,
        architectureAnalysis: archAfter,
        source: 'manual',
        revisionIdentity: 'v2',
      });

      const comparison = compareHistoricalRecords(recBefore, recAfter);
      expect(comparison.verdict).toBe('ENGINEERING_POSTURE_IMPROVED');
      expect(comparison.securityDelta.criticalDelta).toBeLessThanOrEqual(0);
      expect(comparison.securityDelta.resolvedFindingIds.length).toBeGreaterThan(0);
    });

    it('20. detects ENGINEERING_POSTURE_DEGRADED when new critical risks are introduced', () => {
      const valBefore = validatorEngine.evaluate(baseEnv);
      const recBefore = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valBefore,
        source: 'manual',
        revisionIdentity: 'v1',
      });

      // Introduce public database access
      baseEnv.addEdge({
        id: 'dangerous-db-leak',
        source: baseEnv.getNodes().find((n) => n.type === 'internet')?.id ?? 'internet-1',
        target: baseEnv.getNodes().find((n) => n.type === 'database')?.id ?? 'db-1',
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const valAfter = validatorEngine.evaluate(baseEnv);
      const recAfter = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valAfter,
        source: 'manual',
        revisionIdentity: 'v2',
      });

      const comparison = compareHistoricalRecords(recBefore, recAfter);
      expect(comparison.verdict).toBe('ENGINEERING_POSTURE_DEGRADED');
      expect(comparison.securityDelta.criticalDelta).toBeGreaterThan(0);
      expect(comparison.securityDelta.introducedFindingIds.length).toBeGreaterThan(0);
    });

    it('21. detects MIXED_ENGINEERING_IMPACT when one metric improves while another degrades', () => {
      const recA = {
        schemaVersion: 1,
        id: 'rec-a',
        environmentId: 'env-1',
        environmentName: 'Env',
        timestamp: '2026-05-01T00:00:00Z',
        source: 'manual' as const,
        sourceIdentity: { type: 'manual' as const, environmentId: 'env-1' },
        revisionIdentity: 'rev-a',
        topology: { nodeCount: 5, edgeCount: 5, criticalNodeCount: 1, internetFacingNodeCount: 1 },
        validation: {
          findingCount: 3,
          criticalCount: 2,
          highCount: 1,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
          findingIds: ['f-1', 'f-2', 'f-3'],
        },
        architecture: { score: 70, rating: 'good' as const, segmentation: 'moderate', findingsCount: 1 },
        readiness: { score: 60, rating: 'NEEDS_ATTENTION' as const, status: 'NOT_READY' as const, blockedGatesCount: 2, warningCount: 1 },
        testing: { score: 50, level: 'MODERATE' as const, criticalCoverage: 50, highCoverage: 50, unverifiedPropertiesCount: 3 },
        technicalDebt: { score: 60, rating: 'MANAGEABLE' as const, activeCount: 3, p0Count: 1, p1Count: 1 },
        evidenceNotes: [],
      };

      // In recB: Critical findings dropped from 2 to 0 (improvement!), but Architecture score dropped from 70 to 40 (degradation!)
      const recB = {
        ...recA,
        id: 'rec-b',
        revisionIdentity: 'rev-b',
        validation: {
          ...recA.validation,
          criticalCount: 0,
          findingCount: 1,
          findingIds: ['f-3'],
        },
        architecture: {
          score: 40,
          rating: 'weak' as const,
          segmentation: 'flat',
          findingsCount: 3,
        },
      };

      const comparison = compareHistoricalRecords(recA, recB);
      expect(comparison.verdict).toBe('MIXED_ENGINEERING_IMPACT');
      expect(comparison.verdictExplanation).toContain('Mixed outcome');
    });

    it('22. declares INSUFFICIENT_EVIDENCE if comparison records lack core validation or topology', () => {
      const emptyRecA = {
        schemaVersion: 1,
        id: 'empty-a',
        environmentId: 'env-1',
        environmentName: 'Env',
        timestamp: '2026-05-01T00:00:00Z',
        source: 'manual' as const,
        sourceIdentity: { type: 'manual' as const, environmentId: 'env-1' },
        revisionIdentity: 'rev-empty',
        topology: { nodeCount: 0, edgeCount: 0, criticalNodeCount: 0, internetFacingNodeCount: 0 },
        validation: {
          findingCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
          findingIds: [],
        },
        evidenceNotes: [],
      };

      const comparison = compareHistoricalRecords(emptyRecA, emptyRecA);
      expect(comparison.verdict).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  describe('Trend Analysis Engine', () => {
    it('23. returns insufficient-data for fewer than two records', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const rec = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
      });

      const trends = calculateEngineeringTrends([rec]);
      expect(trends.overallDirection).toBe('insufficient-data');
      expect(trends.securityTrend.direction).toBe('insufficient-data');
      expect(trends.architectureTrend.direction).toBe('insufficient-data');
    });

    it('24. correctly identifies improving trends across time', () => {
      const records: EngineeringHistoryRecord[] = [
        {
          schemaVersion: 1,
          id: 'rec-1',
          environmentId: 'env-1',
          environmentName: 'Env',
          timestamp: '2026-01-01T00:00:00Z',
          source: 'manual',
          sourceIdentity: { type: 'manual', environmentId: 'env-1' },
          revisionIdentity: 'r1',
          topology: { nodeCount: 5, edgeCount: 5, criticalNodeCount: 1, internetFacingNodeCount: 1 },
          validation: { findingCount: 4, criticalCount: 2, highCount: 2, mediumCount: 0, lowCount: 0, infoCount: 0, findingIds: ['f1', 'f2', 'f3', 'f4'] },
          attackPath: { pathCount: 4, criticalPathCount: 2, highRiskPathCount: 2, highestRiskScore: 80, highestRisk: 'critical', reachableCriticalAssets: 1, mostExposedAssetId: 'db', mostExposedAssetName: 'DB' },
          architecture: { score: 50, rating: 'needs-attention', segmentation: 'weak', findingsCount: 3 },
          readiness: { score: 45, rating: 'POOR', status: 'NOT_READY', blockedGatesCount: 3, warningCount: 2 },
          testing: { score: 40, level: 'WEAK', criticalCoverage: 40, highCoverage: 40, unverifiedPropertiesCount: 5 },
          technicalDebt: { score: 40, rating: 'HIGH', activeCount: 6, p0Count: 2, p1Count: 2 },
          evidenceNotes: [],
        },
        {
          schemaVersion: 1,
          id: 'rec-2',
          environmentId: 'env-1',
          environmentName: 'Env',
          timestamp: '2026-02-01T00:00:00Z',
          source: 'manual',
          sourceIdentity: { type: 'manual', environmentId: 'env-1' },
          revisionIdentity: 'r2',
          topology: { nodeCount: 5, edgeCount: 5, criticalNodeCount: 1, internetFacingNodeCount: 1 },
          validation: { findingCount: 1, criticalCount: 0, highCount: 1, mediumCount: 0, lowCount: 0, infoCount: 0, findingIds: ['f4'] },
          attackPath: { pathCount: 1, criticalPathCount: 0, highRiskPathCount: 1, highestRiskScore: 40, highestRisk: 'medium', reachableCriticalAssets: 0, mostExposedAssetId: 'app', mostExposedAssetName: 'App' },
          architecture: { score: 85, rating: 'strong', segmentation: 'strong', findingsCount: 0 },
          readiness: { score: 90, rating: 'EXCELLENT', status: 'READY', blockedGatesCount: 0, warningCount: 1 },
          testing: { score: 85, level: 'GOOD', criticalCoverage: 100, highCoverage: 80, unverifiedPropertiesCount: 1 },
          technicalDebt: { score: 90, rating: 'LOW_DEBT', activeCount: 1, p0Count: 0, p1Count: 0 },
          evidenceNotes: [],
        },
      ];

      const trends = calculateEngineeringTrends(records);
      expect(trends.overallDirection).toBe('improving');
      expect(trends.securityTrend.direction).toBe('improving'); // critical+high 4 -> 1
      expect(trends.attackExposureTrend.direction).toBe('improving'); // 80 -> 40
      expect(trends.architectureTrend.direction).toBe('improving'); // 50 -> 85
      expect(trends.readinessTrend.direction).toBe('improving'); // 45 -> 90
      expect(trends.technicalDebtTrend.direction).toBe('improving'); // 40 -> 90
    });

    it('25. correctly identifies degrading trends when metrics deteriorate', () => {
      const records: EngineeringHistoryRecord[] = [
        {
          schemaVersion: 1,
          id: 'rec-good',
          environmentId: 'env-1',
          environmentName: 'Env',
          timestamp: '2026-01-01T00:00:00Z',
          source: 'manual',
          sourceIdentity: { type: 'manual', environmentId: 'env-1' },
          revisionIdentity: 'r1',
          topology: { nodeCount: 5, edgeCount: 5, criticalNodeCount: 1, internetFacingNodeCount: 1 },
          validation: { findingCount: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0, findingIds: [] },
          architecture: { score: 90, rating: 'strong', segmentation: 'strong', findingsCount: 0 },
          readiness: { score: 90, rating: 'EXCELLENT', status: 'READY', blockedGatesCount: 0, warningCount: 0 },
          testing: { score: 90, level: 'EXCELLENT', criticalCoverage: 100, highCoverage: 100, unverifiedPropertiesCount: 0 },
          technicalDebt: { score: 95, rating: 'LOW_DEBT', activeCount: 0, p0Count: 0, p1Count: 0 },
          evidenceNotes: [],
        },
        {
          schemaVersion: 1,
          id: 'rec-bad',
          environmentId: 'env-1',
          environmentName: 'Env',
          timestamp: '2026-02-01T00:00:00Z',
          source: 'manual',
          sourceIdentity: { type: 'manual', environmentId: 'env-1' },
          revisionIdentity: 'r2',
          topology: { nodeCount: 5, edgeCount: 5, criticalNodeCount: 1, internetFacingNodeCount: 1 },
          validation: { findingCount: 5, criticalCount: 3, highCount: 2, mediumCount: 0, lowCount: 0, infoCount: 0, findingIds: ['f1', 'f2', 'f3', 'f4', 'f5'] },
          architecture: { score: 40, rating: 'weak', segmentation: 'flat', findingsCount: 4 },
          readiness: { score: 30, rating: 'CRITICAL', status: 'NOT_READY', blockedGatesCount: 4, warningCount: 3 },
          testing: { score: 30, level: 'WEAK', criticalCoverage: 20, highCoverage: 20, unverifiedPropertiesCount: 6 },
          technicalDebt: { score: 20, rating: 'SEVERE', activeCount: 8, p0Count: 3, p1Count: 3 },
          evidenceNotes: [],
        },
      ];

      const trends = calculateEngineeringTrends(records);
      expect(trends.overallDirection).toBe('degrading');
      expect(trends.securityTrend.direction).toBe('degrading');
      expect(trends.readinessTrend.direction).toBe('degrading');
      expect(trends.technicalDebtTrend.direction).toBe('degrading');
    });

    it('26. correctly sorts unordered records chronologically before calculating trends', () => {
      const r1 = {
        schemaVersion: 1,
        id: 'rec-jan',
        environmentId: 'env-1',
        environmentName: 'Env',
        timestamp: '2026-01-01T00:00:00Z',
        source: 'manual' as const,
        sourceIdentity: { type: 'manual' as const, environmentId: 'env-1' },
        revisionIdentity: 'r1',
        topology: { nodeCount: 3, edgeCount: 2, criticalNodeCount: 1, internetFacingNodeCount: 1 },
        validation: { findingCount: 5, criticalCount: 2, highCount: 3, mediumCount: 0, lowCount: 0, infoCount: 0, findingIds: [] },
        evidenceNotes: [],
      };
      const r2 = {
        schemaVersion: 1,
        id: 'rec-mar',
        environmentId: 'env-1',
        environmentName: 'Env',
        timestamp: '2026-03-01T00:00:00Z',
        source: 'manual' as const,
        sourceIdentity: { type: 'manual' as const, environmentId: 'env-1' },
        revisionIdentity: 'r3',
        topology: { nodeCount: 3, edgeCount: 2, criticalNodeCount: 1, internetFacingNodeCount: 1 },
        validation: { findingCount: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0, findingIds: [] },
        evidenceNotes: [],
      };

      // Pass in reverse chronological order [March, January]
      const trends = calculateEngineeringTrends([r2, r1]);
      expect(trends.securityTrend.direction).toBe('improving');
      expect(trends.securityTrend.firstValue).toBe(5);
      expect(trends.securityTrend.lastValue).toBe(0);
    });
  });

  describe('Security & Privacy Guarantees', () => {
    it('27. sanitizes authentication tokens and credentials from source references', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const record = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'local-git',
        sourceIdentity: {
          type: 'local-git',
          repositoryPath: 'https://user:ghp_1234567890abcdef1234567890@github.com/org/repo.git',
          commitSha: 'a1b2c3d4e5f6',
        },
      });

      if (record.sourceIdentity.type === 'local-git') {
        expect(record.sourceIdentity.repositoryPath).not.toContain('ghp_1234567890abcdef1234567890');
        expect(record.sourceIdentity.repositoryPath).toContain('[REDACTED_');
      }
    });

    it('28. does not persist raw passwords or secrets in serialized history files', () => {
      const fileStore = new FileSystemHistoryStore(tempHistoryDir);
      const val = validatorEngine.evaluate(baseEnv);
      const record = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'github-pr',
        sourceIdentity: {
          type: 'github-pr',
          owner: 'secure-org',
          repository: 'prod-repo',
          prNumber: 42,
          baseSha: '0123456789abcdef0123456789abcdef01234567',
          headSha: 'fedcba9876543210fedcba9876543210fedcba98',
        },
      });

      fileStore.save(record);
      const rawFile = fs.readFileSync(path.join(tempHistoryDir, `${record.id}.json`), 'utf-8');
      expect(rawFile).not.toContain('Bearer ');
      expect(rawFile).not.toContain('ghp_');
      expect(rawFile).not.toContain('sk-');
    });
  });

  describe('High-Level Orchestration Helpers', () => {
    it('29. queryHistory filters records cleanly', async () => {
      const store = new InMemoryHistoryStore();
      const val = validatorEngine.evaluate(baseEnv);
      const r1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'r1',
      });
      const r2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'local-git',
        revisionIdentity: 'r2',
      });

      store.save(r1);
      store.save(r2);

      const queried = await queryHistory(store, { source: 'local-git' });
      expect(queried.length).toBe(1);
      expect(queried[0].source).toBe('local-git');
    });

    it('30. compareLatestHistory returns null when fewer than 2 records exist', async () => {
      const store = new InMemoryHistoryStore();
      const res = await compareLatestHistory(store);
      expect(res).toBeNull();
    });

    it('31. compareLatestHistory compares the two most recent records', async () => {
      const store = new InMemoryHistoryStore();
      const val = validatorEngine.evaluate(baseEnv);
      const r1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'rev-old',
        timestamp: '2026-01-01T00:00:00Z',
      });
      const r2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'rev-new',
        timestamp: '2026-02-01T00:00:00Z',
      });

      store.save(r1);
      store.save(r2);

      const comparison = await compareLatestHistory(store, baseEnv.id);
      expect(comparison).not.toBeNull();
      expect(comparison?.baselineRecordId).toBe(r1.id);
      expect(comparison?.currentRecordId).toBe(r2.id);
    });

    it('32. getHistoryTrends computes longitudinal summary from store', async () => {
      const store = new InMemoryHistoryStore();
      const val = validatorEngine.evaluate(baseEnv);
      for (let i = 0; i < 3; i++) {
        const r = captureEngineeringHistoryRecord({
          environment: baseEnv,
          validationResult: val,
          source: 'manual',
          revisionIdentity: `rev-${i}`,
          timestamp: `2026-03-0${i + 1}T00:00:00Z`,
        });
        store.save(r);
      }

      const trends = await getHistoryTrends(store);
      expect(trends.recordCount).toBe(3);
      expect(trends.overallDirection).toBe('stable');
    });
  });

  describe('UI & Workflow QA Scenarios (1-15)', () => {
    let qaStore: InMemoryHistoryStore;

    beforeEach(() => {
      qaStore = new InMemoryHistoryStore();
    });

    it('QA 1: empty history state handling', () => {
      const records = qaStore.list();
      expect(records.length).toBe(0);

      const trends = calculateEngineeringTrends(records);
      expect(trends.recordCount).toBe(0);
      expect(trends.overallDirection).toBe('insufficient-data');
      expect(trends.summary).toContain('At least two');
    });

    it('QA 2: capture first snapshot', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const r1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'snapshot-1',
        timestamp: '2026-10-01T12:00:00Z',
      });

      const res = qaStore.save(r1);
      expect(res.isDuplicate).toBe(false);
      expect(qaStore.list().length).toBe(1);
      expect(qaStore.get(r1.id)?.revisionIdentity).toBe('snapshot-1');
    });

    it('QA 3: capture second snapshot', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const r1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'snapshot-1',
        timestamp: '2026-10-01T12:00:00Z',
      });
      qaStore.save(r1);

      const r2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'snapshot-2',
        timestamp: '2026-10-02T12:00:00Z',
      });
      const res2 = qaStore.save(r2);
      expect(res2.isDuplicate).toBe(false);
      expect(qaStore.list().length).toBe(2);
    });

    it('QA 4: timeline renders in strict chronological order', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const t1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'oct-01',
        timestamp: '2026-10-01T10:00:00Z',
      });
      const t2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'oct-03',
        timestamp: '2026-10-03T10:00:00Z',
      });
      const t3 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'oct-02',
        timestamp: '2026-10-02T10:00:00Z',
      });

      qaStore.save(t1);
      qaStore.save(t2);
      qaStore.save(t3);

      const timeline = qaStore.list();
      expect(timeline[0].revisionIdentity).toBe('oct-03');
      expect(timeline[1].revisionIdentity).toBe('oct-02');
      expect(timeline[2].revisionIdentity).toBe('oct-01');
    });

    it('QA 5: trend metrics render with valid data points', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const arch = analyzeArchitecture(baseEnv);
      const pr = assessProductionReadiness(baseEnv, { validationResult: val });
      const ti = assessTestingIntelligence(baseEnv, { validationResult: val });
      const td = assessTechnicalDebt(baseEnv, { validationResult: val });

      const s1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        architectureAnalysis: arch,
        productionReadiness: pr,
        testingIntelligence: ti,
        technicalDebt: td,
        source: 'manual',
        revisionIdentity: 't-1',
        timestamp: '2026-10-01T00:00:00Z',
      });
      const s2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        architectureAnalysis: arch,
        productionReadiness: pr,
        testingIntelligence: ti,
        technicalDebt: td,
        source: 'manual',
        revisionIdentity: 't-2',
        timestamp: '2026-10-02T00:00:00Z',
      });

      const trends = calculateEngineeringTrends([s1, s2]);
      expect(trends.recordCount).toBe(2);
      expect(trends.architectureTrend.dataPoints.length).toBe(2);
      expect(trends.readinessTrend.dataPoints.length).toBe(2);
      expect(trends.testingTrend.dataPoints.length).toBe(2);
      expect(trends.technicalDebtTrend.dataPoints.length).toBe(2);
    });

    it('QA 6: baseline and current comparison execution', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const b1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'b1',
      });
      const c1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'c1',
      });

      const cmp = compareHistoricalRecords(b1, c1);
      expect(cmp.baselineRecordId).toBe(b1.id);
      expect(cmp.currentRecordId).toBe(c1.id);
      expect(cmp.verdict).toBe('NO_MEANINGFUL_CHANGE');
    });

    it('QA 7: improving comparison scenario', () => {
      const inet = baseEnv.getNodes().find((n) => n.type === 'internet')?.id ?? 'inet';
      const db = baseEnv.getNodes().find((n) => n.type === 'database')?.id ?? 'db';
      baseEnv.addEdge({ id: 'vuln', source: inet, target: db, protocol: 'TCP', ports: '5432', access: 'allow' });

      const valBad = validatorEngine.evaluate(baseEnv);
      const snapBad = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valBad,
        source: 'manual',
        revisionIdentity: 'bad',
      });

      baseEnv.removeEdge('vuln');
      const valGood = validatorEngine.evaluate(baseEnv);
      const snapGood = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valGood,
        source: 'manual',
        revisionIdentity: 'good',
      });

      const cmp = compareHistoricalRecords(snapBad, snapGood);
      expect(cmp.verdict).toBe('ENGINEERING_POSTURE_IMPROVED');
    });

    it('QA 8: degrading comparison scenario', () => {
      const valGood = validatorEngine.evaluate(baseEnv);
      const snapGood = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valGood,
        source: 'manual',
        revisionIdentity: 'good',
      });

      const inet = baseEnv.getNodes().find((n) => n.type === 'internet')?.id ?? 'inet';
      const db = baseEnv.getNodes().find((n) => n.type === 'database')?.id ?? 'db';
      baseEnv.addEdge({ id: 'vuln2', source: inet, target: db, protocol: 'TCP', ports: '5432', access: 'allow' });

      const valBad = validatorEngine.evaluate(baseEnv);
      const snapBad = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: valBad,
        source: 'manual',
        revisionIdentity: 'bad',
      });

      const cmp = compareHistoricalRecords(snapGood, snapBad);
      expect(cmp.verdict).toBe('ENGINEERING_POSTURE_DEGRADED');
    });

    it('QA 9: mixed comparison scenario', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const r1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: { ...val, findings: [{ ...val.findings[0], id: 'f-1', severity: 'critical' } as any] },
        architectureAnalysis: { score: { score: 80, rating: 'strong' as const, deductions: [], summary: '' } } as any,
        source: 'manual',
        revisionIdentity: 'm1',
      });
      const r2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: { ...val, findings: [] }, // Critical findings resolved (+1)
        architectureAnalysis: { score: { score: 30, rating: 'weak' as const, deductions: [], summary: '' } } as any, // Arch degraded (-1)
        source: 'manual',
        revisionIdentity: 'm2',
      });

      const cmp = compareHistoricalRecords(r1, r2);
      expect(cmp.verdict).toBe('MIXED_ENGINEERING_IMPACT');
    });

    it('QA 10: insufficient evidence handling', () => {
      const incompleteA = {
        schemaVersion: 1,
        id: 'inc-a',
        environmentId: 'env-x',
        environmentName: 'X',
        timestamp: '2026-10-01T00:00:00Z',
        source: 'manual' as const,
        sourceIdentity: { type: 'manual' as const, environmentId: 'env-x' },
        revisionIdentity: 'none',
        topology: { nodeCount: 0, edgeCount: 0, criticalNodeCount: 0, internetFacingNodeCount: 0 },
        validation: { findingCount: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0, findingIds: [] },
        evidenceNotes: [],
      };

      const cmp = compareHistoricalRecords(incompleteA, incompleteA);
      expect(cmp.verdict).toBe('INSUFFICIENT_EVIDENCE');
      expect(cmp.verdictExplanation).toContain('Insufficient topology');
    });

    it('QA 11: malformed history record handling in file store', () => {
      const fileStore = new FileSystemHistoryStore(tempHistoryDir);
      fs.writeFileSync(path.join(tempHistoryDir, 'broken.json'), 'not a json file at all', 'utf-8');

      const list = fileStore.list();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });

    it('QA 12: duplicate capture handling and deduplication', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const snap = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
      });

      const save1 = qaStore.save(snap);
      expect(save1.isDuplicate).toBe(false);

      const save2 = qaStore.save(snap);
      expect(save2.isDuplicate).toBe(true);
      expect(qaStore.list().length).toBe(1);
    });

    it('QA 13: local Git revision display and provenance', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const gitSnap = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'local-git',
        sourceIdentity: {
          type: 'local-git',
          repositoryPath: 'e:/MHT CET REGISTRATION/BE/Task/PathForge',
          commitSha: '72a0761e1c2d365eed4271484641195da0b97565',
          branch: 'master',
          comparisonMode: 'working-tree-vs-head',
        },
      });

      expect(gitSnap.source).toBe('local-git');
      expect(gitSnap.revisionIdentity).toBe('72a0761e1c2d365eed4271484641195da0b97565');
      if (gitSnap.sourceIdentity.type === 'local-git') {
        expect(gitSnap.sourceIdentity.branch).toBe('master');
      }
    });

    it('QA 14: GitHub PR source display without credential leaks', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const prSnap = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'github-pr',
        sourceIdentity: {
          type: 'github-pr',
          owner: 'acme-corp',
          repository: 'cloud-infrastructure',
          prNumber: 102,
          baseSha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
          headSha: 'f31a982cb123e4567890abcdef1234567890abcd',
        },
      });

      expect(prSnap.source).toBe('github-pr');
      if (prSnap.sourceIdentity.type === 'github-pr') {
        expect(prSnap.sourceIdentity.owner).toBe('acme-corp');
        expect(prSnap.sourceIdentity.repository).toBe('cloud-infrastructure');
        expect(prSnap.sourceIdentity.prNumber).toBe(102);
      }
      const serialized = JSON.stringify(prSnap);
      expect(serialized).not.toContain('ghp_');
      expect(serialized).not.toContain('token');
    });

    it('QA 15: clear and delete history behavior', () => {
      const val = validatorEngine.evaluate(baseEnv);
      const r1 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'del-1',
      });
      const r2 = captureEngineeringHistoryRecord({
        environment: baseEnv,
        validationResult: val,
        source: 'manual',
        revisionIdentity: 'del-2',
      });

      qaStore.save(r1);
      qaStore.save(r2);
      expect(qaStore.list().length).toBe(2);

      qaStore.delete(r1.id);
      expect(qaStore.list().length).toBe(1);
      expect(qaStore.get(r1.id)).toBeNull();

      qaStore.clear();
      expect(qaStore.list().length).toBe(0);
    });
  });
});

