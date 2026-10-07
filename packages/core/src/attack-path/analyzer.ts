import { Environment } from '../domain/environment.js';
import {
  AttackPath,
  AttackPathAnalysisOptions,
  AttackPathAnalysisResult,
  AttackPathNodeSummary,
  AttackPathEdgeSummary,
  AttackPathRisk,
  AttackPathSummary,
  EntryPointExposure,
  ExposedAssetIntelligence,
  ReachabilityIntelligence,
} from './types.js';
import { isPotentialEntryPoint, traverseFromEntryPoint } from './traversal.js';
import { scoreAttackPath } from './scoring.js';
import { InfrastructureNode } from '../domain/node.js';
import { AssetCriticality } from '@pathforge/shared';

const RISK_WEIGHTS: Record<AttackPathRisk, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const CRITICALITY_WEIGHTS: Record<AssetCriticality, number> = {
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
 * connecting attacker-controlled entry points to sensitive or restricted assets,
 * evaluates their risk-weighted prioritization, and compiles reachability intelligence.
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
  const entryPointReachableMap = new Map<string, Set<string>>();

  // 2. Execute Deterministic Traversal per Entry Point
  for (const entryPoint of entryPointNodes) {
    const { reachableAssetIds, rawPaths } = traverseFromEntryPoint(environment, entryPoint);
    entryPointReachableMap.set(entryPoint.id, reachableAssetIds);

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
        riskScore: scoring.riskScore,
        riskAssessment: scoring.riskAssessment,
        riskFactors: scoring.riskFactors,
        whyItExists: scoring.whyItExists,
        steps: scoring.steps,
      });
    }
  }

  // 3. Deterministic Sort: Risk score desc, risk level desc, target criticality desc, hop count asc, ID asc
  attackPaths.sort((a, b) => {
    const scoreDiff = b.riskScore - a.riskScore;
    if (scoreDiff !== 0) return scoreDiff;

    const riskDiff = RISK_WEIGHTS[b.risk] - RISK_WEIGHTS[a.risk];
    if (riskDiff !== 0) return riskDiff;

    const critDiff =
      CRITICALITY_WEIGHTS[b.targetCriticality] - CRITICALITY_WEIGHTS[a.targetCriticality];
    if (critDiff !== 0) return critDiff;

    const hopDiff = a.hopCount - b.hopCount;
    if (hopDiff !== 0) return hopDiff;

    return a.id.localeCompare(b.id);
  });

  // 4. Compute Reachability Intelligence
  // 4.1 Entry Point Exposures
  const entryPointExposures: EntryPointExposure[] = entryPointNodes.map((epNode) => {
    const epSummary = nodeToSummary(epNode);
    const pathsFromEp = attackPaths.filter((p) => p.entryPoint.id === epNode.id);
    const reachableSet = entryPointReachableMap.get(epNode.id) ?? new Set<string>();

    const targetNodesFromEp = pathsFromEp.map((p) => p.target);
    const uniqueSensitiveIds = new Set(targetNodesFromEp.map((t) => t.id));
    const uniqueCriticalIds = new Set(
      targetNodesFromEp.filter((t) => t.criticality === 'critical').map((t) => t.id)
    );
    const uniqueRestrictedIds = new Set(
      targetNodesFromEp.filter((t) => t.zone === 'restricted').map((t) => t.id)
    );

    const maxBoundaries = pathsFromEp.reduce(
      (max, p) => Math.max(max, p.trustBoundariesCrossed),
      0
    );
    const highestScore = pathsFromEp.reduce((max, p) => Math.max(max, p.riskScore), 0);
    const highestLevel = pathsFromEp.length > 0 ? pathsFromEp[0].risk : 'low';

    return {
      entryPoint: epSummary,
      reachableAssetCount: reachableSet.size,
      sensitiveAssetCount: uniqueSensitiveIds.size,
      criticalAssetCount: uniqueCriticalIds.size,
      restrictedAssetCount: uniqueRestrictedIds.size,
      maxTrustBoundariesCrossed: maxBoundaries,
      highestRiskScore: highestScore,
      highestRiskLevel: highestLevel,
    };
  });

  entryPointExposures.sort((a, b) => {
    const scoreDiff = b.highestRiskScore - a.highestRiskScore;
    if (scoreDiff !== 0) return scoreDiff;
    return a.entryPoint.id.localeCompare(b.entryPoint.id);
  });

  // 4.2 Exposed Assets Intelligence
  const exposedAssets: ExposedAssetIntelligence[] = Array.from(sensitiveTargetIds).map((targetId) => {
    const pathsToTarget = attackPaths.filter((p) => p.target.id === targetId);
    const targetSummary = pathsToTarget[0].target;

    const entryPointMap = new Map<string, AttackPathNodeSummary>();
    for (const p of pathsToTarget) {
      entryPointMap.set(p.entryPoint.id, p.entryPoint);
    }
    const distinctEntryPoints = Array.from(entryPointMap.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    const highestScore = pathsToTarget.reduce((max, p) => Math.max(max, p.riskScore), 0);
    const highestLevel = pathsToTarget[0].risk; // sorted first
    const shortestHops = pathsToTarget.reduce(
      (min, p) => Math.min(min, p.hopCount),
      Number.MAX_SAFE_INTEGER
    );

    const hasWildcardAccess = pathsToTarget.some((p) =>
      p.edges.some((e) => e.ports === 'ANY' || e.ports === '*' || e.ports.includes('-'))
    );
    const hasCleartextAccess = pathsToTarget.some((p) => p.edges.some((e) => !e.encrypted));

    return {
      asset: targetSummary,
      entryPointCount: distinctEntryPoints.length,
      entryPoints: distinctEntryPoints,
      highestRiskScore: highestScore,
      highestRiskLevel: highestLevel,
      shortestHopCount: shortestHops === Number.MAX_SAFE_INTEGER ? 0 : shortestHops,
      pathCount: pathsToTarget.length,
      hasWildcardAccess,
      hasCleartextAccess,
    };
  });

  // Sort exposed assets: most distinct entry points desc, highest risk score desc, target criticality desc, shortest hop asc, asset ID asc
  exposedAssets.sort((a, b) => {
    const epCountDiff = b.entryPointCount - a.entryPointCount;
    if (epCountDiff !== 0) return epCountDiff;

    const scoreDiff = b.highestRiskScore - a.highestRiskScore;
    if (scoreDiff !== 0) return scoreDiff;

    const critDiff =
      CRITICALITY_WEIGHTS[b.asset.criticality] - CRITICALITY_WEIGHTS[a.asset.criticality];
    if (critDiff !== 0) return critDiff;

    const hopDiff = a.shortestHopCount - b.shortestHopCount;
    if (hopDiff !== 0) return hopDiff;

    return a.asset.id.localeCompare(b.asset.id);
  });

  // 4.3 Most Dangerous Path and Most Exposed Asset
  const mostDangerousPath = attackPaths.length > 0 ? attackPaths[0] : null;
  const mostExposedAsset = exposedAssets.length > 0 ? exposedAssets[0] : null;

  const criticalPathCount = attackPaths.filter((p) => p.risk === 'critical').length;
  const highRiskPathCount = attackPaths.filter((p) => p.risk === 'high').length;
  const mediumRiskPathCount = attackPaths.filter((p) => p.risk === 'medium').length;
  const lowRiskPathCount = attackPaths.filter((p) => p.risk === 'low').length;

  const totalScore = attackPaths.reduce((sum, p) => sum + p.riskScore, 0);
  const averageRiskScore =
    attackPaths.length > 0 ? Math.round(totalScore / attackPaths.length) : 0;

  const intelligence: ReachabilityIntelligence = {
    totalAttackPaths: attackPaths.length,
    criticalAttackPaths: criticalPathCount,
    highRiskAttackPaths: highRiskPathCount,
    mediumRiskAttackPaths: mediumRiskPathCount,
    lowRiskAttackPaths: lowRiskPathCount,
    reachableCriticalAssets: criticalTargetIds.size,
    entryPointExposures,
    exposedAssets,
    mostDangerousPath,
    mostExposedAsset,
  };

  // 5. Compute Summary
  const highestRisk: AttackPathRisk | 'none' =
    attackPaths.length > 0 ? attackPaths[0].risk : 'none';

  const summary: AttackPathSummary = {
    entryPointCount: entryPointNodes.length,
    reachableAssetCount: allReachableAssetIds.size,
    sensitiveAssetsReached: sensitiveTargetIds.size,
    criticalAssetsReached: criticalTargetIds.size,
    attackPathCount: attackPaths.length,
    highestRisk,
    criticalPathCount,
    highRiskPathCount,
    averageRiskScore,
    mostDangerousPathId: mostDangerousPath?.id ?? null,
    mostExposedAssetId: mostExposedAsset?.asset.id ?? null,
  };

  return {
    environmentId: environment.id,
    analyzedAt,
    entryPoints: entryPointNodes.map(nodeToSummary),
    attackPaths,
    reachableAssets: Array.from(allReachableAssetIds).sort(),
    summary,
    intelligence,
  };
}
