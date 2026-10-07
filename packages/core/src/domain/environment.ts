import {
  EnvironmentDefinition,
  EnvironmentMetadata,
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
