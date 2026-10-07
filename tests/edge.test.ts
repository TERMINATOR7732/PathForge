import { describe, it, expect } from 'vitest';
import { InfrastructureEdge } from '@pathforge/core';

describe('InfrastructureEdge Domain Model', () => {
  it('creates a valid infrastructure edge with metadata', () => {
    const edge = new InfrastructureEdge({
      id: 'edge-01',
      source: 'node-web',
      target: 'node-api',
      metadata: {
        protocol: 'https',
        ports: '443',
        encrypted: true,
        direction: 'unidirectional',
        access: 'allow',
      },
    });

    expect(edge.id).toBe('edge-01');
    expect(edge.source).toBe('node-web');
    expect(edge.target).toBe('node-api');
    expect(edge.metadata.protocol).toBe('https');
    expect(edge.metadata.ports).toBe('443');
    expect(edge.metadata.encrypted).toBe(true);
  });

  it('rejects edge creation missing required parameters', () => {
    expect(
      () =>
        new InfrastructureEdge({
          id: '',
          source: 'a',
          target: 'b',
        })
    ).toThrow('Edge id must be a non-empty string');

    expect(
      () =>
        new InfrastructureEdge({
          id: 'e1',
          source: '',
          target: 'b',
        })
    ).toThrow('Edge source must be a non-empty string');

    expect(
      () =>
        new InfrastructureEdge({
          id: 'e1',
          source: 'a',
          target: '',
        })
    ).toThrow('Edge target must be a non-empty string');
  });

  it('clones an edge into an independent instance', () => {
    const original = new InfrastructureEdge({
      id: 'e-orig',
      source: 'src',
      target: 'tgt',
      metadata: { ports: '80', encrypted: false },
    });

    const clone = original.clone();
    expect(clone.id).toBe('e-orig');
    expect(clone.metadata).toEqual({ ports: '80', encrypted: false });

    clone.updateMetadata({ encrypted: true, ports: '443' });
    expect(original.metadata.encrypted).toBe(false);
    expect(original.metadata.ports).toBe('80');
  });
});
