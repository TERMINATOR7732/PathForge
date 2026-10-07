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
 * Category of a risk factor increasing attack path severity.
 */
export type RiskFactorCategory =
  | 'entry-exposure'
  | 'target-criticality'
  | 'trust-boundary'
  | 'path-depth'
  | 'encryption'
  | 'access-scope';

/**
 * An individual observable risk factor contributing to the attack path risk score.
 */
export interface RiskFactor {
  readonly id: string;
  readonly category: RiskFactorCategory;
  readonly weight: number;
  readonly reason: string;
}

/**
 * Category of a mitigating security factor reducing path risk.
 */
export type MitigatingFactorCategory =
  | 'encryption'
  | 'boundary-control'
  | 'segmentation'
  | 'access-restriction';

/**
 * An observable architectural defense mitigating attack path severity.
 */
export interface MitigatingFactor {
  readonly id: string;
  readonly category: MitigatingFactorCategory;
  readonly weight: number;
  readonly reason: string;
}

/**
 * Structured risk assessment for an attack path.
 */
export interface RiskAssessment {
  /**
   * Deterministic normalized relative risk score between 0 and 100.
   * Note: This prioritizes architectural exposure, NOT a real-world probability.
   */
  readonly score: number;
  readonly level: AttackPathRisk;
  readonly factors: readonly RiskFactor[];
  readonly mitigatingFactors: readonly MitigatingFactor[];
  readonly dominantFactors: readonly string[];
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
  readonly riskScore: number;
  readonly riskAssessment: RiskAssessment;
  readonly riskFactors: readonly string[];
  readonly whyItExists: readonly string[];
  readonly steps: readonly TraversalStepFact[];
}

/**
 * Reachability exposure metrics originating from a specific entry point.
 */
export interface EntryPointExposure {
  readonly entryPoint: AttackPathNodeSummary;
  readonly reachableAssetCount: number;
  readonly sensitiveAssetCount: number;
  readonly criticalAssetCount: number;
  readonly restrictedAssetCount: number;
  readonly maxTrustBoundariesCrossed: number;
  readonly highestRiskScore: number;
  readonly highestRiskLevel: AttackPathRisk;
}

/**
 * Reachability exposure metrics for an exposed asset reached by attacker entry points.
 */
export interface ExposedAssetIntelligence {
  readonly asset: AttackPathNodeSummary;
  readonly entryPointCount: number;
  readonly entryPoints: readonly AttackPathNodeSummary[];
  readonly highestRiskScore: number;
  readonly highestRiskLevel: AttackPathRisk;
  readonly shortestHopCount: number;
  readonly pathCount: number;
  readonly hasWildcardAccess: boolean;
  readonly hasCleartextAccess: boolean;
}

/**
 * Environment-level reachability intelligence and aggregate prioritization.
 */
export interface ReachabilityIntelligence {
  readonly totalAttackPaths: number;
  readonly criticalAttackPaths: number;
  readonly highRiskAttackPaths: number;
  readonly mediumRiskAttackPaths: number;
  readonly lowRiskAttackPaths: number;
  readonly reachableCriticalAssets: number;
  readonly entryPointExposures: readonly EntryPointExposure[];
  readonly exposedAssets: readonly ExposedAssetIntelligence[];
  readonly mostDangerousPath: AttackPath | null;
  readonly mostExposedAsset: ExposedAssetIntelligence | null;
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
  readonly criticalPathCount?: number;
  readonly highRiskPathCount?: number;
  readonly averageRiskScore?: number;
  readonly mostDangerousPathId?: string | null;
  readonly mostExposedAssetId?: string | null;
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
  readonly intelligence: ReachabilityIntelligence;
}

/**
 * Options for running attack path analysis.
 */
export interface AttackPathAnalysisOptions {
  readonly entryPointIds?: readonly string[];
  readonly analyzedAt?: string;
}
