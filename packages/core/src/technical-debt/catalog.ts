import { TechnicalDebtDefinition } from './types.js';

/**
 * Authoritative deterministic catalog of technical debt patterns in PathForge.
 *
 * Distinguishes current security vulnerabilities from long-term architectural
 * debt, operational fragility, maintenance burden, and future change risks.
 */
export const TECHNICAL_DEBT_CATALOG: readonly TechnicalDebtDefinition[] = [
  // ==========================================
  // Category 1: Security Debt
  // ==========================================
  {
    id: 'TD-001',
    title: 'Public Sensitive Asset Exposure',
    category: 'security-debt',
    baseSeverity: 'CRITICAL',
    summary: 'Sensitive databases or persistence tiers are exposed directly to public ingress.',
    whyItMatters:
      'Public sensitive access creates a persistent architectural compromise that increases long-term security maintenance burden and requires fragile downstream defensive controls elsewhere.',
    debtImpact: 'security-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'validation',
    recommendation: 'Eliminate direct public ingress to databases by routing traffic through dedicated DMZ load balancers and internal API application tiers.',
  },
  {
    id: 'TD-002',
    title: 'Unencrypted Sensitive Communication',
    category: 'security-debt',
    baseSeverity: 'CRITICAL',
    summary: 'Communication channels to sensitive data stores transmit plaintext unencrypted traffic.',
    whyItMatters:
      'Cleartext transport requires treating intermediate network links as zero-trust liabilities, complicating future packet inspection and network re-architecting.',
    debtImpact: 'security-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'validation',
    recommendation: 'Mandate transport-layer cryptographic encryption (TLS/SSH) on all links carrying sensitive data.',
  },
  {
    id: 'TD-003',
    title: 'Excessive Trust Relationship',
    category: 'security-debt',
    baseSeverity: 'HIGH',
    summary: 'Overly permissive trust relationships bypass intermediate perimeter enforcement.',
    whyItMatters:
      'Implicit trust relationships erode defense-in-depth, turning localized perimeter compromises into broad internal breaches.',
    debtImpact: 'security-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'validation',
    recommendation: 'Replace implicit inter-zone trust relationships with explicit, inspected boundary gateway policies.',
  },
  {
    id: 'TD-004',
    title: 'Broad Network Access',
    category: 'security-debt',
    baseSeverity: 'HIGH',
    summary: 'Network links permit wide port ranges or permissive access policies without least-privilege scoping.',
    whyItMatters:
      'Overly broad access rules make future auditing difficult and increase the chance that newly deployed services accidentally inherit exposure.',
    debtImpact: 'change-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'validation',
    recommendation: 'Restrict connection rules to explicit destination ports and protocols strictly required by the target workload.',
  },

  // ==========================================
  // Category 2: Architecture Debt
  // ==========================================
  {
    id: 'TD-005',
    title: 'Flat Network Architecture',
    category: 'architecture-debt',
    baseSeverity: 'HIGH',
    summary: 'Internal workloads share an unsegmented network zone without perimeter boundaries.',
    whyItMatters:
      'Lack of segmentation increases the number of future changes that require careful access-control coordination and expands lateral-movement risk.',
    debtImpact: 'complexity-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'architecture',
    recommendation: 'Partition components into distinct tiers (DMZ, application, data) separated by explicit inspection gateways.',
  },
  {
    id: 'TD-006',
    title: 'Tier Bypass',
    category: 'architecture-debt',
    baseSeverity: 'CRITICAL',
    summary: 'Direct communication paths cross multiple tiers, bypassing application mediation.',
    whyItMatters:
      'Tier bypassing breaks the architectural layering contract, preventing independent scalability, auditing, and maintenance of intermediate tiers.',
    debtImpact: 'change-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'architecture',
    recommendation: 'Enforce strict multi-tier request mediation: client requests must terminate at application services before querying persistence.',
  },
  {
    id: 'TD-007',
    title: 'Weak Perimeter Segmentation',
    category: 'architecture-debt',
    baseSeverity: 'HIGH',
    summary: 'Public ingress communicates with compute workloads without perimeter firewall or reverse proxy inspection.',
    whyItMatters:
      'Direct perimeter exposure turns application compute nodes into frontline firewalls, increasing workload vulnerability to protocol exploits.',
    debtImpact: 'security-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'architecture',
    recommendation: 'Deploy dedicated perimeter firewalls and reverse-proxy load balancers at the ingress boundary.',
  },
  {
    id: 'TD-008',
    title: 'Dependency Concentration',
    category: 'architecture-debt',
    baseSeverity: 'MEDIUM',
    summary: 'An excessive number of workloads depend directly on a single centralized component.',
    whyItMatters:
      'Future changes to that component have a larger blast radius and require broader regression validation across dependent services.',
    debtImpact: 'change-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'architecture',
    recommendation: 'Decouple tightly bound services using asynchronous event queues, microservices, or read-replica clusters.',
  },

  // ==========================================
  // Category 3: Resilience Debt
  // ==========================================
  {
    id: 'TD-009',
    title: 'Potential Single Point of Failure',
    category: 'resilience-debt',
    baseSeverity: 'HIGH',
    summary: 'A critical workload operates without visible redundancy or failover clustering.',
    whyItMatters:
      'Outages or maintenance on non-redundant components cause immediate service interruption and prevent zero-downtime maintenance.',
    debtImpact: 'resilience-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'architecture',
    recommendation: 'Introduce multi-node clustering, active-standby redundancy, or distributed availability sets for critical assets.',
  },
  {
    id: 'TD-010',
    title: 'Critical Dependency Concentration',
    category: 'resilience-debt',
    baseSeverity: 'HIGH',
    summary: 'Critical-tier services concentrate dependencies into a shared un-replicated bottleneck.',
    whyItMatters:
      'High architectural coupling on critical pathways amplifies cascading system failures during partial infrastructure outages.',
    debtImpact: 'resilience-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'architecture',
    recommendation: 'Isolate critical dependencies and provide dedicated fallback pathways or isolated tenant stores.',
  },

  // ==========================================
  // Category 4: Access-Control Debt
  // ==========================================
  {
    id: 'TD-011',
    title: 'Wildcard Access',
    category: 'access-control-debt',
    baseSeverity: 'CRITICAL',
    summary: 'Network links permit wildcard ANY protocol or ANY port traffic.',
    whyItMatters:
      'Future service changes can inherit unintended reachability because access boundaries are not explicit or defensively constrained.',
    debtImpact: 'change-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'validation',
    recommendation: 'Replace wildcard ANY port allowances with explicit, granular protocol and port definitions.',
  },
  {
    id: 'TD-012',
    title: 'Excessive Administrative Reachability',
    category: 'access-control-debt',
    baseSeverity: 'HIGH',
    summary: 'Administrative management interfaces (SSH/RDP) are reachable across general network paths.',
    whyItMatters:
      'Dispersed administrative access increases the credential stuffing surface and makes management-plane access auditing complex.',
    debtImpact: 'security-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'validation',
    recommendation: 'Isolate management ports within an authorized Management zone accessible solely through authenticated bastion hosts.',
  },
  {
    id: 'TD-013',
    title: 'Overly Broad Protocol/Port Access',
    category: 'access-control-debt',
    baseSeverity: 'MEDIUM',
    summary: 'Allowed port ranges permit unused ports between communicating services.',
    whyItMatters:
      'Excess open ports increase the likelihood that shadow services or debugging daemons accidentally become reachable.',
    debtImpact: 'change-risk',
    futureChangeImpact: 'LOW',
    defaultSource: 'validation',
    recommendation: 'Tighten port ranges to the minimum set of ports actively bound by validated services.',
  },

  // ==========================================
  // Category 5: Testing Debt
  // ==========================================
  {
    id: 'TD-014',
    title: 'Missing Critical Verification Coverage',
    category: 'testing-debt',
    baseSeverity: 'HIGH',
    summary: 'A critical security or architecture property lacks automated verification evidence.',
    whyItMatters:
      'A critical security property currently lacks verification evidence, increasing regression risk during infrastructure changes.',
    debtImpact: 'regression-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'testing-intelligence',
    recommendation: 'Add dedicated scenario verification tests that explicitly exercise the critical security property.',
  },
  {
    id: 'TD-015',
    title: 'Missing Regression Baseline',
    category: 'testing-debt',
    baseSeverity: 'MEDIUM',
    summary: 'The environment has no immutable validated baseline snapshot established.',
    whyItMatters:
      'Future topology modifications cannot be mathematically verified against regressions without a verified historical baseline.',
    debtImpact: 'regression-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'testing-intelligence',
    recommendation: 'Execute a validation and remediation cycle to capture an immutable validated environment baseline.',
  },
  {
    id: 'TD-016',
    title: 'Unverified High-Risk Property',
    category: 'testing-debt',
    baseSeverity: 'MEDIUM',
    summary: 'A high-importance security assumption has only partial or missing verification evidence.',
    whyItMatters:
      'Future topology changes may silently regress high-risk security properties without automated regression detection.',
    debtImpact: 'regression-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'testing-intelligence',
    recommendation: 'Formulate explicit verification scenarios to provide full evidence for high-risk properties.',
  },

  // ==========================================
  // Category 6: Operational Debt
  // ==========================================
  {
    id: 'TD-017',
    title: 'Missing Operational Evidence',
    category: 'operational-debt',
    baseSeverity: 'MEDIUM',
    summary: 'Operational controls are unrepresented in the modeled infrastructure.',
    whyItMatters:
      'Infrastructure models lacking operational definitions risk false confidence regarding runtime stability and observability.',
    debtImpact: 'operational-risk',
    futureChangeImpact: 'LOW',
    defaultSource: 'production-readiness',
    recommendation: 'Document and link operational procedures, deployment policies, and runtime health checks.',
  },
  {
    id: 'TD-018',
    title: 'Unverified Recovery Controls',
    category: 'operational-debt',
    baseSeverity: 'LOW',
    summary: 'Backup, snapshot, and disaster recovery procedures are unmodeled and unverified.',
    whyItMatters:
      'Data corruption or component failure recovery cannot be validated from topological models alone.',
    debtImpact: 'operational-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'production-readiness',
    recommendation: 'Establish and verify automated persistence backups and disaster recovery failover runbooks.',
  },
  {
    id: 'TD-019',
    title: 'Unverified Monitoring/Alerting',
    category: 'operational-debt',
    baseSeverity: 'LOW',
    summary: 'Telemetry collection, metric monitoring, and security alerting channels are unmodeled.',
    whyItMatters:
      'Security breaches and performance degradation will lack real-time detection without observability pipelines.',
    debtImpact: 'operational-risk',
    futureChangeImpact: 'LOW',
    defaultSource: 'production-readiness',
    recommendation: 'Integrate observability sidecars, flow log collection, and centralized security event alerting.',
  },

  // ==========================================
  // Category 7: Complexity Debt
  // ==========================================
  {
    id: 'TD-020',
    title: 'High Connectivity Concentration',
    category: 'complexity-debt',
    baseSeverity: 'MEDIUM',
    summary: 'A hub component handles an disproportionately large share of inbound and outbound links.',
    whyItMatters:
      'Hub components increase mental overhead, making cognitive reasoning about change side-effects difficult for engineers.',
    debtImpact: 'complexity-risk',
    futureChangeImpact: 'HIGH',
    defaultSource: 'architecture',
    recommendation: 'Decompose monolithic network hubs into domain-specific subnets or distributed meshes.',
  },
  {
    id: 'TD-021',
    title: 'Excessive Trust Boundaries',
    category: 'complexity-debt',
    baseSeverity: 'LOW',
    summary: 'Paths traverse numerous micro-segmented boundaries with fragmented inspection.',
    whyItMatters:
      'Excessive micro-segmentation without centralized orchestration increases policy drift and administrative burden.',
    debtImpact: 'complexity-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'attack-path',
    recommendation: 'Consolidate redundant micro-zones into standardized architectural tiers.',
  },
  {
    id: 'TD-022',
    title: 'Infrastructure Topology Complexity',
    category: 'complexity-debt',
    baseSeverity: 'LOW',
    summary: 'High ratio of inter-component connections relative to modeled infrastructure nodes.',
    whyItMatters:
      'Mesh topologies with complex interdependencies are prone to unexpected feedback loops and configuration errors during deployment.',
    debtImpact: 'complexity-risk',
    futureChangeImpact: 'MEDIUM',
    defaultSource: 'topology',
    recommendation: 'Refactor cross-cutting service connections into well-defined hierarchical dependency trees.',
  },
];

/**
 * Helper to look up a technical debt definition by ID.
 */
export function getTechnicalDebtDefinition(id: string): TechnicalDebtDefinition | undefined {
  return TECHNICAL_DEBT_CATALOG.find((d) => d.id === id);
}
