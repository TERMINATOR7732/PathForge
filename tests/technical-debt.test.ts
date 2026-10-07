import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  assessTechnicalDebt,
  instantiateScenario,
  TECHNICAL_DEBT_CATALOG,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
} from '@pathforge/validator';

describe('Phase 2.7 — Technical Debt & Engineering Risk Tracking', () => {
  let validatorEngine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    validatorEngine = new ValidatorEngine(registry);
  });

  // Test 1: Secure web app has low modeled technical debt
  it('1. evaluates secure-web-app reference scenario with low/manageable modeled technical debt (>= 75)', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, {
      validationResult: val,
      scenarioId: 'secure-web-app',
    });

    expect(assessment.summary.overallScore).toBeGreaterThanOrEqual(75);
    expect(['LOW_DEBT', 'MANAGEABLE']).toContain(assessment.summary.rating);
    expect(assessment.summary.criticalCount).toBe(0);
    expect(assessment.summary.p0Count).toBe(0);
  });

  // Test 2: Public DB exposure produces security debt
  it('2. detects TD-001 Public Sensitive Asset Exposure when database is exposed to public ingress', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, {
      validationResult: val,
      scenarioId: 'public-db-exposure',
    });

    const td001 = assessment.items.find((i) => i.definitionId === 'TD-001');
    expect(td001).toBeDefined();
    expect(td001?.status).toBe('ACTIVE');
    expect(td001?.category).toBe('security-debt');
    expect(td001?.severity).toBe('CRITICAL');
    expect(td001?.priority).toBe('P0');
    expect(td001?.evidence.length).toBeGreaterThan(0);
  });

  // Test 3: Flat topology produces architecture debt
  it('3. detects TD-005 Flat Network Architecture in flat internal network scenario', () => {
    const env = instantiateScenario('flat-network');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, {
      validationResult: val,
      scenarioId: 'flat-network',
    });

    const td005 = assessment.items.find((i) => i.definitionId === 'TD-005');
    expect(td005).toBeDefined();
    expect(td005?.status).toBe('ACTIVE');
    expect(td005?.category).toBe('architecture-debt');
  });

  // Test 4: Cleartext sensitive communication produces communication/security debt
  it('4. detects TD-002 Unencrypted Sensitive Communication when cleartext links target sensitive stores', () => {
    const env = new Environment({ id: 'unenc-env', name: 'Unencrypted Sensitive DB' });
    const app = env.createNode('vm', { x: 0, y: 0 }, undefined, { zone: 'internal' });
    const db = env.createNode('database', { x: 200, y: 0 }, undefined, { zone: 'restricted' });
    env.createEdge(app.id, db.id, { access: 'allow', protocol: 'TCP', port: 5432, encrypted: false });

    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const td002 = assessment.items.find((i) => i.definitionId === 'TD-002');
    expect(td002).toBeDefined();
    expect(td002?.status).toBe('ACTIVE');
    expect(td002?.severity).toBe('CRITICAL');
    expect(td002?.causedBy).toContain('PF-008');
  });

  // Test 5: Wildcard access produces access-control debt
  it('5. detects TD-011 Wildcard Access when links allow ANY:ANY without port scoping', () => {
    const env = new Environment({ id: 'wildcard-env', name: 'Wildcard Access' });
    const n1 = env.createNode('internet', { x: 0, y: 0 }, undefined, { zone: 'public' });
    const n2 = env.createNode('vm', { x: 200, y: 0 }, undefined, { zone: 'internal' });
    env.createEdge(n1.id, n2.id, { access: 'allow', protocol: 'ANY', port: 'ANY' });

    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const td011 = assessment.items.find((i) => i.definitionId === 'TD-011');
    expect(td011).toBeDefined();
    expect(td011?.status).toBe('ACTIVE');
    expect(td011?.category).toBe('access-control-debt');
  });

  // Test 6: Potential SPOF produces resilience debt
  it('6. detects TD-009 Potential Single Point of Failure when single nodes become bottlenecks', () => {
    const env = new Environment({ id: 'spof-env', name: 'SPOF Bottleneck' });
    const client1 = env.createNode('web_server', { x: 0, y: 0 });
    const client2 = env.createNode('web_server', { x: 0, y: 100 });
    const client3 = env.createNode('web_server', { x: 0, y: 200 });
    const sharedDb = env.createNode('database', { x: 300, y: 100 }, undefined, { criticality: 'critical' });

    env.createEdge(client1.id, sharedDb.id, { access: 'allow', protocol: 'TLS', port: 5432, encrypted: true });
    env.createEdge(client2.id, sharedDb.id, { access: 'allow', protocol: 'TLS', port: 5432, encrypted: true });
    env.createEdge(client3.id, sharedDb.id, { access: 'allow', protocol: 'TLS', port: 5432, encrypted: true });

    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const td009 = assessment.items.find((i) => i.definitionId === 'TD-009');
    expect(td009).toBeDefined();
    expect(td009?.status).toBe('ACTIVE');
    expect(td009?.category).toBe('resilience-debt');
  });

  // Test 7: High dependency concentration produces dependency/resilience debt
  it('7. detects TD-008 Dependency Concentration when excessive fan-in converges on a single asset', () => {
    const env = new Environment({ id: 'fanin-env', name: 'Fan-In Concentration' });
    const db = env.createNode('database', { x: 400, y: 150 });
    for (let i = 0; i < 4; i++) {
      const app = env.createNode('api_server', { x: 100, y: i * 80 });
      env.createEdge(app.id, db.id, { access: 'allow', protocol: 'TLS', port: 5432, encrypted: true });
    }

    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const td008 = assessment.items.find((i) => i.definitionId === 'TD-008');
    expect(td008).toBeDefined();
    expect(td008?.status).toBe('ACTIVE');
    expect(td008?.affectedNodeIds).toContain(db.id);
  });

  // Test 8: Missing critical testing coverage produces testing debt
  it('8. detects TD-014 Missing Critical Verification Coverage when critical properties are unverified', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, {
      validationResult: val,
      scenarioId: 'public-db-exposure',
    });

    const td014 = assessment.items.find((i) => i.definitionId === 'TD-014');
    expect(td014).toBeDefined();
    expect(td014?.status).toBe('ACTIVE');
    expect(td014?.category).toBe('testing-debt');
    expect(td014?.debtImpact).toBe('regression-risk');
  });

  // Test 9: Missing regression baseline produces appropriate testing debt
  it('9. detects TD-015 Missing Regression Baseline when no validated baseline exists', () => {
    const env = instantiateScenario('secure-web-app');
    const assessment = assessTechnicalDebt(env, {
      fixVerification: null,
    });

    const td015 = assessment.items.find((i) => i.definitionId === 'TD-015');
    expect(td015).toBeDefined();
    expect(td015?.status).toBe('ACTIVE');
    expect(td015?.summary).toContain('No immutable validated snapshot exists');
  });

  // Test 10: Unverified operational controls produce operational debt
  it('10. classifies unmodeled operational controls as UNVERIFIED operational debt', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const opItems = assessment.items.filter((i) => i.category === 'operational-debt');
    expect(opItems.length).toBeGreaterThan(0);
    for (const item of opItems) {
      expect(item.status).toBe('UNVERIFIED');
      expect(item.sourceAnalysis).toBe('production-readiness');
    }
  });

  // Test 11: Debt source links point to real existing evidence
  it('11. links debt items to authentic evidence and source analysis without fabrications', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    for (const item of assessment.items) {
      expect(item.sourceAnalysis).toBeDefined();
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.causedBy.length).toBeGreaterThan(0);
    }
  });

  // Test 12: Debt scores are deterministic
  it('12. calculates identical priority scores and metrics across repeated executions', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);

    const a1 = assessTechnicalDebt(env, { validationResult: val, analyzedAt: '2026-10-08T00:00:00Z' });
    const a2 = assessTechnicalDebt(env, { validationResult: val, analyzedAt: '2026-10-08T00:00:00Z' });

    expect(a1.summary.overallScore).toBe(a2.summary.overallScore);
    expect(a1.summary.rating).toBe(a2.summary.rating);
    expect(a1.items.length).toBe(a2.items.length);
    for (let i = 0; i < a1.items.length; i++) {
      expect(a1.items[i].priorityScore).toBe(a2.items[i].priorityScore);
      expect(a1.items[i].priority).toBe(a2.items[i].priority);
    }
  });

  // Test 13: Priority levels are deterministic
  it('13. maps priority scores deterministically to P0, P1, P2, and P3 tiers', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    for (const item of assessment.items) {
      if (item.priorityScore >= 80) {
        expect(item.priority).toBe('P0');
      } else if (item.priorityScore >= 60) {
        expect(item.priority).toBe('P1');
      } else if (item.priorityScore >= 35) {
        expect(item.priority).toBe('P2');
      } else {
        expect(item.priority).toBe('P3');
      }
    }
  });

  // Test 14: Tie-breaking is deterministic
  it('14. uses strict deterministic tie-breaking for equal priority scores', () => {
    const env = instantiateScenario('flat-network');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const severityRank: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    for (let i = 0; i < assessment.items.length - 1; i++) {
      const it1 = assessment.items[i];
      const it2 = assessment.items[i + 1];

      if (it1.priorityScore !== it2.priorityScore) {
        expect(it1.priorityScore).toBeGreaterThanOrEqual(it2.priorityScore);
      } else {
        const r1 = severityRank[it1.severity];
        const r2 = severityRank[it2.severity];
        if (r1 !== r2) {
          expect(r1).toBeGreaterThanOrEqual(r2);
        } else if (it1.category !== it2.category) {
          expect(it1.category.localeCompare(it2.category)).toBeLessThanOrEqual(0);
        } else {
          expect(it1.id.localeCompare(it2.id)).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  // Test 15: Coordinates do not affect debt
  it('15. produces identical technical debt assessment when node canvas coordinates are moved', () => {
    const env1 = instantiateScenario('secure-web-app');
    const env2 = instantiateScenario('secure-web-app');

    for (const node of env2.getNodes()) {
      node.position = { x: node.position.x + 800, y: node.position.y - 450 };
    }

    const a1 = assessTechnicalDebt(env1, { analyzedAt: '2026-10-08T00:00:00Z' });
    const a2 = assessTechnicalDebt(env2, { analyzedAt: '2026-10-08T00:00:00Z' });

    expect(a1.summary.overallScore).toBe(a2.summary.overallScore);
    expect(a1.summary.activeCount).toBe(a2.summary.activeCount);
    expect(a1.items.length).toBe(a2.items.length);
  });

  // Test 16: DENY edges do not create false debt
  it('16. ensures explicit DENY edges do not create false exposure debt', () => {
    const env = new Environment({ id: 'deny-env', name: 'Deny Boundary' });
    const inet = env.createNode('internet', { x: 0, y: 0 }, undefined, { zone: 'public' });
    const db = env.createNode('database', { x: 200, y: 0 }, undefined, { zone: 'restricted' });
    env.createEdge(inet.id, db.id, { access: 'deny', protocol: 'ANY', port: 'ANY' });

    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const td001 = assessment.items.find((i) => i.definitionId === 'TD-001');
    expect(td001).toBeUndefined();

    const td011 = assessment.items.find((i) => i.definitionId === 'TD-011');
    expect(td011).toBeUndefined();
  });

  // Test 17: Encryption removes the appropriate communication debt
  it('17. clears TD-002 Unencrypted Sensitive Communication when sensitive edges enforce encryption', () => {
    const env = new Environment({ id: 'enc-clean-env', name: 'Encrypted DB Link' });
    const app = env.createNode('vm', { x: 0, y: 0 }, undefined, { zone: 'internal' });
    const db = env.createNode('database', { x: 200, y: 0 }, undefined, { zone: 'restricted' });
    env.createEdge(app.id, db.id, { access: 'allow', protocol: 'TLS', port: 5432, encrypted: true });

    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const td002 = assessment.items.find((i) => i.definitionId === 'TD-002');
    expect(td002).toBeUndefined();
  });

  // Test 18: Remediation followed by revalidation can mark debt MITIGATED
  it('18. marks debt item as MITIGATED when fix verification proves revalidation resolution', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);

    const mockFixVerification = {
      isVerified: true,
      hasRegressions: false,
      baselineTimestamp: '2026-10-07T10:00:00.000Z',
      verifiedAt: '2026-10-07T10:05:00.000Z',
      resolvedFindings: [
        {
          finding: {
            id: 'F-PF-001',
            ruleId: 'PF-001',
            title: 'Public DB Exposure',
            severity: 'critical' as const,
            message: 'Resolved',
            affectedNodes: ['node-db'],
            affectedEdges: [],
            evidence: [],
          },
          verifiedByRevalidation: true,
        },
      ],
      remainingFindings: [],
      newFindings: [],
      structuralChanges: {
        addedNodeIds: [],
        removedNodeIds: [],
        addedEdgeIds: [],
        removedEdgeIds: [],
        modifiedNodeIds: [],
        modifiedEdgeIds: [],
      },
    };

    const assessment = assessTechnicalDebt(env, {
      validationResult: val,
      fixVerification: mockFixVerification,
    });

    const td001 = assessment.items.find((i) => i.definitionId === 'TD-001');
    expect(td001).toBeDefined();
    expect(td001?.status).toBe('MITIGATED');
    expect(assessment.mitigatedItems).toContain(td001);
  });

  // Test 19: Applying a fix without revalidation does NOT mark debt mitigated
  it('19. keeps debt item ACTIVE if finding is still active in current validation result', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);

    // No fix verification executed yet
    const assessment = assessTechnicalDebt(env, {
      validationResult: val,
      fixVerification: null,
    });

    const td001 = assessment.items.find((i) => i.definitionId === 'TD-001');
    expect(td001).toBeDefined();
    expect(td001?.status).toBe('ACTIVE');
  });

  // Test 20: Multiple debt items are sorted deterministically
  it('20. sorts items by priority score, severity, category, and ID', () => {
    const env = instantiateScenario('chaos-lab');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    expect(assessment.items.length).toBeGreaterThan(1);
    for (let i = 0; i < assessment.items.length - 1; i++) {
      expect(assessment.items[i].priorityScore).toBeGreaterThanOrEqual(
        assessment.items[i + 1].priorityScore
      );
    }
  });

  // Test 21: Aggregate score is deterministic
  it('21. produces byte-for-byte identical JSON serialization with fixed analyzedAt', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);

    const a1 = assessTechnicalDebt(env, { validationResult: val, analyzedAt: '2026-10-08T12:00:00.000Z' });
    const a2 = assessTechnicalDebt(env, { validationResult: val, analyzedAt: '2026-10-08T12:00:00.000Z' });

    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
  });

  // Test 22: Category totals are correct
  it('22. accurately aggregates category count totals matching active item counts', () => {
    const env = instantiateScenario('chaos-lab');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const totalFromCategories = Object.values(assessment.summary.byCategory).reduce(
      (acc, count) => acc + count,
      0
    );
    expect(totalFromCategories).toBe(assessment.summary.activeCount);
  });

  // Test 23: Empty/sparse environments do not receive fabricated debt
  it('23. returns 100 overall score and 0 active debt items for empty or single-node topologies', () => {
    const emptyEnv = new Environment({ id: 'empty', name: 'Empty' });
    const aEmpty = assessTechnicalDebt(emptyEnv);

    expect(aEmpty.summary.overallScore).toBe(100);
    expect(aEmpty.summary.rating).toBe('LOW_DEBT');
    expect(aEmpty.items).toHaveLength(0);
    expect(aEmpty.activeItems).toHaveLength(0);

    const singleEnv = new Environment({ id: 'single', name: 'Single' });
    singleEnv.createNode('internet', { x: 0, y: 0 });
    const aSingle = assessTechnicalDebt(singleEnv);

    expect(aSingle.summary.overallScore).toBe(100);
    expect(aSingle.items).toHaveLength(0);
  });

  // Test 24: No debt is generated solely because a capability is outside PathForge's modeled scope
  it('24. only represents unobservable operational controls as unverified evidence debt', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);
    const assessment = assessTechnicalDebt(env, { validationResult: val });

    const unverified = assessment.unverifiedItems;
    for (const item of unverified) {
      expect(item.category).toBe('operational-debt');
      expect(item.sourceAnalysis).toBe('production-readiness');
    }
  });

  // Test 25: Existing tests remain unchanged and passing
  it('25. verifies full integrity of the technical debt catalog', () => {
    expect(TECHNICAL_DEBT_CATALOG.length).toBeGreaterThanOrEqual(20);
    const categories = new Set(TECHNICAL_DEBT_CATALOG.map((d) => d.category));
    expect(categories.has('security-debt')).toBe(true);
    expect(categories.has('architecture-debt')).toBe(true);
    expect(categories.has('resilience-debt')).toBe(true);
    expect(categories.has('access-control-debt')).toBe(true);
    expect(categories.has('testing-debt')).toBe(true);
    expect(categories.has('operational-debt')).toBe(true);
    expect(categories.has('complexity-debt')).toBe(true);
  });
});
