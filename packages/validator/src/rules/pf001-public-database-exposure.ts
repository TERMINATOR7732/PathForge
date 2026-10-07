import { Finding } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class PublicDatabaseExposureRule implements ValidationRule {
  readonly id = 'PF-001';
  readonly name = 'Public Database Exposure';
  readonly category = 'exposure';
  readonly defaultSeverity = 'critical';
  readonly description =
    'Detects direct network ingress from untrusted public networks to database or cache nodes.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    const publicSources = graph
      .getNodes()
      .filter((n) => n.type === 'internet' || n.type === 'external_network' || n.metadata.zone === 'public');

    const dataNodes = graph
      .getNodes()
      .filter((n) => n.type === 'database' || n.type === 'redis');

    for (const source of publicSources) {
      for (const target of dataNodes) {
        const directEdges = graph.getDirectEdges(source.id, target.id);
        if (directEdges.length > 0) {
          const edgeIds = directEdges.map((e) => e.id);
          findings.push({
            id: `PF-001-${source.id}-${target.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: `Critical: Public Database Exposure (${source.name} → ${target.name})`,
            description: `A direct connection was found from untrusted node "${source.name}" to data node "${target.name}".`,
            whyItMatters:
              'Databases and in-memory caches must never be directly exposed to the public Internet or untrusted external networks. They lack hardened public-facing application layers and Web Application Firewall (WAF) mitigations.',
            impact:
              'Remote unauthenticated attackers can probe database ports, attempt brute-force authentication, exploit known database engine CVEs, or directly exfiltrate sensitive persisted records without traversing application authorization boundaries.',
            affectedNodes: [source.id, target.id],
            affectedEdges: edgeIds,
            recommendation:
              'Route all traffic through a secure DMZ tier (Firewall → Load Balancer → Web/API App Server) and relocate the database into an isolated private network segment accessible only by authenticated application services.',
            remediation:
              `Delete direct edge(s) [${edgeIds.join(', ')}] connecting "${source.name}" to "${target.name}". Connect the application tier to "${target.name}" instead.`,
          });
        }
      }
    }

    return findings;
  }
}
