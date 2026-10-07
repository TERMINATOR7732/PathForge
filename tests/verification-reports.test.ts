import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  createEnvironmentSnapshot,
  verifyFix,
  EnvironmentSnapshot,
  generateVerificationReport,
  formatReportAsJson,
  formatReportAsMarkdown,
  formatReportAsPrintableHtml,
  exportEnvironmentAsSvg,
  instantiateScenario,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
  getRemediationActions,
} from '@pathforge/validator';

describe('Phase 1.8 — Verification Reports & Engineering Export', () => {
  let engine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  describe('Report Generation Semantics & Truthfulness', () => {
    it('generates a verified PASSED report when all violations are eliminated', () => {
      const env = new Environment({ id: 'report-pass-env', name: 'Secure 3-Tier Production' });
      const internet = env.createNode('internet', { x: 50, y: 100 });
      const db = env.createNode('database', { x: 450, y: 100 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });
      const edge = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      // 1. Baseline state has critical violation (PF-001)
      const baselineResult = engine.evaluate(env);
      expect(baselineResult.summary.passed).toBe(false);
      const baselineSnapshot: EnvironmentSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // 2. Remediate violation: Switch access to deny
      env.updateEdgeConfig(edge.id, { access: 'deny' });
      const revalidatedResult = engine.evaluate(env);
      expect(revalidatedResult.summary.passed).toBe(true);

      const verification = verifyFix(baselineSnapshot, env, revalidatedResult, {
        actionId: 'rem-deny-edge',
        type: 'deny-edge',
        title: 'Block Insecure Direct Ingress Edge (DENY)',
      });

      expect(verification.status).toBe('verified');

      // 3. Generate Verification Report
      const report = generateVerificationReport({
        environment: env,
        currentResult: revalidatedResult,
        verification,
        generatedAt: '2026-10-07T12:00:00.000Z',
      });

      expect(report.metadata.title).toContain('PathForge');
      expect(report.environment.id).toBe('report-pass-env');
      expect(report.environment.name).toBe('Secure 3-Tier Production');
      expect(report.productionGate).toBe('PASSED');
      expect(report.executiveSummary.status).toBe('verified');
      expect(report.executiveSummary.productionGate).toBe('PASSED');
      expect(report.resolvedFindings.length).toBeGreaterThan(0);
      expect(report.stillPresentFindings.length).toBe(0);
      expect(report.regressions.length).toBe(0);
      expect(report.remediation?.outcome).toBe('Verified Eliminated');

      // Security Delta
      expect(report.securityDelta?.productionGate.before).toBe('BLOCKED');
      expect(report.securityDelta?.productionGate.after).toBe('PASSED');
      expect(report.securityDelta?.total.delta).toBeLessThan(0);
    });

    it('generates a BLOCKED report when violations remain unresolved', () => {
      const env = new Environment({ id: 'report-blocked-env', name: 'Incomplete Remediation Env' });
      const internet = env.createNode('internet', { x: 50, y: 100 });
      const db = env.createNode('database', { x: 450, y: 100 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });
      // Direct edge causing PF-001
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const baselineResult = engine.evaluate(env);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Do not fix the violation; revalidate
      const revalidatedResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, revalidatedResult);

      const report = generateVerificationReport({
        environment: env,
        currentResult: revalidatedResult,
        verification,
      });

      expect(report.productionGate).toBe('BLOCKED');
      expect(report.executiveSummary.productionGate).toBe('BLOCKED');
      expect(report.resolvedFindings.length).toBe(0);
      expect(report.stillPresentFindings.length).toBeGreaterThan(0);
      expect(report.regressions.length).toBe(0);
    });

    it('generates a REGRESSION report when new violations are introduced in fix attempt', () => {
      const env = new Environment({ id: 'report-regress-env', name: 'Accidental Regression Env' });
      const internet = env.createNode('internet', { x: 50, y: 100 });
      const api = env.createNode('api_gateway', { x: 250, y: 100 }, undefined, {
        zone: 'dmz',
      });
      const db = env.createNode('database', { x: 500, y: 100 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });

      // Valid API -> DB connection (HTTPS encrypted)
      env.createEdge(api.id, db.id, {
        protocol: 'HTTPS',
        ports: '443',
        access: 'allow',
        encrypted: true,
      });

      const baselineResult = engine.evaluate(env);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Engineer attempts to connect internet directly to DB (introduces PF-001)
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const revalidatedResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, revalidatedResult);

      expect(verification.status).toBe('requires-attention');
      expect(verification.newFindings.length).toBeGreaterThan(0);

      const report = generateVerificationReport({
        environment: env,
        currentResult: revalidatedResult,
        verification,
      });

      expect(report.productionGate).toBe('BLOCKED');
      expect(report.executiveSummary.status).toBe('requires-attention');
      expect(report.regressions.length).toBeGreaterThan(0);
      expect(report.regressions[0].ruleId).toBe('PF-001');
      expect(report.regressions[0].whyItAppeared).toContain('Introduced by new connection');
    });

    it('truthfully handles no-baseline state without fabricating a false PASS', () => {
      const env = new Environment({ id: 'report-nobaseline-env', name: 'Fresh Custom Topology' });
      const internet = env.createNode('internet', { x: 50, y: 100 });
      const db = env.createNode('database', { x: 450, y: 100 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const currentResult = engine.evaluate(env);

      // Generate report with NO baseline or verification
      const report = generateVerificationReport({
        environment: env,
        currentResult,
        baseline: null,
        verification: null,
      });

      expect(report.productionGate).toBe('BLOCKED');
      expect(report.executiveSummary.status).toBe('no-baseline');
      expect(report.executiveSummary.baselineAvailable).toBe(false);
      expect(report.executiveSummary.headline).toContain('NO BASELINE');
      expect(report.executiveSummary.narrative).toContain('No validated before-state baseline exists');
      expect(report.securityDelta).toBeUndefined();
      expect(report.resolvedFindings.length).toBe(0);
      expect(report.stillPresentFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Formatters: JSON Output', () => {
    it('produces valid JSON containing all report sections and matching finding counts', () => {
      const env = instantiateScenario('public-db-exposure');
      const baselineResult = engine.evaluate(env);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // In public-db-exposure, switch edge to DENY
      const edge = env.getEdges()[0];
      if (edge) {
        env.updateEdgeConfig(edge.id, { access: 'deny' });
      }

      const revalidatedResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, revalidatedResult);

      const report = generateVerificationReport({
        environment: env,
        currentResult: revalidatedResult,
        verification,
      });

      const jsonString = formatReportAsJson(report);
      expect(typeof jsonString).toBe('string');

      const parsed = JSON.parse(jsonString);
      expect(parsed.metadata.title).toBe(report.metadata.title);
      expect(parsed.environment.id).toBe(env.id);
      expect(parsed.productionGate).toBe(report.productionGate);
      expect(parsed.resolvedFindings.length).toBe(report.resolvedFindings.length);
      expect(parsed.stillPresentFindings.length).toBe(report.stillPresentFindings.length);
      expect(parsed.regressions.length).toBe(report.regressions.length);
    });
  });

  describe('Formatters: Markdown Output', () => {
    it('produces structured markdown with tables, flow comparison, and no false PASS language', () => {
      const env = new Environment({ id: 'md-test-env', name: 'Markdown Verification Lab' });
      const internet = env.createNode('internet', { x: 50, y: 100 }, 'Public Web Client');
      const db = env.createNode('database', { x: 450, y: 100 }, 'Production Database', {
        zone: 'restricted',
        criticality: 'critical',
      });
      const edge = env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const baselineResult = engine.evaluate(env);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Remediate by severing edge
      env.removeEdge(edge.id);
      const revalidatedResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, revalidatedResult, {
        actionId: 'rem-isolate',
        type: 'remove-edge',
        title: 'Isolate Database',
      });

      const report = generateVerificationReport({
        environment: env,
        currentResult: revalidatedResult,
        verification,
      });

      const md = formatReportAsMarkdown(report);

      // Verify Headers & Structure
      expect(md).toContain('# PATHFORGE');
      expect(md).toContain('## Infrastructure Security Verification Report');
      expect(md).toContain('### Report Metadata');
      expect(md).toContain('`Markdown Verification Lab`');
      expect(md).toContain('## 1. Executive Summary');
      expect(md).toContain('## 2. Before / After Security Delta Summary');
      expect(md).toContain('## 3. Verified Resolved Findings');
      expect(md).toContain('## 4. Still Present / Unresolved Findings');
      expect(md).toContain('## 5. Security Regressions');
      expect(md).toContain('## 6. Infrastructure Change Log');

      // Verify Flow Comparison Box
      expect(md).toContain('BEFORE:');
      expect(md).toContain('AFTER:');
      expect(md).toContain('[CONNECTION PERMANENTLY REMOVED / ISOLATED]');

      // Verify Delta Table
      expect(md).toContain('| Metric | Baseline (Before) | Revalidated (After) | Delta |');
      expect(md).toContain('| **Production Gate** |');

      // Verify Remediation Trail
      expect(md).toContain('### Applied Remediation Trail');
      expect(md).toContain('Isolate Database');
    });

    it('emits prominent warning in Markdown when regressions exist', () => {
      const env = new Environment({ id: 'md-regress-env', name: 'Regression Lab' });
      const internet = env.createNode('internet', { x: 50, y: 100 });
      const db = env.createNode('database', { x: 450, y: 100 }, undefined, {
        zone: 'restricted',
        criticality: 'critical',
      });

      const baselineResult = engine.evaluate(env);
      const baselineSnapshot = createEnvironmentSnapshot(env, baselineResult);

      // Introduce violation
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'allow',
      });

      const revalidatedResult = engine.evaluate(env);
      const verification = verifyFix(baselineSnapshot, env, revalidatedResult);

      const report = generateVerificationReport({
        environment: env,
        currentResult: revalidatedResult,
        verification,
      });

      const md = formatReportAsMarkdown(report);
      expect(md).toContain('REGRESSION WARNING');
      expect(md).toContain('New security violations were introduced');
    });
  });

  describe('Formatters: Printable HTML Output', () => {
    it('produces standalone, print-friendly HTML with zero external network dependencies', () => {
      const env = new Environment({ id: 'html-test-env', name: 'HTML Print Lab <>&' });
      const internet = env.createNode('internet', { x: 50, y: 100 });
      const db = env.createNode('database', { x: 450, y: 100 });
      env.createEdge(internet.id, db.id, { protocol: 'HTTP', ports: '80', access: 'allow' });

      const currentResult = engine.evaluate(env);
      const report = generateVerificationReport({
        environment: env,
        currentResult,
      });

      const html = formatReportAsPrintableHtml(report);

      // Standalone HTML checks
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('@media print');
      expect(html).toContain('window.print()');
      expect(html).toContain('PATHFORGE');

      // Escaping check
      expect(html).toContain('&lt;&gt;&amp;');
      expect(html).not.toContain('<>&');

      // Zero external network dependencies (no http/https link tags or script tags)
      expect(html).not.toMatch(/<script\s+[^>]*src=["']https?:\/\//i);
      expect(html).not.toMatch(/<link\s+[^>]*href=["']https?:\/\//i);
    });
  });

  describe('SVG Architecture Diagram Exporter', () => {
    it('exports a valid SVG preserving security semantics and bounding geometry', () => {
      const env = new Environment({ id: 'svg-env', name: 'Architecture Topology' });
      const internet = env.createNode('internet', { x: 100, y: 150 }, 'Internet Ingress');
      const web = env.createNode('web_server', { x: 350, y: 150 }, 'Frontend Web', {
        zone: 'dmz',
        service: { port: 443 },
      });
      const db = env.createNode('database', { x: 600, y: 150 }, 'Core DB', {
        zone: 'restricted',
        service: { port: 5432 },
      });

      // Allowed TLS Edge
      env.createEdge(internet.id, web.id, {
        protocol: 'HTTPS',
        ports: '443',
        access: 'allow',
        encrypted: true,
      });

      // Denied Edge
      env.createEdge(internet.id, db.id, {
        protocol: 'TCP',
        ports: '5432',
        access: 'deny',
      });

      const svg = exportEnvironmentAsSvg(env);

      // Basic SVG XML validity
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).toContain('viewBox=');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

      // Nodes rendered with names & zones
      expect(svg).toContain('Internet Ingress');
      expect(svg).toContain('Frontend Web');
      expect(svg).toContain('Core DB');
      expect(svg).toContain('dmz');
      expect(svg).toContain('restricted');

      // Security edge semantics
      expect(svg).toContain('[TLS]'); // TLS indicator
      expect(svg).toContain('[DENY]'); // Deny indicator
      expect(svg).toContain('stroke-dasharray="6,4"'); // Deny dashed stroke
      expect(svg).toContain('marker-end="url(#arrow-deny)"'); // Deny marker
      expect(svg).toContain('marker-end="url(#arrow-allow)"'); // Allow TLS marker
    });
  });

  describe('Full Remediation-to-Export Lifecycle', () => {
    it('executes full scenario remediation and exports all 4 formats', () => {
      // 1. Load scenario
      const env = instantiateScenario('public-db-exposure');
      const initialResult = engine.evaluate(env);
      const baseline = createEnvironmentSnapshot(env, initialResult);

      expect(initialResult.summary.passed).toBe(false);

      // 2. Discover and apply remediation
      const actions = getRemediationActions(initialResult.findings[0], env);
      expect(actions.length).toBeGreaterThan(0);

      const firstAutomated = actions.find((a) => a.isAutomated);
      expect(firstAutomated).toBeDefined();

      if (firstAutomated && firstAutomated.targetEdgeId) {
        if (firstAutomated.type === 'deny-edge') {
          env.updateEdgeConfig(firstAutomated.targetEdgeId, { access: 'deny' });
        } else if (firstAutomated.type === 'remove-edge') {
          env.removeEdge(firstAutomated.targetEdgeId);
        } else if (firstAutomated.type === 'enable-encryption') {
          env.updateEdgeConfig(firstAutomated.targetEdgeId, { encrypted: true, protocol: 'HTTPS' });
        }
      }

      // 3. Revalidate & Verify
      const revalidatedResult = engine.evaluate(env);
      const verification = verifyFix(baseline, env, revalidatedResult, firstAutomated ?? undefined);

      // 4. Generate master report
      const report = generateVerificationReport({
        environment: env,
        currentResult: revalidatedResult,
        verification,
        appliedRemediation: firstAutomated ?? undefined,
      });

      // 5. Export to all 4 formats
      const jsonReport = formatReportAsJson(report);
      const markdownReport = formatReportAsMarkdown(report);
      const htmlReport = formatReportAsPrintableHtml(report);
      const svgDiagram = exportEnvironmentAsSvg(env);

      expect(jsonReport.length).toBeGreaterThan(200);
      expect(markdownReport.length).toBeGreaterThan(200);
      expect(htmlReport.length).toBeGreaterThan(500);
      expect(svgDiagram.length).toBeGreaterThan(500);

      // Check consistent environment identity across all 4 exports
      expect(jsonReport).toContain(env.id);
      expect(markdownReport).toContain(env.name);
      expect(htmlReport).toContain(env.name);
      expect(svgDiagram).toContain(env.name);
    });
  });
});
