import { Environment } from '../domain/environment.js';
import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import {
  BlockingReason,
  ReadinessWarning,
  UnverifiedControl,
  ReadinessEvidenceRecord,
  ProductionReadinessStatus,
  ProductionReadinessRating,
} from './types.js';

export interface AssessmentBuilderContext {
  environment: Environment;
  validationResult: ValidationResult | null;
  attackPathAnalysis: AttackPathAnalysisResult;
  architectureAnalysis: ArchitectureAnalysisResult;
}

/**
 * Deterministically constructs structured blocking reasons preventing production readiness.
 */
export function buildBlockingReasons(ctx: AssessmentBuilderContext): BlockingReason[] {
  const { validationResult, attackPathAnalysis, architectureAnalysis } = ctx;
  const findings = validationResult?.findings ?? [];
  const reasons: BlockingReason[] = [];

  // 1. Critical Validation Findings (e.g. PF-001, PF-004)
  for (const finding of findings) {
    if (finding.severity === 'critical') {
      reasons.push({
        id: `BLOCK-VAL-${finding.id}`,
        title: finding.title,
        severity: 'critical',
        category: finding.ruleId === 'PF-004' ? 'access-control' : 'security',
        explanation: `Critical security violation: ${finding.whyItMatters}`,
        evidence: [finding.ruleId, ...finding.affectedNodes],
        affectedNodeIds: finding.affectedNodes.slice().sort(),
        affectedEdgeIds: finding.affectedEdges.slice().sort(),
        recommendation: finding.recommendation,
      });
    }
  }

  // 2. Critical Attack Paths
  const criticalAttackPaths = attackPathAnalysis.attackPaths.filter((p) => p.risk === 'critical');
  for (const path of criticalAttackPaths) {
    // Avoid duplicate if already covered by finding on same edge/target
    const alreadyBlocked = reasons.some(
      (r) => r.affectedNodeIds.includes(path.target.id) && r.severity === 'critical'
    );
    if (!alreadyBlocked) {
      reasons.push({
        id: `BLOCK-PATH-${path.id}`,
        title: `Critical Attack Path to ${path.target.name}`,
        severity: 'critical',
        category: 'attack-exposure',
        explanation: `An adversarial attack path originates at ${path.entryPoint.name} and traverses ${path.hopCount} hop(s) to reach sensitive asset ${path.target.name}.`,
        evidence: [path.id, `${path.hopCount} hops`, `Score: ${path.riskScore}`],
        affectedNodeIds: path.nodes.map((n) => n.id).slice().sort(),
        affectedEdgeIds: path.edges.map((e) => e.id).slice().sort(),
        recommendation: 'Sever the direct ingress connection or place an inspection firewall / reverse proxy in a DMZ.',
      });
    }
  }

  // 3. Direct Edge-to-Data Ingress (ARCH-001)
  if (architectureAnalysis.tierAnalysis.hasDirectEdgeToData) {
    const directDataFinding = architectureAnalysis.findings.find((f) => f.id === 'ARCH-001');
    const existing = reasons.some((r) => r.id.includes('ARCH-001') || r.title.toLowerCase().includes('database'));
    if (!existing) {
      reasons.push({
        id: 'BLOCK-ARCH-DIRECT-DATA',
        title: 'Direct Untrusted Ingress to Data Tier',
        severity: 'critical',
        category: 'architecture',
        explanation: 'Data storage components receive incoming network connections directly from external edge ingress without application tier mediation.',
        evidence: ['ARCH-001', ...(directDataFinding?.affectedNodeIds ?? [])],
        affectedNodeIds: (directDataFinding?.affectedNodeIds ?? []).slice().sort(),
        affectedEdgeIds: (directDataFinding?.affectedEdgeIds ?? []).slice().sort(),
        recommendation: 'Re-route traffic through an application server or reverse proxy, enforcing authentication and least privilege.',
      });
    }
  }

  // 4. Exposed Management Plane (PF-002 or ARCH-004)
  const archMgmtFinding = architectureAnalysis.findings.find((f) => f.id === 'ARCH-004');
  const pf002 = findings.find((f) => f.ruleId === 'PF-002');
  if (archMgmtFinding || pf002) {
    const targetNodeIds = archMgmtFinding?.affectedNodeIds ?? pf002?.affectedNodes ?? [];
    reasons.push({
      id: 'BLOCK-MGMT-EXPOSURE',
      title: 'Administrative Console Reachable from Untrusted Ingress',
      severity: 'high',
      category: 'security',
      explanation: 'Administrative or management interfaces are reachable across untrusted ingress boundaries, risking remote management compromise.',
      evidence: ['PF-002', 'ARCH-004', ...targetNodeIds],
      affectedNodeIds: targetNodeIds.slice().sort(),
      affectedEdgeIds: (archMgmtFinding?.affectedEdgeIds ?? pf002?.affectedEdges ?? []).slice().sort(),
      recommendation: 'Isolate administrative systems in a dedicated Management or Restricted zone behind a VPN bastion.',
    });
  }

  // 5. Cleartext Sensitive Communication (PF-008)
  const cleartextFindings = findings.filter((f) => f.ruleId === 'PF-008');
  for (const c of cleartextFindings) {
    reasons.push({
      id: `BLOCK-CLEARTEXT-${c.id}`,
      title: 'Cleartext Unencrypted Sensitive Communication',
      severity: 'high',
      category: 'communication',
      explanation: 'Unencrypted communication channels terminate at databases or restricted internal workloads, risking data snooping or token capture.',
      evidence: ['PF-008', ...c.affectedNodes],
      affectedNodeIds: c.affectedNodes.slice().sort(),
      affectedEdgeIds: c.affectedEdges.slice().sort(),
      recommendation: 'Enable transport layer security (TLS/SSH) on connections terminating at databases or restricted tiers.',
    });
  }

  // Sort deterministically: severity descending (critical > high > medium), then ID ascending
  const severityRank: Record<string, number> = { critical: 3, high: 2, medium: 1 };
  return reasons.sort((a, b) => {
    const diff = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Deterministically constructs structured warnings that highlight non-blocking risks.
 */
export function buildReadinessWarnings(ctx: AssessmentBuilderContext): ReadinessWarning[] {
  const { validationResult, architectureAnalysis } = ctx;
  const warnings: ReadinessWarning[] = [];

  // 1. Flat Internal Network Topology (ARCH-003)
  if (architectureAnalysis.topologyAnalysis.isFlatTopology) {
    const flatFinding = architectureAnalysis.findings.find((f) => f.id === 'ARCH-003');
    warnings.push({
      id: 'WARN-FLAT-TOPOLOGY',
      title: 'Flat Internal Network Topology',
      category: 'architecture',
      explanation: 'Application servers, databases, and administrative services share a single internal broadcast domain without isolation boundaries.',
      evidence: ['ARCH-003', ...(flatFinding?.affectedNodeIds ?? [])],
      affectedNodeIds: (flatFinding?.affectedNodeIds ?? []).slice().sort(),
      affectedEdgeIds: [],
      recommendation: 'Segment the internal network into distinct Application, Data, and Management subnets with perimeter firewalls.',
    });
  }

  // 2. Potential Single Points of Failure (ARCH-006)
  const spofs = architectureAnalysis.dependencyAnalysis.singlePointsOfFailure;
  for (const spof of spofs) {
    warnings.push({
      id: `WARN-SPOF-${spof.nodeId}`,
      title: `Potential Single Point of Failure: ${spof.nodeName}`,
      category: 'resilience',
      explanation: `Only one instance of ${spof.nodeName} (${spof.role}) is modeled. If un-replicated in production, failure directly disrupts ${spof.dependentNodeIds.length} dependent component(s).`,
      evidence: ['ARCH-006', `${spof.dependentNodeIds.length} dependents`, spof.nodeId],
      affectedNodeIds: [spof.nodeId, ...spof.dependentNodeIds].slice().sort(),
      affectedEdgeIds: [],
      recommendation: 'Evaluate whether this component requires multi-node clustering, load balancing, or failover redundancy in production.',
    });
  }

  // 3. High Dependency Concentration (ARCH-005)
  if (architectureAnalysis.dependencyAnalysis.concentrationRating === 'high') {
    const highDepFinding = architectureAnalysis.findings.find((f) => f.id === 'ARCH-005');
    warnings.push({
      id: 'WARN-DEPENDENCY-CONCENTRATION',
      title: 'High Centralized Dependency Concentration',
      category: 'resilience',
      explanation: 'Critical infrastructure components handle an unusually high volume of inbound/outbound connections, creating architectural bottlenecks.',
      evidence: ['ARCH-005', ...(highDepFinding?.affectedNodeIds ?? [])],
      affectedNodeIds: (highDepFinding?.affectedNodeIds ?? []).slice().sort(),
      affectedEdgeIds: [],
      recommendation: 'Distribute connectivity across intermediary services or horizontal pools.',
    });
  }

  // 4. Weak Perimeter Segmentation (ARCH-007)
  const weakPerimeter = architectureAnalysis.findings.find((f) => f.id === 'ARCH-007');
  if (weakPerimeter) {
    warnings.push({
      id: 'WARN-WEAK-PERIMETER',
      title: 'Direct Untrusted Ingress to Compute Workloads',
      category: 'architecture',
      explanation: 'Compute workloads receive traffic directly from public ingress without intermediate firewall inspection or reverse proxy filtering.',
      evidence: ['ARCH-007', ...weakPerimeter.affectedNodeIds],
      affectedNodeIds: weakPerimeter.affectedNodeIds.slice().sort(),
      affectedEdgeIds: weakPerimeter.affectedEdgeIds.slice().sort(),
      recommendation: 'Route untrusted ingress through a perimeter firewall or DMZ load balancer before reaching compute tiers.',
    });
  }

  // 5. Overly Broad Access / Wildcard Ports (PF-007)
  const broadAccess = validationResult?.findings.filter((f) => f.ruleId === 'PF-007') ?? [];
  for (const b of broadAccess) {
    warnings.push({
      id: `WARN-BROAD-ACCESS-${b.id}`,
      title: b.title,
      category: 'access-control',
      explanation: b.whyItMatters,
      evidence: ['PF-007', ...b.affectedNodes],
      affectedNodeIds: b.affectedNodes.slice().sort(),
      affectedEdgeIds: b.affectedEdges.slice().sort(),
      recommendation: b.recommendation,
    });
  }

  return warnings.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Deterministically discovers observable architectural strengths supported by the model.
 */
export function buildReadinessStrengths(ctx: AssessmentBuilderContext): string[] {
  const { environment, validationResult, attackPathAnalysis, architectureAnalysis } = ctx;
  const findings = validationResult?.findings ?? [];
  const edges = environment.getEdges();
  const nodes = environment.getNodes();
  const strengths: string[] = [];

  // 1. Zero Critical Findings
  const criticalFindings = findings.filter((f) => f.severity === 'critical');
  if (criticalFindings.length === 0 && nodes.length > 0) {
    strengths.push('Zero critical security rule violations detected across the modeled graph.');
  }

  // 2. Zero Critical Attack Paths
  const criticalPaths = attackPathAnalysis.attackPaths.filter((p) => p.risk === 'critical');
  if (criticalPaths.length === 0 && attackPathAnalysis.entryPoints.length > 0) {
    strengths.push('No direct or critical adversarial attack paths reach sensitive crown-jewel assets.');
  }

  // 3. No Direct Ingress to Data
  if (!architectureAnalysis.tierAnalysis.hasDirectEdgeToData) {
    strengths.push('Data stores are isolated from direct external ingress by intermediate application tiers.');
  }

  // 4. Encrypted Sensitive Traffic
  const sensitiveEdges = edges.filter((e) => {
    if (e.access === 'deny') return false;
    const target = environment.getNode(e.target);
    return target && (target.type === 'database' || target.type === 'redis' || target.zone === 'restricted');
  });
  if (sensitiveEdges.length > 0 && sensitiveEdges.every((e) => e.encrypted)) {
    strengths.push('All modeled communication channels to sensitive data stores enforce transport encryption (TLS/SSH).');
  }

  // 5. Perimeter Defenses in Place
  const hasPerimeter = nodes.some((n) => n.type === 'firewall' || n.type === 'load_balancer');
  if (hasPerimeter) {
    strengths.push('Dedicated perimeter inspection components (firewall / load balancer) mediate ingress traffic.');
  }

  // 6. Isolated Management Plane
  const hasUntrustedMgmt = architectureAnalysis.findings.some((f) => f.id === 'ARCH-004');
  const hasMgmtNode = nodes.some((n) => n.zone === 'management' || n.type === 'admin');
  if (hasMgmtNode && !hasUntrustedMgmt) {
    strengths.push('Administrative and management systems are isolated from untrusted ingress networks.');
  }

  // 7. Strong or Moderate Segmentation
  const seg = architectureAnalysis.topologyAnalysis.segmentationQuality;
  if (seg === 'strong') {
    strengths.push('Network topology enforces strong multi-zone isolation across distinct trust domains.');
  } else if (seg === 'moderate') {
    strengths.push('Network topology maintains distinct zone boundaries between public and internal workloads.');
  }

  return strengths.sort();
}

/**
 * Returns the 10 explicit operational controls not verifiable from the modeled graph.
 */
export function getUnverifiedControls(): UnverifiedControl[] {
  return [
    {
      id: 'backup',
      name: 'Backup & Recovery Schedule',
      category: 'Data Protection',
      description: 'Automated database backups, snapshot intervals, offsite replication, and restore procedures.',
      rationale: 'Evidence gap: Backup mechanisms and restore retention schedules cannot be verified from network topology models.',
    },
    {
      id: 'disaster_recovery',
      name: 'Disaster Recovery & Failover',
      category: 'Business Continuity',
      description: 'Multi-region failover automation, recovery time objectives (RTO), and recovery point objectives (RPO).',
      rationale: 'Evidence gap: Multi-region failover automation and physical geographic redundancy are not represented in the graph.',
    },
    {
      id: 'monitoring',
      name: 'Observability & Metrics Telemetry',
      category: 'Operations',
      description: 'Distributed tracing, log shipping, APM telemetry, and node resource monitoring agents.',
      rationale: 'Evidence gap: Telemetry collection daemons and logging pipelines are not modeled as network components.',
    },
    {
      id: 'alerting',
      name: 'Security Alerting & On-Call Routing',
      category: 'Operations',
      description: 'Security incident alert rules, paging escalations, and automated anomaly detection.',
      rationale: 'Evidence gap: Alert routing schedules and PagerDuty/webhook dispatch rules are outside network topology scope.',
    },
    {
      id: 'patch_management',
      name: 'OS & Vulnerability Patching',
      category: 'Vulnerability Management',
      description: 'Host operating system update cadences, kernel patching policies, and dependency vulnerability scans.',
      rationale: 'Evidence gap: Machine image maintenance policies and patch deployment workflows cannot be verified from architecture diagrams.',
    },
    {
      id: 'secret_rotation',
      name: 'Secret & Credential Rotation',
      category: 'Identity & Access',
      description: 'Automated KMS key rotation, database password renewal, and ephemeral token lifetimes.',
      rationale: 'Evidence gap: Secret manager configurations and token lifetime lifecycles are outside structural topology.',
    },
    {
      id: 'identity_authentication',
      name: 'Identity, MFA & SSO Federation',
      category: 'Identity & Access',
      description: 'Multi-factor authentication (MFA), SAML/OIDC single sign-on federation, and RBAC directory integration.',
      rationale: 'Evidence gap: Authentication protocol implementations and identity provider integrations are not modeled.',
    },
    {
      id: 'incident_response',
      name: 'Incident Response Playbooks',
      category: 'Security Governance',
      description: 'Documented security incident response runbooks, tabletop exercises, and forensic audit logging.',
      rationale: 'Evidence gap: Organizational security governance and incident handling procedures cannot be observed from infrastructure graphs.',
    },
    {
      id: 'deployment_controls',
      name: 'CI/CD Deployment Gates & Artifact Signing',
      category: 'Supply Chain',
      description: 'Signed container image enforcement, pipeline approval gates, and software bill of materials (SBOM).',
      rationale: 'Evidence gap: Software delivery pipelines and build provenance verification are external to modeled environments.',
    },
    {
      id: 'runtime_health',
      name: 'Runtime Process & Daemon Health',
      category: 'Reliability',
      description: 'Container health probes, memory leak monitoring, CPU throttling, and kernel crash recovery.',
      rationale: 'Evidence gap: Live daemon runtime states and memory usage cannot be established from virtual topology graphs.',
    },
  ];
}

/**
 * Deterministically constructs traceable evidence records from all analysis sources.
 */
export function buildEvidenceRecords(ctx: AssessmentBuilderContext): ReadinessEvidenceRecord[] {
  const { validationResult, attackPathAnalysis, architectureAnalysis } = ctx;
  const records: ReadinessEvidenceRecord[] = [];

  // Validation Evidence
  for (const f of validationResult?.findings ?? []) {
    records.push({
      id: `EV-VAL-${f.id}`,
      source: 'validation',
      category: f.severity === 'critical' ? 'security' : 'access-control',
      item: f.ruleId,
      details: `${f.title} (${f.severity}) on ${f.affectedNodes.join(', ')}`,
    });
  }

  // Attack Path Evidence
  for (const p of attackPathAnalysis.attackPaths) {
    records.push({
      id: `EV-PATH-${p.id}`,
      source: 'attack-path',
      category: 'attack-exposure',
      item: p.id,
      details: `Traverses ${p.entryPoint.name} -> ${p.target.name} (${p.risk}, Score: ${p.riskScore})`,
    });
  }

  // Architecture Evidence
  for (const f of architectureAnalysis.findings) {
    records.push({
      id: `EV-ARCH-${f.id}`,
      source: 'architecture',
      category: 'architecture',
      item: f.id,
      details: `${f.title} (${f.severity})`,
    });
  }

  return records.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Synthesizes actionable recommended next steps derived from blocking reasons and warnings.
 */
export function buildRecommendedNextSteps(
  blockingReasons: readonly BlockingReason[],
  warnings: readonly ReadinessWarning[]
): string[] {
  const steps: string[] = [];

  for (const b of blockingReasons) {
    if (b.recommendation && !steps.includes(b.recommendation)) {
      steps.push(b.recommendation);
    }
  }

  for (const w of warnings) {
    if (w.recommendation && !steps.includes(w.recommendation)) {
      steps.push(w.recommendation);
    }
  }

  if (steps.length === 0) {
    steps.push('Maintain verified security boundaries and monitor dependencies for drift.');
    steps.push('Validate runtime operational controls (backups, observability, disaster recovery) prior to deployment.');
  }

  return steps.slice(0, 5);
}

/**
 * Formulates a clear executive verdict with cautious engineering language.
 */
export function buildExecutiveVerdict(
  status: ProductionReadinessStatus,
  score: number,
  rating: ProductionReadinessRating,
  blockingReasons: readonly BlockingReason[],
  warnings: readonly ReadinessWarning[]
): string {
  if (status === 'INSUFFICIENT_EVIDENCE') {
    return 'Based on the modeled infrastructure: Insufficient topology components modeled to determine production readiness.';
  }

  if (status === 'NOT_READY') {
    return `Based on the modeled infrastructure: The environment is NOT production-ready due to ${blockingReasons.length} blocking security or architectural issue(s). Readiness Score: ${score}/100 (${rating}). Note: This assessment cannot verify controls that are not represented in the model.`;
  }

  if (status === 'READY_WITH_WARNINGS') {
    return `Based on the modeled infrastructure: The environment is conditionally ready with ${warnings.length} operational or resilience warning(s). Readiness Score: ${score}/100 (${rating}). Actual redundancy and operational controls require separate verification.`;
  }

  return `Based on the modeled infrastructure: All modeled security and architectural production gates are satisfied. Readiness Score: ${score}/100 (${rating}). Note: Operational runtime controls (backups, monitoring, patching) are unverified in the graph model.`;
}
