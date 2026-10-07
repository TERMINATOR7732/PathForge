import { Environment } from '../domain/environment.js';
import {
  DependencyAnalysis,
  DependencyConcentrationRating,
  NodeDependencyProfile,
  SinglePointOfFailure,
} from './types.js';

/**
 * Deterministically analyzes graph dependency metrics, in/out degrees,
 * critical asset dependency concentration, and potential single points of failure.
 */
export function analyzeDependencies(environment: Environment): DependencyAnalysis {
  const nodes = environment.getNodes().slice().sort((a, b) => a.id.localeCompare(b.id));
  const edges = environment.getEdges().slice().sort((a, b) => a.id.localeCompare(b.id));

  const incomingMap = new Map<string, Set<string>>();
  const outgoingMap = new Map<string, Set<string>>();

  for (const node of nodes) {
    incomingMap.set(node.id, new Set());
    outgoingMap.set(node.id, new Set());
  }

  for (const edge of edges) {
    const inc = incomingMap.get(edge.target);
    if (inc) inc.add(edge.source);

    const out = outgoingMap.get(edge.source);
    if (out) out.add(edge.target);
  }

  const profiles: NodeDependencyProfile[] = nodes.map((node) => {
    const inc = incomingMap.get(node.id) ?? new Set();
    const out = outgoingMap.get(node.id) ?? new Set();
    const isCritical =
      (node.criticality ?? '').toLowerCase() === 'critical' ||
      (node.zone ?? '').toLowerCase() === 'restricted';

    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      zone: node.zone,
      criticality: node.criticality,
      inDegree: inc.size,
      outDegree: out.size,
      totalConnectivity: inc.size + out.size,
      incomingNodeIds: Array.from(inc).sort(),
      outgoingNodeIds: Array.from(out).sort(),
      isCriticalAsset: isCritical,
    };
  });

  // 1. High Connectivity Nodes: inDegree >= 3, outDegree >= 4, or totalConnectivity >= 5
  const highConnectivityNodes = profiles
    .filter((p) => p.inDegree >= 3 || p.outDegree >= 4 || p.totalConnectivity >= 5)
    .sort((a, b) => b.totalConnectivity - a.totalConnectivity);

  // 2. Critical Asset Dependency Concentration: critical or database with inDegree >= 2
  const criticalAssetDependencies = profiles
    .filter((p) => (p.isCriticalAsset || p.nodeType === 'database') && p.inDegree >= 2)
    .sort((a, b) => b.inDegree - a.inDegree);

  // 3. Potential Single Points of Failure (SPOF)
  // Check key infrastructure roles where exactly 1 node of that role exists and has >= 2 dependents
  const singlePointsOfFailure: SinglePointOfFailure[] = [];

  const typeCounts = new Map<string, NodeDependencyProfile[]>();
  for (const p of profiles) {
    const t = p.nodeType.toLowerCase();
    const list = typeCounts.get(t) ?? [];
    list.push(p);
    typeCounts.set(t, list);
  }

  const spofRoles: Array<{ type: string; roleName: string }> = [
    { type: 'firewall', roleName: 'Sole Perimeter Firewall' },
    { type: 'load_balancer', roleName: 'Sole Ingress Load Balancer' },
    { type: 'database', roleName: 'Sole Primary Database' },
    { type: 'vpn', roleName: 'Sole Remote Access Gateway' },
  ];

  for (const { type, roleName } of spofRoles) {
    const list = typeCounts.get(type);
    if (list && list.length === 1) {
      const p = list[0];
      // Has meaningful dependencies (inDegree >= 1 or outDegree >= 2)
      if (p.inDegree >= 1 || p.outDegree >= 2) {
        const dependentIds = Array.from(new Set([...p.incomingNodeIds, ...p.outgoingNodeIds])).sort();
        singlePointsOfFailure.push({
          nodeId: p.nodeId,
          nodeName: p.nodeName,
          role: roleName,
          downstreamDependentCount: p.outDegree > 0 ? p.outDegree : p.inDegree,
          dependentNodeIds: dependentIds,
          riskDescription: `Potential single point of failure: only 1 ${type.replace('_', ' ')} component modeled. If un-replicated in production, failure or disruption directly impacts ${dependentIds.length} connected component(s).`,
        });
      }
    }
  }

  singlePointsOfFailure.sort((a, b) => b.downstreamDependentCount - a.downstreamDependentCount);

  // Evaluate Concentration Rating
  let concentrationRating: DependencyConcentrationRating = 'low';
  let rationale = '';

  if (criticalAssetDependencies.some((c) => c.inDegree >= 3) || singlePointsOfFailure.length >= 2) {
    concentrationRating = 'high';
    rationale = 'High dependency concentration: critical data or perimeter assets are heavily centralized with multiple direct upstream dependencies and potential single points of failure.';
  } else if (criticalAssetDependencies.length > 0 || singlePointsOfFailure.length > 0) {
    concentrationRating = 'moderate';
    rationale = 'Moderate dependency concentration: isolated critical components receive direct traffic from multiple application components.';
  } else {
    concentrationRating = 'low';
    rationale = 'Balanced dependency distribution with low centralization across modeled components.';
  }

  return {
    profiles,
    highConnectivityNodes,
    criticalAssetDependencies,
    singlePointsOfFailure,
    concentrationRating,
    rationale,
  };
}
