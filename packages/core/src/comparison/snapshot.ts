import { NodeDefinition, EdgeDefinition, ValidationResult } from '@pathforge/shared';
import { Environment } from '../domain/environment.js';

/**
 * Validated Baseline Snapshot
 * Represents an immutable capture of the infrastructure state
 * at the exact moment a validation result was produced.
 *
 * Immutability Principle: Snapshots are deep copies independent
 * of subsequent live domain mutations.
 */
export interface EnvironmentSnapshot {
  readonly environmentId: string;
  readonly name: string;
  readonly timestamp: string;
  readonly nodes: readonly NodeDefinition[];
  readonly edges: readonly EdgeDefinition[];
  readonly validationResult: ValidationResult;
}

/**
 * Captures an immutable snapshot of an Environment and its ValidationResult.
 */
export function createEnvironmentSnapshot(
  environment: Environment,
  validationResult: ValidationResult
): EnvironmentSnapshot {
  const jsonDef = environment.toJSON();

  return {
    environmentId: jsonDef.id,
    name: jsonDef.name,
    timestamp: new Date().toISOString(),
    nodes: Object.freeze(JSON.parse(JSON.stringify(jsonDef.nodes))),
    edges: Object.freeze(JSON.parse(JSON.stringify(jsonDef.edges))),
    validationResult: Object.freeze(JSON.parse(JSON.stringify(validationResult))),
  };
}
