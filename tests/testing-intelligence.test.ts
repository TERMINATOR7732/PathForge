import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  assessTestingIntelligence,
  SECURITY_PROPERTY_CATALOG,
  instantiateScenario,
  evaluateRegressionIntelligence,
  evaluatePropertyCoverage,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
} from '@pathforge/validator';

describe('Phase 2.6 — Testing Intelligence', () => {
  let validatorEngine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    validatorEngine = new ValidatorEngine(registry);
  });

  // Test 1: Secure web app has strong coverage
  it('1. evaluates secure-web-app reference scenario with strong coverage (>= 75, GOOD or EXCELLENT)', () => {
    const env = instantiateScenario('secure-web-app');
    const validationResult = validatorEngine.evaluate(env);
    const result = assessTestingIntelligence(env, {
      validationResult,
      scenarioId: 'secure-web-app',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(['GOOD', 'EXCELLENT']).toContain(result.level);
    expect(result.coverage.verifiedProperties).toBeGreaterThan(10);
    expect(result.coverage.criticalCoverage).toBeGreaterThanOrEqual(70);
  });

  // Test 2: Public DB exposure property is verified by existing scenarios/tests
  it('2. verifies database-isolation property correctly across clean vs exposed environments', () => {
    // Clean environment
    const secureEnv = instantiateScenario('secure-web-app');
    const secureVal = validatorEngine.evaluate(secureEnv);
    const secureResult = assessTestingIntelligence(secureEnv, {
      validationResult: secureVal,
    });
    const dbPropSecure = secureResult.properties.find(
      (p) => p.property.id === 'database-isolation'
    );
    expect(dbPropSecure?.status).toBe('VERIFIED');
    expect(dbPropSecure?.evidenceList.length).toBeGreaterThan(0);

    // Exposed environment
    const exposedEnv = instantiateScenario('public-db-exposure');
    const exposedVal = validatorEngine.evaluate(exposedEnv);
    const exposedResult = assessTestingIntelligence(exposedEnv, {
      validationResult: exposedVal,
      scenarioId: 'public-db-exposure',
    });
    const dbPropExposed = exposedResult.properties.find(
      (p) => p.property.id === 'database-isolation'
    );
    expect(dbPropExposed?.status).toBe('UNVERIFIED');
    expect(dbPropExposed?.evidenceList[0]?.source).toBe('unit-test');
  });

  // Test 3: Attack-path containment receives correct evidence
  it('3. assigns correct evidence to attack-path containment properties', () => {
    const secureEnv = instantiateScenario('secure-web-app');
    const secureVal = validatorEngine.evaluate(secureEnv);
    const result = assessTestingIntelligence(secureEnv, {
      validationResult: secureVal,
    });

    const critReach = result.properties.find(
      (p) => p.property.id === 'critical-asset-reachability'
    );
    expect(critReach?.status).toBe('VERIFIED');
    expect(critReach?.evidenceList.some((e) => e.source === 'model-invariant')).toBe(true);

    const highRiskProp = result.properties.find(
      (p) => p.property.id === 'high-risk-attack-path-prevention'
    );
    expect(highRiskProp?.status).toBe('VERIFIED');
  });

  // Test 4: Fix verification contributes remediation evidence
  it('4. incorporates fix verification evidence into remediation properties', () => {
    const env = instantiateScenario('secure-web-app');
    const validationResult = validatorEngine.evaluate(env);

    const mockFixVerification = {
      isVerified: true,
      hasRegressions: false,
      baselineTimestamp: '2026-10-07T12:00:00.000Z',
      verifiedAt: '2026-10-07T12:05:00.000Z',
      resolvedFindings: [
        {
          finding: {
            id: 'F-1',
            ruleId: 'PF-001',
            title: 'Public DB',
            severity: 'critical' as const,
            message: 'Resolved',
            affectedNodes: ['db-1'],
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

    const result = assessTestingIntelligence(env, {
      validationResult,
      fixVerification: mockFixVerification,
    });

    const resolutionProp = result.properties.find(
      (p) => p.property.id === 'finding-resolution-verification'
    );
    expect(resolutionProp?.status).toBe('VERIFIED');
    expect(resolutionProp?.evidenceList[0]?.source).toBe('fix-verification');

    const regressionProp = result.properties.find(
      (p) => p.property.id === 'regression-detection'
    );
    expect(regressionProp?.status).toBe('VERIFIED');
    expect(result.regressions.remediationVerified).toBe(true);
    expect(result.regressions.status).toBe('healthy');
  });

  // Test 5: Unmodeled operational properties remain UNVERIFIED
  it('5. keeps unmodeled operational properties unverified when assumptions are missing', () => {
    const env = new Environment({ id: 'wildcard-env', name: 'Wildcard Port Env' });
    const n1 = env.createNode('internet', { x: 0, y: 0 }, undefined, { zone: 'public' });
    const n2 = env.createNode('vm', { x: 200, y: 0 }, undefined, { zone: 'internal' });
    // Edge with wildcard ANY port
    env.createEdge(n1.id, n2.id, { access: 'allow', protocol: 'ANY', port: 'ANY' });

    const val = validatorEngine.evaluate(env);
    const result = assessTestingIntelligence(env, { validationResult: val });

    const wildcardProp = result.properties.find(
      (p) => p.property.id === 'wildcard-access-prevention'
    );
    expect(wildcardProp?.status).toBe('UNVERIFIED');
  });

  // Test 6: Critical properties carry higher weight
  it('6. weights critical properties with 3, high with 2, and normal with 1', () => {
    const env = instantiateScenario('secure-web-app');
    const result = assessTestingIntelligence(env);

    for (const p of result.properties) {
      if (p.property.importance === 'critical') {
        expect(p.weight).toBe(3);
      } else if (p.property.importance === 'high') {
        expect(p.weight).toBe(2);
      } else {
        expect(p.weight).toBe(1);
      }
    }
  });

  // Test 7: Partial evidence contributes half weight
  it('7. contributes half weight scoreContribution for partial verification status', () => {
    const env = instantiateScenario('secure-web-app');
    const result = assessTestingIntelligence(env);

    for (const p of result.properties) {
      if (p.status === 'VERIFIED') {
        expect(p.scoreContribution).toBe(p.weight * 1.0);
      } else if (p.status === 'PARTIAL') {
        expect(p.scoreContribution).toBe(p.weight * 0.5);
      } else {
        expect(p.scoreContribution).toBe(0);
      }
    }
  });

  // Test 8: Coverage score is deterministic
  it('8. calculates identical score and metrics across multiple executions', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);

    const r1 = assessTestingIntelligence(env, { validationResult: val, analyzedAt: '2026-10-07T00:00:00Z' });
    const r2 = assessTestingIntelligence(env, { validationResult: val, analyzedAt: '2026-10-07T00:00:00Z' });

    expect(r1.score).toBe(r2.score);
    expect(r1.level).toBe(r2.level);
    expect(r1.coverage).toEqual(r2.coverage);
    expect(r1.gaps.length).toBe(r2.gaps.length);
  });

  // Test 9: Coordinate changes do not affect result
  it('9. does not change coverage score when node layout coordinates are modified', () => {
    const env1 = instantiateScenario('secure-web-app');
    const env2 = instantiateScenario('secure-web-app');

    // Mutate coordinates on env2
    for (const node of env2.getNodes()) {
      node.position = { x: node.position.x + 500, y: node.position.y - 300 };
    }

    const r1 = assessTestingIntelligence(env1, { analyzedAt: '2026-10-07T00:00:00Z' });
    const r2 = assessTestingIntelligence(env2, { analyzedAt: '2026-10-07T00:00:00Z' });

    expect(r1.score).toBe(r2.score);
    expect(r1.coverage).toEqual(r2.coverage);
  });

  // Test 10: Serialized output is deterministic
  it('10. produces byte-for-byte identical JSON serialization with fixed analyzedAt', () => {
    const env = instantiateScenario('secure-web-app');
    const val = validatorEngine.evaluate(env);

    const r1 = assessTestingIntelligence(env, { validationResult: val, analyzedAt: '2026-10-07T12:00:00.000Z' });
    const r2 = assessTestingIntelligence(env, { validationResult: val, analyzedAt: '2026-10-07T12:00:00.000Z' });

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  // Test 11: Category scores are correct
  it('11. computes accurate category coverage summaries and scores across all 6 categories', () => {
    const env = instantiateScenario('secure-web-app');
    const result = assessTestingIntelligence(env);

    expect(result.categories).toHaveLength(6);
    const categories = result.categories.map((c) => c.category);
    expect(categories).toEqual([
      'network-security',
      'communication-security',
      'access-control',
      'attack-resistance',
      'architecture',
      'remediation',
    ]);

    for (const cat of result.categories) {
      expect(cat.score).toBeGreaterThanOrEqual(0);
      expect(cat.score).toBeLessThanOrEqual(100);
      expect(cat.verified + cat.partial + cat.unverified).toBe(cat.totalProperties);
    }
  });

  // Test 12: Coverage gaps have correct severity
  it('12. assigns correct severity to coverage gaps based on property importance', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);
    const result = assessTestingIntelligence(env, { validationResult: val });

    for (const gap of result.gaps) {
      const def = SECURITY_PROPERTY_CATALOG.find((p) => p.id === gap.propertyId);
      expect(def).toBeDefined();
      if (def?.importance === 'critical') {
        expect(['high', 'medium']).toContain(gap.severity);
      } else if (def?.importance === 'high') {
        expect(['medium', 'low']).toContain(gap.severity);
      } else {
        expect(gap.severity).toBe('low');
      }
    }
  });

  // Test 13: Recommendations map deterministically to properties
  it('13. maps recommendations deterministically from verification strategies of gap properties', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);
    const result = assessTestingIntelligence(env, { validationResult: val });

    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const rec of result.recommendations) {
      const matched = SECURITY_PROPERTY_CATALOG.some((p) => p.verificationStrategy === rec);
      expect(matched).toBe(true);
    }
  });

  // Test 14: Existing scenario catalog is reused rather than duplicated
  it('14. reuses existing scenario catalog definitions as evidence', () => {
    const env = instantiateScenario('public-db-exposure');
    const val = validatorEngine.evaluate(env);
    const result = assessTestingIntelligence(env, {
      validationResult: val,
      scenarioId: 'public-db-exposure',
    });

    const evs = result.properties.flatMap((p) => p.evidenceList);
    expect(evs.some((e) => e.source === 'unit-test' || e.source === 'scenario')).toBe(true);
  });

  // Test 15: Regression baseline unavailable is represented explicitly
  it('15. explicitly flags no-baseline status when fix verification baseline is absent', () => {
    const reg = evaluateRegressionIntelligence(null);

    expect(reg.hasBaseline).toBe(false);
    expect(reg.status).toBe('no-baseline');
    expect(reg.summary).toContain('No regression baseline available');
    expect(reg.remediationVerified).toBe(false);
  });

  // Test 16: Previously resolved finding remaining resolved is healthy
  it('16. reports healthy regression status when resolved findings remain resolved', () => {
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
            title: 'Resolved DB Exposure',
            severity: 'critical' as const,
            message: 'Fixed',
            affectedNodes: ['db-1'],
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

    const reg = evaluateRegressionIntelligence(mockFixVerification);

    expect(reg.hasBaseline).toBe(true);
    expect(reg.status).toBe('healthy');
    expect(reg.remediationVerified).toBe(true);
    expect(reg.regressedPropertiesCount).toBe(0);
    expect(reg.resolvedPropertiesCount).toBe(1);
  });

  // Test 17: Reintroduced finding is detected as regression
  it('17. detects introduced findings as regressions and sets regressions-detected status', () => {
    const mockFixVerification = {
      isVerified: false,
      hasRegressions: true,
      baselineTimestamp: '2026-10-07T10:00:00.000Z',
      verifiedAt: '2026-10-07T10:05:00.000Z',
      resolvedFindings: [],
      remainingFindings: [],
      newFindings: [
        {
          finding: {
            id: 'F-REG-001',
            ruleId: 'PF-004',
            title: 'New untrusted ingress',
            severity: 'critical' as const,
            message: 'Regression',
            affectedNodes: ['net-1'],
            affectedEdges: [],
            evidence: [],
          },
          introducedIn: 'after' as const,
        },
      ],
      structuralChanges: {
        addedNodeIds: [],
        removedNodeIds: [],
        addedEdgeIds: [],
        removedEdgeIds: [],
        modifiedNodeIds: [],
        modifiedEdgeIds: [],
      },
    };

    const reg = evaluateRegressionIntelligence(mockFixVerification);

    expect(reg.hasBaseline).toBe(true);
    expect(reg.status).toBe('regressions-detected');
    expect(reg.regressedPropertiesCount).toBe(1);
    expect(reg.regressedFindings).toContain('PF-004');
    expect(reg.remediationVerified).toBe(false);
  });

  // Test 18: Multiple gaps are sorted deterministically
  it('18. sorts multiple coverage gaps deterministically by severity rank and propertyId', () => {
    const env = instantiateScenario('flat-network');
    const val = validatorEngine.evaluate(env);
    const result = assessTestingIntelligence(env, { validationResult: val });

    const severityRank: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    for (let i = 0; i < result.gaps.length - 1; i++) {
      const g1 = result.gaps[i];
      const g2 = result.gaps[i + 1];
      const r1 = severityRank[g1.severity];
      const r2 = severityRank[g2.severity];
      if (r1 !== r2) {
        expect(r1).toBeGreaterThanOrEqual(r2);
      } else {
        expect(g1.propertyId.localeCompare(g2.propertyId)).toBeLessThanOrEqual(0);
      }
    }
  });

  // Test 19: DENY topology does not create false exposure evidence
  it('19. verifies deny-boundary-enforcement when explicit DENY edges exist without false exposures', () => {
    const env = new Environment({ id: 'deny-test-env', name: 'Deny Boundary Env' });
    const inet = env.createNode('internet', { x: 0, y: 0 }, undefined, { zone: 'public' });
    const fw = env.createNode('firewall', { x: 200, y: 0 }, undefined, { zone: 'dmz' });
    const db = env.createNode('database', { x: 400, y: 0 }, undefined, { zone: 'restricted' });

    env.createEdge(inet.id, fw.id, { access: 'allow', protocol: 'HTTPS', port: 443, encrypted: true });
    env.createEdge(fw.id, db.id, { access: 'deny', protocol: 'ANY', port: 'ANY' });

    const val = validatorEngine.evaluate(env);
    const result = assessTestingIntelligence(env, { validationResult: val });

    const denyProp = result.properties.find((p) => p.property.id === 'deny-boundary-enforcement');
    expect(denyProp?.status).toBe('VERIFIED');
    expect(denyProp?.evidenceList[0]?.source).toBe('model-invariant');
  });

  // Test 20: Encrypted sensitive communication receives correct verification status
  it('20. verifies sensitive-traffic-encryption when sensitive edges are encrypted and flags unencrypted', () => {
    // Encrypted setup
    const encEnv = new Environment({ id: 'enc-env', name: 'Encrypted Env' });
    const app = encEnv.createNode('vm', { x: 0, y: 0 }, undefined, { zone: 'internal' });
    const db = encEnv.createNode('database', { x: 200, y: 0 }, undefined, { zone: 'restricted' });
    encEnv.createEdge(app.id, db.id, { access: 'allow', protocol: 'TLS', port: 5432, encrypted: true });

    const valEnc = validatorEngine.evaluate(encEnv);
    const resEnc = assessTestingIntelligence(encEnv, { validationResult: valEnc });
    const propEnc = resEnc.properties.find((p) => p.property.id === 'sensitive-traffic-encryption');
    expect(propEnc?.status).toBe('VERIFIED');

    // Unencrypted setup
    const unencEnv = new Environment({ id: 'unenc-env', name: 'Unencrypted Env' });
    const app2 = unencEnv.createNode('vm', { x: 0, y: 0 }, undefined, { zone: 'internal' });
    const db2 = unencEnv.createNode('database', { x: 200, y: 0 }, undefined, { zone: 'restricted' });
    unencEnv.createEdge(app2.id, db2.id, { access: 'allow', protocol: 'TCP', port: 5432, encrypted: false });

    const valUnenc = validatorEngine.evaluate(unencEnv);
    const resUnenc = assessTestingIntelligence(unencEnv, { validationResult: valUnenc });
    const propUnenc = resUnenc.properties.find((p) => p.property.id === 'sensitive-traffic-encryption');
    expect(propUnenc?.status).toBe('UNVERIFIED');
  });

  // Test 21: Empty/sparse environments do not receive fabricated coverage
  it('21. returns 0 score and INSUFFICIENT coverage for empty or single-node environments', () => {
    const emptyEnv = new Environment({ id: 'empty-env', name: 'Empty' });
    const rEmpty = assessTestingIntelligence(emptyEnv);

    expect(rEmpty.score).toBe(0);
    expect(rEmpty.level).toBe('INSUFFICIENT');
    expect(rEmpty.coverage.verifiedProperties).toBe(0);
    expect(rEmpty.coverage.overallCoverage).toBe(0);
    expect(rEmpty.summary).toContain('insufficient modeled components');

    const singleEnv = new Environment({ id: 'single-env', name: 'Single' });
    singleEnv.createNode('internet', { x: 0, y: 0 });
    const rSingle = assessTestingIntelligence(singleEnv);

    expect(rSingle.score).toBe(0);
    expect(rSingle.level).toBe('INSUFFICIENT');
  });

  // Test 22: No operational capability is marked verified unless actual evidence exists
  it('22. does not mark operational or unverified capabilities as VERIFIED without evidence', () => {
    const sparseEnv = new Environment({ id: 'minimal-env', name: 'Minimal Env' });
    sparseEnv.createNode('internet', { x: 0, y: 0 });
    sparseEnv.createNode('vm', { x: 200, y: 0 });

    const val = validatorEngine.evaluate(sparseEnv);
    const result = assessTestingIntelligence(sparseEnv, { validationResult: val });

    // Without explicit DENY edges or firewalls, deny-boundary-enforcement is not verified
    const denyProp = result.properties.find((p) => p.property.id === 'deny-boundary-enforcement');
    expect(denyProp?.status).not.toBe('VERIFIED');

    // Without fix verification, finding-resolution-verification is not verified
    const fixProp = result.properties.find((p) => p.property.id === 'finding-resolution-verification');
    expect(fixProp?.status).not.toBe('VERIFIED');
  });
});
