import { describe, it, expect } from 'vitest';
import { InfrastructureNode } from '@pathforge/core';

describe('InfrastructureNode Domain Model', () => {
  it('creates a valid infrastructure node with required fields', () => {
    const node = new InfrastructureNode({
      id: 'node-db-01',
      type: 'database',
      name: 'Primary PostgreSQL',
      position: { x: 100, y: 200 },
      metadata: { zone: 'restricted', version: '15.4' },
    });

    expect(node.id).toBe('node-db-01');
    expect(node.type).toBe('database');
    expect(node.name).toBe('Primary PostgreSQL');
    expect(node.position).toEqual({ x: 100, y: 200 });
    expect(node.metadata.zone).toBe('restricted');
    expect(node.metadata.version).toBe('15.4');
  });

  it('rejects node creation with empty or invalid ID', () => {
    expect(
      () =>
        new InfrastructureNode({
          id: '',
          type: 'database',
          name: 'DB',
        })
    ).toThrow('Node id must be a non-empty string');
  });

  it('rejects node creation with missing name or type', () => {
    expect(
      () =>
        new InfrastructureNode({
          id: 'test-1',
          type: '' as any,
          name: 'DB',
        })
    ).toThrow('Node type must be specified');

    expect(
      () =>
        new InfrastructureNode({
          id: 'test-2',
          type: 'database',
          name: '',
        })
    ).toThrow('Node name must be specified');
  });

  it('updates position and metadata cleanly', () => {
    const node = new InfrastructureNode({
      id: 'node-web-01',
      type: 'web_server',
      name: 'Web 01',
    });

    node.setPosition(350, 420);
    expect(node.position).toEqual({ x: 350, y: 420 });

    node.updateMetadata({ zone: 'dmz', tags: ['frontend', 'react'] });
    expect(node.metadata.zone).toBe('dmz');
    expect(node.metadata.tags).toEqual(['frontend', 'react']);
  });

  it('clones a node into an independent deep copy', () => {
    const original = new InfrastructureNode({
      id: 'node-api-01',
      type: 'api_server',
      name: 'API 01',
      metadata: { zone: 'private', tags: ['auth'] },
    });

    const clone = original.clone();
    expect(clone.id).toBe(original.id);
    expect(clone.name).toBe(original.name);
    expect(clone.metadata).toEqual(original.metadata);

    // Ensure deep independence
    clone.name = 'API Modified';
    clone.updateMetadata({ zone: 'public' });
    expect(original.name).toBe('API 01');
    expect(original.metadata.zone).toBe('private');
  });

  it('serializes to clean JSON matching NodeDefinition schema', () => {
    const node = new InfrastructureNode({
      id: 'node-fw-01',
      type: 'firewall',
      name: 'Edge WAF',
      position: { x: 50, y: 60 },
      metadata: { zone: 'perimeter' },
    });

    const json = node.toJSON();
    expect(json).toEqual({
      id: 'node-fw-01',
      type: 'firewall',
      name: 'Edge WAF',
      position: { x: 50, y: 60 },
      metadata: { zone: 'perimeter' },
    });
  });
});
