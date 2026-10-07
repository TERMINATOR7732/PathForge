import {
  EnvironmentDefinition,
  EnvironmentMetadata,
  NodeType,
  NodePosition,
  NodeMetadata,
  EdgeMetadata,
} from '@pathforge/shared';
import { InfrastructureNode } from './node.js';
import { InfrastructureEdge } from './edge.js';
import { InfrastructureGraph } from '../graph/infrastructure-graph.js';

export interface CreateEnvironmentOptions {
  id: string;
  name: string;
  description?: string;
  metadata?: Partial<EnvironmentMetadata>;
  graph?: InfrastructureGraph;
}

export class Environment {
  readonly id: string;
  name: string;
  description: string;
  metadata: EnvironmentMetadata;
  readonly graph: InfrastructureGraph;

  constructor(options: CreateEnvironmentOptions) {
    if (!options.id || typeof options.id !== 'string') {
      throw new Error('Environment id must be a non-empty string');
    }
    if (!options.name || typeof options.name !== 'string') {
      throw new Error('Environment name must be specified');
    }

    this.id = options.id.trim();
    this.name = options.name.trim();
    this.description = (options.description ?? '').trim();
    this.metadata = {
      version: options.metadata?.version ?? '1.0.0',
      createdAt: options.metadata?.createdAt ?? new Date().toISOString(),
      updatedAt: options.metadata?.updatedAt ?? new Date().toISOString(),
      ...options.metadata,
    };

    this.graph = options.graph ?? new InfrastructureGraph();
  }

  // Node delegation methods
  addNode(node: InfrastructureNode): void {
    this.graph.addNode(node);
    this.touch();
  }

  /**
   * Creates a new InfrastructureNode with a sensible default name,
   * stable ID, and zone metadata, then adds it to the graph.
   */
  createNode(
    type: NodeType,
    position?: NodePosition,
    customName?: string,
    customMetadata?: NodeMetadata
  ): InfrastructureNode {
    const existingNodes = this.graph.getNodesByType(type);
    const count = existingNodes.length;

    const defaultNames: Record<string, { label: string; zone: string }> = {
      internet: { label: 'Internet', zone: 'public' },
      firewall: { label: 'Firewall', zone: 'perimeter' },
      load_balancer: { label: 'Load Balancer', zone: 'perimeter' },
      web_server: { label: 'Web Server', zone: 'dmz' },
      api_server: { label: 'API Server', zone: 'private' },
      database: { label: 'Database', zone: 'restricted' },
      redis: { label: 'Redis', zone: 'restricted' },
      admin: { label: 'Admin', zone: 'management' },
      vpn: { label: 'VPN', zone: 'gateway' },
      internal_network: { label: 'Internal Network', zone: 'private' },
      external_network: { label: 'External Network', zone: 'untrusted' },
    };

    const typeConfig = defaultNames[type] ?? {
      label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
      zone: 'default',
    };

    const name =
      customName ??
      (count === 0 ? typeConfig.label : `${typeConfig.label} ${count + 1}`);

    // Generate unique stable ID
    let candidateId = `node-${type.replace(/_/g, '-')}-${count + 1}`;
    let suffix = count + 1;
    while (this.graph.hasNode(candidateId)) {
      suffix += 1;
      candidateId = `node-${type.replace(/_/g, '-')}-${suffix}`;
    }

    const node = new InfrastructureNode({
      id: candidateId,
      type,
      name,
      position: position ?? { x: 200, y: 200 },
      metadata: {
        zone: typeConfig.zone,
        ...customMetadata,
      },
    });

    this.addNode(node);
    return node;
  }

  /**
   * Updates coordinates of a node in the graph and updates environment timestamp.
   */
  updateNodePosition(nodeId: string, x: number, y: number): boolean {
    const node = this.getNode(nodeId);
    if (!node) return false;
    node.setPosition(x, y);
    this.touch();
    return true;
  }

  removeNode(nodeId: string): boolean {
    const removed = this.graph.removeNode(nodeId);
    if (removed) {
      this.touch();
    }
    return removed;
  }

  getNode(nodeId: string): InfrastructureNode | undefined {
    return this.graph.getNode(nodeId);
  }

  getNodes(): InfrastructureNode[] {
    return this.graph.getNodes();
  }

  // Edge delegation methods
  addEdge(edge: InfrastructureEdge): void {
    this.graph.addEdge(edge);
    this.touch();
  }

  /**
   * Creates and registers a directional edge between two nodes.
   */
  createEdge(
    sourceId: string,
    targetId: string,
    metadata?: EdgeMetadata
  ): InfrastructureEdge {
    if (!this.graph.hasNode(sourceId)) {
      throw new Error(`Cannot create edge: source node '${sourceId}' does not exist`);
    }
    if (!this.graph.hasNode(targetId)) {
      throw new Error(`Cannot create edge: target node '${targetId}' does not exist`);
    }

    let edgeId = `edge-${sourceId}-to-${targetId}`;
    let counter = 1;
    while (this.graph.hasEdge(edgeId)) {
      counter += 1;
      edgeId = `edge-${sourceId}-to-${targetId}-${counter}`;
    }

    const edge = new InfrastructureEdge({
      id: edgeId,
      source: sourceId,
      target: targetId,
      metadata: {
        protocol: 'tcp',
        direction: 'unidirectional',
        access: 'allow',
        ...metadata,
      },
    });

    this.addEdge(edge);
    return edge;
  }

  hasEdgeBetween(sourceId: string, targetId: string): boolean {
    return this.graph.hasDirectEdge(sourceId, targetId);
  }

  removeEdge(edgeId: string): boolean {
    const removed = this.graph.removeEdge(edgeId);
    if (removed) {
      this.touch();
    }
    return removed;
  }

  getEdge(edgeId: string): InfrastructureEdge | undefined {
    return this.graph.getEdge(edgeId);
  }

  getEdges(): InfrastructureEdge[] {
    return this.graph.getEdges();
  }

  updateMetadata(patch: Partial<EnvironmentMetadata>): void {
    this.metadata = {
      ...this.metadata,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  }

  private touch(): void {
    this.metadata.updatedAt = new Date().toISOString();
  }

  toJSON(): EnvironmentDefinition {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      nodes: this.graph.getNodes().map((n) => n.toJSON()),
      edges: this.graph.getEdges().map((e) => e.toJSON()),
      metadata: { ...this.metadata },
    };
  }

  clone(newId?: string, newName?: string): Environment {
    return new Environment({
      id: newId ?? `${this.id}-copy`,
      name: newName ?? `${this.name} (Copy)`,
      description: this.description,
      metadata: JSON.parse(JSON.stringify(this.metadata)),
      graph: this.graph.clone(),
    });
  }
}
