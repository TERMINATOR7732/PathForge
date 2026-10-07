import { Environment } from '../domain/environment.js';
import {
  AttackPath,
  AttackPathAnalysisOptions,
  AttackPathAnalysisResult,
  AttackPathNodeSummary,
  AttackPathEdgeSummary,
  AttackPathRisk,
  AttackPathSummary,
} from './types.js';
import { isPotentialEntryPoint, traverseFromEntryPoint } from './traversal.js';
import { scoreAttackPath } from './scoring.js';
import { InfrastructureNode } from '../domain/node.js';

const RISK_WEIGHTS: Record<AttackPathRisk, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function nodeToSummary(node: InfrastructureNode): AttackPathNodeSummary {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    zone: node.zone,
    criticality: node.criticality,
  };
}

/**
 * Generates a deterministic, reproducible identity for an attack path.
 */
export function generateAttackPathId(
  entryPointId: string,
  targetId: string,
  edgeIds: readonly string[]
): string {
  const edgeStr = edgeIds.length > 0 ? edgeIds.join('_') : 'direct';
  return `ap_${entryPointId}_to_${targetId}_via_${edgeStr}`;
}

/**
 * Deterministically analyzes the environment to discover all attack paths
 * connecting attacker-controlled entry points to sensitive or restricted assets.
 */
export function analyzeAttackPaths(
  environment: Environment,
  options: AttackPathAnalysisOptions = {}
): AttackPathAnalysisResult {
  const analyzedAt = options.analyzedAt ?? new Date().toISOString();
  const allNodes = environment.getNodes().slice().sort((a, b) => a.id.localeCompare(b.id));

  // 1. Identify Entry Points
  let entryPointNodes: InfrastructureNode[] = [];
  if (options.entryPointIds && options.entryPointIds.length > 0) {
    const requestedSet = new Set(options.entryPointIds);
    entryPointNodes = allNodes.filter((n) => requestedSet.has(n.id));
  } else {
    entryPointNodes = allNodes.filter((n) => isPotentialEntryPoint(n));
  }

  const allReachableAssetIds = new Set<string>();
  const attackPaths: AttackPath[] = [];
  const sensitiveTargetIds = new Set<string>();
  const criticalTargetIds = new Set<string>();

  // 2. Execute Deterministic Traversal per Entry Point
  for (const entryPoint of entryPointNodes) {
    const { reachableAssetIds, rawPaths } = traverseFromEntryPoint(environment, entryPoint);

    for (const rId of reachableAssetIds) {
      allReachableAssetIds.add(rId);
    }

    for (const raw of rawPaths) {
      const nodeSummaries: AttackPathNodeSummary[] = raw.nodes.map(nodeToSummary);
      const edgeSummaries: AttackPathEdgeSummary[] = raw.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: e.protocol,
        ports: e.ports,
        access: e.access,
        encrypted: e.encrypted,
      }));

      const entrySummary = nodeToSummary(raw.entryPoint);
      const targetSummary = nodeToSummary(raw.target);

      const scoring = scoreAttackPath({
        entryPoint: entrySummary,
        target: targetSummary,
        nodes: nodeSummaries,
        edges: edgeSummaries,
      });

      const pathId = generateAttackPathId(
        entrySummary.id,
        targetSummary.id,
        edgeSummaries.map((e) => e.id)
      );

      sensitiveTargetIds.add(targetSummary.id);
      if (targetSummary.criticality === 'critical') {
        criticalTargetIds.add(targetSummary.id);
      }

      attackPaths.push({
        id: pathId,
        entryPoint: entrySummary,
        target: targetSummary,
        nodes: nodeSummaries,
        edges: edgeSummaries,
        hopCount: scoring.hopCount,
        trustBoundariesCrossed: scoring.trustBoundariesCrossed,
        targetCriticality: targetSummary.criticality,
        risk: scoring.risk,
        riskFactors: scoring.riskFactors,
        whyItExists: scoring.whyItExists,
        steps: scoring.steps,
      });
    }
  }

  // 3. Deterministic Sort: Risk descending, then hopCount ascending, then ID lexicographically
  attackPaths.sort((a, b) => {
    const riskDiff = RISK_WEIGHTS[b.risk] - RISK_WEIGHTS[a.risk];
    if (riskDiff !== 0) return riskDiff;
    const hopDiff = a.hopCount - b.hopCount;
    if (hopDiff !== 0) return hopDiff;
    return a.id.localeCompare(b.id);
  });

  // 4. Compute Summary
  const highestRisk: AttackPathRisk | 'none' =
    attackPaths.length > 0 ? attackPaths[0].risk : 'none';

  const summary: AttackPathSummary = {
    entryPointCount: entryPointNodes.length,
    reachableAssetCount: allReachableAssetIds.size,
    sensitiveAssetsReached: sensitiveTargetIds.size,
    criticalAssetsReached: criticalTargetIds.size,
    attackPathCount: attackPaths.length,
    highestRisk,
  };

  return {
    environmentId: environment.id,
    analyzedAt,
    entryPoints: entryPointNodes.map(nodeToSummary),
    attackPaths,
    reachableAssets: Array.from(allReachableAssetIds).sort(),
    summary,
  };
}
