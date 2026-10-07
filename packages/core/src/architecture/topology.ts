import { Environment } from '../domain/environment.js';
import { NodeZone } from '@pathforge/shared';
import {
  CrossZoneTransition,
  SegmentationQuality,
  TopologyAnalysis,
  ZoneSummary,
} from './types.js';

function normalizeZone(zone: NodeZone): string {
  const z = (zone ?? 'internal').toLowerCase().trim();
  if (z === 'private') return 'internal';
  return z;
}

/**
 * Deterministically analyzes the network zoning, trust boundaries, and segmentation
 * quality of the modeled infrastructure.
 */
export function analyzeTopology(environment: Environment): TopologyAnalysis {
  const nodes = environment.getNodes().slice().sort((a, b) => a.id.localeCompare(b.id));
  const edges = environment.getEdges().slice().sort((a, b) => a.id.localeCompare(b.id));

  const nodeZoneMap = new Map<string, string>();
  const zoneNodesMap = new Map<string, string[]>();

  for (const node of nodes) {
    const norm = normalizeZone(node.zone);
    nodeZoneMap.set(node.id, norm);
    const list = zoneNodesMap.get(norm) ?? [];
    list.push(node.id);
    zoneNodesMap.set(norm, list);
  }

  // Cross-zone and internal edges counting
  const zoneInternalEdgesMap = new Map<string, number>();
  const zoneOutboundEdgesMap = new Map<string, number>();
  const zoneInboundEdgesMap = new Map<string, number>();
  const transitionMap = new Map<string, { fromZone: string; toZone: string; edgeIds: string[] }>();

  for (const edge of edges) {
    const fromZone = nodeZoneMap.get(edge.source) ?? 'internal';
    const toZone = nodeZoneMap.get(edge.target) ?? 'internal';

    if (fromZone === toZone) {
      zoneInternalEdgesMap.set(fromZone, (zoneInternalEdgesMap.get(fromZone) ?? 0) + 1);
    } else {
      zoneOutboundEdgesMap.set(fromZone, (zoneOutboundEdgesMap.get(fromZone) ?? 0) + 1);
      zoneInboundEdgesMap.set(toZone, (zoneInboundEdgesMap.get(toZone) ?? 0) + 1);

      const key = `${fromZone}->${toZone}`;
      const existing = transitionMap.get(key);
      if (existing) {
        existing.edgeIds.push(edge.id);
      } else {
        transitionMap.set(key, { fromZone, toZone, edgeIds: [edge.id] });
      }
    }
  }

  // Compile Zone Summaries
  const zoneSummaries: ZoneSummary[] = Array.from(zoneNodesMap.entries())
    .map(([zone, nodeIds]) => ({
      zone: zone as NodeZone,
      assetCount: nodeIds.length,
      nodeIds: nodeIds.sort(),
      internalEdgesCount: zoneInternalEdgesMap.get(zone) ?? 0,
      outboundCrossZoneEdgesCount: zoneOutboundEdgesMap.get(zone) ?? 0,
      inboundCrossZoneEdgesCount: zoneInboundEdgesMap.get(zone) ?? 0,
    }))
    .sort((a, b) => a.zone.localeCompare(b.zone));

  // Compile Cross-Zone Transitions
  const crossZoneTransitions: CrossZoneTransition[] = Array.from(transitionMap.values())
    .map((t) => ({
      fromZone: t.fromZone as NodeZone,
      toZone: t.toZone as NodeZone,
      edgeCount: t.edgeIds.length,
      edgeIds: t.edgeIds.sort(),
    }))
    .sort((a, b) => `${a.fromZone}->${a.toZone}`.localeCompare(`${b.fromZone}->${b.toZone}`));

  // Flat Topology Detection
  const nonEdgeNodes = nodes.filter(
    (n) => n.type.toLowerCase() !== 'internet' && n.type.toLowerCase() !== 'external_network'
  );

  let isFlatTopology = false;
  const internalNodeCount = zoneNodesMap.get('internal')?.length ?? 0;
  const internalInternalEdges = zoneInternalEdgesMap.get('internal') ?? 0;

  // Criteria for Flat Topology:
  // 1. Either nonEdgeNodes >= 3 and all nonEdgeNodes share a single zone
  // 2. Or internal zone has >= 3 assets with multiple direct peer links and constitutes >60% of non-edge nodes
  if (nonEdgeNodes.length >= 3) {
    const distinctNonEdgeZones = new Set(nonEdgeNodes.map((n) => nodeZoneMap.get(n.id)));
    if (distinctNonEdgeZones.size === 1 && internalInternalEdges >= 2) {
      isFlatTopology = true;
    } else if (
      internalNodeCount >= 3 &&
      internalNodeCount / nonEdgeNodes.length >= 0.6 &&
      internalInternalEdges >= 2 &&
      (zoneNodesMap.get('dmz')?.length ?? 0) === 0
    ) {
      isFlatTopology = true;
    }
  }

  // Evaluate Segmentation Quality
  let segmentationQuality: SegmentationQuality = 'moderate';
  let rationale = '';

  const distinctZonesCount = zoneSummaries.length;
  const hasRestrictedZone = zoneNodesMap.has('restricted');
  const hasDmzZone = zoneNodesMap.has('dmz');

  const publicOrDmzToRestricted = crossZoneTransitions.some(
    (t) => (t.fromZone === 'public' || t.fromZone === 'dmz') && t.toZone === 'restricted'
  );

  if (isFlatTopology) {
    segmentationQuality = 'flat';
    rationale = `Flat network topology: ${nonEdgeNodes.length} infrastructure assets share an unsegmented zone with broad direct connectivity, elevating lateral movement risk.`;
  } else if (publicOrDmzToRestricted) {
    segmentationQuality = 'weak';
    rationale = 'Weak segmentation: restricted assets are directly reachable across perimeter boundaries without intermediate internal isolation.';
  } else if (distinctZonesCount >= 3 && hasDmzZone && (hasRestrictedZone || zoneSummaries.length >= 4)) {
    segmentationQuality = 'strong';
    rationale = `Strong segmentation: ${distinctZonesCount} distinct network zones with controlled boundary transitions (DMZ perimeter and isolated internal/restricted enclaves).`;
  } else if (distinctZonesCount >= 2) {
    segmentationQuality = 'moderate';
    rationale = `Moderate segmentation: ${distinctZonesCount} network zones exist, but deeper tier isolation or microsegmentation could further restrict cross-zone traffic.`;
  } else {
    segmentationQuality = 'flat';
    rationale = 'Minimal or single-zone network topology without defensive boundary segmentation.';
  }

  return {
    totalZones: distinctZonesCount,
    zones: zoneSummaries,
    crossZoneTransitions,
    isFlatTopology,
    segmentationQuality,
    rationale,
  };
}
