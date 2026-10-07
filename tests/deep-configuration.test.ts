import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  deserializeEnvironment,
  serializeEnvironment,
  Environment,
  InfrastructureNode,
  InfrastructureEdge,
  validateCidrOrIp,
  parsePortInput,
  isPortAllowed,
} from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine } from '@pathforge/validator';

describe('Phase 1.3 Deep Node & Edge Configuration', () => {
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

  describe('Pure Configuration Validation Utilities', () => {
    describe('validateCidrOrIp', () => {
      it('accepts undefined and empty input as valid', () => {
        expect(validateCidrOrIp(undefined)).toEqual({ valid: true, value: undefined });
        expect(validateCidrOrIp('')).toEqual({ valid: true, value: undefined });
        expect(validateCidrOrIp('   ')).toEqual({ valid: true, value: undefined });
      });

      it('accepts valid IPv4 single host addresses', () => {
        expect(validateCidrOrIp('10.0.1.10')).toEqual({ valid: true, value: '10.0.1.10' });
        expect(validateCidrOrIp('192.168.1.1')).toEqual({ valid: true, value: '192.168.1.1' });
        expect(validateCidrOrIp('172.16.0.50')).toEqual({ valid: true, value: '172.16.0.50' });
        expect(validateCidrOrIp('0.0.0.0')).toEqual({ valid: true, value: '0.0.0.0' });
      });

      it('accepts valid CIDR blocks from /0 to /32', () => {
        expect(validateCidrOrIp('10.0.0.0/24')).toEqual({ valid: true, value: '10.0.0.0/24' });
        expect(validateCidrOrIp('10.0.1.10/32')).toEqual({ valid: true, value: '10.0.1.10/32' });
        expect(validateCidrOrIp('0.0.0.0/0')).toEqual({ valid: true, value: '0.0.0.0/0' });
        expect(validateCidrOrIp('172.16.0.0/16')).toEqual({ valid: true, value: '172.16.0.0/16' });
      });

      it('rejects invalid octets out of 0-255 range', () => {
        const res1 = validateCidrOrIp('256.0.0.1');
        expect(res1.valid).toBe(false);
        expect(res1.error).toContain('out of valid range');

        const res2 = validateCidrOrIp('10.300.0.1');
        expect(res2.valid).toBe(false);
      });

      it('rejects invalid octet count', () => {
        const res1 = validateCidrOrIp('10.0.1');
        expect(res1.valid).toBe(false);
        expect(res1.error).toContain('must contain exactly 4 octets');

        const res2 = validateCidrOrIp('10.0.0.1.5');
        expect(res2.valid).toBe(false);
      });

      it('rejects non-numeric octets', () => {
        const res = validateCidrOrIp('10.0.abc.1');
        expect(res.valid).toBe(false);
        expect(res.error).toContain('Invalid octet');
      });

      it('rejects invalid CIDR prefix lengths', () => {
        const res1 = validateCidrOrIp('10.0.0.1/33');
        expect(res1.valid).toBe(false);
        expect(res1.error).toContain('between 0 and 32');

        const res2 = validateCidrOrIp('10.0.0.1/35');
        expect(res2.valid).toBe(false);

        const res3 = validateCidrOrIp('10.0.0.1/abc');
        expect(res3.valid).toBe(false);
      });

      it('rejects multiple slashes in CIDR string', () => {
        const res = validateCidrOrIp('10.0.0.1/24/32');
        expect(res.valid).toBe(false);
        expect(res.error).toContain('multiple slashes');
      });
    });

    describe('parsePortInput', () => {
      it('accepts single valid numeric and string ports', () => {
        const resNum = parsePortInput(443);
        expect(resNum.valid).toBe(true);
        expect(resNum.config).toEqual({ type: 'single', value: 443 });
        expect(resNum.formatted).toBe('443');

        const resStr = parsePortInput('80');
        expect(resStr.valid).toBe(true);
        expect(resStr.config).toEqual({ type: 'single', value: 80 });
        expect(resStr.formatted).toBe('80');
      });

      it('accepts port ranges', () => {
        const res = parsePortInput('8000-8080');
        expect(res.valid).toBe(true);
        expect(res.config).toEqual({ type: 'range', start: 8000, end: 8080 });
        expect(res.formatted).toBe('8000-8080');
      });

      it('accepts wildcard port formats', () => {
        expect(parsePortInput('ANY').config).toEqual({ type: 'any' });
        expect(parsePortInput('*').config).toEqual({ type: 'any' });
        expect(parsePortInput('all').config).toEqual({ type: 'any' });
        expect(parsePortInput(undefined).config).toEqual({ type: 'any' });
      });

      it('rejects out of range single ports', () => {
        expect(parsePortInput(0).valid).toBe(false);
        expect(parsePortInput(70000).valid).toBe(false);
        expect(parsePortInput('65536').valid).toBe(false);
      });

      it('rejects inverted port ranges', () => {
        const res = parsePortInput('8080-8000');
        expect(res.valid).toBe(false);
        expect(res.error).toContain('cannot be greater than end port');
      });

      it('rejects malformed port strings', () => {
        expect(parsePortInput('http').valid).toBe(false);
        expect(parsePortInput('8000-8080-9000').valid).toBe(false);
      });
    });

    describe('isPortAllowed', () => {
      it('permits all ports on any config', () => {
        expect(isPortAllowed({ type: 'any' }, 80)).toBe(true);
        expect(isPortAllowed({ type: 'any' }, 443)).toBe(true);
        expect(isPortAllowed({ type: 'any' }, 5432)).toBe(true);
      });

      it('permits only matching port on single config', () => {
        const cfg = { type: 'single' as const, value: 5432 };
        expect(isPortAllowed(cfg, 5432)).toBe(true);
        expect(isPortAllowed(cfg, 80)).toBe(false);
        expect(isPortAllowed(cfg, 5433)).toBe(false);
      });

      it('permits ports within range', () => {
        const cfg = { type: 'range' as const, start: 8000, end: 8080 };
        expect(isPortAllowed(cfg, 8000)).toBe(true);
        expect(isPortAllowed(cfg, 8050)).toBe(true);
        expect(isPortAllowed(cfg, 8080)).toBe(true);
        expect(isPortAllowed(cfg, 7999)).toBe(false);
        expect(isPortAllowed(cfg, 8081)).toBe(false);
      });
    });
  });

  describe('Node Domain Model Deep Configuration', () => {
    it('updates node zone, criticality, tags, and service info', () => {
      const node = env.getNode('node-db');
      expect(node).toBeDefined();

      const updated = env.updateNodeConfig('node-db', {
        name: 'Production PostgreSQL Cluster',
        zone: 'restricted',
        criticality: 'critical',
        cidr: '10.0.3.50/32',
        service: { name: 'postgres', port: 5432, protocol: 'TCP' },
        tags: ['production', 'pci-dss', 'tier=storage'],
      });

      expect(updated).toBe(true);
      expect(node?.name).toBe('Production PostgreSQL Cluster');
      expect(node?.zone).toBe('restricted');
      expect(node?.criticality).toBe('critical');
      expect(node?.cidr).toBe('10.0.3.50/32');
      expect(node?.service).toEqual({ name: 'postgres', port: 5432, protocol: 'TCP' });
      expect(node?.tags).toEqual(['production', 'pci-dss', 'tier=storage']);
    });

    it('rejects invalid CIDR when updating node config', () => {
      expect(() => {
        env.updateNodeConfig('node-db', {
          cidr: '256.0.0.1',
        });
      }).toThrow('out of valid range');

      expect(() => {
        env.updateNodeConfig('node-db', {
          cidr: '10.0.0.1/35',
        });
      }).toThrow('between 0 and 32');
    });

    it('rejects empty node name', () => {
      expect(() => {
        env.updateNodeConfig('node-db', {
          name: '   ',
        });
      }).toThrow('Node name cannot be empty');
    });
  });

  describe('Edge Domain Model Deep Configuration & Port Allowance', () => {
    it('updates edge protocol, ports, access policy, and encryption', () => {
      const edge = env.getEdge('edge-api-to-db');
      expect(edge).toBeDefined();

      const updated = env.updateEdgeConfig('edge-api-to-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: true,
        relationship: 'network',
      });

      expect(updated).toBe(true);
      expect(edge?.protocol).toBe('TCP');
      expect(edge?.ports).toBe('5432');
      expect(edge?.portConfig).toEqual({ type: 'single', value: 5432 });
      expect(edge?.access).toBe('allow');
      expect(edge?.encrypted).toBe(true);
      expect(edge?.relationship).toBe('network');

      // Evaluates port allowance
      expect(edge?.allowsPort(5432)).toBe(true);
      expect(edge?.allowsPort(80)).toBe(false);
    });

    it('supports port ranges on edges and verifies port allowance', () => {
      const edge = env.getEdge('edge-web-to-api');
      expect(edge).toBeDefined();

      env.updateEdgeConfig('edge-web-to-api', {
        ports: '8000-8080',
        protocol: 'HTTP',
        access: 'allow',
      });

      expect(edge?.portConfig).toEqual({ type: 'range', start: 8000, end: 8080 });
      expect(edge?.allowsPort(8000)).toBe(true);
      expect(edge?.allowsPort(8050)).toBe(true);
      expect(edge?.allowsPort(8080)).toBe(true);
      expect(edge?.allowsPort(80)).toBe(false);
      expect(edge?.allowsPort(8081)).toBe(false);
    });

    it('denies all traffic when access policy is set to deny', () => {
      const edge = env.getEdge('edge-api-to-db');
      expect(edge).toBeDefined();

      env.updateEdgeConfig('edge-api-to-db', {
        ports: '5432',
        access: 'deny',
      });

      expect(edge?.access).toBe('deny');
      // Deny blocks all traffic regardless of port
      expect(edge?.allowsPort(5432)).toBe(false);
      expect(edge?.allowsPort(80)).toBe(false);
    });

    it('rejects invalid edge port specifications', () => {
      expect(() => {
        env.updateEdgeConfig('edge-api-to-db', {
          ports: '70000',
        });
      }).toThrow('between 1 and 65535');

      expect(() => {
        env.updateEdgeConfig('edge-api-to-db', {
          ports: '9000-8000',
        });
      }).toThrow('cannot be greater than end port');
    });
  });

  describe('Full Serialization Round-Trip Fidelity', () => {
    it('preserves all deep configuration fields across serialization and deserialization', () => {
      // Configure node deeply
      env.updateNodeConfig('node-web', {
        name: 'DMZ Web Ingress',
        zone: 'dmz',
        criticality: 'high',
        cidr: '10.0.1.10/24',
        service: { name: 'nginx', port: 443, protocol: 'HTTPS' },
        tags: ['ingress', 'public-facing', 'dmz'],
      });

      // Configure edge deeply
      env.updateEdgeConfig('edge-web-to-api', {
        protocol: 'HTTPS',
        ports: '8443',
        access: 'allow',
        encrypted: true,
        relationship: 'network',
      });

      // Serialize and restore
      const json = serializeEnvironment(env);
      const restored = deserializeEnvironment(json);

      // Verify node
      const restoredWeb = restored.getNode('node-web');
      expect(restoredWeb).toBeDefined();
      expect(restoredWeb?.name).toBe('DMZ Web Ingress');
      expect(restoredWeb?.zone).toBe('dmz');
      expect(restoredWeb?.criticality).toBe('high');
      expect(restoredWeb?.cidr).toBe('10.0.1.10/24');
      expect(restoredWeb?.service).toEqual({ name: 'nginx', port: 443, protocol: 'HTTPS' });
      expect(restoredWeb?.tags).toEqual(['ingress', 'public-facing', 'dmz']);

      // Verify edge
      const restoredEdge = restored.getEdge('edge-web-to-api');
      expect(restoredEdge).toBeDefined();
      expect(restoredEdge?.protocol).toBe('HTTPS');
      expect(restoredEdge?.ports).toBe('8443');
      expect(restoredEdge?.portConfig).toEqual({ type: 'single', value: 8443 });
      expect(restoredEdge?.access).toBe('allow');
      expect(restoredEdge?.encrypted).toBe(true);
      expect(restoredEdge?.relationship).toBe('network');
      expect(restoredEdge?.allowsPort(8443)).toBe(true);
      expect(restoredEdge?.allowsPort(80)).toBe(false);
    });
  });

  describe('Manual QA Workflows (Scenarios A through F)', () => {
    it('Scenario A & B: Node inspection, editing zone, criticality, and CIDR', () => {
      const dbNode = env.getNode('node-db');
      expect(dbNode).toBeDefined();
      expect(dbNode?.zone).toBe('restricted');

      // Change DB to public zone, critical criticality, and assign CIDR
      env.updateNodeConfig('node-db', {
        zone: 'public',
        criticality: 'critical',
        cidr: '198.51.100.10/32',
      });

      expect(dbNode?.zone).toBe('public');
      expect(dbNode?.criticality).toBe('critical');
      expect(dbNode?.cidr).toBe('198.51.100.10/32');
    });

    it('Scenario C: Port & protocol configuration', () => {
      const edge = env.getEdge('edge-web-to-api');
      expect(edge).toBeDefined();

      env.updateEdgeConfig('edge-web-to-api', {
        protocol: 'TCP',
        ports: '8080',
        encrypted: true,
      });

      expect(edge?.protocol).toBe('TCP');
      expect(edge?.ports).toBe('8080');
      expect(edge?.encrypted).toBe(true);
      expect(edge?.allowsPort(8080)).toBe(true);
    });

    it('Scenario D: Edge access control (allow vs deny)', () => {
      const edge = env.getEdge('edge-api-to-db');
      expect(edge).toBeDefined();

      // Deny access
      env.updateEdgeConfig('edge-api-to-db', { access: 'deny' });
      expect(edge?.access).toBe('deny');
      expect(edge?.allowsPort(5432)).toBe(false);

      // Re-allow access
      env.updateEdgeConfig('edge-api-to-db', { access: 'allow' });
      expect(edge?.access).toBe('allow');
      expect(edge?.allowsPort(5432)).toBe(true);
    });

    it('Scenario E: Intentionally insecure configuration (Internet -> DB direct unencrypted :5432)', () => {
      // Connect Internet directly to Database
      const directEdge = env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      expect(directEdge).toBeDefined();
      expect(directEdge.source).toBe('node-internet');
      expect(directEdge.target).toBe('node-db');
      expect(directEdge.ports).toBe('5432');
      expect(directEdge.encrypted).toBe(false);
      expect(directEdge.allowsPort(5432)).toBe(true);

      // Insecure configurations are valid domain models
      const json = serializeEnvironment(env);
      const restored = deserializeEnvironment(json);
      expect(restored.hasEdgeBetween('node-internet', 'node-db')).toBe(true);
    });

    it('Scenario F: Validation re-run reflecting intentionally insecure configuration', () => {
      // Baseline validation before dangerous edge
      const initialResult = validator.evaluate(env);
      const initialFindingCount = initialResult.findings.length;

      // Add direct unencrypted edge from Internet to DB
      env.createEdge('node-internet', 'node-db', {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
        encrypted: false,
      });

      // Re-run validation
      const postResult = validator.evaluate(env);

      // Should detect new severe security issues (e.g. exposure / direct access to database)
      expect(postResult.findings.length).toBeGreaterThan(initialFindingCount);
      const dbExposure = postResult.findings.find(
        (f) =>
          f.affectedNodes.includes('node-db') &&
          (f.category === 'exposure' || f.category === 'unrestricted_reachability')
      );
      expect(dbExposure).toBeDefined();
    });
  });
});
