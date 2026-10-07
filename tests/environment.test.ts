import { describe, it, expect } from 'vitest';
import {
  Environment,
  InfrastructureNode,
  InfrastructureEdge,
  serializeEnvironment,
  deserializeEnvironment,
  SerializationError,
} from '@pathforge/core';

describe('Environment Domain Model & Serialization', () => {
  it('creates an environment and delegates graph operations', () => {
    const env = new Environment({
      id: 'env-prod-01',
      name: 'Production Environment',
      description: 'Main production VPC',
    });

    expect(env.id).toBe('env-prod-01');
    expect(env.name).toBe('Production Environment');
    expect(env.description).toBe('Main production VPC');
    expect(env.getNodes()).toHaveLength(0);

    const node = new InfrastructureNode({
      id: 'node-lb',
      type: 'load_balancer',
      name: 'Ingress LB',
    });
    env.addNode(node);

    expect(env.getNodes()).toHaveLength(1);
    expect(env.getNode('node-lb')).toBe(node);
  });

  it('serializes and deserializes environment deterministically', () => {
    const env = new Environment({
      id: 'env-test',
      name: 'Test Environment',
      description: 'Automated test suite topology',
      metadata: { author: 'Test Runner', tags: ['ci'] },
    });

    env.addNode(
      new InfrastructureNode({
        id: 'n1',
        type: 'web_server',
        name: 'Web 1',
        position: { x: 10, y: 20 },
      })
    );
    env.addNode(
      new InfrastructureNode({
        id: 'n2',
        type: 'database',
        name: 'Database 1',
        position: { x: 100, y: 200 },
      })
    );
    env.addEdge(
      new InfrastructureEdge({
        id: 'e1',
        source: 'n1',
        target: 'n2',
        metadata: { protocol: 'tcp', ports: '5432' },
      })
    );

    const json = serializeEnvironment(env);
    expect(typeof json).toBe('string');

    const restored = deserializeEnvironment(json);
    expect(restored.id).toBe(env.id);
    expect(restored.name).toBe(env.name);
    expect(restored.getNodes()).toHaveLength(2);
    expect(restored.getEdges()).toHaveLength(1);

    const restoredEdge = restored.getEdge('e1');
    expect(restoredEdge).toBeDefined();
    expect(restoredEdge?.source).toBe('n1');
    expect(restoredEdge?.target).toBe('n2');
    expect(restoredEdge?.metadata.ports).toBe('5432');
  });

  it('rejects deserialization on invalid JSON or corrupt schemas', () => {
    expect(() => deserializeEnvironment('{ bad json')).toThrow(SerializationError);

    expect(() => deserializeEnvironment(null as any)).toThrow(
      'Environment definition must be an object'
    );

    expect(() =>
      deserializeEnvironment({
        id: '',
        name: 'Test',
        description: '',
        nodes: [],
        edges: [],
        metadata: {} as any,
      })
    ).toThrow('missing required string "id"');

    expect(() =>
      deserializeEnvironment({
        id: 'env-1',
        name: 'Test',
        description: '',
        nodes: [
          { id: 'dup', type: 'web_server', name: 'Web 1' },
          { id: 'dup', type: 'web_server', name: 'Web 2' },
        ],
        edges: [],
        metadata: {} as any,
      })
    ).toThrow('Duplicate node id detected: "dup"');

    expect(() =>
      deserializeEnvironment({
        id: 'env-1',
        name: 'Test',
        description: '',
        nodes: [{ id: 'n1', type: 'web_server', name: 'Web 1' }],
        edges: [{ id: 'e1', source: 'n1', target: 'non-existent' }],
        metadata: {} as any,
      })
    ).toThrow('references non-existent target node "non-existent"');
  });

  it('supports createNode with sensible default naming and unique IDs', () => {
    const env = new Environment({ id: 'env-test', name: 'Test' });

    const db1 = env.createNode('database', { x: 100, y: 150 });
    expect(db1.id).toBe('node-database-1');
    expect(db1.name).toBe('Database');
    expect(db1.metadata.zone).toBe('restricted');
    expect(db1.position).toEqual({ x: 100, y: 150 });

    const db2 = env.createNode('database', { x: 300, y: 250 });
    expect(db2.id).toBe('node-database-2');
    expect(db2.name).toBe('Database 2');
    expect(db2.position).toEqual({ x: 300, y: 250 });

    const web1 = env.createNode('web_server');
    expect(web1.id).toBe('node-web-server-1');
    expect(web1.name).toBe('Web Server');
    expect(web1.metadata.zone).toBe('dmz');
  });

  it('persists updated node coordinates across serialization round-trip', () => {
    const env = new Environment({ id: 'env-coords', name: 'Coordinates Test' });
    const node = env.createNode('database', { x: 400, y: 250 });

    // Update position
    const updated = env.updateNodePosition(node.id, 650, 320);
    expect(updated).toBe(true);
    expect(node.position).toEqual({ x: 650, y: 320 });

    // Serialize and deserialize
    const json = serializeEnvironment(env);
    const restored = deserializeEnvironment(json);
    const restoredNode = restored.getNode(node.id);

    expect(restoredNode).toBeDefined();
    expect(restoredNode?.position).toEqual({ x: 650, y: 320 });
  });

  it('creates directional edges and validates endpoints in environment', () => {
    const env = new Environment({ id: 'env-edges', name: 'Edges Test' });
    const web = env.createNode('web_server');
    const db = env.createNode('database');

    const edge = env.createEdge(web.id, db.id, { protocol: 'tcp', ports: '5432' });
    expect(edge.source).toBe(web.id);
    expect(edge.target).toBe(db.id);
    expect(edge.metadata.ports).toBe('5432');
    expect(env.hasEdgeBetween(web.id, db.id)).toBe(true);

    // Deleting node removes connected edge
    env.removeNode(web.id);
    expect(env.getNode(web.id)).toBeUndefined();
    expect(env.getEdge(edge.id)).toBeUndefined();
    expect(env.hasEdgeBetween(web.id, db.id)).toBe(false);
  });
});

