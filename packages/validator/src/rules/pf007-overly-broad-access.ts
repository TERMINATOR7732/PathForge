import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class OverlyBroadAccessRule implements ValidationRule {
  readonly id = 'PF-007';
  readonly name = 'Overly Broad Access';
  readonly category = 'access_control';
  readonly defaultSeverity = 'high';
  readonly description =
    'Detects wildcard port/protocol assignments on allow edges and unencrypted protocols traversing trust boundaries.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    for (const edge of graph.getEdges()) {
      // DENY edges are filtering rules, not overly broad reachable access
      if (edge.access === 'deny') continue;

      const sourceNode = graph.getNode(edge.source);
      const targetNode = graph.getNode(edge.target);
      if (!sourceNode || !targetNode) continue;

      const ports = edge.ports?.trim();
      const protocol = edge.protocol?.trim().toUpperCase();

      const isWildcardPort =
        edge.portConfig?.type === 'any' ||
        ports === '*' ||
        ports.toLowerCase() === 'all' ||
        ports.toUpperCase() === 'ANY' ||
        ports === '1-65535' ||
        ports === '0-65535';

      const isWildcardProtocol =
        protocol === '*' || protocol === 'ALL' || protocol === 'ANY';

      if (isWildcardPort || isWildcardProtocol) {
        const isSourceUntrusted =
          sourceNode.type === 'internet' ||
          sourceNode.type === 'external_network' ||
          sourceNode.zone === 'public';

        const isTargetSensitive =
          targetNode.zone === 'restricted' ||
          targetNode.zone === 'management' ||
          targetNode.criticality === 'critical' ||
          targetNode.criticality === 'high' ||
          targetNode.type === 'database' ||
          targetNode.type === 'admin' ||
          targetNode.type === 'api_server';

        // High severity for untrusted sources or sensitive targets; medium for internal low-risk
        const severity =
          isSourceUntrusted || isTargetSensitive ? 'high' : 'medium';

        const evidence: FindingEvidence = {
          sourceNode: sourceNode.id,
          sourceName: sourceNode.name,
          sourceZone: sourceNode.zone,
          targetNode: targetNode.id,
          targetName: targetNode.name,
          targetZone: targetNode.zone,
          targetCriticality: targetNode.criticality,
          protocol: edge.protocol,
          ports: edge.ports,
          access: edge.access,
          encrypted: edge.encrypted,
        };

        findings.push({
          id: `PF-007-wildcard-${edge.id}`,
          ruleId: this.id,
          severity,
          category: this.category,
          title: `${severity === 'high' ? 'High' : 'Medium'}: Overly Permissive Wildcard Access (${edge.source} → ${edge.target})`,
          description: `Edge "${edge.id}" specifies unrestricted ports (${ports ?? 'ANY'}) or protocols (${protocol ?? 'ANY'}) into ${targetNode.name} (${targetNode.zone}).`,
          whyItMatters:
            'Principle of Least Privilege mandates that network access rules permit only explicitly authorized destination ports and protocols. Wildcards allow attackers to reach ancillary or debugging services running on unmonitored ports.',
          impact:
            'Attackers can exploit secondary services (e.g. internal debug listeners, Redis on 6379, management daemons) using previously permitted edges.',
          affectedNodes: [edge.source, edge.target],
          affectedEdges: [edge.id],
          recommendation:
            'Replace wildcard port/protocol rules with strict, minimal service-specific definitions (e.g., TCP 443 for HTTPS).',
          remediation:
            `Change edge "${edge.id}" ports and protocol from wildcard to explicit target service ports.`,
          evidence,
          metadata: { ...evidence },
        });
      }

      // Check unencrypted cleartext protocol from public / internet sources
      if (
        (sourceNode.type === 'internet' ||
          sourceNode.type === 'external_network' ||
          sourceNode.zone === 'public') &&
        (protocol === 'HTTP' ||
          protocol === 'TELNET' ||
          protocol === 'FTP' ||
          edge.encrypted === false)
      ) {
        const evidence: FindingEvidence = {
          sourceNode: sourceNode.id,
          sourceName: sourceNode.name,
          sourceZone: sourceNode.zone,
          targetNode: targetNode.id,
          targetName: targetNode.name,
          targetZone: targetNode.zone,
          targetCriticality: targetNode.criticality,
          protocol: edge.protocol,
          ports: edge.ports,
          access: edge.access,
          encrypted: edge.encrypted,
        };

        findings.push({
          id: `PF-007-unencrypted-${edge.id}`,
          ruleId: this.id,
          severity: 'medium',
          category: this.category,
          title: `Medium: Cleartext Protocol Ingress (${edge.source} → ${edge.target})`,
          description: `Traffic from untrusted node "${edge.source}" uses unencrypted protocol "${protocol ?? 'unencrypted'}" across a perimeter boundary.`,
          whyItMatters:
            'Cleartext protocols expose session cookies, bearer tokens, passwords, and sensitive payload data to eavesdropping and man-in-the-middle (MitM) packet tampering.',
          impact:
            'Adversaries on intermediate networks can sniff credentials and tamper with requests in transit.',
          affectedNodes: [edge.source, edge.target],
          affectedEdges: [edge.id],
          recommendation:
            'Enforce TLS encryption (HTTPS/SSH) across all perimeter boundaries.',
          remediation:
            `Update edge "${edge.id}" metadata to protocol: 'https' and encrypted: true.`,
          evidence,
          metadata: { ...evidence },
        });
      }
    }

    return findings;
  }
}
