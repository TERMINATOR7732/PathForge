import { EnvironmentDefinition } from '@pathforge/shared';
import { Environment } from '../domain/environment.js';
import { InfrastructureNode } from '../domain/node.js';
import { InfrastructureEdge } from '../domain/edge.js';
import { InfrastructureGraph } from '../graph/infrastructure-graph.js';

export class SerializationError extends Error {
  constructor(message: string) {
    super(`[SerializationError] ${message}`);
    this.name = 'SerializationError';
  }
}

/**
 * Serializes an Environment into a deterministic JSON string.
 */
export function serializeEnvironment(
  environment: Environment,
  pretty: boolean = true
): string {
  const def = environment.toJSON();
  return pretty ? JSON.stringify(def, null, 2) : JSON.stringify(def);
}

/**
 * Deserializes an Environment JSON string or object definition into a live Environment instance.
 */
export function deserializeEnvironment(
  input: string | object
): Environment {
  let def: any;

  if (typeof input === 'string') {
    try {
      def = JSON.parse(input) as EnvironmentDefinition;
    } catch (err) {
      throw new SerializationError(
        `Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else {
    def = input;
  }

  if (!def || typeof def !== 'object') {
    throw new SerializationError('Environment definition must be an object');
  }

  if (!def.id || typeof def.id !== 'string') {
    throw new SerializationError('Environment definition missing required string "id"');
  }

  if (!def.name || typeof def.name !== 'string') {
    throw new SerializationError('Environment definition missing required string "name"');
  }

  if (!Array.isArray(def.nodes)) {
    throw new SerializationError('Environment "nodes" must be an array');
  }

  if (!Array.isArray(def.edges)) {
    throw new SerializationError('Environment "edges" must be an array');
  }

  const graph = new InfrastructureGraph();
  const seenNodeIds = new Set<string>();

  for (const nodeDef of def.nodes) {
    if (!nodeDef.id || typeof nodeDef.id !== 'string') {
      throw new SerializationError('Every node must have a valid string "id"');
    }
    if (seenNodeIds.has(nodeDef.id)) {
      throw new SerializationError(`Duplicate node id detected: "${nodeDef.id}"`);
    }
    seenNodeIds.add(nodeDef.id);

    const node = new InfrastructureNode({
      id: nodeDef.id,
      type: nodeDef.type,
      name: nodeDef.name,
      position: nodeDef.position,
      metadata: nodeDef.metadata,
    });
    graph.addNode(node);
  }

  const seenEdgeIds = new Set<string>();
  for (const edgeDef of def.edges) {
    if (!edgeDef.id || typeof edgeDef.id !== 'string') {
      throw new SerializationError('Every edge must have a valid string "id"');
    }
    if (seenEdgeIds.has(edgeDef.id)) {
      throw new SerializationError(`Duplicate edge id detected: "${edgeDef.id}"`);
    }
    seenEdgeIds.add(edgeDef.id);

    if (!seenNodeIds.has(edgeDef.source)) {
      throw new SerializationError(
        `Edge "${edgeDef.id}" references non-existent source node "${edgeDef.source}"`
      );
    }
    if (!seenNodeIds.has(edgeDef.target)) {
      throw new SerializationError(
        `Edge "${edgeDef.id}" references non-existent target node "${edgeDef.target}"`
      );
    }

    const edge = new InfrastructureEdge({
      id: edgeDef.id,
      source: edgeDef.source,
      target: edgeDef.target,
      metadata: edgeDef.metadata,
    });
    graph.addEdge(edge);
  }

  return new Environment({
    id: def.id,
    name: def.name,
    description: def.description,
    metadata: def.metadata,
    graph,
  });
}
