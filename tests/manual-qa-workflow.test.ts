import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { deserializeEnvironment } from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine } from '@pathforge/validator';

describe('Phase 1.2 — 10-Step Manual QA Workflow Simulation', () => {
  it('executes the exact 10-step workflow reliably', () => {
    // Step 1: Load the standard environment
    const demoFilePath = path.resolve(
      __dirname,
      '../environments/demo/standard-web-app.json'
    );
    const env = deserializeEnvironment(fs.readFileSync(demoFilePath, 'utf-8'));
    const registry = createDefaultRuleRegistry();
    const engine = new ValidatorEngine(registry);

    expect(env.id).toBe('env-demo-standard-web');
    expect(env.getNodes()).toHaveLength(7);
    expect(env.getEdges()).toHaveLength(6);

    // Initial validation passes
    const initialResult = engine.evaluate(env);
    expect(initialResult.summary.passed).toBe(true);

    // Step 2: Move Web, API, Database around the canvas. Confirm positions remain correct.
    env.updateNodePosition('node-web', 750, 260);
    env.updateNodePosition('node-api', 950, 260);
    env.updateNodePosition('node-db', 1150, 200);

    expect(env.getNode('node-web')?.position).toEqual({ x: 750, y: 260 });
    expect(env.getNode('node-api')?.position).toEqual({ x: 950, y: 260 });
    expect(env.getNode('node-db')?.position).toEqual({ x: 1150, y: 200 });

    // Step 3: Add a second Database from the palette. Confirm it appears at the drop position.
    const db2 = env.createNode('database', { x: 800, y: 500 });
    expect(db2).toBeDefined();
    expect(db2.id).toBe('node-database-2');
    expect(db2.name).toBe('Database 2');
    expect(db2.position).toEqual({ x: 800, y: 500 });
    expect(env.getNode('node-database-2')).toBe(db2);

    // Step 4: Connect Web → Database 2. Confirm an actual edge is created.
    const edgeWebToDb2 = env.createEdge('node-web', db2.id, {
      protocol: 'tcp',
      ports: '5432',
    });
    expect(edgeWebToDb2).toBeDefined();
    expect(env.hasEdgeBetween('node-web', db2.id)).toBe(true);
    expect(env.getEdge(edgeWebToDb2.id)).toBe(edgeWebToDb2);

    // Step 5: Select the edge. Confirm the inspector shows Web → Database 2.
    const inspectedEdge = env.getEdge(edgeWebToDb2.id);
    expect(inspectedEdge?.source).toBe('node-web');
    expect(inspectedEdge?.target).toBe('node-database-2');

    // Step 6: Delete the edge. Confirm it disappears from the graph.
    const edgeDeleted = env.removeEdge(edgeWebToDb2.id);
    expect(edgeDeleted).toBe(true);
    expect(env.getEdge(edgeWebToDb2.id)).toBeUndefined();
    expect(env.hasEdgeBetween('node-web', db2.id)).toBe(false);

    // Step 7: Create Internet → Database. Confirm the editor allows it.
    const badEdge = env.createEdge('node-internet', 'node-db', {
      protocol: 'tcp',
      ports: '5432',
    });
    expect(badEdge).toBeDefined();
    expect(env.hasEdgeBetween('node-internet', 'node-db')).toBe(true);

    // Step 8: Run validation. Confirm the existing public database exposure rule reports the problem.
    const brokenResult = engine.evaluate(env);
    expect(brokenResult.summary.passed).toBe(false);
    expect(brokenResult.summary.criticalCount).toBe(1);

    const finding = brokenResult.findings.find((f) => f.ruleId === 'PF-001');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('critical');
    expect(finding?.affectedNodes).toContain('node-internet');
    expect(finding?.affectedNodes).toContain('node-db');

    // Step 9: Delete the bad edge.
    const badEdgeDeleted = env.removeEdge(badEdge.id);
    expect(badEdgeDeleted).toBe(true);
    expect(env.getEdge(badEdge.id)).toBeUndefined();
    expect(env.hasEdgeBetween('node-internet', 'node-db')).toBe(false);

    // Clean up the isolated db2 to leave standard topology clean
    env.removeNode(db2.id);

    // Step 10: Re-run validation. Confirm the finding disappears if no other violation exists.
    const finalResult = engine.evaluate(env);
    expect(finalResult.summary.passed).toBe(true);
    expect(finalResult.summary.criticalCount).toBe(0);
    expect(finalResult.findings.some((f) => f.ruleId === 'PF-001')).toBe(false);
  });
});
