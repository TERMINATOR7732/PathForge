import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { deserializeEnvironment, InfrastructureEdge } from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine } from '@pathforge/validator';

describe('Product Loop: Build → Validate → Break → Explain → Defend → Fix → Re-test → Prove', () => {
  it('executes full deterministic break, explain, fix, and re-test cycle', () => {
    // 1. Build / Load Baseline
    const demoFilePath = path.resolve(
      __dirname,
      '../environments/demo/standard-web-app.json'
    );
    const env = deserializeEnvironment(fs.readFileSync(demoFilePath, 'utf-8'));

    const registry = createDefaultRuleRegistry();
    const engine = new ValidatorEngine(registry);

    // Initial Validate: Expect PASS
    const initialResult = engine.evaluate(env);
    expect(initialResult.summary.passed).toBe(true);
    expect(initialResult.summary.criticalCount).toBe(0);

    // 2. Break: User introduces intentional dangerous anti-pattern (Internet -> Database)
    // CRITICAL UX PRINCIPLE: The system allows the user to build bad infrastructure!
    const badEdge = new InfrastructureEdge({
      id: 'edge-chaos-bad-db',
      source: 'node-internet',
      target: 'node-db',
      metadata: {
        protocol: 'tcp',
        ports: '5432',
        direction: 'unidirectional',
        access: 'allow',
      },
    });
    env.addEdge(badEdge);

    // 3. Re-Validate: Must deterministically detect vulnerability
    const brokenResult = engine.evaluate(env);
    expect(brokenResult.summary.passed).toBe(false);
    expect(brokenResult.summary.criticalCount).toBe(1);

    // 4. Explain: System explains WHY this is dangerous across all 6 dimensions
    const dbFinding = brokenResult.findings.find((f) => f.ruleId === 'PF-001');
    expect(dbFinding).toBeDefined();
    expect(dbFinding?.severity).toBe('critical');
    expect(dbFinding?.affectedNodes).toContain('node-internet');
    expect(dbFinding?.affectedNodes).toContain('node-db');
    expect(dbFinding?.affectedEdges).toContain('edge-chaos-bad-db');

    // Explanations present
    expect(dbFinding?.whyItMatters).toContain('Databases and in-memory caches must never be directly exposed');
    expect(dbFinding?.impact).toContain('Remote unauthenticated attackers can probe database ports');
    expect(dbFinding?.recommendation).toContain('Route all traffic through a secure DMZ tier');
    expect(dbFinding?.remediation).toContain('Delete direct edge(s) [edge-chaos-bad-db]');

    // 5. Defend & Fix: Apply recommended remediation (remove bad edge)
    const removed = env.removeEdge('edge-chaos-bad-db');
    expect(removed).toBe(true);

    // 6. Re-test: Validate again
    const fixedResult = engine.evaluate(env);

    // 7. Prove: Critical finding eliminated, system restored to SECURE state
    expect(fixedResult.summary.criticalCount).toBe(0);
    expect(fixedResult.summary.passed).toBe(true);
    const remainingBadFinding = fixedResult.findings.find((f) => f.ruleId === 'PF-001');
    expect(remainingBadFinding).toBeUndefined();
  });
});
