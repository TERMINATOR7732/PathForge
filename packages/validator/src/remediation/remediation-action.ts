import { Environment } from '@pathforge/core';
import { Finding } from '@pathforge/shared';

export type RemediationActionType =
  | 'deny-edge'
  | 'remove-edge'
  | 'enable-encryption'
  | 'restrict-port'
  | 'align-port'
  | 'manual';

export interface RemediationAction {
  id: string;
  type: RemediationActionType;
  title: string;
  description: string;
  impactSummary: string;
  targetEdgeId?: string;
  targetNodeId?: string;
  isAutomated: boolean;
  apply?: (environment: Environment) => boolean;
}

/**
 * Returns deterministic remediation actions for a given security finding.
 * PathForge core principle: Never simply flag a problem; provide clear, verifiable remediations.
 */
export function getRemediationActions(
  finding: Finding,
  environment: Environment
): RemediationAction[] {
  const actions: RemediationAction[] = [];
  const primaryEdgeId = finding.affectedEdges?.[0];
  const edge = primaryEdgeId ? environment.getEdge(primaryEdgeId) : undefined;
  const targetNode = edge ? environment.getNode(edge.target) : undefined;

  // Helper to create safe deny-edge action
  const createDenyAction = (
    title = 'Block Insecure Access (Set DENY)',
    desc = 'Update the connection access policy to DENY. This blocks network ingress while maintaining diagram documentation.',
    impact = 'Immediately updates the edge policy to DENY. Network traffic will be blocked.'
  ): RemediationAction => ({
    id: `remediate-deny-${primaryEdgeId}`,
    type: 'deny-edge',
    title,
    description: desc,
    impactSummary: impact,
    targetEdgeId: primaryEdgeId,
    isAutomated: true,
    apply: (env: Environment) => {
      if (!primaryEdgeId || !env.getEdge(primaryEdgeId)) return false;
      return env.updateEdgeConfig(primaryEdgeId, { access: 'deny' });
    },
  });

  // Helper to create safe remove-edge action
  const createRemoveAction = (
    title = 'Sever Connection (Delete Edge)',
    desc = 'Permanently delete this connection from the infrastructure graph.',
    impact = 'Deletes the edge entirely from the topology model.'
  ): RemediationAction => ({
    id: `remediate-remove-${primaryEdgeId}`,
    type: 'remove-edge',
    title,
    description: desc,
    impactSummary: impact,
    targetEdgeId: primaryEdgeId,
    isAutomated: true,
    apply: (env: Environment) => {
      if (!primaryEdgeId || !env.getEdge(primaryEdgeId)) return false;
      return env.removeEdge(primaryEdgeId);
    },
  });

  switch (finding.ruleId) {
    case 'PF-001': {
      // Public Database Exposure
      if (primaryEdgeId && edge) {
        actions.push(
          createDenyAction(
            'Block Public Access (DENY)',
            `Block direct public access from "${edge.source}" to database "${edge.target}" by setting the access policy to DENY.`,
            `Changes edge "${primaryEdgeId}" access from ALLOW to DENY. Direct database traffic will be blocked.`
          )
        );
        actions.push(
          createRemoveAction(
            'Remove Direct Connection',
            `Permanently delete direct edge "${primaryEdgeId}" connecting "${edge.source}" to "${edge.target}".`,
            `Removes edge "${primaryEdgeId}". Application services can then connect internally.`
          )
        );
      }
      break;
    }

    case 'PF-002': {
      // Public Admin Exposure
      if (primaryEdgeId && edge) {
        actions.push(
          createDenyAction(
            'Block Admin Exposure (DENY)',
            `Block public ingress to administrative endpoint "${edge.target}" by setting edge access to DENY.`,
            `Sets edge access to DENY. Unauthenticated public access to administrative ports is blocked.`
          )
        );
        actions.push(
          createRemoveAction(
            'Remove Public Admin Edge',
            `Delete direct edge "${primaryEdgeId}" connecting public network to administrative interface.`,
            `Deletes edge "${primaryEdgeId}". Route administration via a secure bastion/VPN.`
          )
        );
      }
      break;
    }

    case 'PF-004': {
      // Untrusted to Internal
      if (primaryEdgeId && edge) {
        actions.push(
          createDenyAction(
            'Block Direct Internal Ingress (DENY)',
            `Set edge policy to DENY to stop untrusted traffic from bypassing perimeter firewalls.`,
            `Sets edge "${primaryEdgeId}" access to DENY.`
          )
        );
        actions.push(createRemoveAction());
      }
      break;
    }

    case 'PF-007': {
      // Overly Broad Access (wildcard or unencrypted)
      if (primaryEdgeId && edge) {
        if (finding.id.includes('unencrypted')) {
          actions.push({
            id: `remediate-encrypt-${primaryEdgeId}`,
            type: 'enable-encryption',
            title: 'Enforce Transport Encryption (HTTPS/TLS)',
            description: `Enable encryption and upgrade protocol to HTTPS/TLS on edge "${primaryEdgeId}".`,
            impactSummary: `Sets encrypted: true and protocol: 'HTTPS' on edge "${primaryEdgeId}".`,
            targetEdgeId: primaryEdgeId,
            isAutomated: true,
            apply: (env: Environment) => {
              if (!primaryEdgeId || !env.getEdge(primaryEdgeId)) return false;
              const currentProto = env.getEdge(primaryEdgeId)?.protocol.toUpperCase();
              const newProto = currentProto === 'HTTP' ? 'HTTPS' : currentProto;
              return env.updateEdgeConfig(primaryEdgeId, {
                encrypted: true,
                protocol: newProto,
              });
            },
          });
        } else {
          // Wildcard port
          const targetPort =
            targetNode?.service?.port ??
            (targetNode?.type === 'database' ? 5432 : targetNode?.type === 'web_server' ? 443 : 8080);

          actions.push({
            id: `remediate-restrict-port-${primaryEdgeId}`,
            type: 'restrict-port',
            title: `Restrict Port to Least-Privilege (Port ${targetPort})`,
            description: `Replace wildcard ANY port on edge "${primaryEdgeId}" with explicit port ${targetPort} matching target service.`,
            impactSummary: `Sets ports: "${targetPort}" and portConfig: { type: 'single', value: ${targetPort} }.`,
            targetEdgeId: primaryEdgeId,
            isAutomated: true,
            apply: (env: Environment) => {
              if (!primaryEdgeId || !env.getEdge(primaryEdgeId)) return false;
              return env.updateEdgeConfig(primaryEdgeId, {
                ports: String(targetPort),
                portConfig: { type: 'single', value: targetPort },
              });
            },
          });
          actions.push(createDenyAction());
        }
      }
      break;
    }

    case 'PF-008': {
      // Unencrypted Sensitive Communication
      if (primaryEdgeId && edge) {
        actions.push({
          id: `remediate-tls-${primaryEdgeId}`,
          type: 'enable-encryption',
          title: 'Enable Transport Encryption (TLS)',
          description: `Enable TLS encryption on edge "${primaryEdgeId}" to secure data-in-transit to sensitive asset "${edge.target}".`,
          impactSummary: `Sets encrypted: true on edge "${primaryEdgeId}". Cleartext interception risk is mitigated.`,
          targetEdgeId: primaryEdgeId,
          isAutomated: true,
          apply: (env: Environment) => {
            if (!primaryEdgeId || !env.getEdge(primaryEdgeId)) return false;
            return env.updateEdgeConfig(primaryEdgeId, { encrypted: true });
          },
        });
      }
      break;
    }

    case 'PF-009': {
      // Service Connection Mismatch
      if (primaryEdgeId && edge && targetNode?.service?.port) {
        const expectedPort = targetNode.service.port;
        actions.push({
          id: `remediate-align-port-${primaryEdgeId}`,
          type: 'align-port',
          title: `Align Edge Port with Target Service (Port ${expectedPort})`,
          description: `Update edge port to match listening service port ${expectedPort} on "${targetNode.name}".`,
          impactSummary: `Sets ports: "${expectedPort}" and portConfig: { type: 'single', value: ${expectedPort} }.`,
          targetEdgeId: primaryEdgeId,
          isAutomated: true,
          apply: (env: Environment) => {
            if (!primaryEdgeId || !env.getEdge(primaryEdgeId)) return false;
            return env.updateEdgeConfig(primaryEdgeId, {
              ports: String(expectedPort),
              portConfig: { type: 'single', value: expectedPort },
            });
          },
        });
      }
      break;
    }

    case 'PF-005': {
      // Excessive Trust Relationship / Tier Bypass
      if (primaryEdgeId && edge) {
        actions.push(
          createDenyAction(
            'Block Tier Bypass (DENY)',
            `Block direct communication bypassing intermediate security tiers by setting access to DENY.`,
            `Sets edge "${primaryEdgeId}" access to DENY.`
          )
        );
        actions.push(createRemoveAction());
      }
      break;
    }

    case 'PF-003': {
      // Missing Security Boundary
      actions.push({
        id: `remediate-manual-boundary-${finding.id}`,
        type: 'manual',
        title: 'Insert Perimeter Security Boundary (Firewall / WAF)',
        description:
          'Drag a Firewall node from the left palette onto the canvas between the public source and the application server. Re-route connections through the firewall boundary.',
        impactSummary:
          'Enforces perimeter traffic inspection and prevents uninspected ingress.',
        isAutomated: false,
      });
      break;
    }

    default: {
      if (primaryEdgeId && edge) {
        actions.push(createDenyAction());
        actions.push(createRemoveAction());
      }
      break;
    }
  }

  return actions;
}

/**
 * Returns the primary (recommended) remediation action, or null if only manual intervention applies.
 */
export function getPrimaryRemediationAction(
  finding: Finding,
  environment: Environment
): RemediationAction | null {
  const actions = getRemediationActions(finding, environment);
  return actions.length > 0 ? actions[0] : null;
}
