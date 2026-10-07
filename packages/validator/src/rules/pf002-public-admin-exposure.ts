import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

const ADMIN_PORTS = [22, 3389, 23];

export class PublicAdminExposureRule implements ValidationRule {
  readonly id = 'PF-002';
  readonly name = 'Public Admin Exposure';
  readonly category = 'exposure';
  readonly defaultSeverity = 'high';
  readonly description =
    'Detects direct network exposure of administrative and management interfaces to untrusted public networks.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    // Untrusted public sources (exempts authorized management zone sources)
    const publicSources = graph
      .getNodes()
      .filter(
        (n) =>
          (n.type === 'internet' ||
            n.type === 'external_network' ||
            n.zone === 'public') &&
          n.zone !== 'management'
      );

    const allNodes = graph.getNodes();

    for (const source of publicSources) {
      for (const target of allNodes) {
        if (source.id === target.id) continue;

        const directEdges = graph.getDirectEdges(source.id, target.id);
        // Only active ALLOW edges constitute reachable exposure
        const allowEdges = directEdges.filter((e) => e.access !== 'deny');

        if (allowEdges.length === 0) continue;

        // Check if target is an administrative console or edge exposes an administrative port
        const isAdminTarget =
          target.type === 'admin' || target.zone === 'management';

        const adminEdge = allowEdges.find((e) => {
          if (isAdminTarget) return true;
          const proto = e.protocol.toUpperCase();
          if (proto === 'SSH' || proto === 'RDP' || proto === 'TELNET') return true;
          if (ADMIN_PORTS.some((port) => e.allowsPort(port))) return true;
          if (target.service?.port && ADMIN_PORTS.includes(target.service.port)) return true;
          return false;
        });

        if (adminEdge) {
          const edgeIds = allowEdges.map((e) => e.id);
          const evidence: FindingEvidence = {
            sourceNode: source.id,
            sourceName: source.name,
            sourceZone: source.zone,
            targetNode: target.id,
            targetName: target.name,
            targetZone: target.zone,
            targetCriticality: target.criticality,
            protocol: adminEdge.protocol,
            ports: adminEdge.ports,
            access: adminEdge.access,
            encrypted: adminEdge.encrypted,
          };

          const isDirectAdminConsole =
            target.type === 'admin' || target.zone === 'management';

          findings.push({
            id: `PF-002-${source.id}-${target.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: isDirectAdminConsole
              ? `High: Public Admin Interface Exposure (${source.name} → ${target.name})`
              : `High: Public Administrative Port Exposure (${source.name} → ${target.name})`,
            description: `Administrative interface "${target.name}" is directly accessible from untrusted source "${source.name}". Protocol: ${adminEdge.protocol}, Port: ${adminEdge.ports}, Access: ${adminEdge.access.toUpperCase()}, Target Zone: ${target.zone}.`,
            whyItMatters:
              'Administrative and management consoles possess elevated privileges capable of modifying system configurations, accessing secrets, or altering security controls. Exposing them to public networks invites credential stuffing and zero-day exploitation.',
            impact:
              'Full administrative takeover of the infrastructure component or underlying cluster, leading to unauthorized data modification, lateral movement, or denial of service.',
            affectedNodes: [source.id, target.id],
            affectedEdges: edgeIds,
            recommendation:
              'Place administrative consoles behind an authenticated VPN, bastion host, or zero-trust identity-aware proxy requiring multi-factor authentication (MFA).',
            remediation:
              `Remove direct edge(s) [${edgeIds.join(', ')}] and insert a VPN or secure bastion host between "${source.name}" and "${target.name}".`,
            evidence,
            metadata: { ...evidence },
          });
        }
      }
    }

    return findings;
  }
}
