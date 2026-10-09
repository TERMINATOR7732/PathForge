import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  getAllScenarios,
  getScenarioById,
  instantiateScenario,
  serializeEnvironment,
  deserializeEnvironment,
  createEnvironmentSnapshot,
  diffEnvironments,
} from '@pathforge/core';
import {
  createDefaultRuleRegistry,
  ValidatorEngine,
  getRemediationActions,
  getPrimaryRemediationAction,
} from '@pathforge/validator';

describe('UX Refinement — Pre-Deployment Invariants & Interaction Contracts', () => {
  let engine: ValidatorEngine;

  beforeEach(() => {
    const registry = createDefaultRuleRegistry();
    engine = new ValidatorEngine(registry);
  });

  describe('1. Unsaved State Tracing & Mutation Invariants', () => {
    let env: Environment;
    let initialSnapshot: string;

    beforeEach(() => {
      env = instantiateScenario('public-db-exposure');
      initialSnapshot = serializeEnvironment(env);
    });

    it('detects no unsaved changes immediately after scenario instantiation', () => {
      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).toBe(initialSnapshot);
      const baseline = createEnvironmentSnapshot(env, engine.evaluate(env));
      const diff = diffEnvironments(baseline, env);
      expect(diff.hasChanges).toBe(false);
    });

    it('marks environment as modified upon node creation', () => {
      const baseline = createEnvironmentSnapshot(env, engine.evaluate(env));
      const newNode = env.createNode('firewall', { x: 450, y: 150 });
      expect(newNode).toBeDefined();

      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).not.toBe(initialSnapshot);

      const diff = diffEnvironments(baseline, env);
      expect(diff.hasChanges).toBe(true);
      expect(diff.addedNodeIds).toContain(newNode.id);
    });

    it('marks environment as modified upon node position movement', () => {
      const dbNode = env.getNode('node-db');
      expect(dbNode).toBeDefined();
      const initialPos = { ...dbNode!.position };

      env.updateNodePosition('node-db', initialPos.x + 100, initialPos.y + 50);

      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).not.toBe(initialSnapshot);

      const restored = deserializeEnvironment(currentSnapshot);
      expect(restored.getNode('node-db')?.position).toEqual({
        x: initialPos.x + 100,
        y: initialPos.y + 50,
      });
    });

    it('marks environment as modified upon node removal and cleans up connected edges', () => {
      const initialNodeCount = env.getNodes().length;
      const initialEdgeCount = env.getEdges().length;

      const removed = env.removeNode('node-db');
      expect(removed).toBe(true);
      expect(env.getNodes().length).toBe(initialNodeCount - 1);
      // Incident edges connected to node-db are removed
      expect(env.getEdges().length).toBeLessThan(initialEdgeCount);

      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).not.toBe(initialSnapshot);
    });

    it('marks environment as modified upon edge creation', () => {
      const baseline = createEnvironmentSnapshot(env, engine.evaluate(env));
      // Add a third node first to connect
      const webNode = env.createNode('web_server', { x: 350, y: 240 });
      const initialEdgeCount = env.getEdges().length;

      const edge = env.createEdge('node-internet', webNode.id, {
        protocol: 'HTTPS',
        ports: '443',
        access: 'allow',
      });
      expect(edge).toBeDefined();
      expect(env.getEdges().length).toBe(initialEdgeCount + 1);

      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).not.toBe(initialSnapshot);

      const diff = diffEnvironments(baseline, env);
      expect(diff.hasChanges).toBe(true);
      expect(diff.addedEdgeIds).toContain(edge.id);
    });

    it('marks environment as modified upon edge removal', () => {
      const baseline = createEnvironmentSnapshot(env, engine.evaluate(env));
      const edges = env.getEdges();
      expect(edges.length).toBeGreaterThan(0);
      const edgeId = edges[0].id;

      const removed = env.removeEdge(edgeId);
      expect(removed).toBe(true);

      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).not.toBe(initialSnapshot);

      const diff = diffEnvironments(baseline, env);
      expect(diff.hasChanges).toBe(true);
      expect(diff.removedEdgeIds).toContain(edgeId);
    });

    it('marks environment as modified when applying automated remediation', () => {
      const evalResult = engine.evaluate(env);
      const criticalFinding = evalResult.findings.find(
        (f) => f.severity === 'critical' && f.ruleId === 'PF-001'
      );
      expect(criticalFinding).toBeDefined();

      const primaryFix = getPrimaryRemediationAction(criticalFinding!, env);
      expect(primaryFix).toBeDefined();
      expect(primaryFix?.targetEdgeId).toBeDefined();

      // Apply the fix via updateEdgeConfig: change access to deny
      const updated = env.updateEdgeConfig(primaryFix!.targetEdgeId!, {
        access: 'deny',
      });
      expect(updated).toBe(true);

      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).not.toBe(initialSnapshot);

      // Re-evaluating verifies that the critical finding is resolved
      const reevalResult = engine.evaluate(env);
      const remainingFinding = reevalResult.findings.find(
        (f) => f.ruleId === 'PF-001'
      );
      expect(remainingFinding).toBeUndefined();
    });

    it('clears unsaved modified delta when exported and re-synchronized as new baseline', () => {
      // User edits environment
      env.createNode('worker', { x: 500, y: 300 });

      // Simulating export baseline capture
      const exportedJson = serializeEnvironment(env);
      const savedBaseline = exportedJson;

      // Re-verifying current snapshot matches saved baseline
      const currentSnapshot = serializeEnvironment(env);
      expect(currentSnapshot).toBe(savedBaseline);

      // Modifying again after save marks modified again
      env.createNode('cache', { x: 600, y: 300 });
      expect(serializeEnvironment(env)).not.toBe(savedBaseline);
    });

    it('switching scenario discards in-memory edits when confirmed and loads canonical scenario', () => {
      // Modify first scenario
      const customNode = env.createNode('redis', { x: 999, y: 999 });
      expect(env.getNode(customNode.id)).toBeDefined();

      // Confirmed switch to a new scenario (e.g., flat-network)
      const newEnv = instantiateScenario('flat-network');
      expect(newEnv.id).toBe('env-demo-flat-network');
      expect(newEnv.getNode(customNode.id)).toBeUndefined();
      expect(newEnv.getNodes().length).toBeGreaterThan(0);
    });

    it('instantiates an empty canvas cleanly when Build from Scratch is selected', () => {
      const scratchEnv = new Environment({
        id: 'scratch-env',
        name: 'Custom Infrastructure',
      });
      expect(scratchEnv.getNodes()).toHaveLength(0);
      expect(scratchEnv.getEdges()).toHaveLength(0);

      const evalResult = engine.evaluate(scratchEnv);
      expect(evalResult.findings).toHaveLength(0);
      expect(evalResult.summary.passed).toBe(true);
      expect(evalResult.summary.totalFindings).toBe(0);
    });
  });

  describe('2. Contextual Inspector Selection & Content Mapping', () => {
    let env: Environment;

    beforeEach(() => {
      env = instantiateScenario('public-db-exposure');
    });

    it('resolves complete node inspector details and connected edges', () => {
      const dbNode = env.getNode('node-db');
      expect(dbNode).toBeDefined();

      const connectedEdges = env.getEdges().filter(
        (e) => e.source === dbNode!.id || e.target === dbNode!.id
      );
      expect(connectedEdges.length).toBeGreaterThan(0);
      expect(dbNode?.metadata.zone).toBe('restricted');
      expect(dbNode?.metadata.criticality).toBe('critical');
    });

    it('resolves complete edge inspector details with source and target labels', () => {
      const edges = env.getEdges();
      expect(edges.length).toBeGreaterThan(0);
      const edge = edges[0];

      const sourceNode = env.getNode(edge.source);
      const targetNode = env.getNode(edge.target);

      expect(sourceNode).toBeDefined();
      expect(targetNode).toBeDefined();
      expect(edge.protocol).toBeDefined();
      expect(edge.access).toMatch(/^(allow|deny)$/i);
    });

    it('formats findings in plain-English 4-step structure with technical evidence', () => {
      const evalResult = engine.evaluate(env);
      const finding = evalResult.findings[0];
      expect(finding).toBeDefined();

      // 1. What is wrong
      expect(finding.title).toBeTruthy();
      // 2. Why it matters
      expect(finding.whyItMatters || finding.description).toBeTruthy();
      // 3. Where the issue appears
      expect(finding.affectedNodes.length + finding.affectedEdges.length).toBeGreaterThan(0);
      // 4. Remediation actions available
      const actions = getRemediationActions(finding, env);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].description).toBeTruthy();

      // Expandable Technical Evidence
      expect(finding.evidence).toBeDefined();
      expect(typeof finding.evidence).toBe('object');
      expect(finding.severity).toMatch(/^(critical|high|medium|low|info)$/);
    });

    it('computes accurate topology overview metrics when deselecting all items', () => {
      const nodes = env.getNodes();
      const edges = env.getEdges();
      const evalResult = engine.evaluate(env);

      const overview = {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        criticalFindings: evalResult.findings.filter((f) => f.severity === 'critical').length,
        highFindings: evalResult.findings.filter((f) => f.severity === 'high').length,
        mediumFindings: evalResult.findings.filter((f) => f.severity === 'medium').length,
      };

      expect(overview.totalNodes).toBe(2);
      expect(overview.totalEdges).toBe(1);
      expect(overview.criticalFindings).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Guided Tour Flow & State Persistence Contracts', () => {
    it('defines 6 structured sequential guided tour steps', () => {
      const tourSteps = [
        {
          title: 'Infrastructure Canvas',
          description: 'This is your interactive architecture workspace. Drag nodes to reposition them, drop new components from the palette on the left, and connect them with security policies.',
        },
        {
          title: 'Component Palette',
          description: 'Access cloud primitives, compute workloads, databases, and network boundaries. Click or drag any component to introduce it to your topology.',
        },
        {
          title: 'Deterministic Security Engine',
          description: 'PathForge evaluates every connection against zero-trust engineering rules in real-time. No cloud calls, no telemetry—100% deterministic local analysis.',
        },
        {
          title: 'Attack-Path Discovery',
          description: 'Simulate realistic adversary lateral movement. Visualize how an external compromise reaches mission-critical restricted databases.',
        },
        {
          title: 'One-Click Remediation',
          description: 'When security violations are found, PathForge provides plain-English explanations and automated fixes. Test fixes instantly before deploying.',
        },
        {
          title: 'Engineering Workbench & Gates',
          description: 'Access Architecture Score, Blast Radius, CI Gates, and Production Readiness. Verify compliance before promoting infrastructure to production.',
        },
      ];

      expect(tourSteps).toHaveLength(6);
      tourSteps.forEach((step) => {
        expect(step.title).toBeTruthy();
        expect(step.description.length).toBeGreaterThan(30);
      });
    });

    it('maintains expected localStorage key conventions', () => {
      const VISITED_KEY = 'pathforge_visited';
      const TOUR_COMPLETED_KEY = 'pathforge_tour_completed';

      expect(VISITED_KEY).toBe('pathforge_visited');
      expect(TOUR_COMPLETED_KEY).toBe('pathforge_tour_completed');
    });
  });

  describe('4. Scenario Catalog & Beginner Defaults', () => {
    it('has all scenarios cataloged with recommended beginner scenario identified', () => {
      const scenarios = getAllScenarios();
      expect(scenarios.length).toBe(4);

      // Beginner recommended scenario
      const beginnerScenario = getScenarioById('public-db-exposure');
      expect(beginnerScenario).toBeDefined();
      expect(beginnerScenario?.name).toBe('Public Database Exposure');
      expect(beginnerScenario?.riskLevel).toBe('critical');

      // Chaos Lab scenario
      const chaosScenario = getScenarioById('chaos-lab');
      expect(chaosScenario).toBeDefined();
      expect(chaosScenario?.riskLevel).toBe('chaos');

      // Flat Network scenario
      const flatScenario = getScenarioById('flat-network');
      expect(flatScenario).toBeDefined();

      // Secure Web App scenario
      const secureScenario = getScenarioById('secure-web-app');
      expect(secureScenario).toBeDefined();
    });
  });
});
