import { describe, it, expect, beforeEach } from 'vitest';
import { InfrastructureGraph, InfrastructureNode, InfrastructureEdge } from '@pathforge/core';

describe('InfrastructureGraph Abstraction', () => {
  let graph: InfrastructureGraph;
  let internetNode: InfrastructureNode;
  let firewallNode: InfrastructureNode;
  let webNode: InfrastructureNode;
  let dbNode: InfrastructureNode;

  beforeEach(() => {
    graph = new InfrastructureGraph();

    internetNode = new InfrastructureNode({
      id: 'node-internet',
      type: 'internet',
      name: 'Internet',
    });
    firewallNode = new InfrastructureNode({
      id: 'node-firewall',
      type: 'firewall',
      name: 'Firewall',
    });
    webNode = new InfrastructureNode({
      id: 'node-web',
      type: 'web_server',
      name: 'Web Server',
    });
    dbNode = new InfrastructureNode({
      id: 'node-db',
      type: 'database',
      name: 'Database',
    });

    graph.addNode(internetNode);
    graph.addNode(firewallNode);
    graph.addNode(webNode);
    graph.addNode(dbNode);
  });

  it('stores and retrieves nodes correctly', () => {
    expect(graph.hasNode('node-internet')).toBe(true);
    expect(graph.getNode('node-internet')?.name).toBe('Internet');
    expect(graph.getNodes()).toHaveLength(4);
    expect(graph.getNodesByType('database')).toEqual([dbNode]);
  });

  it('prevents adding duplicate node IDs', () => {
    expect(() =>
      graph.addNode(
        new InfrastructureNode({
          id: 'node-internet',
          type: 'internet',
          name: 'Duplicate',
        })
      )
    ).toThrow("Node with id 'node-internet' already exists");
  });

  it('adds edges and validates endpoint existence', () => {
    const edge = new InfrastructureEdge({
      id: 'edge-in-fw',
      source: 'node-internet',
      target: 'node-firewall',
    });
    graph.addEdge(edge);

    expect(graph.hasEdge('edge-in-fw')).toBe(true);
    expect(graph.getEdge('edge-in-fw')).toBe(edge);
    expect(graph.getEdges()).toHaveLength(1);

    // Fails on non-existent source
    expect(() =>
      graph.addEdge(
        new InfrastructureEdge({
          id: 'edge-bad-source',
          source: 'node-ghost',
          target: 'node-firewall',
        })
      )
    ).toThrow("source node 'node-ghost' does not exist");

    // Fails on non-existent target
    expect(() =>
      graph.addEdge(
        new InfrastructureEdge({
          id: 'edge-bad-target',
          source: 'node-internet',
          target: 'node-phantom',
        })
      )
    ).toThrow("target node 'node-phantom' does not exist");
  });

  it('accurately queries graph traversal primitives (successors, predecessors, neighbors)', () => {
    graph.addEdge(
      new InfrastructureEdge({
        id: 'e1',
        source: 'node-internet',
        target: 'node-firewall',
      })
    );
    graph.addEdge(
      new InfrastructureEdge({
        id: 'e2',
        source: 'node-firewall',
        target: 'node-web',
      })
    );
    graph.addEdge(
      new InfrastructureEdge({
        id: 'e3',
        source: 'node-web',
        target: 'node-db',
      })
    );

    // Firewall outgoing and incoming
    expect(graph.getOutgoingEdges('node-firewall')).toHaveLength(1);
    expect(graph.getIncomingEdges('node-firewall')).toHaveLength(1);

    // Successors & Predecessors of Firewall
    expect(graph.getSuccessors('node-firewall').map((n) => n.id)).toEqual(['node-web']);
    expect(graph.getPredecessors('node-firewall').map((n) => n.id)).toEqual(['node-internet']);

    // Neighbors of Firewall (both directions)
    const firewallNeighborIds = graph.getNeighbors('node-firewall').map((n) => n.id);
    expect(firewallNeighborIds).toContain('node-web');
    expect(firewallNeighborIds).toContain('node-internet');
    expect(firewallNeighborIds).toHaveLength(2);

    // Degree check
    expect(graph.getDegree('node-firewall')).toEqual({
      inDegree: 1,
      outDegree: 1,
      total: 2,
    });
    expect(graph.getDegree('node-internet')).toEqual({
      inDegree: 0,
      outDegree: 1,
      total: 1,
    });
    expect(graph.getDegree('node-db')).toEqual({
      inDegree: 1,
      outDegree: 0,
      total: 1,
    });

    // Direct edge checks
    expect(graph.hasDirectEdge('node-internet', 'node-firewall')).toBe(true);
    expect(graph.hasDirectEdge('node-internet', 'node-db')).toBe(false);
  });

  it('cascades edge cleanup when removing a node', () => {
    graph.addEdge(
      new InfrastructureEdge({
        id: 'e1',
        source: 'node-internet',
        target: 'node-firewall',
      })
    );
    graph.addEdge(
      new InfrastructureEdge({
        id: 'e2',
        source: 'node-firewall',
        target: 'node-web',
      })
    );

    expect(graph.getEdges()).toHaveLength(2);

    // Remove firewall
    const removed = graph.removeNode('node-firewall');
    expect(removed).toBe(true);
    expect(graph.hasNode('node-firewall')).toBe(false);

    // Both edges connected to firewall must be automatically removed!
    expect(graph.hasEdge('e1')).toBe(false);
    expect(graph.hasEdge('e2')).toBe(false);
    expect(graph.getEdges()).toHaveLength(0);
    expect(graph.getOutgoingEdges('node-internet')).toHaveLength(0);
    expect(graph.getIncomingEdges('node-web')).toHaveLength(0);
  });

  it('clones the graph into an independent copy', () => {
    graph.addEdge(
      new InfrastructureEdge({
        id: 'e1',
        source: 'node-internet',
        target: 'node-firewall',
      })
    );

    const cloned = graph.clone();
    expect(cloned.getNodes()).toHaveLength(4);
    expect(cloned.getEdges()).toHaveLength(1);

    // Mutating original does not affect clone
    graph.removeNode('node-internet');
    expect(graph.hasNode('node-internet')).toBe(false);
    expect(cloned.hasNode('node-internet')).toBe(true);
    expect(cloned.hasEdge('e1')).toBe(true);
  });
});
