import { BlastRadiusImpact, BlastRadiusNodeSummary, LateralMovementStep } from './types.js';
import { RawBlastRadiusTraversal } from './traversal.js';

export interface BlastRadiusScoringResult {
  highestImpact: BlastRadiusImpact;
  riskFactors: string[];
  explanationFacts: string[];
}

/**
 * Computes deterministic impact rating, explainable risk factors,
 * and numbered architectural explanation facts for a blast radius traversal.
 */
export function scoreBlastRadius(
  traversal: RawBlastRadiusTraversal,
  nodeSummaries: BlastRadiusNodeSummary[]
): BlastRadiusScoringResult {
  const {
    compromisedNode,
    reachableNodes,
    movementSteps,
    uniqueBoundaryCount,
    maxDepth,
  } = traversal;

  const totalReachable = reachableNodes.length;
  const criticalNodes = nodeSummaries.filter((n) => n.isCritical);
  const sensitiveNodes = nodeSummaries.filter((n) => n.isSensitive);

  const hasCritical = criticalNodes.length > 0;
  const hasSensitive = sensitiveNodes.length > 0;
  const reachesDatabase = nodeSummaries.some((n) => n.type === 'database' || n.type === 'redis');
  const reachesAdmin = nodeSummaries.some((n) => n.type === 'admin');
  const reachesRestricted = nodeSummaries.some((n) => n.zone === 'restricted');

  // 1. Determine Impact Level
  let highestImpact: BlastRadiusImpact = 'low';

  if (totalReachable === 0) {
    highestImpact = 'low';
  } else if (hasCritical || reachesRestricted || (reachesDatabase && uniqueBoundaryCount > 0) || reachesAdmin) {
    highestImpact = 'critical';
  } else if (hasSensitive || totalReachable >= 3 || uniqueBoundaryCount >= 2) {
    highestImpact = 'high';
  } else if (totalReachable > 0) {
    highestImpact = 'medium';
  }

  // 2. Formulate Explainable Risk Factors
  const riskFactors: string[] = [];

  if (totalReachable === 0) {
    riskFactors.push('Compromised asset is topologically isolated with no outgoing ALLOW edges.');
  } else {
    if (hasCritical) {
      const names = criticalNodes.map((n) => `${n.name} (${n.zone})`).join(', ');
      riskFactors.push(
        `Lateral movement can compromise ${criticalNodes.length} critical asset(s): ${names}.`
      );
    }

    if (reachesRestricted) {
      riskFactors.push('Lateral movement penetrates the high-security RESTRICTED network tier.');
    }

    if (reachesDatabase) {
      const dbNames = nodeSummaries
        .filter((n) => n.type === 'database' || n.type === 'redis')
        .map((n) => n.name)
        .join(', ');
      riskFactors.push(`Adversary can laterally reach crown-jewel data store(s): ${dbNames}.`);
    }

    if (reachesAdmin) {
      const adminNames = nodeSummaries.filter((n) => n.type === 'admin').map((n) => n.name).join(', ');
      riskFactors.push(`Adversary can reach administrative management control surface(s): ${adminNames}.`);
    }

    if (uniqueBoundaryCount > 0) {
      riskFactors.push(
        `Traverses ${uniqueBoundaryCount} distinct security trust boundary/boundaries without packet-filtering barrier.`
      );
    }

    if (maxDepth >= 2) {
      riskFactors.push(`Deep multi-hop lateral expansion capability spanning up to ${maxDepth} network hops.`);
    }

    if (totalReachable >= 3) {
      riskFactors.push(`Broad blast radius exposing ${totalReachable} downstream infrastructure components.`);
    }
  }

  // 3. Formulate Deterministic Explanation Facts
  const explanationFacts: string[] = [];

  explanationFacts.push(
    `Compromised starting origin: "${compromisedNode.name}" in the "${compromisedNode.zone ?? 'internal'}" zone.`
  );

  if (totalReachable === 0) {
    explanationFacts.push(
      'No modeled ALLOW edges originate from this component; lateral movement is completely contained.'
    );
  } else {
    // Detail each step in traversal
    movementSteps.forEach((step: LateralMovementStep) => {
      const portPart = step.ports ? `over ${step.protocol}/${step.ports}` : `over ${step.protocol}`;
      const boundaryPart = step.crossesTrustBoundary
        ? `crossing from ${step.sourceZone} to ${step.targetZone}`
        : `within ${step.sourceZone}`;
      explanationFacts.push(
        `"${step.sourceNodeName}" can reach "${step.targetNodeName}" ${portPart} (${boundaryPart}).`
      );
    });

    if (reachesRestricted) {
      const restrictedNames = nodeSummaries
        .filter((n) => n.zone === 'restricted')
        .map((n) => n.name)
        .join(', ');
      explanationFacts.push(
        `High-value asset(s) ${restrictedNames} reside in the restricted zone without defensive isolation.`
      );
    }

    explanationFacts.push(
      `No modeled DENY barrier prevents lateral movement from reaching ${totalReachable} downstream component(s).`
    );
  }

  return {
    highestImpact,
    riskFactors,
    explanationFacts,
  };
}
