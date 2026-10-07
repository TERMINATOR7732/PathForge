import { Finding } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

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

    const publicSources = graph
      .getNodes()
      .filter((n) => n.type === 'internet' || n.type === 'external_network' || n.metadata.zone === 'public');

    const adminNodes = graph.getNodesByType('admin');

    for (const source of publicSources) {
      for (const target of adminNodes) {
        const directEdges = graph.getDirectEdges(source.id, target.id);
        if (directEdges.length > 0) {
          const edgeIds = directEdges.map((e) => e.id);
          findings.push({
            id: `PF-002-${source.id}-${target.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: `High: Public Admin Interface Exposure (${source.name} → ${target.name})`,
            description: `Administrative interface "${target.name}" is directly accessible from untrusted source "${source.name}".`,
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
          });
        }
      }
    }

    return findings;
  }
}
