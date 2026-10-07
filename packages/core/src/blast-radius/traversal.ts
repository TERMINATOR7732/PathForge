import { Environment } from '../domain/environment.js';
import { InfrastructureNode } from '../domain/node.js';
import { InfrastructureEdge } from '../domain/edge.js';
import { NodeZone } from '@pathforge/shared';
import {
  normalizeZone,
  isTrustBoundaryCrossing,
  isSensitiveTarget,
  isCriticalAsset,
} from '../attack-path/traversal.js';
import {
  BlastRadiusNodeSummary,
  BlastRadiusEdgeSummary,
  LateralMovementStep,
  TrustBoundaryTransition,
} from './types.js';

export interface RawBlastRadiusTraversal {
  compromisedNode: InfrastructureNode;
  reachableNodes: Array<{
    node: InfrastructureNode;
    depth: number;
  }>;
  reachableEdges: InfrastructureEdge[];
  movementSteps: LateralMovementStep[];
  boundaryTransitions: TrustBoundaryTransition[];
  uniqueBoundaryCount: number;
  uniqueZonesReached: NodeZone[];
  maxDepth: number;
}

/**
 * Executes a deterministic directed Breadth-First Search (BFS) starting from
 * a designated compromised origin node.
 *
 * Traversal Rules:
 * - Only edges with access === 'allow' are traversable.
 * - DENY edges are strict barriers and are never crossed.
 * - Traversal strictly follows edge directionality (source -> target).
 * - Cycles and self-loops terminate deterministically via visited sets.
 * - Exploration order is deterministic (edges sorted by edge.id ascending).
 * - The compromised origin node itself is excluded from reachable assets.
 */
export function traverseBlastRadius(
  environment: Environment,
  compromisedNodeId: string,
  maxDepthLimit?: number
): RawBlastRadiusTraversal {
  const originNode = environment.getNode(compromisedNodeId);
  if (!originNode) {
    throw new Error(`Compromised node with ID "${compromisedNodeId}" not found in environment.`);
  }

  const visitedNodeIds = new Set<string>([originNode.id]);
  const nodeDepths = new Map<string, number>();
  const reachableNodesList: Array<{ node: InfrastructureNode; depth: number }> = [];
  const movementSteps: LateralMovementStep[] = [];
  const traversedEdgeIds = new Set<string>();
  const reachableEdges: InfrastructureEdge[] = [];

  // Track unique trust boundary transitions (e.g. "dmz -> internal")
  const uniqueBoundaryKeySet = new Set<string>();
  const boundaryTransitions: TrustBoundaryTransition[] = [];
  const reachedZonesSet = new Set<NodeZone>();

  interface QueueItem {
    node: InfrastructureNode;
    depth: number;
  }

  const queue: QueueItem[] = [{ node: originNode, depth: 0 }];
  let stepCounter = 1;

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (maxDepthLimit !== undefined && current.depth >= maxDepthLimit) {
      continue;
    }

    // Get outgoing edges from current node, sorted deterministically by ID
    const outgoingEdges = environment.graph
      .getOutgoingEdges(current.node.id)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const edge of outgoingEdges) {
      // Rule: Only ALLOW edges are traversable
      if (edge.access !== 'allow') {
        continue;
      }

      const targetNode = environment.getNode(edge.target);
      if (!targetNode) {
        continue;
      }

      // Do not treat compromised origin as lateral movement target
      if (targetNode.id === originNode.id) {
        continue;
      }

      const isNewNode = !visitedNodeIds.has(targetNode.id);

      if (isNewNode) {
        visitedNodeIds.add(targetNode.id);
        const targetDepth = current.depth + 1;
        nodeDepths.set(targetNode.id, targetDepth);
        reachableNodesList.push({ node: targetNode, depth: targetDepth });

        const fromZone = current.node.zone ?? 'internal';
        const toZone = targetNode.zone ?? 'internal';
        const crossesBoundary = isTrustBoundaryCrossing(fromZone, toZone);

        if (crossesBoundary) {
          const boundaryKey = `${normalizeZone(fromZone)}->${normalizeZone(toZone)}`;
          if (!uniqueBoundaryKeySet.has(boundaryKey)) {
            uniqueBoundaryKeySet.add(boundaryKey);
            boundaryTransitions.push({
              fromZone,
              toZone,
              sourceNodeId: current.node.id,
              targetNodeId: targetNode.id,
              edgeId: edge.id,
            });
          }
        }

        reachedZonesSet.add(toZone);

        // Build deterministic rationale
        const portDesc = edge.ports ? `over ${edge.protocol}/${edge.ports}` : `over ${edge.protocol}`;
        const boundaryDesc = crossesBoundary
          ? `Movement crosses security trust boundary from ${fromZone.toUpperCase()} to ${toZone.toUpperCase()}.`
          : `Intra-zone movement within ${fromZone.toUpperCase()}.`;
        const rationale = `${current.node.name} can reach ${targetNode.name} ${portDesc}. ${boundaryDesc}`;

        movementSteps.push({
          stepIndex: stepCounter++,
          sourceNodeId: current.node.id,
          sourceNodeName: current.node.name,
          targetNodeId: targetNode.id,
          targetNodeName: targetNode.name,
          edgeId: edge.id,
          protocol: edge.protocol,
          ports: edge.ports,
          access: edge.access,
          encrypted: edge.encrypted,
          relationship: edge.relationship,
          sourceZone: fromZone,
          targetZone: toZone,
          crossesTrustBoundary: crossesBoundary,
          rationale,
        });

        if (!traversedEdgeIds.has(edge.id)) {
          traversedEdgeIds.add(edge.id);
          reachableEdges.push(edge);
        }

        queue.push({ node: targetNode, depth: targetDepth });
      } else if (!traversedEdgeIds.has(edge.id)) {
        // Edge between already reachable nodes (valid lateral link)
        traversedEdgeIds.add(edge.id);
        reachableEdges.push(edge);
      }
    }
  }

  // Sort reachable nodes deterministically: primary by depth ascending, secondary by node ID
  reachableNodesList.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.node.id.localeCompare(b.node.id);
  });

  const maxDepth = reachableNodesList.reduce((max, item) => Math.max(max, item.depth), 0);

  return {
    compromisedNode: originNode,
    reachableNodes: reachableNodesList,
    reachableEdges,
    movementSteps,
    boundaryTransitions,
    uniqueBoundaryCount: uniqueBoundaryKeySet.size,
    uniqueZonesReached: Array.from(reachedZonesSet).sort(),
    maxDepth,
  };
}

/**
 * Maps an InfrastructureNode into a typed BlastRadiusNodeSummary.
 */
export function toBlastRadiusNodeSummary(
  node: InfrastructureNode,
  depth: number
): BlastRadiusNodeSummary {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    zone: node.zone,
    criticality: node.criticality,
    isSensitive: isSensitiveTarget(node),
    isCritical: isCriticalAsset(node),
    depth,
  };
}

/**
 * Maps an InfrastructureEdge into a typed BlastRadiusEdgeSummary.
 */
export function toBlastRadiusEdgeSummary(edge: InfrastructureEdge): BlastRadiusEdgeSummary {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    protocol: edge.protocol,
    ports: edge.ports,
    access: edge.access,
    encrypted: edge.encrypted,
    relationship: edge.relationship,
  };
}
