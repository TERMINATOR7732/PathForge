import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  deserializeEnvironment,
  serializeEnvironment,
  Environment,
} from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine } from '@pathforge/validator';

describe('Phase 1.2 Editor Domain & Validation Integration', () => {
  let env: Environment;
  let engine: ValidatorEngine;

  beforeEach(() => {
    const demoFilePath = path.resolve(
      __dirname,
      '../environments/demo/standard-web-app.json'
    );
    env = deserializeEnvironment(fs.readFileSync(demoFilePath, 'utf-8'));
    const registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  describe('Node Manipulations & Coordinate Persistence', () => {
    it('updates node coordinates and persists them across serialization', () => {
      const webNode = env.getNode('node-web');
      expect(webNode).toBeDefined();
      expect(webNode?.position).toEqual({ x: 700, y: 240 });

      // Move node to new position
      const moved = env.updateNodePosition('node-web', 850, 400);
      expect(moved).toBe(true);
      expect(webNode?.position).toEqual({ x: 850, y: 400 });

      // Serialize and restore
      const json = serializeEnvironment(env);
      const restored = deserializeEnvironment(json);
      const restoredWebNode = restored.getNode('node-web');

      expect(restoredWebNode?.position).toEqual({ x: 850, y: 400 });
    });

    it('adds new components from palette with unique IDs and sensible names', () => {
      const initialNodeCount = env.getNodes().length;

      // Add a second database
      const db2 = env.createNode('database', { x: 1100, y: 450 });
      expect(env.getNodes().length).toBe(initialNodeCount + 1);
      expect(db2.id).toBe('node-database-2');
      expect(db2.name).toBe('Database 2');
      expect(db2.metadata.zone).toBe('restricted');
      expect(db2.position).toEqual({ x: 1100, y: 450 });

      // Add a third database
      const db3 = env.createNode('database', { x: 1100, y: 600 });
      expect(db3.id).toBe('node-database-3');
      expect(db3.name).toBe('Database 3');

      // Add a firewall
      const fw2 = env.createNode('firewall', { x: 300, y: 400 });
      expect(fw2.id).toBe('node-firewall-2');
      expect(fw2.name).toBe('Firewall 2');
    });

    it('deletes a node and cascades removal of all associated edges', () => {
      // Check initial state of API server
      const apiNode = env.getNode('node-api');
      expect(apiNode).toBeDefined();

      const incoming = env.graph.getIncomingEdges('node-api');
      const outgoing = env.graph.getOutgoingEdges('node-api');
      expect(incoming.length).toBeGreaterThan(0);
      expect(outgoing.length).toBeGreaterThan(0);

      const edgeIds = [...incoming.map((e) => e.id), ...outgoing.map((e) => e.id)];

      // Delete the node
      const deleted = env.removeNode('node-api');
      expect(deleted).toBe(true);
      expect(env.getNode('node-api')).toBeUndefined();

      // Verify all incident edges are completely gone from the graph
      for (const edgeId of edgeIds) {
        expect(env.getEdge(edgeId)).toBeUndefined();
      }
    });
  });

  describe('Edge Interactions & Directionality', () => {
    it('creates directional edges between nodes and updates graph queries', () => {
      // Add a secondary database
      const db2 = env.createNode('database', { x: 1100, y: 450 });

      // Connect API server to secondary database
      const edge = env.createEdge('node-api', db2.id, {
        protocol: 'tcp',
        ports: '5433',
        encrypted: true,
      });

      expect(edge).toBeDefined();
      expect(edge.source).toBe('node-api');
      expect(edge.target).toBe(db2.id);
      expect(edge.metadata.ports).toBe('5433');

      // Verify directionality
      expect(env.graph.hasDirectEdge('node-api', db2.id)).toBe(true);
      expect(env.graph.hasDirectEdge(db2.id, 'node-api')).toBe(false);

      // Verify outgoing from node-api now includes the new edge
      const apiOutgoing = env.graph.getOutgoingEdges('node-api');
      expect(apiOutgoing.some((e) => e.id === edge.id)).toBe(true);
    });

    it('deletes edges cleanly without affecting connected nodes', () => {
      const edgeId = 'edge-api-to-db';
      expect(env.getEdge(edgeId)).toBeDefined();

      const removed = env.removeEdge(edgeId);
      expect(removed).toBe(true);
      expect(env.getEdge(edgeId)).toBeUndefined();

      // Nodes must remain intact
      expect(env.getNode('node-api')).toBeDefined();
      expect(env.getNode('node-db')).toBeDefined();
    });
  });

  describe('Validation Integration & Chaotic Experiments', () => {
    it('allows intentionally dangerous connections (Internet → DB) and validator detects it', () => {
      // Step 1: Baseline passes
      const baselineResult = engine.evaluate(env);
      expect(baselineResult.summary.passed).toBe(true);
      expect(baselineResult.summary.criticalCount).toBe(0);

      // Step 2: User intentionally creates bad connection: Internet -> Database
      // The editor does NOT prevent this!
      const badEdge = env.createEdge('node-internet', 'node-db', {
        protocol: 'tcp',
        ports: '5432',
      });
      expect(badEdge).toBeDefined();

      // Step 3: Run validation
      const brokenResult = engine.evaluate(env);
      expect(brokenResult.summary.passed).toBe(false);

      // Step 4: Verify validator detected PF-001 Public Database Exposure
      const dbFinding = brokenResult.findings.find((f) => f.ruleId === 'PF-001');
      expect(dbFinding).toBeDefined();
      expect(dbFinding?.severity).toBe('critical');
      expect(dbFinding?.affectedNodes).toContain('node-internet');
      expect(dbFinding?.affectedNodes).toContain('node-db');

      // Step 5: Delete the bad edge (simulating user remediation)
      env.removeEdge(badEdge.id);

      // Step 6: Re-test
      const fixedResult = engine.evaluate(env);
      expect(fixedResult.summary.passed).toBe(true);
      expect(fixedResult.summary.criticalCount).toBe(0);
      expect(fixedResult.findings.some((f) => f.ruleId === 'PF-001')).toBe(false);
    });

    it('allows adding an exposed Admin console and validator detects PF-002', () => {
      // Add Admin node from palette
      const adminNode = env.createNode('admin', { x: 600, y: 100 });

      // Connect Internet directly to Admin
      const badEdge = env.createEdge('node-internet', adminNode.id, {
        protocol: 'https',
        ports: '8443',
      });
      expect(badEdge).toBeDefined();

      // Run validation
      const result = engine.evaluate(env);
      const adminFinding = result.findings.find((f) => f.ruleId === 'PF-002');
      expect(adminFinding).toBeDefined();
      expect(adminFinding?.severity).toBe('high');
      expect(adminFinding?.affectedNodes).toContain(adminNode.id);
    });
  });
});
