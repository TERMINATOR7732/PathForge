import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class ServiceConnectionMismatchRule implements ValidationRule {
  readonly id = 'PF-009';
  readonly name = 'Service / Connection Mismatch';
  readonly category = 'topology_anomaly';
  readonly defaultSeverity = 'medium';
  readonly description =
    'Detects unambiguous configuration anomalies where connection ports or protocols conflict with explicit target service configurations.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    for (const edge of graph.getEdges()) {
      // Denied edges or wildcard definitions are not evaluated for exact service port mismatch
      if (edge.access === 'deny') continue;
      if (edge.ports === 'ANY' || edge.portConfig.type === 'any') continue;
      if (edge.protocol.toUpperCase() === 'ANY') continue;

      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      if (!source || !target) continue;

      let expectedPort: number | undefined;
      let serviceLabel: string | undefined;

      // 1. Explicit service definition on target
      if (target.service?.port !== undefined) {
        expectedPort = target.service.port;
        serviceLabel = target.service.name ?? `${target.name} service`;
      } else if (target.type === 'redis') {
        expectedPort = 6379;
        serviceLabel = 'Redis cache';
      } else if (
        target.type === 'database' &&
        (target.name.toLowerCase().includes('postgres') ||
          target.name.toLowerCase().includes('pgsql'))
      ) {
        expectedPort = 5432;
        serviceLabel = 'PostgreSQL';
      }

      if (expectedPort !== undefined) {
        // Check if edge allows the expected port
        if (!edge.allowsPort(expectedPort)) {
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
            encrypted: edge.encrypted,
            expectedPort,
            serviceLabel,
          };

          findings.push({
            id: `PF-009-mismatch-${edge.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: `Medium: Service Connection Mismatch (${source.name} → ${target.name})`,
            description: `Edge "${edge.id}" communicates over ${edge.protocol}:${edge.ports}, but target component "${target.name}" is configured for ${serviceLabel} on port ${expectedPort}.`,
            whyItMatters:
              'Mismatch between edge communication parameters and target service listeners results in dropped packets, connection resets, or unintended routing to dormant processes in production environments.',
            impact:
              'Service reachability failure or unintentional communication with unexpected host processes.',
            affectedNodes: [source.id, target.id],
            affectedEdges: [edge.id],
            recommendation:
              `Align edge protocol and port definitions with the target listening service port (${expectedPort}).`,
            remediation:
              `Update edge "${edge.id}" ports to target port ${expectedPort} (${edge.protocol}).`,
            evidence,
            metadata: { ...evidence },
          });
        }
      }
    }

    return findings;
  }
}
