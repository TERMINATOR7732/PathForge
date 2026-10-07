import { Environment } from '../domain/environment.js';
import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { ProductionGate, ProductionGateStatus } from './types.js';

export interface GateEvaluationContext {
  environment: Environment;
  validationResult: ValidationResult | null;
  attackPathAnalysis: AttackPathAnalysisResult;
  architectureAnalysis: ArchitectureAnalysisResult;
}

/**
 * Deterministically evaluates the 6 production readiness gates
 * by composing findings from validation, attack paths, and architecture intelligence.
 */
export function evaluateProductionGates(ctx: GateEvaluationContext): ProductionGate[] {
  const { environment, validationResult, attackPathAnalysis, architectureAnalysis } = ctx;
  const findings = validationResult?.findings ?? [];
  const nodes = environment.getNodes();
  const edges = environment.getEdges();

  const gates: ProductionGate[] = [];

  // ==========================================
  // Gate 1: Critical Security Gate
  // ==========================================
  {
    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    const criticalAttackPaths = attackPathAnalysis.attackPaths.filter((p) => p.risk === 'critical');
    
    // Check direct exposure of critical assets from untrusted ingress
    const untrustedNodeIds = new Set(
      nodes
        .filter((n) => n.zone === 'public' || n.type === 'internet' || n.type === 'external_network')
        .map((n) => n.id)
    );
    const criticalDirectExposures = edges.filter((e) => {
      if (e.access === 'deny') return false;
      if (!untrustedNodeIds.has(e.source)) return false;
      const targetNode = environment.getNode(e.target);
      return (
        targetNode &&
        (targetNode.criticality === 'critical' ||
          targetNode.type === 'database' ||
          targetNode.zone === 'restricted')
      );
    });

    const isBlocked =
      criticalFindings.length > 0 ||
      criticalAttackPaths.length > 0 ||
      criticalDirectExposures.length > 0;

    const reasons: string[] = [];
    if (criticalFindings.length > 0) {
      reasons.push(
        `${criticalFindings.length} critical validation finding(s) detected (${criticalFindings.map((f) => f.ruleId).slice(0, 3).join(', ')}).`
      );
    }
    if (criticalAttackPaths.length > 0) {
      reasons.push(
        `${criticalAttackPaths.length} critical attack path(s) can reach sensitive infrastructure assets.`
      );
    }
    if (criticalDirectExposures.length > 0) {
      reasons.push(
        `${criticalDirectExposures.length} direct ingress edge(s) target critical or restricted assets.`
      );
    }

    if (reasons.length === 0) {
      reasons.push('No unresolved critical validation violations or critical attack paths detected.');
    }

    gates.push({
      id: 'critical-security',
      name: 'Critical Security Gate',
      status: isBlocked ? 'BLOCKED' : 'PASSED',
      summary: isBlocked
        ? 'BLOCKED: Critical security violations or direct exposure paths exist in the modeled infrastructure.'
        : 'PASSED: Zero critical validation violations or critical attack paths identified.',
      reasons,
      evidenceSources: ['validation', 'attack-path', 'topology'],
    });
  }

  // ==========================================
  // Gate 2: High-Risk Exposure Gate
  // ==========================================
  {
    const highRiskAttackPaths = attackPathAnalysis.attackPaths.filter((p) => p.risk === 'high');
    const reachableSensitiveCount = attackPathAnalysis.summary.sensitiveAssetsReached;
    
    // Check administrative or management plane exposure
    const managementFindings = findings.filter(
      (f) => f.ruleId === 'PF-002' || f.category === 'exposure'
    );
    const archMgmtFindings = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-004');

    const hasExposedManagement = managementFindings.length > 0 || archMgmtFindings.length > 0;
    // Shallow high-risk paths (hopCount <= 2) represent immediate unmediated exposure
    const shallowHighRiskPaths = highRiskAttackPaths.filter((p) => p.hopCount <= 2);
    const deepMediatedHighRiskPaths = highRiskAttackPaths.filter((p) => p.hopCount > 2);

    let status: ProductionGateStatus = 'PASSED';
    const reasons: string[] = [];

    if (hasExposedManagement || shallowHighRiskPaths.length > 0) {
      status = 'BLOCKED';
      if (hasExposedManagement) {
        reasons.push(
          'Administrative management plane is reachable from untrusted ingress networks.'
        );
      }
      if (shallowHighRiskPaths.length > 0) {
        reasons.push(
          `${shallowHighRiskPaths.length} shallow high-risk attack path(s) reach sensitive workloads with insufficient tier mediation.`
        );
      }
    } else if (deepMediatedHighRiskPaths.length > 0 || reachableSensitiveCount > 0) {
      status = 'WARNING';
      if (deepMediatedHighRiskPaths.length > 0) {
        reasons.push(
          `${deepMediatedHighRiskPaths.length} multi-tier mediated path(s) reach sensitive workloads through modeled infrastructure.`
        );
      } else {
        reasons.push(
          `${reachableSensitiveCount} sensitive asset(s) are reachable via multi-hop internal pathways.`
        );
      }
    } else {
      reasons.push('Sensitive infrastructure tiers are isolated from untrusted ingress.');
    }

    gates.push({
      id: 'high-risk-exposure',
      name: 'High-Risk Exposure Gate',
      status,
      summary:
        status === 'BLOCKED'
          ? 'BLOCKED: Shallow high-risk attack paths or untrusted management exposure detected.'
          : status === 'WARNING'
          ? 'WARNING: Multi-tier mediated paths reach sensitive workloads through modeled infrastructure.'
          : 'PASSED: No high-risk exposure or untrusted reachability to sensitive assets.',
      reasons,
      evidenceSources: ['attack-path', 'validation', 'architecture'],
    });
  }

  // ==========================================
  // Gate 3: Architecture Gate
  // ==========================================
  {
    const directDataIngress = architectureAnalysis.tierAnalysis.hasDirectEdgeToData;
    const arch001 = architectureAnalysis.findings.some((f) => f.id === 'ARCH-001');
    const arch002 = architectureAnalysis.findings.some((f) => f.id === 'ARCH-002');
    const arch003 = architectureAnalysis.findings.some((f) => f.id === 'ARCH-003');
    const arch007 = architectureAnalysis.findings.some((f) => f.id === 'ARCH-007');
    const isFlat = architectureAnalysis.topologyAnalysis.isFlatTopology;

    let status: ProductionGateStatus = 'PASSED';
    const reasons: string[] = [];

    if (directDataIngress || arch001) {
      status = 'BLOCKED';
      reasons.push('Direct ingress to the data tier bypasses compute and application boundaries.');
    } else if (arch002) {
      status = 'BLOCKED';
      reasons.push('Missing application tier: perimeter connects directly to data stores.');
    } else if (isFlat || arch003) {
      status = 'WARNING';
      reasons.push('Flat internal network topology co-locates heterogeneous workloads without zone boundaries.');
    } else if (arch007) {
      status = 'WARNING';
      reasons.push('Weak perimeter segmentation: compute workloads receive direct untrusted ingress.');
    } else {
      reasons.push('Modeled architecture adheres to multi-tier layered isolation and zone segmentation.');
    }

    gates.push({
      id: 'architecture',
      name: 'Network Architecture Gate',
      status,
      summary:
        status === 'BLOCKED'
          ? 'BLOCKED: Critical architectural structural flaws (direct data ingress or missing tiers) identified.'
          : status === 'WARNING'
          ? 'WARNING: Suboptimal network zoning or flat internal topology detected.'
          : 'PASSED: Clean multi-tier separation and defensible zone boundaries verified.',
      reasons,
      evidenceSources: ['architecture', 'topology'],
    });
  }

  // ==========================================
  // Gate 4: Resilience Gate
  // ==========================================
  {
    const spofs = architectureAnalysis.dependencyAnalysis.singlePointsOfFailure;
    const isHighConcentration =
      architectureAnalysis.dependencyAnalysis.concentrationRating === 'high';

    let status: ProductionGateStatus = 'PASSED';
    const reasons: string[] = [];

    if (spofs.length > 0 || isHighConcentration) {
      status = 'WARNING';
      if (spofs.length > 0) {
        reasons.push(
          `${spofs.length} potential single point(s) of failure modeled (${spofs.map((s) => s.nodeName).slice(0, 3).join(', ')}). Actual redundancy cannot be verified from the topology model.`
        );
      }
      if (isHighConcentration) {
        reasons.push(
          'High centralized dependency concentration detected on critical infrastructure assets.'
        );
      }
    } else {
      reasons.push(
        'Modeled components exhibit distributed connectivity without centralized bottleneck concentration.'
      );
    }

    gates.push({
      id: 'resilience',
      name: 'Resilience & Redundancy Gate',
      status,
      summary:
        status === 'WARNING'
          ? 'WARNING: Potential single points of failure or high dependency concentration identified.'
          : 'PASSED: No centralized structural bottlenecks detected among modeled components.',
      reasons,
      evidenceSources: ['architecture', 'configuration'],
    });
  }

  // ==========================================
  // Gate 5: Communication Security Gate
  // ==========================================
  {
    const cleartextFindings = findings.filter((f) => f.ruleId === 'PF-008');
    
    // Check sensitive edges with unencrypted transport
    const unencryptedSensitiveEdges = edges.filter((e) => {
      if (e.access === 'deny') return false;
      if (e.encrypted) return false;
      const targetNode = environment.getNode(e.target);
      return (
        targetNode &&
        (targetNode.type === 'database' ||
          targetNode.type === 'redis' ||
          targetNode.zone === 'restricted' ||
          targetNode.criticality === 'critical')
      );
    });

    let status: ProductionGateStatus = 'PASSED';
    const reasons: string[] = [];

    if (cleartextFindings.length > 0 || unencryptedSensitiveEdges.length > 0) {
      status = 'BLOCKED';
      reasons.push(
        `${Math.max(cleartextFindings.length, unencryptedSensitiveEdges.length)} unencrypted cleartext channel(s) terminate at databases or sensitive tiers.`
      );
    } else {
      reasons.push('All modeled communication paths to sensitive tiers employ encrypted transport (TLS/SSH).');
    }

    gates.push({
      id: 'communication-security',
      name: 'Communication Security Gate',
      status,
      summary:
        status === 'BLOCKED'
          ? 'BLOCKED: Cleartext unencrypted communication channels terminate at sensitive data stores.'
          : 'PASSED: Sensitive data pathways utilize encrypted transport protocols.',
      reasons,
      evidenceSources: ['validation', 'configuration'],
    });
  }

  // ==========================================
  // Gate 6: Evidence Sufficiency Gate
  // ==========================================
  {
    // Truthful engineering disclosure: the graph cannot verify runtime operational controls
    gates.push({
      id: 'evidence-sufficiency',
      name: 'Operational Evidence Sufficiency Gate',
      status: 'LIMITED',
      summary: 'LIMITED: Runtime operational controls are outside the modeled infrastructure graph.',
      reasons: [
        'The topology model cannot verify backups, disaster recovery, monitoring, alerting, patch management, or secret rotation.',
        'Assessment is based strictly on observable structural topology and configuration metadata.',
      ],
      evidenceSources: ['model-coverage'],
    });
  }

  return gates;
}
