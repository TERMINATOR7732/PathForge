import { Environment } from '../domain/environment.js';
import { analyzeTiers } from './tiers.js';
import { analyzeTopology } from './topology.js';
import { analyzeDependencies } from './dependencies.js';
import {
  ArchitectureAnalysisOptions,
  ArchitectureAnalysisResult,
  ArchitectureFinding,
  ArchitectureProfile,
  ArchitectureRating,
  ArchitectureScore,
  ArchitectureScoreDeduction,
} from './types.js';

function normalizeZone(zone?: string): string {
  const z = (zone ?? 'internal').toLowerCase().trim();
  if (z === 'private') return 'internal';
  return z;
}

/**
 * Deterministically analyzes the structural architecture of the modeled infrastructure graph,
 * evaluating tier separation, network zoning, dependency concentration, single points of failure,
 * and high-order architectural weaknesses.
 */
export function analyzeArchitecture(
  environment: Environment,
  options: ArchitectureAnalysisOptions = {}
): ArchitectureAnalysisResult {
  const analyzedAt = options.analyzedAt ?? new Date().toISOString();
  const nodes = environment.getNodes().slice().sort((a, b) => a.id.localeCompare(b.id));

  // 1. Core Domain Analyses
  const tierAnalysis = analyzeTiers(environment);
  const topologyAnalysis = analyzeTopology(environment);
  const dependencyAnalysis = analyzeDependencies(environment);

  // 2. Compile Architecture Profile
  let internetFacingCount = 0;
  let dmzCount = 0;
  let internalCount = 0;
  let restrictedCount = 0;
  let managementCount = 0;
  let criticalCount = 0;
  let criticalIsolatedCount = 0;

  for (const node of nodes) {
    const type = node.type.toLowerCase();
    const zone = normalizeZone(node.zone);
    const isCrit =
      (node.criticality ?? '').toLowerCase() === 'critical' || zone === 'restricted';

    if (type === 'internet' || type === 'external_network' || zone === 'public') {
      internetFacingCount++;
    } else if (zone === 'dmz') {
      dmzCount++;
    } else if (zone === 'restricted') {
      restrictedCount++;
    } else if (zone === 'management' || type === 'admin') {
      managementCount++;
    } else {
      internalCount++;
    }

    if (isCrit) {
      criticalCount++;
      // Check if isolated from direct edge/dmz connections
      const profile = dependencyAnalysis.profiles.find((p) => p.nodeId === node.id);
      const hasDirectEdgeOrDmzCaller = profile?.incomingNodeIds.some((incId) => {
        const caller = nodes.find((n) => n.id === incId);
        if (!caller) return false;
        const cZone = normalizeZone(caller.zone);
        const cType = caller.type.toLowerCase();
        return cZone === 'public' || cZone === 'dmz' || cType === 'internet' || cType === 'external_network';
      });

      if (!hasDirectEdgeOrDmzCaller) {
        criticalIsolatedCount++;
      }
    }
  }

  const activeTiersCount = Object.values(tierAnalysis.tierCounts).filter((c) => c > 0).length;

  const profile: ArchitectureProfile = {
    internetFacingAssets: internetFacingCount,
    dmzAssets: dmzCount,
    internalAssets: internalCount,
    restrictedAssets: restrictedCount,
    managementAssets: managementCount,
    totalAssets: nodes.length,
    applicationTiersCount: activeTiersCount,
    networkZonesCount: topologyAnalysis.totalZones,
    trustBoundariesCount: topologyAnalysis.crossZoneTransitions.length,
    criticalAssetsCount: criticalCount,
    criticalAssetsIsolatedCount: criticalIsolatedCount,
    segmentation: topologyAnalysis.segmentationQuality,
    tierSeparation: tierAnalysis.separationQuality,
    dependencyConcentration: dependencyAnalysis.concentrationRating,
  };

  // 3. Compile Architectural Findings
  const findings: ArchitectureFinding[] = [];
  const deductions: ArchitectureScoreDeduction[] = [];

  // ARCH-001: Data Tier Directly Exposed to Edge / Missing Application Boundary
  if (tierAnalysis.hasDirectEdgeToData) {
    const directTransitions = tierAnalysis.tierTransitions.filter(
      (t) => t.fromTier === 'edge' && t.toTier === 'data'
    );
    const directEdgeIds = directTransitions.flatMap((t) => t.edgeIds);
    const dataNodes = nodes.filter((n) => {
      const t = n.type.toLowerCase();
      return t === 'database' || t === 'redis';
    });

    findings.push({
      id: 'ARCH-001',
      title: 'Data Tier Directly Exposed to External Edge',
      category: 'tier-separation',
      severity: 'critical',
      summary: 'Stateful database or cache components receive direct connections from the external edge with no intermediate application boundary.',
      whyItMatters: 'Direct external connectivity to data storage circumvents compute-tier authentication and business validation, exposing storage protocols to direct compromise.',
      evidence: [
        `Direct edge-to-data network connection(s) detected (${directEdgeIds.length} edge(s)).`,
        `Affected data asset(s): ${dataNodes.map((n) => `"${n.name}"`).join(', ')}.`,
        'Zero intermediate presentation or business application tiers mediate external client access.',
      ],
      affectedNodeIds: dataNodes.map((n) => n.id),
      affectedEdgeIds: directEdgeIds,
      recommendation: 'Introduce an application compute tier (API or Web server) and perimeter firewall to mediate all client requests to data services.',
    });

    deductions.push({
      category: 'tier-separation',
      points: 25,
      reason: 'Data tier directly exposed to external edge without application mediation (-25 pts)',
    });
  }

  // ARCH-002: Flat Internal Topology with Broad Peer Connectivity
  if (topologyAnalysis.isFlatTopology) {
    const internalNodes = nodes.filter(
      (n) => n.type.toLowerCase() !== 'internet' && n.type.toLowerCase() !== 'external_network'
    );
    const internalZone = topologyAnalysis.zones.find((z) => z.zone === 'internal');

    findings.push({
      id: 'ARCH-002',
      title: 'Flat Internal Network Topology with Broad Peer Connectivity',
      category: 'flat-topology',
      severity: 'high',
      summary: `${internalNodes.length} internal infrastructure components participate in an unsegmented trust zone with broad direct peer communication.`,
      whyItMatters: 'An unsegmented internal zone allows an attacker who compromises any single host to laterally traverse directly to other workloads without perimeter barriers.',
      evidence: [
        `${internalNodes.length} components share a single internal network segment.`,
        `Internal segment contains ${internalZone?.internalEdgesCount ?? 0} direct inter-component edge(s).`,
        'No intermediate security perimeters or microsegmentation firewalls restrict lateral peer traffic.',
      ],
      affectedNodeIds: internalNodes.map((n) => n.id),
      affectedEdgeIds: [],
      recommendation: 'Segment internal workloads into dedicated functional tiers (e.g. DMZ, Internal App, Restricted Data enclaves) with policy-based firewalls.',
    });

    deductions.push({
      category: 'flat-topology',
      points: 15,
      reason: 'Flat internal topology with unsegmented peer-to-peer connectivity (-15 pts)',
    });
  }

  // ARCH-003: Critical Asset Dependency Concentration
  for (const dep of dependencyAnalysis.criticalAssetDependencies) {
    if (dep.inDegree >= 3) {
      findings.push({
        id: `ARCH-003-${dep.nodeId}`,
        title: `Critical Asset Dependency Concentration: "${dep.nodeName}"`,
        category: 'critical-asset-dependency',
        severity: 'high',
        summary: `Critical component "${dep.nodeName}" receives direct incoming dependencies from ${dep.inDegree} distinct upstream infrastructure assets.`,
        whyItMatters: 'Heavy centralization on a single core asset creates an operational bottleneck and dramatically magnifies the blast radius of any service degradation or compromise.',
        evidence: [
          `Component "${dep.nodeName}" has ${dep.inDegree} direct incoming dependencies.`,
          `Upstream dependents: ${dep.incomingNodeIds.map((id) => `"${nodes.find((n) => n.id === id)?.name ?? id}"`).join(', ')}.`,
          `Asset criticality: ${dep.criticality.toUpperCase()}, Zone: ${dep.zone}.`,
        ],
        affectedNodeIds: [dep.nodeId, ...dep.incomingNodeIds],
        affectedEdgeIds: [],
        recommendation: 'Reduce direct dependencies by introducing a dedicated service abstraction layer, read-replicas, or a caching tier to distribute workload access.',
      });

      deductions.push({
        category: 'dependency-concentration',
        points: 10,
        reason: `Excessive dependency concentration on critical asset "${dep.nodeName}" (-10 pts)`,
      });
      break; // Deduct once for the most concentrated critical asset
    }
  }

  // ARCH-004: Potential Single Point of Failure in Critical Role
  for (const spof of dependencyAnalysis.singlePointsOfFailure) {
    findings.push({
      id: `ARCH-004-${spof.nodeId}`,
      title: `Potential Single Point of Failure: ${spof.role} ("${spof.nodeName}")`,
      category: 'single-point-of-failure',
      severity: 'medium',
      summary: `Only 1 instance of ${spof.role} is modeled in the architecture graph, serving ${spof.downstreamDependentCount} dependent component(s).`,
      whyItMatters: spof.riskDescription,
      evidence: [
        `Component "${spof.nodeName}" is the sole modeled instance of its infrastructure type.`,
        `Directly connected to ${spof.dependentNodeIds.length} component(s): ${spof.dependentNodeIds.map((id) => `"${nodes.find((n) => n.id === id)?.name ?? id}"`).join(', ')}.`,
        'No redundant standby or clustered peer is modeled in the infrastructure graph.',
      ],
      affectedNodeIds: [spof.nodeId, ...spof.dependentNodeIds],
      affectedEdgeIds: [],
      recommendation: 'Evaluate modeling high-availability clustering, failover pairs, or multi-AZ deployment for this critical component.',
    });

    deductions.push({
      category: 'single-point-of-failure',
      points: 5,
      reason: `Potential single point of failure: ${spof.role} ("${spof.nodeName}") (-5 pts)`,
    });
  }

  // ARCH-005: Direct Ingress to Application Tier Bypassing Perimeter Inspection
  const directEdgeToApp = tierAnalysis.tierTransitions.some(
    (t) => t.fromTier === 'edge' && t.toTier === 'application'
  );
  if (directEdgeToApp && tierAnalysis.tierCounts.perimeter === 0) {
    const appTransitions = tierAnalysis.tierTransitions.filter(
      (t) => t.fromTier === 'edge' && t.toTier === 'application'
    );
    findings.push({
      id: 'ARCH-005',
      title: 'Direct External Ingress to Application Tier Without Perimeter Gateway',
      category: 'tier-separation',
      severity: 'medium',
      summary: 'Application tier receives external ingress directly without an intermediate perimeter inspection tier (firewall or load balancer).',
      whyItMatters: 'Without perimeter traffic inspection, edge network anomalies and protocol attacks terminate directly on application compute workloads.',
      evidence: [
        'External edge connects directly to application workloads.',
        'Zero perimeter gateway components (firewall, load balancer, WAF) modeled in ingress path.',
      ],
      affectedNodeIds: nodes.filter((n) => n.type === 'web_server' || n.type === 'api_server').map((n) => n.id),
      affectedEdgeIds: appTransitions.flatMap((t) => t.edgeIds),
      recommendation: 'Deploy a perimeter firewall or ingress load balancer before application compute instances to enforce boundary traffic inspection.',
    });

    deductions.push({
      category: 'tier-separation',
      points: 10,
      reason: 'Application tier directly exposed to edge without perimeter gateway (-10 pts)',
    });
  }

  // ARCH-006: Privileged Management Tier Exposed to External Ingress
  const directEdgeToMgmt = tierAnalysis.tierTransitions.some(
    (t) => t.fromTier === 'edge' && t.toTier === 'management'
  );
  if (directEdgeToMgmt) {
    const mgmtTransitions = tierAnalysis.tierTransitions.filter(
      (t) => t.fromTier === 'edge' && t.toTier === 'management'
    );
    const adminNodes = nodes.filter((n) => n.type === 'admin');

    findings.push({
      id: 'ARCH-006',
      title: 'Privileged Management Plane Exposed to External Ingress',
      category: 'management-exposure',
      severity: 'high',
      summary: 'Administrative management plane is directly accessible from untrusted external edge ingress.',
      whyItMatters: 'Administrative endpoints exposed to external network boundaries are high-priority targets for credential stuffing, brute force, and privilege escalation.',
      evidence: [
        'External edge connects directly to administrative management plane.',
        `Affected administrative host(s): ${adminNodes.map((n) => `"${n.name}"`).join(', ')}.`,
      ],
      affectedNodeIds: adminNodes.map((n) => n.id),
      affectedEdgeIds: mgmtTransitions.flatMap((t) => t.edgeIds),
      recommendation: 'Isolate administrative endpoints in a dedicated management enclave accessible solely through a bastion host or VPN with multi-factor authentication.',
    });

    deductions.push({
      category: 'management-exposure',
      points: 15,
      reason: 'Privileged management plane exposed to external ingress (-15 pts)',
    });
  }

  // ARCH-007: Weak Cross-Zone Segmentation Quality
  if (topologyAnalysis.segmentationQuality === 'weak') {
    findings.push({
      id: 'ARCH-007',
      title: 'Weak Network Segmentation with Cross-Zone Perimeter Spillover',
      category: 'segmentation',
      severity: 'high',
      summary: 'Restricted or sensitive assets are directly reachable across perimeter boundaries without intermediate internal containment.',
      whyItMatters: 'Perimeter boundaries fail to insulate high-value assets when cross-zone connections bypass internal intermediate tiers.',
      evidence: [
        'Direct connection detected spanning from external/DMZ boundary directly into restricted zones.',
        'Violates standard Defense-in-Depth multi-tier containment.',
      ],
      affectedNodeIds: nodes.filter((n) => normalizeZone(n.zone) === 'restricted').map((n) => n.id),
      affectedEdgeIds: [],
      recommendation: 'Enforce strict perimeter-to-internal-to-restricted zone transitions with policy-based routing and default-deny firewalls.',
    });

    deductions.push({
      category: 'segmentation',
      points: 15,
      reason: 'Weak cross-zone segmentation with direct perimeter-to-restricted transitions (-15 pts)',
    });
  }

  // 4. Compute Architecture Score
  const totalDeductionPoints = deductions.reduce((sum, d) => sum + d.points, 0);
  const rawScore = 100 - totalDeductionPoints;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let rating: ArchitectureRating;
  if (score >= 90) {
    rating = 'strong';
  } else if (score >= 75) {
    rating = 'good';
  } else if (score >= 50) {
    rating = 'needs-attention';
  } else {
    rating = 'weak';
  }

  let summaryText = '';
  if (rating === 'strong') {
    summaryText = 'Well-structured multi-tier architecture with coherent boundaries, segmented zones, and distributed dependencies.';
  } else if (rating === 'good') {
    summaryText = 'Sound architectural foundation with minor structural concentrations or segmentation opportunities.';
  } else if (rating === 'needs-attention') {
    summaryText = 'Architecture exhibits structural weaknesses such as flat internal zoning, missing perimeter inspection, or concentrated dependencies.';
  } else {
    summaryText = 'Critical architectural vulnerabilities detected: direct data exposure, flat topology, or unsegregated privilege zones.';
  }

  const architectureScore: ArchitectureScore = {
    score,
    rating,
    deductions,
    summary: summaryText,
  };

  return {
    environmentId: environment.id,
    analyzedAt,
    profile,
    tierAnalysis,
    topologyAnalysis,
    dependencyAnalysis,
    findings,
    score: architectureScore,
  };
}
