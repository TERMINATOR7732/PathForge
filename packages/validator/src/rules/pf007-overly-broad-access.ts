import { Finding } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class OverlyBroadAccessRule implements ValidationRule {
  readonly id = 'PF-007';
  readonly name = 'Overly Broad Access';
  readonly category = 'access_control';
  readonly defaultSeverity = 'high';
  readonly description =
    'Detects wildcard port/protocol assignments and unencrypted protocols traversing trust boundaries.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    for (const edge of graph.getEdges()) {
      const ports = edge.metadata?.ports?.trim().toLowerCase();
      const protocol = edge.metadata?.protocol?.trim().toLowerCase();
      const encrypted = edge.metadata?.encrypted;

      const isWildcardPort =
        ports === '*' || ports === 'all' || ports === 'any' || ports === '1-65535' || ports === '0-65535';
      const isWildcardProtocol =
        protocol === '*' || protocol === 'all' || protocol === 'any';

      if (isWildcardPort || isWildcardProtocol) {
        findings.push({
          id: `PF-007-wildcard-${edge.id}`,
          ruleId: this.id,
          severity: this.defaultSeverity,
          category: this.category,
          title: `High: Overly Permissive Wildcard Access (${edge.source} → ${edge.target})`,
          description: `Edge "${edge.id}" specifies unrestricted ports (${ports ?? 'default'}) or protocols (${protocol ?? 'default'}).`,
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
        });
      }

      // Check unencrypted protocol from public / internet sources
      const sourceNode = graph.getNode(edge.source);
      if (
        (sourceNode?.type === 'internet' || sourceNode?.type === 'external_network') &&
        (protocol === 'http' || protocol === 'telnet' || protocol === 'ftp' || encrypted === false)
      ) {
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
        });
      }
    }

    return findings;
  }
}
