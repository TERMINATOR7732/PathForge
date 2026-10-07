import {
  AttackPathNodeSummary,
  AttackPathEdgeSummary,
  AttackPathRisk,
  TraversalStepFact,
  RiskAssessment,
} from './types.js';
import { isTrustBoundaryCrossing } from './traversal.js';
import { evaluateAttackPathRisk } from './risk.js';

export interface PathScoringInput {
  entryPoint: AttackPathNodeSummary;
  target: AttackPathNodeSummary;
  nodes: readonly AttackPathNodeSummary[];
  edges: readonly AttackPathEdgeSummary[];
}

export interface PathScoringResult {
  hopCount: number;
  trustBoundariesCrossed: number;
  risk: AttackPathRisk;
  riskScore: number;
  riskAssessment: RiskAssessment;
  riskFactors: readonly string[];
  whyItExists: readonly string[];
  steps: readonly TraversalStepFact[];
}

/**
 * Deterministically evaluates an attack path to calculate:
 * - Hop count
 * - Trust boundaries crossed
 * - Granular traversal step facts
 * - Deterministic explainable risk classification and normalized score
 * - Human-readable risk factors, mitigating factors, and existence rationale
 */
export function scoreAttackPath(input: PathScoringInput): PathScoringResult {
  const { entryPoint, target, nodes, edges } = input;
  const hopCount = edges.length;

  let trustBoundariesCrossed = 0;
  const steps: TraversalStepFact[] = [];
  const whyItExists: string[] = [];

  whyItExists.push(
    `Attacker controls ingress entry point "${entryPoint.name}" (${entryPoint.type}) in '${entryPoint.zone}' zone.`
  );

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const sourceNode = nodes[i];
    const targetNode = nodes[i + 1] ?? target;

    const boundaryCrossed = isTrustBoundaryCrossing(sourceNode.zone, targetNode.zone);
    if (boundaryCrossed) {
      trustBoundariesCrossed++;
    }

    const stepNum = i + 1;
    const protoPort = `${edge.protocol}:${edge.ports}`;
    const encStr = edge.encrypted ? 'TLS Encrypted' : 'Cleartext';
    const boundaryStr = boundaryCrossed
      ? ` (crosses boundary: ${sourceNode.zone} → ${targetNode.zone})`
      : '';

    const explanation = `Hop ${stepNum}: Traffic allowed from "${sourceNode.name}" to "${targetNode.name}" via ${protoPort} [${encStr}]${boundaryStr}.`;

    steps.push({
      step: stepNum,
      sourceNodeId: sourceNode.id,
      sourceNodeName: sourceNode.name,
      targetNodeId: targetNode.id,
      targetNodeName: targetNode.name,
      edgeId: edge.id,
      protocol: edge.protocol,
      ports: edge.ports,
      access: edge.access,
      encrypted: edge.encrypted,
      fromZone: sourceNode.zone,
      toZone: targetNode.zone,
      boundaryCrossed,
      explanation,
    });

    whyItExists.push(
      `Hop ${stepNum}: "${sourceNode.name}" allows network reachability to "${targetNode.name}" on ${protoPort} (${encStr}${boundaryCrossed ? `, entering '${targetNode.zone}' zone` : ''}).`
    );
  }

  whyItExists.push(
    `Reachable target "${target.name}" is reached by attacker (${target.criticality} criticality, '${target.zone}' zone).`
  );

  // Evaluate Risk via Dedicated Risk Intelligence Engine
  const riskAssessment = evaluateAttackPathRisk({
    entryPoint,
    target,
    nodes,
    edges,
    hopCount,
    trustBoundariesCrossed,
  });

  return {
    hopCount,
    trustBoundariesCrossed,
    risk: riskAssessment.level,
    riskScore: riskAssessment.score,
    riskAssessment,
    riskFactors: riskAssessment.factors.map((f) => f.reason),
    whyItExists,
    steps,
  };
}
