import {
  AttackPathNodeSummary,
  AttackPathEdgeSummary,
  AttackPathRisk,
  RiskAssessment,
  RiskFactor,
  MitigatingFactor,
} from './types.js';

export interface PathRiskInput {
  readonly entryPoint: AttackPathNodeSummary;
  readonly target: AttackPathNodeSummary;
  readonly nodes: readonly AttackPathNodeSummary[];
  readonly edges: readonly AttackPathEdgeSummary[];
  readonly hopCount: number;
  readonly trustBoundariesCrossed: number;
}

/**
 * Deterministically evaluates the risk of an attack path based on observable
 * architectural facts: entry exposure, target criticality, trust boundaries,
 * path depth, encryption, and access controls.
 *
 * The output score is a relative prioritization metric (0-100), not a probability.
 */
export function evaluateAttackPathRisk(input: PathRiskInput): RiskAssessment {
  const { entryPoint, target, nodes, edges, hopCount, trustBoundariesCrossed } = input;

  const factors: RiskFactor[] = [];
  const mitigatingFactors: MitigatingFactor[] = [];

  const BASE_SCORE = 5;

  // 1. Entry Exposure Evaluation
  const isPublicEntry =
    entryPoint.zone === 'public' ||
    entryPoint.type === 'internet' ||
    entryPoint.type === 'external_network';

  const isDmzEntry = entryPoint.zone === 'dmz';

  if (isPublicEntry) {
    factors.push({
      id: 'entry-public',
      category: 'entry-exposure',
      weight: 20,
      reason: `Public untrusted attacker entry point ("${entryPoint.name}")`,
    });
  } else if (isDmzEntry) {
    factors.push({
      id: 'entry-dmz',
      category: 'entry-exposure',
      weight: 10,
      reason: `Attacker originates from perimeter DMZ tier ("${entryPoint.name}")`,
    });
  } else {
    factors.push({
      id: 'entry-internal',
      category: 'entry-exposure',
      weight: 5,
      reason: `Attacker originates from internal network asset ("${entryPoint.name}")`,
    });
  }

  // 2. Target Criticality & Role Evaluation
  const isTargetCritical = target.criticality === 'critical';
  const isTargetHigh = target.criticality === 'high';
  const isTargetMedium = target.criticality === 'medium';
  const isTargetRestricted = target.zone === 'restricted';
  const isCoreDataOrAdmin =
    target.type === 'database' || target.type === 'admin' || target.type === 'redis';

  if (isTargetCritical) {
    factors.push({
      id: 'target-critical',
      category: 'target-criticality',
      weight: 25,
      reason: `Target asset "${target.name}" has CRITICAL criticality rating`,
    });
  } else if (isTargetHigh) {
    factors.push({
      id: 'target-high',
      category: 'target-criticality',
      weight: 15,
      reason: `Target asset "${target.name}" has HIGH criticality rating`,
    });
  } else if (isTargetMedium) {
    factors.push({
      id: 'target-medium',
      category: 'target-criticality',
      weight: 5,
      reason: `Target asset "${target.name}" has MEDIUM criticality rating`,
    });
  }

  if (isTargetRestricted) {
    factors.push({
      id: 'target-restricted-zone',
      category: 'target-criticality',
      weight: 10,
      reason: `Target resides within RESTRICTED security zone`,
    });
  }

  if (isCoreDataOrAdmin) {
    factors.push({
      id: 'target-sensitive-role',
      category: 'target-criticality',
      weight: 10,
      reason: `High-value sensitive asset role: ${target.type.toUpperCase()}`,
    });
  }

  // 3. Path Depth & Exposure Urgency
  if (hopCount === 1) {
    factors.push({
      id: 'depth-direct',
      category: 'path-depth',
      weight: 20,
      reason: `Direct 1-hop exposure to attacker`,
    });
  } else if (hopCount === 2) {
    factors.push({
      id: 'depth-shallow',
      category: 'path-depth',
      weight: 10,
      reason: `Shallow attack path: reached in only 2 network hops`,
    });
  } else {
    factors.push({
      id: 'depth-extended',
      category: 'path-depth',
      weight: 0,
      reason: `Multi-hop traversal across ${hopCount} network hops`,
    });
  }

  // 4. Trust Boundary Crossings
  if (trustBoundariesCrossed === 0) {
    factors.push({
      id: 'boundary-flat',
      category: 'trust-boundary',
      weight: 15,
      reason: `Zero defensive security boundaries separating entry point from target`,
    });
  } else if (trustBoundariesCrossed === 1) {
    factors.push({
      id: 'boundary-single',
      category: 'trust-boundary',
      weight: 5,
      reason: `Only 1 perimeter trust boundary traversed`,
    });
  } else {
    factors.push({
      id: 'boundary-multiple',
      category: 'trust-boundary',
      weight: 10,
      reason: `Crosses ${trustBoundariesCrossed} distinct security trust boundaries`,
    });
  }

  // 5. Access Scope & Edge Protocols
  const hasWildcard = edges.some(
    (e) => e.ports === 'ANY' || e.ports === '*' || e.ports.includes('-')
  );
  const hasAnyProto = edges.some((e) => e.protocol === 'ANY');
  const hasAdminPort = edges.some((e) => {
    const p = e.ports.toLowerCase();
    return p.includes('22') || p.includes('3389');
  });

  if (hasWildcard) {
    factors.push({
      id: 'access-wildcard-port',
      category: 'access-scope',
      weight: 15,
      reason: `Broad wildcard port access ('ANY') permitted along path`,
    });
  }

  if (hasAnyProto) {
    factors.push({
      id: 'access-any-protocol',
      category: 'access-scope',
      weight: 10,
      reason: `Unrestricted ANY protocol permitted along path`,
    });
  }

  if (hasAdminPort) {
    factors.push({
      id: 'access-admin-port',
      category: 'access-scope',
      weight: 10,
      reason: `Exposes remote administrative ports (SSH 22 / RDP 3389) along path`,
    });
  }

  // 6. Encryption State
  const hasUnencrypted = edges.some((e) => !e.encrypted);
  const allEncrypted = edges.length > 0 && edges.every((e) => e.encrypted);
  const targetEdge = edges[edges.length - 1];
  const isTargetEdgeUnencrypted = targetEdge ? !targetEdge.encrypted : false;

  if (isTargetEdgeUnencrypted && (isCoreDataOrAdmin || isTargetCritical || isTargetRestricted)) {
    factors.push({
      id: 'enc-cleartext-sensitive',
      category: 'encryption',
      weight: 15,
      reason: `Cleartext unencrypted network traffic permitted along path`,
    });
  } else if (hasUnencrypted) {
    factors.push({
      id: 'enc-cleartext-intermediate',
      category: 'encryption',
      weight: 5,
      reason: `Cleartext unencrypted network traffic permitted along path`,
    });
  }

  // 7. Mitigating Architectural Defenses
  if (allEncrypted) {
    mitigatingFactors.push({
      id: 'mit-tls-enforced',
      category: 'encryption',
      weight: 10,
      reason: `All network hops along path enforce cryptographic encryption (TLS/SSH)`,
    });
  }

  const hasIntermediateFirewallOrProxy = nodes.slice(1, -1).some(
    (n) => n.type === 'firewall' || n.type === 'load_balancer' || n.type === 'web_server'
  );

  if (hopCount >= 3 && hasIntermediateFirewallOrProxy) {
    mitigatingFactors.push({
      id: 'mit-multi-tier-defense',
      category: 'segmentation',
      weight: 10,
      reason: `Multi-tier intermediate segmentation insulates the final target`,
    });
  }

  if (!hasWildcard && !hasAnyProto) {
    mitigatingFactors.push({
      id: 'mit-restricted-ports',
      category: 'access-restriction',
      weight: 5,
      reason: `All edges enforce discrete restricted destination ports without wildcards`,
    });
  }

  // 8. Score Calculation & Clamping
  const positiveSum = factors.reduce((acc, f) => acc + f.weight, 0);
  const mitigationSum = mitigatingFactors.reduce((acc, m) => acc + m.weight, 0);
  const rawScore = BASE_SCORE + positiveSum - mitigationSum;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // 9. Deterministic Risk Level Classification
  let level: AttackPathRisk;
  if (score >= 75) {
    level = 'critical';
  } else if (score >= 50) {
    level = 'high';
  } else if (score >= 25) {
    level = 'medium';
  } else {
    level = 'low';
  }

  // 10. Dominant Factors (Top factors by weight descending)
  const sortedFactors = factors.slice().sort((a, b) => b.weight - a.weight);
  const dominantFactors = sortedFactors.slice(0, 3).map((f) => f.reason);

  return {
    score,
    level,
    factors,
    mitigatingFactors,
    dominantFactors,
  };
}
