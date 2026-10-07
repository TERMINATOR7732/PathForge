import { describe, it, expect, beforeEach } from 'vitest';
import { Environment, InfrastructureNode, InfrastructureEdge } from '@pathforge/core';
import {
  RuleRegistry,
  createDefaultRuleRegistry,
  ValidatorEngine,
  PublicDatabaseExposureRule,
  PublicAdminExposureRule,
  MissingSecurityBoundaryRule,
  UntrustedToInternalNetworkRule,
  ExcessiveTrustRelationshipRule,
  InvalidTopologyRule,
  OverlyBroadAccessRule,
} from '@pathforge/validator';

describe('Validation Engine & Security Rules Architecture', () => {
  let registry: RuleRegistry;
  let engine: ValidatorEngine;

  beforeEach(() => {
    registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  it('registers all default rules correctly in registry', () => {
    const rules = registry.getAllRules();
    // Phase 1.4: 9 default rules (PF-001 through PF-009)
    expect(rules).toHaveLength(9);

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('PF-001');
    expect(ruleIds).toContain('PF-002');
    expect(ruleIds).toContain('PF-003');
    expect(ruleIds).toContain('PF-004');
    expect(ruleIds).toContain('PF-005');
    expect(ruleIds).toContain('PF-006');
    expect(ruleIds).toContain('PF-007');
    expect(ruleIds).toContain('PF-008');
    expect(ruleIds).toContain('PF-009');

    expect(registry.hasRule('PF-001')).toBe(true);
    expect(registry.getRule('PF-001')?.name).toBe('Public Database Exposure');
  });

  it('supports disabling and enabling rules in registry', () => {
    expect(registry.isRuleEnabled('PF-001')).toBe(true);
    registry.disableRule('PF-001');
    expect(registry.isRuleEnabled('PF-001')).toBe(false);
    expect(registry.getActiveRules()).toHaveLength(8);

    registry.enableRule('PF-001');
    expect(registry.isRuleEnabled('PF-001')).toBe(true);
  });

  it('triggers PF-001 when a database is directly connected to the Internet', () => {
    const env = new Environment({ id: 'test-env', name: 'Test' });
    env.addNode(
      new InfrastructureNode({ id: 'net', type: 'internet', name: 'Internet' })
    );
    env.addNode(
      new InfrastructureNode({ id: 'db', type: 'database', name: 'Postgres DB' })
    );
    env.addEdge(
      new InfrastructureEdge({ id: 'edge-bad', source: 'net', target: 'db' })
    );

    const rule = new PublicDatabaseExposureRule();
    const findings = rule.evaluate({ environment: env });

    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.ruleId).toBe('PF-001');
    expect(f.severity).toBe('critical');
    expect(f.affectedNodes).toEqual(['net', 'db']);
    expect(f.affectedEdges).toEqual(['edge-bad']);
    // Verify PathForge Explanatory Principle
    expect(f.whyItMatters).toBeTruthy();
    expect(f.impact).toBeTruthy();
    expect(f.recommendation).toBeTruthy();
    expect(f.remediation).toBeTruthy();
  });

  it('triggers PF-002 when an admin portal is directly exposed to external traffic', () => {
    const env = new Environment({ id: 'test-env', name: 'Test' });
    env.addNode(
      new InfrastructureNode({ id: 'net', type: 'internet', name: 'Internet' })
    );
    env.addNode(
      new InfrastructureNode({ id: 'admin', type: 'admin', name: 'Admin Console' })
    );
    env.addEdge(
      new InfrastructureEdge({ id: 'e-admin', source: 'net', target: 'admin' })
    );

    const rule = new PublicAdminExposureRule();
    const findings = rule.evaluate({ environment: env });

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('PF-002');
    expect(findings[0].severity).toBe('high');
  });

  it('triggers PF-003 when compute workload lacks security boundary', () => {
    const env = new Environment({ id: 'test-env', name: 'Test' });
    env.addNode(
      new InfrastructureNode({ id: 'net', type: 'internet', name: 'Internet' })
    );
    env.addNode(
      new InfrastructureNode({ id: 'web', type: 'web_server', name: 'Web Server' })
    );
    env.addEdge(
      new InfrastructureEdge({ id: 'e-web', source: 'net', target: 'web' })
    );

    const rule = new MissingSecurityBoundaryRule();
    const findings = rule.evaluate({ environment: env });

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('PF-003');
    expect(findings[0].severity).toBe('high');
  });

  it('triggers PF-004 when untrusted network connects to internal network', () => {
    const env = new Environment({ id: 'test-env', name: 'Test' });
    env.addNode(
      new InfrastructureNode({ id: 'ext', type: 'external_network', name: 'External' })
    );
    env.addNode(
      new InfrastructureNode({
        id: 'corp-net',
        type: 'internal_network',
        name: 'Corp LAN',
      })
    );
    env.addEdge(
      new InfrastructureEdge({ id: 'e-bridge', source: 'ext', target: 'corp-net' })
    );

    const rule = new UntrustedToInternalNetworkRule();
    const findings = rule.evaluate({ environment: env });

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('PF-004');
    expect(findings[0].severity).toBe('critical');
  });

  it('triggers PF-005 when frontend bypasses API tier directly to DB', () => {
    const env = new Environment({ id: 'test-env', name: 'Test' });
    env.addNode(
      new InfrastructureNode({ id: 'web', type: 'web_server', name: 'Web' })
    );
    env.addNode(
      new InfrastructureNode({ id: 'api', type: 'api_server', name: 'API' })
    );
    env.addNode(
      new InfrastructureNode({ id: 'db', type: 'database', name: 'DB' })
    );
    // Bypasses API tier:
    env.addEdge(
      new InfrastructureEdge({ id: 'e-bypass', source: 'web', target: 'db' })
    );

    const rule = new ExcessiveTrustRelationshipRule();
    const findings = rule.evaluate({ environment: env });

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('PF-005');
    expect(findings[0].severity).toBe('medium');
  });

  it('triggers PF-006 on self-loops or isolated orphaned nodes', () => {
    const env = new Environment({ id: 'test-env', name: 'Test' });
    env.addNode(
      new InfrastructureNode({ id: 'web', type: 'web_server', name: 'Web' })
    );
    env.addNode(
      new InfrastructureNode({ id: 'db', type: 'database', name: 'DB' })
    );
    // Self loop
    env.addEdge(
      new InfrastructureEdge({ id: 'e-loop', source: 'web', target: 'web' })
    );

    const rule = new InvalidTopologyRule();
    const findings = rule.evaluate({ environment: env });

    // Should detect self-loop on web and orphan on db
    const selfLoopFinding = findings.find((f) => f.id.includes('self-loop'));
    const orphanFinding = findings.find((f) => f.id.includes('orphan'));

    expect(selfLoopFinding).toBeDefined();
    expect(orphanFinding).toBeDefined();
  });

  it('triggers PF-007 on wildcard ports or unencrypted boundary edge', () => {
    const env = new Environment({ id: 'test-env', name: 'Test' });
    env.addNode(
      new InfrastructureNode({ id: 'net', type: 'internet', name: 'Internet' })
    );
    env.addNode(
      new InfrastructureNode({ id: 'fw', type: 'firewall', name: 'Firewall' })
    );
    env.addEdge(
      new InfrastructureEdge({
        id: 'e-wildcard',
        source: 'net',
        target: 'fw',
        metadata: { ports: '*', protocol: 'all' },
      })
    );

    const rule = new OverlyBroadAccessRule();
    const findings = rule.evaluate({ environment: env });

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].ruleId).toBe('PF-007');
  });
});
