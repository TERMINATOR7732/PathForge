import {
  NodeType,
  NodeZone,
  AssetCriticality,
  EdgeProtocol,
  EdgeAccess,
} from '@pathforge/shared';

/**
 * Deterministic Risk Classification for an Attack Path.
 */
export type AttackPathRisk = 'critical' | 'high' | 'medium' | 'low';

/**
 * Compact snapshot of an infrastructure node along an attack path.
 */
export interface AttackPathNodeSummary {
  readonly id: string;
  readonly name: string;
  readonly type: NodeType;
  readonly zone: NodeZone;
  readonly criticality: AssetCriticality;
}

/**
 * Compact snapshot of an edge traversed along an attack path.
 */
export interface AttackPathEdgeSummary {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly protocol: EdgeProtocol;
  readonly ports: string;
  readonly access: EdgeAccess;
  readonly encrypted: boolean;
}

/**
 * Single hop fact in an attack path traversal explaining the step.
 */
export interface TraversalStepFact {
  readonly step: number;
  readonly sourceNodeId: string;
  readonly sourceNodeName: string;
  readonly targetNodeId: string;
  readonly targetNodeName: string;
  readonly edgeId: string;
  readonly protocol: EdgeProtocol;
  readonly ports: string;
  readonly access: EdgeAccess;
  readonly encrypted: boolean;
  readonly fromZone: NodeZone;
  readonly toZone: NodeZone;
  readonly boundaryCrossed: boolean;
  readonly explanation: string;
}

/**
 * An AttackPath represents a deterministic traversal route from an
 * attacker-controlled entry point to a sensitive or restricted asset.
 */
export interface AttackPath {
  readonly id: string;
  readonly entryPoint: AttackPathNodeSummary;
  readonly target: AttackPathNodeSummary;
  readonly nodes: readonly AttackPathNodeSummary[];
  readonly edges: readonly AttackPathEdgeSummary[];
  readonly hopCount: number;
  readonly trustBoundariesCrossed: number;
  readonly targetCriticality: AssetCriticality;
  readonly risk: AttackPathRisk;
  readonly riskFactors: readonly string[];
  readonly whyItExists: readonly string[];
  readonly steps: readonly TraversalStepFact[];
}

/**
 * Summary metrics of an attack path analysis run.
 */
export interface AttackPathSummary {
  readonly entryPointCount: number;
  readonly reachableAssetCount: number;
  readonly sensitiveAssetsReached: number;
  readonly criticalAssetsReached: number;
  readonly attackPathCount: number;
  readonly highestRisk: AttackPathRisk | 'none';
}

/**
 * Complete analysis result for an environment.
 */
export interface AttackPathAnalysisResult {
  readonly environmentId: string;
  readonly analyzedAt: string;
  readonly entryPoints: readonly AttackPathNodeSummary[];
  readonly attackPaths: readonly AttackPath[];
  readonly reachableAssets: readonly string[];
  readonly summary: AttackPathSummary;
}

/**
 * Options for running attack path analysis.
 */
export interface AttackPathAnalysisOptions {
  readonly entryPointIds?: readonly string[];
  readonly analyzedAt?: string;
}
