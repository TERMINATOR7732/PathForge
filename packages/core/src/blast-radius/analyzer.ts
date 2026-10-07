import { Environment } from '../domain/environment.js';
import {
  BlastRadius,
  BlastRadiusAnalysisResult,
  BlastRadiusOptions,
  BlastRadiusSummary,
} from './types.js';
import {
  traverseBlastRadius,
  toBlastRadiusNodeSummary,
  toBlastRadiusEdgeSummary,
} from './traversal.js';
import { scoreBlastRadius } from './scoring.js';

/**
 * Deterministically analyzes the lateral blast radius if a specific
 * infrastructure node in the environment is compromised.
 *
 * Answers:
 * "If this asset is compromised, what else can the attacker reach from it?"
 *
 * @param environment The authoritative environment domain model
 * @param compromisedNodeId The identifier of the compromised starting node
 * @param options Analysis options (timestamp, max depth cutoff)
 */
export function analyzeBlastRadius(
  environment: Environment,
  compromisedNodeId: string,
  options?: BlastRadiusOptions
): BlastRadiusAnalysisResult {
  const traversal = traverseBlastRadius(
    environment,
    compromisedNodeId,
    options?.maxDepthLimit
  );

  const reachableSummaries = traversal.reachableNodes.map((item) =>
    toBlastRadiusNodeSummary(item.node, item.depth)
  );

  const scoring = scoreBlastRadius(traversal, reachableSummaries);

  const sensitiveAssetsReached = reachableSummaries.filter((n) => n.isSensitive).length;
  const criticalAssetsReached = reachableSummaries.filter((n) => n.isCritical).length;

  const blastRadius: BlastRadius = {
    compromisedNode: toBlastRadiusNodeSummary(traversal.compromisedNode, 0),
    reachableNodes: reachableSummaries,
    reachableEdges: traversal.reachableEdges.map(toBlastRadiusEdgeSummary),
    lateralMovementSteps: traversal.movementSteps,
    maxDepth: traversal.maxDepth,
    trustBoundariesCrossed: traversal.uniqueBoundaryCount,
    boundaryTransitions: traversal.boundaryTransitions,
    zonesReached: traversal.uniqueZonesReached,
    sensitiveAssetsReached,
    criticalAssetsReached,
    highestImpact: scoring.highestImpact,
    riskFactors: scoring.riskFactors,
    explanationFacts: scoring.explanationFacts,
  };

  const summary: BlastRadiusSummary = {
    totalReachableAssets: blastRadius.reachableNodes.length,
    totalSensitiveAssetsReached: sensitiveAssetsReached,
    totalCriticalAssetsReached: criticalAssetsReached,
    maxLateralMovementDepth: blastRadius.maxDepth,
    maxTrustBoundariesCrossed: blastRadius.trustBoundariesCrossed,
    uniqueZonesReached: blastRadius.zonesReached,
    highestImpact: blastRadius.reachableNodes.length === 0 ? 'none' : blastRadius.highestImpact,
  };

  return {
    environmentId: environment.id,
    analyzedAt: options?.analyzedAt ?? new Date().toISOString(),
    compromisedNodeId,
    blastRadius,
    summary,
  };
}

/**
 * Computes blast radius analyses for all nodes in an environment,
 * enabling ranking and identification of highest-consequence pivot points.
 */
export function analyzeAllBlastRadii(
  environment: Environment,
  options?: BlastRadiusOptions
): Map<string, BlastRadiusAnalysisResult> {
  const results = new Map<string, BlastRadiusAnalysisResult>();
  for (const node of environment.getNodes()) {
    results.set(node.id, analyzeBlastRadius(environment, node.id, options));
  }
  return results;
}
