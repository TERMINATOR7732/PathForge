import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { deserializeEnvironment } from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine } from '@pathforge/validator';

describe('Demo Environment Verification', () => {
  it('loads and validates the Standard Secure 3-Tier Web App demo environment', () => {
    const demoFilePath = path.resolve(
      __dirname,
      '../environments/demo/standard-web-app.json'
    );
    expect(fs.existsSync(demoFilePath)).toBe(true);

    const rawJson = fs.readFileSync(demoFilePath, 'utf-8');
    const environment = deserializeEnvironment(rawJson);

    expect(environment.id).toBe('env-demo-standard-web');
    expect(environment.name).toBe('Standard Secure 3-Tier Web Application');

    // Verify expected 7 nodes
    const nodes = environment.getNodes();
    expect(nodes).toHaveLength(7);

    const nodeTypes = nodes.map((n) => n.type);
    expect(nodeTypes).toContain('internet');
    expect(nodeTypes).toContain('firewall');
    expect(nodeTypes).toContain('load_balancer');
    expect(nodeTypes).toContain('web_server');
    expect(nodeTypes).toContain('api_server');
    expect(nodeTypes).toContain('database');
    expect(nodeTypes).toContain('redis');

    // Verify 6 edges
    const edges = environment.getEdges();
    expect(edges).toHaveLength(6);

    // Run deterministic validation engine
    const registry = createDefaultRuleRegistry();
    const engine = new ValidatorEngine(registry);
    const result = engine.evaluate(environment);

    expect(result.environmentId).toBe(environment.id);
    expect(result.rulesEvaluated).toBe(7);

    // Standard baseline should have 0 critical findings and pass
    expect(result.summary.criticalCount).toBe(0);
    expect(result.summary.highCount).toBe(0);
    expect(result.summary.passed).toBe(true);
  });
});
