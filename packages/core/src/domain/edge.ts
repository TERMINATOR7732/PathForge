import { EdgeMetadata, EdgeDefinition } from '@pathforge/shared';

export interface CreateEdgeOptions {
  id: string;
  source: string;
  target: string;
  metadata?: EdgeMetadata;
}

export class InfrastructureEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  metadata: EdgeMetadata;

  constructor(options: CreateEdgeOptions) {
    if (!options.id || typeof options.id !== 'string') {
      throw new Error('Edge id must be a non-empty string');
    }
    if (!options.source || typeof options.source !== 'string') {
      throw new Error('Edge source must be a non-empty string');
    }
    if (!options.target || typeof options.target !== 'string') {
      throw new Error('Edge target must be a non-empty string');
    }

    this.id = options.id.trim();
    this.source = options.source.trim();
    this.target = options.target.trim();
    this.metadata = options.metadata ? { ...options.metadata } : {};
  }

  updateMetadata(patch: Partial<EdgeMetadata>): void {
    this.metadata = { ...this.metadata, ...patch };
  }

  toJSON(): EdgeDefinition {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      metadata: { ...this.metadata },
    };
  }

  clone(): InfrastructureEdge {
    return new InfrastructureEdge({
      id: this.id,
      source: this.source,
      target: this.target,
      metadata: JSON.parse(JSON.stringify(this.metadata)),
    });
  }
}
