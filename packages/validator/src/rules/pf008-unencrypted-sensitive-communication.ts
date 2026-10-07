import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

const SENSITIVE_DB_PORTS = [5432, 3306, 27017, 6379, 1433];

export class UnencryptedSensitiveCommunicationRule implements ValidationRule {
  readonly id = 'PF-008';
  readonly name = 'Unencrypted Sensitive Communication';
  readonly category = 'access_control';
  readonly defaultSeverity = 'high';
  readonly description =
    'Detects unencrypted communication channels carrying traffic into sensitive data stores, restricted zones, or critical infrastructure components.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    for (const edge of graph.getEdges()) {
      // Denied edges transmit no traffic
      if (edge.access === 'deny') continue;

      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      if (!source || !target) continue;

      const proto = edge.protocol.toUpperCase();
      const isEncryptedProtocol = proto === 'HTTPS' || proto === 'SSH' || proto === 'TLS';
      const isEncrypted = edge.encrypted || (isEncryptedProtocol && edge.metadata.encrypted !== false);

      // If channel is encrypted, it satisfies security policy
      if (isEncrypted) continue;

      // Determine sensitivity of target asset
      const isTargetDatabase = target.type === 'database' || target.type === 'redis';
      const isTargetRestrictedZone = target.zone === 'restricted';
      const isTargetCritical = target.criticality === 'critical' || target.criticality === 'high';
      const isTargetDbPort =
        target.service?.port !== undefined && SENSITIVE_DB_PORTS.includes(target.service.port);
      const isEdgeTargetingDbPort =
        SENSITIVE_DB_PORTS.some((port) => edge.allowsPort(port));

      const isSensitiveTarget =
        isTargetDatabase ||
        isTargetRestrictedZone ||
        isTargetCritical ||
        isTargetDbPort ||
        isEdgeTargetingDbPort;

      if (!isSensitiveTarget) continue;

      const isSourceUntrusted =
        source.type === 'internet' ||
        source.type === 'external_network' ||
        source.zone === 'public';

      const isSourceDmz = source.zone === 'dmz';

      // Determine severity based on trust boundary traversed
      let severity: 'high' | 'medium';
      if (isSourceUntrusted || (isSourceDmz && (isTargetDatabase || isTargetRestrictedZone || isTargetCritical))) {
        severity = 'high';
      } else {
        severity = 'medium';
      }

      const evidence: FindingEvidence = {
        sourceNode: source.id,
        sourceName: source.name,
        sourceZone: source.zone,
        targetNode: target.id,
        targetName: target.name,
        targetZone: target.zone,
        targetCriticality: target.criticality,
        protocol: edge.protocol,
        ports: edge.ports,
        access: edge.access,
        encrypted: false,
      };

      findings.push({
        id: `PF-008-unencrypted-${edge.id}`,
        ruleId: this.id,
        severity,
        category: this.category,
        title: `${severity === 'high' ? 'High' : 'Medium'}: Unencrypted Sensitive Communication (${source.name} → ${target.name})`,
        description: `Connection from "${source.name}" to sensitive asset "${target.name}" transmits unencrypted traffic over ${edge.protocol}:${edge.ports} (Target Zone: ${target.zone}, Criticality: ${target.criticality}).`,
        whyItMatters:
          'Sensitive infrastructure components—especially database clusters, authentication brokers, and restricted business services—handle credentials, tokens, and confidential records. Transmitting this data over unencrypted channels exposes it to interception, eavesdropping, and man-in-the-middle manipulation.',
        impact:
          'Adversaries with physical access, compromised proxies, or lateral presence on intermediate network hops can inspect cleartext traffic, harvest database credentials, or tamper with payload contents.',
        affectedNodes: [source.id, target.id],
        affectedEdges: [edge.id],
        recommendation:
          'Enforce TLS/SSL or SSH transport encryption across all communication paths reaching sensitive or restricted tiers.',
        remediation:
          `Enable encryption on edge "${edge.id}" (set encrypted: true or adopt a TLS-secured protocol such as HTTPS/TLS).`,
        evidence,
        metadata: { ...evidence },
      });
    }

    return findings;
  }
}
