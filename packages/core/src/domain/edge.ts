import {
  EdgeMetadata,
  EdgeDefinition,
  EdgeProtocol,
  EdgeAccess,
  EdgeRelationship,
  PortConfig,
} from '@pathforge/shared';
import { parsePortInput, isPortAllowed } from './configuration-validation.js';

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

  get protocol(): EdgeProtocol {
    return this.metadata.protocol ?? 'TCP';
  }

  get ports(): string {
    return this.metadata.ports ?? 'ANY';
  }

  get portConfig(): PortConfig {
    if (this.metadata.portConfig) {
      return this.metadata.portConfig;
    }
    if (this.metadata.ports) {
      const portRes = parsePortInput(this.metadata.ports);
      if (portRes.valid && portRes.config) {
        return portRes.config;
      }
    }
    return { type: 'any' };
  }

  get access(): EdgeAccess {
    return this.metadata.access ?? 'allow';
  }

  get encrypted(): boolean {
    return this.metadata.encrypted ?? false;
  }

  get relationship(): EdgeRelationship {
    return this.metadata.relationship ?? 'network';
  }

  get direction(): 'unidirectional' | 'bidirectional' {
    return this.metadata.direction ?? 'unidirectional';
  }

  /**
   * Evaluates whether this edge permits traffic on a given target port.
   */
  allowsPort(targetPort: number): boolean {
    if (this.access === 'deny') {
      return false;
    }
    return isPortAllowed(this.portConfig, targetPort);
  }

  updateMetadata(patch: Partial<EdgeMetadata>): void {
    if (patch.ports !== undefined && patch.portConfig === undefined) {
      const parsed = parsePortInput(patch.ports);
      if (!parsed.valid) {
        throw new Error(parsed.error);
      }
      patch.ports = parsed.formatted;
      patch.portConfig = parsed.config;
    }
    this.metadata = { ...this.metadata, ...patch };
  }

  updateConfig(patch: {
    protocol?: EdgeProtocol;
    ports?: string | number;
    portConfig?: PortConfig;
    access?: EdgeAccess;
    encrypted?: boolean;
    relationship?: EdgeRelationship;
    direction?: 'unidirectional' | 'bidirectional';
    description?: string;
    [key: string]: unknown;
  }): void {
    const { ports, ...rest } = patch;
    const metaPatch: Partial<EdgeMetadata> = { ...rest };

    if (ports !== undefined) {
      const portValidation = parsePortInput(ports);
      if (!portValidation.valid) {
        throw new Error(portValidation.error);
      }
      metaPatch.ports = portValidation.formatted;
      metaPatch.portConfig = portValidation.config;
    }

    this.updateMetadata(metaPatch);
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
