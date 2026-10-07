import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  deserializeEnvironment,
  Environment,
  InfrastructureNode,
  InfrastructureEdge,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
  PublicDatabaseExposureRule,
  PublicAdminExposureRule,
  MissingSecurityBoundaryRule,
  UntrustedToInternalNetworkRule,
  ExcessiveTrustRelationshipRule,
  InvalidTopologyRule,
  OverlyBroadAccessRule,
  UnencryptedSensitiveCommunicationRule,
  ServiceConnectionMismatchRule,
} from '@pathforge/validator';

describe('Phase 1.4 — Semantic Security Validation Intelligence', () => {
  let env: Environment;
  let validator: ValidatorEngine;

  beforeEach(() => {
    const demoFilePath = path.resolve(
      __dirname,
      '../environments/demo/standard-web-app.json'
    );
    env = deserializeEnvironment(fs.readFileSync(demoFilePath, 'utf-8'));
    validator = new ValidatorEngine(createDefaultRuleRegistry());
  });

  describe('PF-001: Configuration-Aware Public Database Exposure', () => {
    const rule = new PublicDatabaseExposureRule();

    it('flags public database access when edge is ALLOW and unencrypted', () => {
      env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(1);

      const f = findings[0];
      expect(f.ruleId).toBe('PF-001');
      expect(f.severity).toBe('critical');
      expect(f.title).toContain('Public Database Exposure');
      expect(f.affectedNodes).toEqual(['node-internet', 'node-db']);

      // Structured evidence
      expect(f.evidence).toBeDefined();
      expect(f.evidence?.sourceNode).toBe('node-internet');
      expect(f.evidence?.sourceZone).toBe('public');
      expect(f.evidence?.targetNode).toBe('node-db');
      expect(f.evidence?.targetZone).toBe('restricted');
      expect(f.evidence?.protocol).toBe('TCP');
      expect(f.evidence?.ports).toBe('5432');
      expect(f.evidence?.access).toBe('allow');
      expect(f.evidence?.encrypted).toBe(false);
    });

    it('does NOT flag public database exposure when edge access is DENY', () => {
      // DENY edges must not be treated as allowed reachability
      env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'deny',
        encrypted: false,
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag authorized internal API to Database communication', () => {
      // In baseline, API -> DB is present
      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });

    it('recognizes common database ports (MySQL 3306, Mongo 27017, Redis 6379, MSSQL 1433)', () => {
      const mysqlHost = env.createNode('database', { x: 1000, y: 500 });
      mysqlHost.updateConfig({
        name: 'MySQL Warehouse',
        service: { name: 'mysql', port: 3306, protocol: 'TCP' },
      });

      env.createEdge('node-internet', mysqlHost.id, {
        protocol: 'TCP',
        ports: '3306',
        access: 'allow',
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings.some((f) => f.affectedNodes.includes(mysqlHost.id))).toBe(true);
    });
  });

  describe('PF-002: Public Admin / SSH Exposure', () => {
    const rule = new PublicAdminExposureRule();

    it('flags public direct SSH port 22 access to compute servers', () => {
      // Internet -> Web Server on SSH port 22
      env.createEdge('node-internet', 'node-web', {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('PF-002');
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toContain('Public Administrative Port Exposure');
      expect(findings[0].evidence?.protocol).toBe('SSH');
      expect(findings[0].evidence?.ports).toBe('22');
    });

    it('does NOT flag SSH access originating from authorized Management zone', () => {
      const mgmtNode = env.createNode('admin', { x: 500, y: 100 });
      mgmtNode.updateConfig({
        name: 'Bastion Host',
        zone: 'management',
      });

      // Management -> Web on SSH :22
      env.createEdge(mgmtNode.id, 'node-web', {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag admin exposure when edge is DENY', () => {
      env.createEdge('node-internet', 'node-web', {
        protocol: 'SSH',
        ports: '22',
        access: 'deny',
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });
  });

  describe('DENY Edge Reachability Filtering Across All Rules', () => {
    it('ensures DENY edges never trigger false positive findings', () => {
      // Connect Internet directly to Database, Internal Network, and Web compute with DENY
      env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'deny',
      });

      const internalNet = env.createNode('internal_network', { x: 900, y: 500 });
      env.createEdge('node-internet', internalNet.id, {
        protocol: 'ANY',
        ports: 'ANY',
        access: 'deny',
      });

      env.createEdge('node-internet', 'node-web', {
        protocol: 'HTTP',
        ports: '80',
        access: 'deny',
      });

      const result = validator.evaluate(env);

      // Deny edges must not trigger exposure or boundary violations
      const exposureFindings = result.findings.filter(
        (f) =>
          f.affectedEdges.includes('edge-node-internet-to-node-db') ||
          f.affectedEdges.includes(`edge-node-internet-to-${internalNet.id}`)
      );
      expect(exposureFindings).toHaveLength(0);
    });
  });

  describe('PF-007: Contextual Wildcard / Overly Broad Access', () => {
    const rule = new OverlyBroadAccessRule();

    it('flags ANY port / ANY protocol from untrusted source as HIGH severity', () => {
      env.createEdge('node-internet', 'node-api', {
        protocol: 'ANY',
        ports: 'ANY',
        access: 'allow',
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings.length).toBeGreaterThanOrEqual(1);

      const anyFinding = findings.find((f) => f.affectedNodes.includes('node-api'));
      expect(anyFinding).toBeDefined();
      expect(anyFinding?.severity).toBe('high');
    });

    it('does NOT flag wildcard on DENY edge (default-deny rule is good practice)', () => {
      env.createEdge('node-internet', 'node-api', {
        protocol: 'ANY',
        ports: 'ANY',
        access: 'deny',
      });

      const findings = rule.evaluate({ environment: env });
      // Should not flag DENY edge as overly broad access
      const anyFinding = findings.find((f) => f.affectedNodes.includes('node-api'));
      expect(anyFinding).toBeUndefined();
    });
  });

  describe('PF-008: Unencrypted Sensitive Communication', () => {
    const rule = new UnencryptedSensitiveCommunicationRule();

    it('flags unencrypted communication into sensitive database tier as HIGH severity', () => {
      // Web -> Database unencrypted
      env.createEdge('node-web', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings.length).toBeGreaterThanOrEqual(1);

      const f = findings.find((f) => f.affectedNodes.includes('node-web') && f.affectedNodes.includes('node-db'));
      expect(f).toBeDefined();
      expect(f?.ruleId).toBe('PF-008');
      expect(f?.severity).toBe('high');
      expect(f?.evidence?.encrypted).toBe(false);
      expect(f?.title).toContain('Unencrypted Sensitive Communication');
    });

    it('does NOT flag encrypted communication (HTTPS/TLS/encrypted: true) to sensitive tier', () => {
      // In baseline: API -> DB has encrypted: true
      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag unencrypted DENY edge', () => {
      env.createEdge('node-web', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'deny',
        encrypted: false,
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });
  });

  describe('PF-009: Service / Connection Mismatch', () => {
    const rule = new ServiceConnectionMismatchRule();

    it('flags explicit mismatch when edge targets port conflicting with service definition', () => {
      // DB has postgres on 5432. Connect with TCP :80
      env.createEdge('node-api', 'node-db', {
        protocol: 'TCP',
        ports: '80',
        access: 'allow',
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(1);

      const f = findings[0];
      expect(f.ruleId).toBe('PF-009');
      expect(f.severity).toBe('medium');
      expect(f.title).toContain('Service Connection Mismatch');
      expect(f.evidence?.ports).toBe('80');
      expect(f.evidence?.expectedPort).toBe(5432);
    });

    it('does NOT flag when edge matches expected service port', () => {
      // In baseline: API -> DB uses port 5432, API -> Redis uses 6379
      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag when edge is DENY', () => {
      env.createEdge('node-api', 'node-db', {
        protocol: 'TCP',
        ports: '80',
        access: 'deny',
      });

      const findings = rule.evaluate({ environment: env });
      expect(findings).toHaveLength(0);
    });
  });

  describe('PF-005: Inappropriate Trust Relationships', () => {
    const rule = new ExcessiveTrustRelationshipRule();

    it('flags explicit trust relationship from Public Internet to Database', () => {
      env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        relationship: 'trust',
      });

      const findings = rule.evaluate({ environment: env });
      const trustFinding = findings.find((f) => f.id.includes('trust'));
      expect(trustFinding).toBeDefined();
      expect(trustFinding?.severity).toBe('high');
      expect(trustFinding?.title).toContain('Inappropriate Trust Relationship');
    });

    it('does NOT flag trust relationship when edge is DENY', () => {
      env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'deny',
        relationship: 'trust',
      });

      const findings = rule.evaluate({ environment: env });
      const trustFinding = findings.find((f) => f.id.includes('trust'));
      expect(trustFinding).toBeUndefined();
    });
  });

  describe('Full Manual QA Workflow Simulation (Tests 1 through 6)', () => {
    it('Test 1: Safe topology passes validation with 0 critical and 0 high findings', () => {
      const result = validator.evaluate(env);
      expect(result.summary.passed).toBe(true);
      expect(result.summary.criticalCount).toBe(0);
      expect(result.summary.highCount).toBe(0);
    });

    it('Test 2: Deliberately expose database produces Critical finding with full evidence', () => {
      const badEdge = env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      const result = validator.evaluate(env);
      expect(result.summary.passed).toBe(false);
      expect(result.summary.criticalCount).toBe(1);

      const dbFinding = result.findings.find((f) => f.ruleId === 'PF-001');
      expect(dbFinding).toBeDefined();
      expect(dbFinding?.evidence?.sourceNode).toBe('node-internet');
      expect(dbFinding?.evidence?.targetNode).toBe('node-db');
      expect(dbFinding?.evidence?.protocol).toBe('TCP');
      expect(dbFinding?.evidence?.ports).toBe('5432');
      expect(dbFinding?.evidence?.access).toBe('allow');
      expect(dbFinding?.evidence?.encrypted).toBe(false);

      // Clean up
      env.removeEdge(badEdge.id);
    });

    it('Test 3: Changing bad edge to DENY eliminates exposure finding while edge remains in graph', () => {
      const edge = env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'deny',
        encrypted: false,
      });

      const result = validator.evaluate(env);
      // Denied edge is not treated as reachable exposure
      expect(result.findings.some((f) => f.ruleId === 'PF-001')).toBe(false);
      expect(env.hasEdgeBetween('node-internet', 'node-db')).toBe(true);

      // Clean up
      env.removeEdge(edge.id);
    });

    it('Test 4: Internet -> Admin :22 triggers PF-002, but Management -> Admin :22 does not', () => {
      const adminNode = env.createNode('admin', { x: 700, y: 100 });

      // Insecure: Internet -> Admin :22 ALLOW
      const badAdminEdge = env.createEdge('node-internet', adminNode.id, {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const badResult = validator.evaluate(env);
      expect(badResult.findings.some((f) => f.ruleId === 'PF-002')).toBe(true);

      // Delete bad edge
      env.removeEdge(badAdminEdge.id);

      // Legitimate: Management source -> Admin :22 ALLOW
      const mgmtNode = env.createNode('admin', { x: 500, y: 100 });
      mgmtNode.updateConfig({ name: 'Management Bastion', zone: 'management' });

      env.createEdge(mgmtNode.id, adminNode.id, {
        protocol: 'SSH',
        ports: '22',
        access: 'allow',
      });

      const mgmtResult = validator.evaluate(env);
      expect(mgmtResult.findings.some((f) => f.ruleId === 'PF-002')).toBe(false);
    });

    it('Test 5: Internet -> Critical Service ANY ANY ALLOW triggers High broad-access finding', () => {
      const criticalSvc = env.createNode('api_server', { x: 900, y: 500 });
      criticalSvc.updateConfig({
        name: 'Payment Processing Service',
        criticality: 'critical',
      });

      const broadEdge = env.createEdge('node-internet', criticalSvc.id, {
        protocol: 'ANY',
        ports: 'ANY',
        access: 'allow',
      });

      const result = validator.evaluate(env);
      const broadFinding = result.findings.find(
        (f) => f.ruleId === 'PF-007' && f.affectedEdges.includes(broadEdge.id)
      );
      expect(broadFinding).toBeDefined();
      expect(broadFinding?.severity).toBe('high');

      // Clean up
      env.removeEdge(broadEdge.id);
      env.removeNode(criticalSvc.id);
    });

    it('Test 6: Fixing topology restores environment to clean passing state', () => {
      // Add a bad edge
      const badEdge = env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      expect(validator.evaluate(env).summary.passed).toBe(false);

      // Fix by removing the edge
      env.removeEdge(badEdge.id);

      const fixedResult = validator.evaluate(env);
      expect(fixedResult.summary.passed).toBe(true);
      expect(fixedResult.summary.criticalCount).toBe(0);
      expect(fixedResult.summary.highCount).toBe(0);
    });
  });
});
