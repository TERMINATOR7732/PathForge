import { Environment } from '../domain/environment.js';
import { InfrastructureNode } from '../domain/node.js';
import {
  ArchitectureTier,
  NodeTierAssignment,
  TierAnalysis,
  TierSeparationQuality,
  TierTransition,
} from './types.js';

/**
 * Deterministically infers the architectural tier of an infrastructure node
 * based on its concrete type and configuration. Unknown types are classified
 * as 'unknown' rather than forced into an artificial tier.
 */
export function inferNodeTier(node: InfrastructureNode): NodeTierAssignment {
  const type = node.type.toLowerCase();

  switch (type) {
    case 'internet':
    case 'external_network':
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        tier: 'edge',
        confidence: 'high',
        rationale: 'External network boundary or untrusted ingress edge',
      };

    case 'firewall':
    case 'load_balancer':
    case 'vpn':
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        tier: 'perimeter',
        confidence: 'high',
        rationale: 'Perimeter gateway, boundary inspection, or traffic distribution tier',
      };

    case 'web_server':
    case 'api_server':
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        tier: 'application',
        confidence: 'high',
        rationale: 'Application compute tier hosting presentation or business logic',
      };

    case 'database':
    case 'redis':
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        tier: 'data',
        confidence: 'high',
        rationale: 'Persistent data store or stateful in-memory cache tier',
      };

    case 'admin':
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        tier: 'management',
        confidence: 'high',
        rationale: 'Administrative access and privileged infrastructure management tier',
      };

    case 'internal_network':
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        tier: 'internal',
        confidence: 'high',
        rationale: 'Internal transit backbone or shared network segment',
      };

    default:
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        tier: 'unknown',
        confidence: 'low',
        rationale: 'Unrecognized custom or generic component; architectural tier not inferred',
      };
  }
}

/**
 * Deterministically analyzes tier distribution and separation quality across the graph.
 */
export function analyzeTiers(environment: Environment): TierAnalysis {
  const nodes = environment.getNodes().slice().sort((a, b) => a.id.localeCompare(b.id));
  const edges = environment.getEdges().slice().sort((a, b) => a.id.localeCompare(b.id));

  const tierMap = new Map<string, ArchitectureTier>();
  const assignments: NodeTierAssignment[] = [];
  const tierCounts: Record<ArchitectureTier, number> = {
    edge: 0,
    perimeter: 0,
    application: 0,
    data: 0,
    management: 0,
    internal: 0,
    unknown: 0,
  };

  for (const node of nodes) {
    const assignment = inferNodeTier(node);
    assignments.push(assignment);
    tierMap.set(node.id, assignment.tier);
    tierCounts[assignment.tier]++;
  }

  // Calculate tier transitions along directed edges
  const transitionMap = new Map<string, { fromTier: ArchitectureTier; toTier: ArchitectureTier; edgeIds: string[] }>();

  let hasDirectEdgeToData = false;
  let hasDirectEdgeToApp = false;
  let hasDirectEdgeToManagement = false;
  let hasBypassedAppToData = false;

  for (const edge of edges) {
    const fromTier = tierMap.get(edge.source) ?? 'unknown';
    const toTier = tierMap.get(edge.target) ?? 'unknown';

    if (fromTier === 'edge' && toTier === 'data') {
      hasDirectEdgeToData = true;
    }
    if (fromTier === 'edge' && toTier === 'application') {
      hasDirectEdgeToApp = true;
    }
    if (fromTier === 'edge' && toTier === 'management') {
      hasDirectEdgeToManagement = true;
    }
    if (fromTier === 'perimeter' && toTier === 'data') {
      hasBypassedAppToData = true;
    }

    const key = `${fromTier}->${toTier}`;
    const existing = transitionMap.get(key);
    if (existing) {
      existing.edgeIds.push(edge.id);
    } else {
      transitionMap.set(key, { fromTier, toTier, edgeIds: [edge.id] });
    }
  }

  const tierTransitions: TierTransition[] = Array.from(transitionMap.values())
    .map((t) => ({
      fromTier: t.fromTier,
      toTier: t.toTier,
      edgeCount: t.edgeIds.length,
      edgeIds: t.edgeIds.sort(),
    }))
    .sort((a, b) => `${a.fromTier}->${a.toTier}`.localeCompare(`${b.fromTier}->${b.toTier}`));

  // Evaluate Tier Separation Quality
  let separationQuality: TierSeparationQuality = 'moderate';
  let rationale = '';

  const hasEdgeTier = tierCounts.edge > 0;
  const hasPerimeterTier = tierCounts.perimeter > 0;
  const hasAppTier = tierCounts.application > 0;
  const hasDataTier = tierCounts.data > 0;

  if (hasDirectEdgeToData) {
    if (!hasAppTier && !hasPerimeterTier) {
      separationQuality = 'none';
      rationale = 'Data tier is directly connected to the external edge with zero intermediate application or perimeter tiers.';
    } else {
      separationQuality = 'weak';
      rationale = 'Data tier is directly reachable from the external edge, bypassing modeled application tiers.';
    }
  } else if (hasEdgeTier && hasDataTier) {
    if (hasPerimeterTier && hasAppTier && !hasDirectEdgeToApp && !hasDirectEdgeToManagement && !hasBypassedAppToData) {
      separationQuality = 'strong';
      rationale = 'Multi-tier layered architecture with coherent Edge → Perimeter → Application → Data tier boundaries.';
    } else if (hasAppTier && !hasDirectEdgeToManagement) {
      separationQuality = 'moderate';
      rationale = 'Application tier separates external edge from data tier, though perimeter or data access boundaries could be tightened.';
    } else {
      separationQuality = 'weak';
      rationale = 'Limited tier separation: intermediate protective tiers are either bypassed or absent.';
    }
  } else {
    const activeTiersCount = Object.values(tierCounts).filter((c) => c > 0).length;
    if (activeTiersCount >= 3) {
      separationQuality = 'strong';
      rationale = 'Multiple distinct architectural tiers modeled with segregated component roles.';
    } else if (activeTiersCount >= 2) {
      separationQuality = 'moderate';
      rationale = 'Basic tier differentiation observed across modeled components.';
    } else {
      separationQuality = 'none';
      rationale = 'No meaningful architectural tier separation observed.';
    }
  }

  return {
    tierAssignments: assignments,
    tierCounts,
    tierTransitions,
    separationQuality,
    hasDirectEdgeToData,
    rationale,
  };
}
