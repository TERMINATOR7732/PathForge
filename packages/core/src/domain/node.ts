import { NodeType, NodeMetadata, NodePosition, NodeDefinition } from '@pathforge/shared';

export interface CreateNodeOptions {
  id: string;
  type: NodeType;
  name: string;
  position?: NodePosition;
  metadata?: NodeMetadata;
}

export class InfrastructureNode {
  readonly id: string;
  readonly type: NodeType;
  name: string;
  position: NodePosition;
  metadata: NodeMetadata;

  constructor(options: CreateNodeOptions) {
    if (!options.id || typeof options.id !== 'string') {
      throw new Error('Node id must be a non-empty string');
    }
    if (!options.type || typeof options.type !== 'string') {
      throw new Error('Node type must be specified');
    }
    if (!options.name || typeof options.name !== 'string') {
      throw new Error('Node name must be specified');
    }

    this.id = options.id.trim();
    this.type = options.type;
    this.name = options.name.trim();
    this.position = options.position ? { ...options.position } : { x: 0, y: 0 };
    this.metadata = options.metadata ? { ...options.metadata } : {};
  }

  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }

  updateMetadata(patch: Partial<NodeMetadata>): void {
    this.metadata = { ...this.metadata, ...patch };
  }

  toJSON(): NodeDefinition {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      position: { ...this.position },
      metadata: { ...this.metadata },
    };
  }

  clone(): InfrastructureNode {
    return new InfrastructureNode({
      id: this.id,
      type: this.type,
      name: this.name,
      position: { ...this.position },
      metadata: JSON.parse(JSON.stringify(this.metadata)),
    });
  }
}
