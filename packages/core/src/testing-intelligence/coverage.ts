import { Environment } from '../domain/environment.js';
import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { BlastRadiusAnalysisResult } from '../blast-radius/types.js';
import { FixVerificationResult } from '../comparison/verification.js';
import { SECURITY_PROPERTY_CATALOG } from './catalog.js';
import type {
  PropertyEvaluation,
  PropertyEvidence,
  PropertyVerificationStatus,
} from './types.js';

export interface CoverageContext {
  environment: Environment;
  validationResult: ValidationResult | null;
  attackPathAnalysis: AttackPathAnalysisResult;
  architectureAnalysis: ArchitectureAnalysisResult;
  blastRadiusAnalysis?: BlastRadiusAnalysisResult | null;
  fixVerification?: FixVerificationResult | null;
  scenarioId?: string | null;
}

/**
 * Deterministically evaluates verification evidence and coverage status
 * for each property in the catalog based on authoritative domain state.
 */
export function evaluatePropertyCoverage(ctx: CoverageContext): PropertyEvaluation[] {
  const {
    environment,
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
    fixVerification,
    scenarioId,
  } = ctx;

  const nodes = environment.getNodes();
  const edges = environment.getEdges();
  const findings = validationResult?.findings ?? [];

  // Sparse or empty environment rule: no fabricated coverage
  const isSparse = nodes.length <= 1;

  const evaluations: PropertyEvaluation[] = [];

  for (const property of SECURITY_PROPERTY_CATALOG) {
    let status: PropertyVerificationStatus = 'UNVERIFIED';
    const evidenceList: PropertyEvidence[] = [];
    let notes = '';
    const affectedNodeIds: string[] = [];
    const affectedEdgeIds: string[] = [];

    // Weight: critical = 3, high = 2, normal = 1
    const weight = property.importance === 'critical' ? 3 : property.importance === 'high' ? 2 : 1;

    if (isSparse) {
      status = 'UNVERIFIED';
      notes = 'Insufficient modeled components to establish verification evidence.';
      evaluations.push({
        property,
        status,
        weight,
        scoreContribution: 0,
        evidenceList,
        notes,
        affectedNodeIds: [],
        affectedEdgeIds: [],
      });
      continue;
    }

    switch (property.id) {
      // ----------------------------------------------------
      // 1. public-ingress-control
      // ----------------------------------------------------
      case 'public-ingress-control': {
        const publicNodes = nodes.filter(
          (n) => n.zone === 'public' || n.type === 'internet' || n.type === 'external_network'
        );
        const pf004 = findings.filter((f) => f.ruleId === 'PF-004');
        const arch007 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-007');

        if (publicNodes.length === 0) {
          status = 'PARTIAL';
          notes = 'No external public ingress nodes modeled.';
        } else if (pf004.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Public ingress connects directly into internal network subnets without perimeter inspection.';
          evidenceList.push({
            id: 'EV-PF-004',
            propertyId: property.id,
            source: 'unit-test',
            status: 'UNVERIFIED',
            description: 'PF-004 Untrusted Network -> Internal Network violation active.',
            evidence: pf004.map((f) => f.id),
          });
          affectedNodeIds.push(...pf004.flatMap((f) => f.affectedNodes));
        } else if (arch007.length > 0) {
          status = 'PARTIAL';
          notes = 'Public ingress connects to compute nodes without intermediate firewall inspection.';
          affectedNodeIds.push(...arch007.flatMap((f) => f.affectedNodeIds));
        } else {
          status = 'VERIFIED';
          notes = 'All public ingress routes pass through perimeter inspection tiers.';
          evidenceList.push({
            id: 'EV-INGRESS-DMZ',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: 'Ingress traffic constrained to DMZ boundary components.',
            evidence: publicNodes.map((n) => n.id),
          });
        }
        break;
      }

      // ----------------------------------------------------
      // 2. database-isolation
      // ----------------------------------------------------
      case 'database-isolation': {
        const databases = nodes.filter((n) => n.type === 'database' || n.type === 'redis');
        const pf001 = findings.filter((f) => f.ruleId === 'PF-001');
        const arch001 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-001');

        if (databases.length === 0) {
          status = 'PARTIAL';
          notes = 'No database or persistence store components modeled.';
        } else if (pf001.length > 0 || arch001.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Direct untrusted ingress to database detected, violating tier isolation.';
          evidenceList.push({
            id: 'EV-PF-001',
            propertyId: property.id,
            source: 'unit-test',
            status: 'UNVERIFIED',
            description: 'Public Database Exposure violation active.',
            evidence: [...pf001.map((f) => f.id), ...arch001.map((f) => f.id)],
          });
          affectedNodeIds.push(...databases.map((d) => d.id));
        } else {
          status = 'VERIFIED';
          notes = 'Databases are isolated from direct edge ingress and mediated by application tiers.';
          evidenceList.push({
            id: 'EV-DB-ISOLATED',
            propertyId: property.id,
            source: scenarioId === 'public-db-exposure' ? 'scenario' : 'model-invariant',
            status: 'VERIFIED',
            description: 'Zero direct ingress connections to persistence tiers.',
            evidence: databases.map((d) => d.id),
          });
        }
        break;
      }

      // ----------------------------------------------------
      // 3. management-plane-isolation
      // ----------------------------------------------------
      case 'management-plane-isolation': {
        const mgmtNodes = nodes.filter((n) => n.zone === 'management' || n.type === 'admin');
        const pf002 = findings.filter((f) => f.ruleId === 'PF-002');
        const arch004 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-004');

        if (mgmtNodes.length === 0) {
          status = 'PARTIAL';
          notes = 'Management plane and administrative jump hosts are not modeled in this environment.';
        } else if (pf002.length > 0 || arch004.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Administrative interfaces or management planes are exposed to untrusted ingress.';
          evidenceList.push({
            id: 'EV-PF-002',
            propertyId: property.id,
            source: 'unit-test',
            status: 'UNVERIFIED',
            description: 'Public Admin Exposure detected.',
            evidence: [...pf002.map((f) => f.id), ...arch004.map((f) => f.id)],
          });
          affectedNodeIds.push(...mgmtNodes.map((n) => n.id));
        } else {
          status = 'VERIFIED';
          notes = 'Management plane is isolated from untrusted ingress networks.';
          evidenceList.push({
            id: 'EV-MGMT-ISOLATED',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: 'Management nodes isolated within dedicated management zones.',
            evidence: mgmtNodes.map((n) => n.id),
          });
        }
        break;
      }

      // ----------------------------------------------------
      // 4. network-segmentation
      // ----------------------------------------------------
      case 'network-segmentation': {
        const seg = architectureAnalysis.topologyAnalysis.segmentationQuality;
        const arch003 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-003');

        if (seg === 'strong' || seg === 'moderate') {
          status = 'VERIFIED';
          notes = `Topology enforces ${seg} multi-zone network segmentation.`;
          evidenceList.push({
            id: 'EV-SEG-VERIFIED',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: `Quality: ${seg}`,
            evidence: architectureAnalysis.topologyAnalysis.zones.map((z) => z.zone),
          });
        } else if (seg === 'weak') {
          status = 'PARTIAL';
          notes = 'Weak network segmentation: limited boundary isolation between trust zones.';
        } else {
          status = 'UNVERIFIED';
          notes = 'Flat internal network topology lacks workload tier segmentation.';
          affectedNodeIds.push(...arch003.flatMap((f) => f.affectedNodeIds));
        }
        break;
      }

      // ----------------------------------------------------
      // 5. deny-boundary-enforcement
      // ----------------------------------------------------
      case 'deny-boundary-enforcement': {
        const denyEdges = edges.filter((e) => e.access === 'deny');
        if (denyEdges.length > 0) {
          status = 'VERIFIED';
          notes = `${denyEdges.length} explicit DENY firewall packet filtering rule(s) verified in graph.`;
          evidenceList.push({
            id: 'EV-DENY-EDGES',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: 'Explicit DENY rules enforce packet filtering boundaries.',
            evidence: denyEdges.map((e) => e.id),
          });
          affectedEdgeIds.push(...denyEdges.map((e) => e.id));
        } else {
          // If no deny edges modeled, but clean firewall boundaries exist
          const hasFw = nodes.some((n) => n.type === 'firewall');
          if (hasFw) {
            status = 'PARTIAL';
            notes = 'Firewall modeled, but default-deny packet filtering rules are not explicitly represented.';
          } else {
            status = 'UNVERIFIED';
            notes = 'No explicit DENY packet filtering rules modeled in network graph.';
          }
        }
        break;
      }

      // ----------------------------------------------------
      // 6. sensitive-traffic-encryption
      // ----------------------------------------------------
      case 'sensitive-traffic-encryption': {
        const pf008 = findings.filter((f) => f.ruleId === 'PF-008');
        const sensitiveEdges = edges.filter((e) => {
          if (e.access === 'deny') return false;
          const target = environment.getNode(e.target);
          return (
            target &&
            (target.type === 'database' ||
              target.type === 'redis' ||
              target.zone === 'restricted' ||
              target.criticality === 'critical')
          );
        });

        if (sensitiveEdges.length === 0) {
          status = 'PARTIAL';
          notes = 'No communication pathways targeting sensitive workloads modeled.';
        } else if (pf008.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Cleartext unencrypted communication channels terminate at sensitive data stores.';
          evidenceList.push({
            id: 'EV-PF-008',
            propertyId: property.id,
            source: 'unit-test',
            status: 'UNVERIFIED',
            description: 'PF-008 Cleartext sensitive communication detected.',
            evidence: pf008.map((f) => f.id),
          });
          affectedEdgeIds.push(...pf008.flatMap((f) => f.affectedEdges));
        } else if (sensitiveEdges.every((e) => e.encrypted)) {
          status = 'VERIFIED';
          notes = 'All communication channels to sensitive workloads enforce transport encryption (TLS/SSH).';
          evidenceList.push({
            id: 'EV-TLS-SENSITIVE',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: '100% of sensitive ingress channels are encrypted.',
            evidence: sensitiveEdges.map((e) => e.id),
          });
        } else {
          status = 'PARTIAL';
          notes = 'Partial transport encryption on sensitive communication paths.';
        }
        break;
      }

      // ----------------------------------------------------
      // 7. secure-protocol-enforcement
      // ----------------------------------------------------
      case 'secure-protocol-enforcement': {
        const allowedEdges = edges.filter((e) => e.access !== 'deny');
        if (allowedEdges.length === 0) {
          status = 'PARTIAL';
          notes = 'No allowed network edges modeled.';
        } else {
          const secureCount = allowedEdges.filter(
            (e) => e.encrypted || e.protocol === 'HTTPS' || e.protocol === 'SSH' || e.protocol === 'TLS'
          ).length;
          const ratio = secureCount / allowedEdges.length;

          if (ratio === 1.0) {
            status = 'VERIFIED';
            notes = '100% of network communication channels utilize secure encrypted protocols.';
          } else if (ratio >= 0.5) {
            status = 'PARTIAL';
            notes = `${Math.round(ratio * 100)}% of communication channels use secure protocols; some cleartext links exist.`;
          } else {
            status = 'UNVERIFIED';
            notes = 'Majority of modeled communication channels operate over unencrypted cleartext protocols.';
          }
        }
        break;
      }

      // ----------------------------------------------------
      // 8. least-privilege-access
      // ----------------------------------------------------
      case 'least-privilege-access': {
        const pf007 = findings.filter((f) => f.ruleId === 'PF-007');
        if (pf007.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Overly broad access rules or wildcard ports allow unrestricted ingress.';
          evidenceList.push({
            id: 'EV-PF-007',
            propertyId: property.id,
            source: 'unit-test',
            status: 'UNVERIFIED',
            description: 'PF-007 Overly Broad Access detected.',
            evidence: pf007.map((f) => f.id),
          });
          affectedEdgeIds.push(...pf007.flatMap((f) => f.affectedEdges));
        } else if (edges.some((e) => e.ports === 'ANY' && e.access === 'allow')) {
          status = 'PARTIAL';
          notes = 'Wildcard ports permitted on non-sensitive network links.';
        } else {
          status = 'VERIFIED';
          notes = 'Network link policies specify discrete port numbers conforming to least privilege.';
          evidenceList.push({
            id: 'EV-LEAST-PRIV',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: 'Explicit ports enforced across active links.',
            evidence: edges.map((e) => `${e.protocol}:${e.ports}`),
          });
        }
        break;
      }

      // ----------------------------------------------------
      // 9. wildcard-access-prevention
      // ----------------------------------------------------
      case 'wildcard-access-prevention': {
        const wildcardEdges = edges.filter(
          (e) => e.access === 'allow' && (e.ports === 'ANY' || e.protocol === 'ANY')
        );
        if (wildcardEdges.length > 0) {
          status = 'UNVERIFIED';
          notes = `${wildcardEdges.length} ALLOW edge(s) permit wildcard ANY port or protocol access.`;
          affectedEdgeIds.push(...wildcardEdges.map((e) => e.id));
        } else {
          status = 'VERIFIED';
          notes = 'Zero ALLOW edges use wildcard ANY ports or protocols.';
        }
        break;
      }

      // ----------------------------------------------------
      // 10. administrative-access-restriction
      // ----------------------------------------------------
      case 'administrative-access-restriction': {
        const pf002 = findings.filter((f) => f.ruleId === 'PF-002');
        const adminListeners = nodes.filter((n) => {
          const p = n.service?.port;
          return p === 22 || p === 3389 || n.type === 'admin';
        });

        if (adminListeners.length === 0) {
          status = 'PARTIAL';
          notes = 'No administrative listeners (SSH :22 / RDP :3389) modeled.';
        } else if (pf002.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Administrative access listeners are reachable from untrusted public ingress.';
          affectedNodeIds.push(...pf002.flatMap((f) => f.affectedNodes));
        } else {
          status = 'VERIFIED';
          notes = 'Administrative access is restricted to authorized management boundaries.';
        }
        break;
      }

      // ----------------------------------------------------
      // 11. critical-asset-reachability
      // ----------------------------------------------------
      case 'critical-asset-reachability': {
        const critAssets = nodes.filter((n) => n.criticality === 'critical');
        const critPaths = attackPathAnalysis.attackPaths.filter(
          (p) => p.risk === 'critical' && critAssets.some((c) => c.id === p.target.id)
        );
        const directHighPaths = attackPathAnalysis.attackPaths.filter(
          (p) => p.risk === 'high' && p.hopCount <= 2 && critAssets.some((c) => c.id === p.target.id)
        );

        if (critAssets.length === 0) {
          status = 'PARTIAL';
          notes = 'No critical-criticality crown jewel assets modeled in this environment.';
        } else if (critPaths.length > 0 || directHighPaths.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Direct or critical attack paths reach critical crown jewel assets.';
          evidenceList.push({
            id: 'EV-CRIT-PATHS',
            propertyId: property.id,
            source: 'unit-test',
            status: 'UNVERIFIED',
            description: 'Critical adversarial attack paths reach critical assets.',
            evidence: [...critPaths.map((p) => p.id), ...directHighPaths.map((p) => p.id)],
          });
          affectedNodeIds.push(...critAssets.map((c) => c.id));
        } else {
          status = 'VERIFIED';
          notes = 'Zero direct or critical attack paths reach critical infrastructure assets.';
          evidenceList.push({
            id: 'EV-NO-CRIT-PATHS',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: 'Attack path analysis confirmed critical assets are protected from direct attack reachability.',
            evidence: ['zero-direct-critical-attack-paths'],
          });
        }
        break;
      }

      // ----------------------------------------------------
      // 12. high-risk-attack-path-prevention
      // ----------------------------------------------------
      case 'high-risk-attack-path-prevention': {
        const critPaths = attackPathAnalysis.attackPaths.filter((p) => p.risk === 'critical');
        const directHighPaths = attackPathAnalysis.attackPaths.filter(
          (p) => p.risk === 'high' && p.hopCount <= 2
        );

        if (critPaths.length > 0 || directHighPaths.length > 0) {
          status = 'UNVERIFIED';
          notes = `${critPaths.length + directHighPaths.length} critical or direct high-risk attack path(s) detected.`;
          affectedEdgeIds.push(
            ...[...critPaths, ...directHighPaths].flatMap((p) => p.edges.map((e) => e.id))
          );
        } else if (attackPathAnalysis.attackPaths.length > 0) {
          status = 'VERIFIED';
          notes = 'All attack paths are mediated through multi-tier defensive controls with zero direct high-risk routes.';
          evidenceList.push({
            id: 'EV-NO-HIGH-PATHS',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: 'Zero unmediated critical or direct high-risk attack paths exist.',
            evidence: ['zero-direct-high-risk-paths'],
          });
        } else {
          status = 'VERIFIED';
          notes = 'Zero adversarial attack paths discovered from untrusted ingress.';
          evidenceList.push({
            id: 'EV-ZERO-ATTACK-PATHS',
            propertyId: property.id,
            source: 'model-invariant',
            status: 'VERIFIED',
            description: 'Zero attack paths discovered from ingress.',
            evidence: ['zero-attack-paths'],
          });
        }
        break;
      }

      // ----------------------------------------------------
      // 13. lateral-movement-containment
      // ----------------------------------------------------
      case 'lateral-movement-containment': {
        const isFlat = architectureAnalysis.topologyAnalysis.isFlatTopology;
        if (isFlat) {
          status = 'UNVERIFIED';
          notes = 'Flat internal network allows unrestricted lateral movement across workloads.';
        } else {
          status = 'VERIFIED';
          notes = 'Multi-tier zone boundaries contain lateral movement progression.';
        }
        break;
      }

      // ----------------------------------------------------
      // 14. blast-radius-control
      // ----------------------------------------------------
      case 'blast-radius-control': {
        const isFlat = architectureAnalysis.topologyAnalysis.isFlatTopology;
        if (isFlat) {
          status = 'UNVERIFIED';
          notes = 'Compromise blast radius cascades across unsegmented internal workloads.';
        } else {
          status = 'VERIFIED';
          notes = 'Blast radius containment enforced by trust zone boundaries.';
        }
        break;
      }

      // ----------------------------------------------------
      // 15. tier-separation
      // ----------------------------------------------------
      case 'tier-separation': {
        const tierQuality = architectureAnalysis.tierAnalysis.separationQuality;
        const hasDirectData = architectureAnalysis.tierAnalysis.hasDirectEdgeToData;

        if (hasDirectData) {
          status = 'UNVERIFIED';
          notes = 'Tier separation bypassed: direct ingress to data tier without application layer.';
        } else if (tierQuality === 'strong' || tierQuality === 'moderate') {
          status = 'VERIFIED';
          notes = `Architecture enforces ${tierQuality} multi-tier separation.`;
        } else {
          status = 'PARTIAL';
          notes = 'Weak tier separation: compute and persistence tiers are loosely separated.';
        }
        break;
      }

      // ----------------------------------------------------
      // 16. dependency-concentration
      // ----------------------------------------------------
      case 'dependency-concentration': {
        const rating = architectureAnalysis.dependencyAnalysis.concentrationRating;
        if (rating === 'low' || rating === 'moderate') {
          status = 'VERIFIED';
          notes = `Dependency concentration is ${rating}; connections are distributed across tiers.`;
        } else {
          status = 'PARTIAL';
          notes = 'High centralized dependency concentration on critical infrastructure components.';
        }
        break;
      }

      // ----------------------------------------------------
      // 17. single-point-of-failure-detection
      // ----------------------------------------------------
      case 'single-point-of-failure-detection': {
        const spofs = architectureAnalysis.dependencyAnalysis.singlePointsOfFailure;
        if (spofs.length === 0) {
          status = 'VERIFIED';
          notes = 'No single points of failure detected among modeled components.';
        } else {
          status = 'PARTIAL';
          notes = `${spofs.length} potential single point(s) of failure identified (${spofs.map((s) => s.nodeName).slice(0, 2).join(', ')}).`;
          affectedNodeIds.push(...spofs.map((s) => s.nodeId));
        }
        break;
      }

      // ----------------------------------------------------
      // 18. perimeter-boundary
      // ----------------------------------------------------
      case 'perimeter-boundary': {
        const arch007 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-007');
        const hasPerimeter = nodes.some((n) => n.type === 'firewall' || n.type === 'load_balancer');

        if (arch007.length > 0) {
          status = 'UNVERIFIED';
          notes = 'Direct external ingress reaches compute workloads without perimeter inspection.';
          affectedNodeIds.push(...arch007.flatMap((f) => f.affectedNodeIds));
        } else if (hasPerimeter) {
          status = 'VERIFIED';
          notes = 'Perimeter firewall or reverse proxy mediates external ingress.';
        } else {
          status = 'PARTIAL';
          notes = 'No dedicated perimeter components (firewall / load balancer) modeled.';
        }
        break;
      }

      // ----------------------------------------------------
      // 19. finding-resolution-verification
      // ----------------------------------------------------
      case 'finding-resolution-verification': {
        if (fixVerification && fixVerification.resolvedFindings.length > 0) {
          status = 'VERIFIED';
          notes = `${fixVerification.resolvedFindings.length} finding(s) mathematically proven resolved against baseline.`;
          evidenceList.push({
            id: 'EV-RESOLVED-FIXES',
            propertyId: property.id,
            source: 'fix-verification',
            status: 'VERIFIED',
            description: `${fixVerification.resolvedFindings.length} resolved finding(s)`,
            evidence: fixVerification.resolvedFindings.map((r) => r.finding.ruleId),
          });
        } else if (findings.length === 0) {
          status = 'PARTIAL';
          notes = 'Validation passes cleanly with zero findings; remediation proof cycle unexercised.';
        } else {
          status = 'UNVERIFIED';
          notes = `${findings.length} active finding(s) remain unresolved without verification proof.`;
        }
        break;
      }

      // ----------------------------------------------------
      // 20. regression-detection
      // ----------------------------------------------------
      case 'regression-detection': {
        if (fixVerification && fixVerification.newFindings.length > 0) {
          status = 'UNVERIFIED';
          notes = `Regressions detected: ${fixVerification.newFindings.length} new finding(s) introduced.`;
          evidenceList.push({
            id: 'EV-REGRESSIONS',
            propertyId: property.id,
            source: 'fix-verification',
            status: 'UNVERIFIED',
            description: 'Regressions introduced by recent remediation.',
            evidence: fixVerification.newFindings.map((n) => n.finding.ruleId),
          });
        } else if (fixVerification && fixVerification.resolvedFindings.length > 0) {
          status = 'VERIFIED';
          notes = 'Zero regressions introduced during verified remediation.';
          evidenceList.push({
            id: 'EV-NO-REGRESSIONS',
            propertyId: property.id,
            source: 'fix-verification',
            status: 'VERIFIED',
            description: 'Fix verification confirmed zero regressions.',
            evidence: ['zero-regressions'],
          });
        } else if (findings.length === 0) {
          status = 'PARTIAL';
          notes = 'Clean validation baseline; regression defense active.';
        } else {
          status = 'PARTIAL';
          notes = 'No regression baseline established yet.';
        }
        break;
      }

      default: {
        status = 'UNVERIFIED';
        notes = 'No evaluation logic mapped for this property.';
        break;
      }
    }

    const scoreContribution = status === 'VERIFIED' ? weight * 1.0 : status === 'PARTIAL' ? weight * 0.5 : 0;

    evaluations.push({
      property,
      status,
      weight,
      scoreContribution,
      evidenceList,
      notes,
      affectedNodeIds: affectedNodeIds.slice().sort(),
      affectedEdgeIds: affectedEdgeIds.slice().sort(),
    });
  }

  return evaluations;
}
