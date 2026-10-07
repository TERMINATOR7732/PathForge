import {
  NodeType,
  NodeZone,
  AssetCriticality,
  Severity,
} from '@pathforge/shared';

/**
 * Architectural tier inferred from node types and infrastructure role.
 */
export type ArchitectureTier =
  | 'edge'
  | 'perimeter'
  | 'application'
  | 'data'
  | 'management'
  | 'internal'
  | 'unknown';

/**
 * High-level qualitative rating of network zoning and segmentation.
 */
export type SegmentationQuality = 'strong' | 'moderate' | 'weak' | 'flat';

/**
 * High-level qualitative rating of architectural tier separation.
 */
export type TierSeparationQuality = 'strong' | 'moderate' | 'weak' | 'none';

/**
 * High-level qualitative rating of dependency concentration across the graph.
 */
export type DependencyConcentrationRating = 'low' | 'moderate' | 'high';

/**
 * High-level qualitative architectural health classification based on score.
 */
export type ArchitectureRating = 'strong' | 'good' | 'needs-attention' | 'weak';

/**
 * Classification of a node into an architectural tier with explanation.
 */
export interface NodeTierAssignment {
  readonly nodeId: string;
  readonly nodeName: string;
  readonly nodeType: NodeType;
  readonly tier: ArchitectureTier;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly rationale: string;
}

/**
 * Summary of a specific security trust zone in the modeled architecture.
 */
export interface ZoneSummary {
  readonly zone: NodeZone;
  readonly assetCount: number;
  readonly nodeIds: readonly string[];
  readonly internalEdgesCount: number;
  readonly outboundCrossZoneEdgesCount: number;
  readonly inboundCrossZoneEdgesCount: number;
}

/**
 * Observable directed edge transition crossing from one zone to another.
 */
export interface CrossZoneTransition {
  readonly fromZone: NodeZone;
  readonly toZone: NodeZone;
  readonly edgeCount: number;
  readonly edgeIds: readonly string[];
}

/**
 * Topology and network zoning analysis of the modeled infrastructure.
 */
export interface TopologyAnalysis {
  readonly totalZones: number;
  readonly zones: readonly ZoneSummary[];
  readonly crossZoneTransitions: readonly CrossZoneTransition[];
  readonly isFlatTopology: boolean;
  readonly segmentationQuality: SegmentationQuality;
  readonly rationale: string;
}

/**
 * Directed connection transition from one architectural tier to another.
 */
export interface TierTransition {
  readonly fromTier: ArchitectureTier;
  readonly toTier: ArchitectureTier;
  readonly edgeCount: number;
  readonly edgeIds: readonly string[];
}

/**
 * Multi-tier separation and layering analysis of the modeled infrastructure.
 */
export interface TierAnalysis {
  readonly tierAssignments: readonly NodeTierAssignment[];
  readonly tierCounts: Record<ArchitectureTier, number>;
  readonly tierTransitions: readonly TierTransition[];
  readonly separationQuality: TierSeparationQuality;
  readonly hasDirectEdgeToData: boolean;
  readonly rationale: string;
}

/**
 * In-degree and out-degree dependency metrics for an individual asset.
 */
export interface NodeDependencyProfile {
  readonly nodeId: string;
  readonly nodeName: string;
  readonly nodeType: NodeType;
  readonly zone: NodeZone;
  readonly criticality: AssetCriticality;
  readonly inDegree: number;
  readonly outDegree: number;
  readonly totalConnectivity: number;
  readonly incomingNodeIds: readonly string[];
  readonly outgoingNodeIds: readonly string[];
  readonly isCriticalAsset: boolean;
}

/**
 * Potential single point of failure observed in the modeled infrastructure.
 * Note: Language reflects potential concentration rather than guaranteed outage.
 */
export interface SinglePointOfFailure {
  readonly nodeId: string;
  readonly nodeName: string;
  readonly role: string;
  readonly downstreamDependentCount: number;
  readonly dependentNodeIds: readonly string[];
  readonly riskDescription: string;
}

/**
 * Dependency graph analysis and concentration assessment.
 */
export interface DependencyAnalysis {
  readonly profiles: readonly NodeDependencyProfile[];
  readonly highConnectivityNodes: readonly NodeDependencyProfile[];
  readonly criticalAssetDependencies: readonly NodeDependencyProfile[];
  readonly singlePointsOfFailure: readonly SinglePointOfFailure[];
  readonly concentrationRating: DependencyConcentrationRating;
  readonly rationale: string;
}

/**
 * Category of an architectural observation or structural finding.
 */
export type ArchitectureFindingCategory =
  | 'tier-separation'
  | 'flat-topology'
  | 'dependency-concentration'
  | 'single-point-of-failure'
  | 'segmentation'
  | 'trust-boundary'
  | 'critical-asset-dependency'
  | 'management-exposure';

/**
 * Structured architectural finding describing a high-order structural pattern.
 */
export interface ArchitectureFinding {
  readonly id: string;
  readonly title: string;
  readonly category: ArchitectureFindingCategory;
  readonly severity: Severity;
  readonly summary: string;
  readonly whyItMatters: string;
  readonly evidence: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly affectedEdgeIds: readonly string[];
  readonly recommendation: string;
}

/**
 * Explainable deduction contributing to the architecture score.
 */
export interface ArchitectureScoreDeduction {
  readonly category: string;
  readonly points: number;
  readonly reason: string;
}

/**
 * Architecture quality score with explainable deduction composition.
 */
export interface ArchitectureScore {
  readonly score: number;
  readonly rating: ArchitectureRating;
  readonly deductions: readonly ArchitectureScoreDeduction[];
  readonly summary: string;
}

/**
 * High-level architecture profile summarizing structural counts and qualities.
 */
export interface ArchitectureProfile {
  readonly internetFacingAssets: number;
  readonly dmzAssets: number;
  readonly internalAssets: number;
  readonly restrictedAssets: number;
  readonly managementAssets: number;
  readonly totalAssets: number;
  readonly applicationTiersCount: number;
  readonly networkZonesCount: number;
  readonly trustBoundariesCount: number;
  readonly criticalAssetsCount: number;
  readonly criticalAssetsIsolatedCount: number;
  readonly segmentation: SegmentationQuality;
  readonly tierSeparation: TierSeparationQuality;
  readonly dependencyConcentration: DependencyConcentrationRating;
}

/**
 * Complete architecture analysis result for an environment.
 */
export interface ArchitectureAnalysisResult {
  readonly environmentId: string;
  readonly analyzedAt: string;
  readonly profile: ArchitectureProfile;
  readonly tierAnalysis: TierAnalysis;
  readonly topologyAnalysis: TopologyAnalysis;
  readonly dependencyAnalysis: DependencyAnalysis;
  readonly findings: readonly ArchitectureFinding[];
  readonly score: ArchitectureScore;
}

/**
 * Options for running architecture analysis.
 */
export interface ArchitectureAnalysisOptions {
  readonly analyzedAt?: string;
}
