import {
  NodeType,
  NodeMetadata,
  NodePosition,
  NodeDefinition,
  NodeZone,
  AssetCriticality,
  NodeServiceInfo,
} from '@pathforge/shared';
import { validateCidrOrIp } from './configuration-validation.js';

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

    if (this.metadata.cidr) {
      const cidrValidation = validateCidrOrIp(this.metadata.cidr);
      if (!cidrValidation.valid) {
        throw new Error(cidrValidation.error);
      }
    }
  }

  get zone(): NodeZone {
    return this.metadata.zone ?? 'internal';
  }

  get cidr(): string | undefined {
    return this.metadata.cidr;
  }

  get criticality(): AssetCriticality {
    return this.metadata.criticality ?? 'medium';
  }

  get service(): NodeServiceInfo | undefined {
    return this.metadata.service;
  }

  get tags(): string[] {
    return this.metadata.tags ?? [];
  }

  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }

  updateMetadata(patch: Partial<NodeMetadata>): void {
    if (patch.cidr !== undefined) {
      const cidrValidation = validateCidrOrIp(patch.cidr);
      if (!cidrValidation.valid) {
        throw new Error(cidrValidation.error);
      }
    }
    this.metadata = { ...this.metadata, ...patch };
  }

  updateConfig(patch: {
    name?: string;
    zone?: NodeZone;
    cidr?: string;
    criticality?: AssetCriticality;
    service?: NodeServiceInfo;
    tags?: string[];
    description?: string;
    [key: string]: unknown;
  }): void {
    if (patch.name !== undefined) {
      if (!patch.name || patch.name.trim() === '') {
        throw new Error('Node name cannot be empty');
      }
      this.name = patch.name.trim();
    }

    if (patch.cidr !== undefined) {
      const cidrValidation = validateCidrOrIp(patch.cidr);
      if (!cidrValidation.valid) {
        throw new Error(cidrValidation.error);
      }
      patch.cidr = cidrValidation.value;
    }

    const { name, ...metaPatch } = patch;
    this.updateMetadata(metaPatch);
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
