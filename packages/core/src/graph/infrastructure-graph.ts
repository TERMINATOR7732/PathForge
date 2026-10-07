import { NodeType } from '@pathforge/shared';
import { InfrastructureNode } from '../domain/node.js';
import { InfrastructureEdge } from '../domain/edge.js';

export interface NodeDegree {
  inDegree: number;
  outDegree: number;
  total: number;
}

/**
 * InfrastructureGraph encapsulates the network topology graph.
 * Provides deterministic, UI-agnostic graph operations that future
 * reachability and attack-path analysis can consume directly.
 */
export class InfrastructureGraph {
  private readonly nodes: Map<string, InfrastructureNode> = new Map();
  private readonly edges: Map<string, InfrastructureEdge> = new Map();

  // node ID -> (edge ID -> edge)
  private readonly outgoingEdges: Map<string, Map<string, InfrastructureEdge>> = new Map();
  private readonly incomingEdges: Map<string, Map<string, InfrastructureEdge>> = new Map();

  /**
   * Adds an infrastructure node to the graph.
   * If a node with the same ID already exists, an error is thrown.
   */
  addNode(node: InfrastructureNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with id '${node.id}' already exists in graph`);
    }
    this.nodes.set(node.id, node);
    this.outgoingEdges.set(node.id, new Map());
    this.incomingEdges.set(node.id, new Map());
  }

  /**
   * Retrieves a node by its ID.
   */
  getNode(nodeId: string): InfrastructureNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Returns true if the node ID exists in the graph.
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Returns all nodes in the graph in insertion order.
   */
  getNodes(): InfrastructureNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns all nodes matching the given NodeType.
   */
  getNodesByType(type: NodeType): InfrastructureNode[] {
    return this.getNodes().filter((n) => n.type === type);
  }

  /**
   * Removes a node and all edges connected to it.
   */
  removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) {
      return false;
    }

    // Remove all outgoing edges
    const outMap = this.outgoingEdges.get(nodeId);
    if (outMap) {
      for (const edge of Array.from(outMap.values())) {
        this.removeEdge(edge.id);
      }
    }

    // Remove all incoming edges
    const inMap = this.incomingEdges.get(nodeId);
    if (inMap) {
      for (const edge of Array.from(inMap.values())) {
        this.removeEdge(edge.id);
      }
    }

    this.outgoingEdges.delete(nodeId);
    this.incomingEdges.delete(nodeId);
    return this.nodes.delete(nodeId);
  }

  /**
   * Adds a directional edge between two existing nodes.
   */
  addEdge(edge: InfrastructureEdge): void {
    if (this.edges.has(edge.id)) {
      throw new Error(`Edge with id '${edge.id}' already exists in graph`);
    }
    if (!this.nodes.has(edge.source)) {
      throw new Error(
        `Cannot add edge '${edge.id}': source node '${edge.source}' does not exist`
      );
    }
    if (!this.nodes.has(edge.target)) {
      throw new Error(
        `Cannot add edge '${edge.id}': target node '${edge.target}' does not exist`
      );
    }

    this.edges.set(edge.id, edge);

    const outMap = this.outgoingEdges.get(edge.source);
    if (outMap) {
      outMap.set(edge.id, edge);
    }

    const inMap = this.incomingEdges.get(edge.target);
    if (inMap) {
      inMap.set(edge.id, edge);
    }
  }

  /**
   * Retrieves an edge by its ID.
   */
  getEdge(edgeId: string): InfrastructureEdge | undefined {
    return this.edges.get(edgeId);
  }

  /**
   * Returns true if the edge ID exists in the graph.
   */
  hasEdge(edgeId: string): boolean {
    return this.edges.has(edgeId);
  }

  /**
   * Returns all edges in the graph in insertion order.
   */
  getEdges(): InfrastructureEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Removes an edge by its ID.
   */
  removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return false;
    }

    const outMap = this.outgoingEdges.get(edge.source);
    if (outMap) {
      outMap.delete(edgeId);
    }

    const inMap = this.incomingEdges.get(edge.target);
    if (inMap) {
      inMap.delete(edgeId);
    }

    return this.edges.delete(edgeId);
  }

  /**
   * Returns all outgoing edges originating from the given node.
   */
  getOutgoingEdges(nodeId: string): InfrastructureEdge[] {
    const map = this.outgoingEdges.get(nodeId);
    return map ? Array.from(map.values()) : [];
  }

  /**
   * Returns all incoming edges targeting the given node.
   */
  getIncomingEdges(nodeId: string): InfrastructureEdge[] {
    const map = this.incomingEdges.get(nodeId);
    return map ? Array.from(map.values()) : [];
  }

  /**
   * Returns all successor nodes (destinations of outgoing edges).
   */
  getSuccessors(nodeId: string): InfrastructureNode[] {
    const outgoing = this.getOutgoingEdges(nodeId);
    const set = new Set<string>();
    const successors: InfrastructureNode[] = [];

    for (const edge of outgoing) {
      if (!set.has(edge.target)) {
        set.add(edge.target);
        const node = this.getNode(edge.target);
        if (node) {
          successors.push(node);
        }
      }
    }

    return successors;
  }

  /**
   * Returns all predecessor nodes (sources of incoming edges).
   */
  getPredecessors(nodeId: string): InfrastructureNode[] {
    const incoming = this.getIncomingEdges(nodeId);
    const set = new Set<string>();
    const predecessors: InfrastructureNode[] = [];

    for (const edge of incoming) {
      if (!set.has(edge.source)) {
        set.add(edge.source);
        const node = this.getNode(edge.source);
        if (node) {
          predecessors.push(node);
        }
      }
    }

    return predecessors;
  }

  /**
   * Returns all directly adjacent neighbors (both incoming and outgoing).
   */
  getNeighbors(nodeId: string): InfrastructureNode[] {
    const seen = new Set<string>();
    const neighbors: InfrastructureNode[] = [];

    for (const succ of this.getSuccessors(nodeId)) {
      if (!seen.has(succ.id)) {
        seen.add(succ.id);
        neighbors.push(succ);
      }
    }

    for (const pred of this.getPredecessors(nodeId)) {
      if (!seen.has(pred.id)) {
        seen.add(pred.id);
        neighbors.push(pred);
      }
    }

    return neighbors;
  }

  /**
   * Checks if a direct directed edge exists from sourceId to targetId.
   */
  hasDirectEdge(sourceId: string, targetId: string): boolean {
    const out = this.outgoingEdges.get(sourceId);
    if (!out) return false;
    for (const edge of out.values()) {
      if (edge.target === targetId) return true;
    }
    return false;
  }

  /**
   * Returns all directed edges between sourceId and targetId.
   */
  getDirectEdges(sourceId: string, targetId: string): InfrastructureEdge[] {
    const out = this.outgoingEdges.get(sourceId);
    if (!out) return [];
    return Array.from(out.values()).filter((e) => e.target === targetId);
  }

  /**
   * Returns degree counts for a node.
   */
  getDegree(nodeId: string): NodeDegree {
    const outDegree = this.outgoingEdges.get(nodeId)?.size ?? 0;
    const inDegree = this.incomingEdges.get(nodeId)?.size ?? 0;
    return {
      inDegree,
      outDegree,
      total: inDegree + outDegree,
    };
  }

  /**
   * Clones the current graph into an independent new instance.
   */
  clone(): InfrastructureGraph {
    const newGraph = new InfrastructureGraph();
    for (const node of this.getNodes()) {
      newGraph.addNode(node.clone());
    }
    for (const edge of this.getEdges()) {
      newGraph.addEdge(edge.clone());
    }
    return newGraph;
  }
}
