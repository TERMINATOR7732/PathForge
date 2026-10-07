import { SecurityPropertyDefinition } from './types.js';

/**
 * Authoritative deterministic catalog of testable infrastructure security
 * and architectural properties in PathForge.
 */
export const SECURITY_PROPERTY_CATALOG: readonly SecurityPropertyDefinition[] = [
  // ==========================================
  // Category 1: Network Security
  // ==========================================
  {
    id: 'public-ingress-control',
    name: 'Public Ingress Control',
    category: 'network-security',
    description: 'External untrusted ingress is constrained to designated perimeter entry points without bypassing edge filtering.',
    importance: 'critical',
    relatedRules: ['PF-003', 'PF-004'],
    relatedAnalysis: ['attack-path', 'architecture'],
    verificationStrategy: 'Verify that incoming traffic from public internet only terminates at authorized DMZ perimeter nodes (firewalls / reverse proxies).',
  },
  {
    id: 'database-isolation',
    name: 'Database Tier Isolation',
    category: 'network-security',
    description: 'Databases and persistence stores are isolated from public ingress and only accessible from authorized application compute nodes.',
    importance: 'critical',
    relatedRules: ['PF-001', 'PF-005'],
    relatedAnalysis: ['architecture', 'attack-path'],
    verificationStrategy: 'Verify that Internet ingress cannot reach the database directly and that expected API -> database pathways remain allowed.',
  },
  {
    id: 'management-plane-isolation',
    name: 'Management Plane Isolation',
    category: 'network-security',
    description: 'Administrative hosts, jump bastions, and management interfaces are isolated from untrusted ingress networks.',
    importance: 'high',
    relatedRules: ['PF-002'],
    relatedAnalysis: ['architecture'],
    verificationStrategy: 'Verify that untrusted ingress cannot reach administrative assets or management subnets.',
  },
  {
    id: 'network-segmentation',
    name: 'Trust Zone Segmentation',
    category: 'network-security',
    description: 'Infrastructure components are partitioned into distinct trust zones (public, DMZ, internal, restricted) with boundary enforcement.',
    importance: 'high',
    relatedRules: ['PF-003', 'PF-004'],
    relatedAnalysis: ['architecture', 'topology'],
    verificationStrategy: 'Verify that cross-zone transitions pass through explicit firewall or gateway mediation without unsegmented bridging.',
  },
  {
    id: 'deny-boundary-enforcement',
    name: 'DENY Boundary Packet Filtering',
    category: 'network-security',
    description: 'Configured DENY packet filtering rules deterministically block unauthorized reachability across network boundaries.',
    importance: 'high',
    relatedRules: ['PF-001', 'PF-004'],
    relatedAnalysis: ['attack-path', 'blast-radius'],
    verificationStrategy: 'Verify that DENY edges prevent traversal from source to target across network and attack path simulations.',
  },

  // ==========================================
  // Category 2: Communication Security
  // ==========================================
  {
    id: 'sensitive-traffic-encryption',
    name: 'Sensitive Traffic Transport Encryption',
    category: 'communication-security',
    description: 'Network communication terminating at databases, caches, or restricted zones enforces transport encryption (TLS/SSH).',
    importance: 'critical',
    relatedRules: ['PF-008'],
    relatedAnalysis: ['validation', 'attack-path'],
    verificationStrategy: 'Verify that all edges terminating at sensitive or restricted assets enforce encrypted transport (TLS/SSH) and reject cleartext.',
  },
  {
    id: 'secure-protocol-enforcement',
    name: 'Secure Application Protocol Enforcement',
    category: 'communication-security',
    description: 'Application services enforce cryptographic network protocols (HTTPS, SSH) rather than unencrypted legacy protocols (HTTP, Telnet).',
    importance: 'normal',
    relatedRules: ['PF-008', 'PF-009'],
    relatedAnalysis: ['validation'],
    verificationStrategy: 'Verify that edge and internal communication channels default to secure protocols across modeled flows.',
  },

  // ==========================================
  // Category 3: Access Control
  // ==========================================
  {
    id: 'least-privilege-access',
    name: 'Least-Privilege Port Constraints',
    category: 'access-control',
    description: 'Network edges restrict allowed access to specific discrete service ports rather than open port ranges.',
    importance: 'high',
    relatedRules: ['PF-007'],
    relatedAnalysis: ['validation', 'attack-path'],
    verificationStrategy: 'Verify that network link access policies specify exact port numbers and protocols matching listening services.',
  },
  {
    id: 'wildcard-access-prevention',
    name: 'Wildcard Port & Protocol Prevention',
    category: 'access-control',
    description: 'Permissive wildcard ANY ports or protocols on ALLOW edges reaching sensitive workloads are eliminated.',
    importance: 'high',
    relatedRules: ['PF-007'],
    relatedAnalysis: ['validation'],
    verificationStrategy: 'Verify that no ALLOW edges targeting sensitive or restricted workloads use wildcard ANY port or protocol rules.',
  },
  {
    id: 'administrative-access-restriction',
    name: 'Administrative Protocol Access Restrictions',
    category: 'access-control',
    description: 'Privileged remote access protocols (SSH :22, RDP :3389) are strictly confined to dedicated management zones.',
    importance: 'high',
    relatedRules: ['PF-002', 'PF-007'],
    relatedAnalysis: ['validation', 'architecture'],
    verificationStrategy: 'Verify that administrative listener ports are only accessible from nodes residing in an authorized management zone.',
  },

  // ==========================================
  // Category 4: Attack Resistance
  // ==========================================
  {
    id: 'critical-asset-reachability',
    name: 'Critical Asset Attack-Path Isolation',
    category: 'attack-resistance',
    description: 'High-criticality crown-jewel assets are unreachable through uninterrupted attack paths from untrusted ingress.',
    importance: 'critical',
    relatedRules: ['PF-001', 'PF-004'],
    relatedAnalysis: ['attack-path'],
    verificationStrategy: 'Verify that directed traversal from untrusted ingress entry points cannot reach assets rated with critical criticality.',
  },
  {
    id: 'high-risk-attack-path-prevention',
    name: 'High-Risk Attack-Path Elimination',
    category: 'attack-resistance',
    description: 'The modeled topology contains zero high-risk or critical-risk adversarial attack paths.',
    importance: 'critical',
    relatedRules: ['PF-001', 'PF-002', 'PF-004'],
    relatedAnalysis: ['attack-path'],
    verificationStrategy: 'Verify that no attack paths evaluate to a critical or high risk classification score.',
  },
  {
    id: 'lateral-movement-containment',
    name: 'Post-Compromise Lateral Movement Containment',
    category: 'attack-resistance',
    description: 'A compromised compute workload cannot laterally traverse across trust boundaries into restricted data stores.',
    importance: 'high',
    relatedRules: ['PF-005'],
    relatedAnalysis: ['blast-radius'],
    verificationStrategy: 'Simulate compromise on application nodes and verify lateral movement depth is bounded and barred from restricted zones.',
  },
  {
    id: 'blast-radius-control',
    name: 'Asset Blast Radius Boundedness',
    category: 'attack-resistance',
    description: 'The blast radius of individual compromised components is bounded and does not encompass all internal infrastructure.',
    importance: 'high',
    relatedRules: ['PF-006'],
    relatedAnalysis: ['blast-radius'],
    verificationStrategy: 'Verify that the reachable blast radius from any single compute asset is limited to immediate necessary dependencies.',
  },

  // ==========================================
  // Category 5: Architecture
  // ==========================================
  {
    id: 'tier-separation',
    name: 'Multi-Tier Layered Separation',
    category: 'architecture',
    description: 'Web presentation, API business logic, and database persistence operate in separate architectural tiers with unidirectional dependencies.',
    importance: 'high',
    relatedRules: ['PF-005'],
    relatedAnalysis: ['architecture'],
    verificationStrategy: 'Verify that edge workloads route through application microservices rather than querying databases directly.',
  },
  {
    id: 'dependency-concentration',
    name: 'Decentralized Dependency Distribution',
    category: 'architecture',
    description: 'Critical infrastructure workloads do not exhibit extreme single-node fan-in or centralized architectural bottlenecks.',
    importance: 'normal',
    relatedRules: [],
    relatedAnalysis: ['architecture'],
    verificationStrategy: 'Verify that in-degree and out-degree connectivity distributions do not create disproportionate single-node bottlenecks.',
  },
  {
    id: 'single-point-of-failure-detection',
    name: 'Single Point of Failure Redundancy Auditing',
    category: 'architecture',
    description: 'Critical components modeled as single instances without redundancy are identified for operational clustering.',
    importance: 'normal',
    relatedRules: [],
    relatedAnalysis: ['architecture'],
    verificationStrategy: 'Audit single points of failure supporting downstream services and verify resilience recommendations.',
  },
  {
    id: 'perimeter-boundary',
    name: 'DMZ Perimeter Inspection Mediation',
    category: 'architecture',
    description: 'Compute workloads receive external ingress solely through intermediate DMZ firewalls or reverse proxies.',
    importance: 'high',
    relatedRules: ['PF-003'],
    relatedAnalysis: ['architecture'],
    verificationStrategy: 'Verify that ingress edges pass through a firewall or load balancer before reaching internal compute clusters.',
  },

  // ==========================================
  // Category 6: Remediation & Integrity
  // ==========================================
  {
    id: 'finding-resolution-verification',
    name: 'Finding Resolution Mathematical Proof',
    category: 'remediation',
    description: 'Remediated infrastructure findings are explicitly revalidated against an immutable baseline and proven resolved.',
    importance: 'critical',
    relatedRules: ['PF-001', 'PF-002', 'PF-003', 'PF-004', 'PF-005', 'PF-006', 'PF-007', 'PF-008', 'PF-009'],
    relatedAnalysis: ['comparison'],
    verificationStrategy: 'Re-run validation after applying remediation to verify that previous finding IDs are mathematically eliminated.',
  },
  {
    id: 'regression-detection',
    name: 'Automated Security Regression Prevention',
    category: 'remediation',
    description: 'Topological modifications made during remediation or infrastructure updates introduce zero new security violations.',
    importance: 'critical',
    relatedRules: ['PF-001', 'PF-002', 'PF-003', 'PF-004', 'PF-005', 'PF-006', 'PF-007', 'PF-008', 'PF-009'],
    relatedAnalysis: ['comparison'],
    verificationStrategy: 'Compare baseline and current validation findings to guarantee that no new security findings have appeared.',
  },
];

/**
 * Retrieves a property definition by its ID.
 */
export function getSecurityPropertyById(id: string): SecurityPropertyDefinition | undefined {
  return SECURITY_PROPERTY_CATALOG.find((p) => p.id === id);
}

/**
 * Retrieves all properties belonging to a category.
 */
export function getSecurityPropertiesByCategory(
  category: SecurityPropertyDefinition['category']
): readonly SecurityPropertyDefinition[] {
  return SECURITY_PROPERTY_CATALOG.filter((p) => p.category === category);
}
