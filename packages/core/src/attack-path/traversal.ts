import { InfrastructureNode } from '../domain/node.js';
import { InfrastructureEdge } from '../domain/edge.js';
import { Environment } from '../domain/environment.js';
import { NodeZone } from '@pathforge/shared';

/**
 * Normalizes a network zone for comparative boundary analysis.
 * 'private' is treated as an alias for 'internal'.
 */
export function normalizeZone(zone?: NodeZone): string {
  const z = (zone ?? 'internal').toLowerCase().trim();
  if (z === 'private') return 'internal';
  return z;
}

/**
 * Checks whether an edge transition crosses a distinct trust boundary.
 * A boundary is crossed when traversal moves between materially different zones.
 */
export function isTrustBoundaryCrossing(fromZone?: NodeZone, toZone?: NodeZone): boolean {
  return normalizeZone(fromZone) !== normalizeZone(toZone);
}

/**
 * Deterministically checks whether a node represents a potential attacker entry point.
 * Primary entry points include public zone nodes or explicitly modeled internet / external nodes.
 */
export function isPotentialEntryPoint(node: InfrastructureNode): boolean {
  const zone = normalizeZone(node.zone);
  const type = (node.type ?? '').toLowerCase();
  return zone === 'public' || type === 'internet' || type === 'external_network';
}

/**
 * Deterministically checks whether a node represents a sensitive or restricted asset.
 * Criteria:
 * - Criticality: 'critical' or 'high'
 * - Zone: 'restricted'
 * - Sensitive infrastructure types: database, redis, admin, vpn, internal_network
 * Excludes entry points themselves.
 */
export function isSensitiveTarget(node: InfrastructureNode): boolean {
  if (isPotentialEntryPoint(node)) {
    return false;
  }
  const crit = (node.criticality ?? '').toLowerCase();
  if (crit === 'critical' || crit === 'high') {
    return true;
  }
  const zone = normalizeZone(node.zone);
  if (zone === 'restricted') {
    return true;
  }
  const type = (node.type ?? '').toLowerCase();
  const sensitiveTypes = new Set([
    'database',
    'redis',
    'admin',
    'vpn',
    'internal_network',
  ]);
  return sensitiveTypes.has(type);
}

export interface RawPathResult {
  entryPoint: InfrastructureNode;
  target: InfrastructureNode;
  nodes: InfrastructureNode[];
  edges: InfrastructureEdge[];
}

export interface TraversalResult {
  reachableAssetIds: Set<string>;
  rawPaths: RawPathResult[];
}

/**
 * Performs iterative Breadth-First Search (BFS) from a given entry point.
 *
 * Traversal Rules:
 * - Only edges with access === 'allow' can be traversed.
 * - DENY edges are strict barriers.
 * - Respects edge directionality (outgoing edges only).
 * - Cycles and self-loops terminate safely.
 * - Deterministic edge exploration order (sorted by edge ID).
 * - Finds shortest path to each reachable sensitive target.
 */
export function traverseFromEntryPoint(
  environment: Environment,
  entryPoint: InfrastructureNode
): TraversalResult {
  const reachableAssetIds = new Set<string>();
  const rawPaths: RawPathResult[] = [];
  const discoveredTargets = new Set<string>();

  interface QueueItem {
    node: InfrastructureNode;
    nodePath: InfrastructureNode[];
    edgePath: InfrastructureEdge[];
  }

  const queue: QueueItem[] = [
    {
      node: entryPoint,
      nodePath: [entryPoint],
      edgePath: [],
    },
  ];

  const visitedInBFS = new Set<string>([entryPoint.id]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currNode = current.node;

    reachableAssetIds.add(currNode.id);

    // If this node is a sensitive target (and not the entry point itself)
    if (currNode.id !== entryPoint.id && isSensitiveTarget(currNode)) {
      if (!discoveredTargets.has(currNode.id)) {
        discoveredTargets.add(currNode.id);
        rawPaths.push({
          entryPoint,
          target: currNode,
          nodes: [...current.nodePath],
          edges: [...current.edgePath],
        });
      }
    }

    // Get outgoing edges and sort them deterministically by edge.id
    const outgoing = environment.graph
      .getOutgoingEdges(currNode.id)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const edge of outgoing) {
      // 1. Edge must permit traffic: DENY edges are strict barriers
      if (edge.access !== 'allow') {
        continue;
      }

      // 2. Self-loop check
      if (edge.target === currNode.id) {
        continue;
      }

      const nextNode = environment.getNode(edge.target);
      if (!nextNode) {
        continue;
      }

      // 3. Cycle prevention & shortest path tracking
      if (visitedInBFS.has(nextNode.id)) {
        continue;
      }

      visitedInBFS.add(nextNode.id);
      queue.push({
        node: nextNode,
        nodePath: [...current.nodePath, nextNode],
        edgePath: [...current.edgePath, edge],
      });
    }
  }

  return {
    reachableAssetIds,
    rawPaths,
  };
}
