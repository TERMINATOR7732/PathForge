import {
  NodeType,
  NodeZone,
  AssetCriticality,
  EdgeProtocol,
  EdgeAccess,
  EdgeRelationship,
} from '@pathforge/shared';

/**
 * Deterministic Impact rating for blast radius assessment.
 * Measures potential consequence after an asset is compromised.
 */
export type BlastRadiusImpact = 'critical' | 'high' | 'medium' | 'low';

/**
 * Compact snapshot of an infrastructure node within a blast radius.
 */
export interface BlastRadiusNodeSummary {
  readonly id: string;
  readonly name: string;
  readonly type: NodeType;
  readonly zone: NodeZone;
  readonly criticality: AssetCriticality;
  readonly isSensitive: boolean;
  readonly isCritical: boolean;
  readonly depth: number;
}

/**
 * Compact snapshot of an edge participating in lateral movement traversal.
 */
export interface BlastRadiusEdgeSummary {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly protocol: EdgeProtocol;
  readonly ports: string;
  readonly access: EdgeAccess;
  readonly encrypted: boolean;
  readonly relationship: EdgeRelationship;
}

/**
 * Granular lateral movement step explaining transition from source to target.
 */
export interface LateralMovementStep {
  readonly stepIndex: number;
  readonly sourceNodeId: string;
  readonly sourceNodeName: string;
  readonly targetNodeId: string;
  readonly targetNodeName: string;
  readonly edgeId: string;
  readonly protocol: EdgeProtocol;
  readonly ports: string;
  readonly access: EdgeAccess;
  readonly encrypted: boolean;
  readonly relationship: EdgeRelationship;
  readonly sourceZone: NodeZone;
  readonly targetZone: NodeZone;
  readonly crossesTrustBoundary: boolean;
  readonly rationale: string;
}

/**
 * Representation of a distinct trust boundary transition crossed during lateral movement.
 */
export interface TrustBoundaryTransition {
  readonly fromZone: NodeZone;
  readonly toZone: NodeZone;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly edgeId: string;
}

/**
 * Complete blast-radius report for a single compromised origin node.
 */
export interface BlastRadius {
  readonly compromisedNode: BlastRadiusNodeSummary;
  readonly reachableNodes: readonly BlastRadiusNodeSummary[];
  readonly reachableEdges: readonly BlastRadiusEdgeSummary[];
  readonly lateralMovementSteps: readonly LateralMovementStep[];
  readonly maxDepth: number;
  readonly trustBoundariesCrossed: number;
  readonly boundaryTransitions: readonly TrustBoundaryTransition[];
  readonly zonesReached: readonly NodeZone[];
  readonly sensitiveAssetsReached: number;
  readonly criticalAssetsReached: number;
  readonly highestImpact: BlastRadiusImpact;
  readonly riskFactors: readonly string[];
  readonly explanationFacts: readonly string[];
}

/**
 * Deterministic aggregate summary of blast-radius findings.
 */
export interface BlastRadiusSummary {
  readonly totalReachableAssets: number;
  readonly totalSensitiveAssetsReached: number;
  readonly totalCriticalAssetsReached: number;
  readonly maxLateralMovementDepth: number;
  readonly maxTrustBoundariesCrossed: number;
  readonly uniqueZonesReached: readonly NodeZone[];
  readonly highestImpact: BlastRadiusImpact | 'none';
}

/**
 * Top-level analysis result container.
 */
export interface BlastRadiusAnalysisResult {
  readonly environmentId: string;
  readonly analyzedAt: string;
  readonly compromisedNodeId: string;
  readonly blastRadius: BlastRadius;
  readonly summary: BlastRadiusSummary;
}

/**
 * Optional parameters for blast radius analysis.
 */
export interface BlastRadiusOptions {
  readonly analyzedAt?: string;
  readonly maxDepthLimit?: number;
}
