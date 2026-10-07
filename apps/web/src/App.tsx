import React, { useState, useMemo, useCallback } from 'react';
import {
  serializeEnvironment,
  Environment,
  createEnvironmentSnapshot,
  verifyFix,
  EnvironmentSnapshot,
  FixVerificationResult,
  instantiateScenario,
  getScenarioById,
  getDefaultScenario,
  analyzeAttackPaths,
  analyzeBlastRadius,
} from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine, RemediationAction } from '@pathforge/validator';
import { NodeType, ValidationResult, Finding } from '@pathforge/shared';

import { TopNav } from './components/TopNav.js';
import { ComponentPalette } from './components/ComponentPalette.js';
import { NetworkCanvas } from './components/canvas/NetworkCanvas.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { FindingsDrawer } from './components/FindingsDrawer.js';
import { ScenarioModal } from './components/ScenarioModal.js';
import { ResetScenarioModal } from './components/ResetScenarioModal.js';

export const App: React.FC = () => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => getDefaultScenario().id);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedAttackPathId, setSelectedAttackPathId] = useState<string | null>(null);
  const [selectedCompromisedNodeId, setSelectedCompromisedNodeId] = useState<string | null>(null);
  const [isValidationStale, setIsValidationStale] = useState<boolean>(false);

  // Investigation & Focus state
  const [hoveredFinding, setHoveredFinding] = useState<Finding | null>(null);
  const [focusedElement, setFocusedElement] = useState<{
    id: string;
    type: 'node' | 'edge';
    timestamp: number;
  } | null>(null);
  const [resolvedFindings, setResolvedFindings] = useState<Finding[]>([]);

  // Fix Verification & Baseline Lifecycle state (Phase 1.6)
  const [lastAppliedRemediation, setLastAppliedRemediation] = useState<{
    actionId: string;
    type: string;
    title: string;
  } | null>(null);
  const [latestVerification, setLatestVerification] = useState<FixVerificationResult | null>(null);

  // graphVersion integer counter to trigger reactive UI re-renders on domain graph mutation
  const [graphVersion, setGraphVersion] = useState<number>(0);
  const bumpGraphVersion = useCallback(() => setGraphVersion((v) => v + 1), []);

  // Initialize rule engine
  const validatorEngine = useMemo(() => {
    const registry = createDefaultRuleRegistry();
    return new ValidatorEngine(registry);
  }, []);

  // Load and hold authoritative Environment instance
  const [environment, setEnvironment] = useState<Environment>(() => {
    return instantiateScenario(getDefaultScenario().id);
  });

  // Compute validation result
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(() => {
    return validatorEngine.evaluate(environment);
  });

  // Validated Baseline Snapshot: immutable capture of the last validated environment
  const [baselineSnapshot, setBaselineSnapshot] = useState<EnvironmentSnapshot | null>(() => {
    const initialResult = validatorEngine.evaluate(environment);
    return createEnvironmentSnapshot(environment, initialResult);
  });

  // Attack Path Analysis (Phase 2.1)
  const attackPathAnalysis = useMemo(() => {
    return analyzeAttackPaths(environment);
  }, [environment, graphVersion]);

  const selectedAttackPath = useMemo(() => {
    if (!selectedAttackPathId) return null;
    return attackPathAnalysis.attackPaths.find((p) => p.id === selectedAttackPathId) ?? null;
  }, [attackPathAnalysis, selectedAttackPathId]);

  // Blast Radius Analysis (Phase 2.2)
  const blastRadiusResult = useMemo(() => {
    if (!selectedCompromisedNodeId) return null;
    try {
      return analyzeBlastRadius(environment, selectedCompromisedNodeId);
    } catch {
      return null;
    }
  }, [environment, selectedCompromisedNodeId, graphVersion]);

  const handleAnalyzeBlastRadius = useCallback((nodeId: string) => {
    setSelectedCompromisedNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  }, []);

  const handleValidate = useCallback(() => {
    const previousFindings = validationResult?.findings ?? [];
    const result = validatorEngine.evaluate(environment);

    // Phase 1.6: Execute deterministic fix verification against the validated baseline
    if (baselineSnapshot) {
      const verification = verifyFix(
        baselineSnapshot,
        environment,
        result,
        lastAppliedRemediation ?? undefined
      );
      setLatestVerification(verification);

      if (verification.resolvedFindings.length > 0) {
        setResolvedFindings(verification.resolvedFindings.map((r) => r.finding));
      }
    } else {
      // Fallback for environment without prior baseline
      const newFindingIds = new Set(result.findings.map((f) => f.id));
      const newlyResolved = previousFindings.filter((prev) => !newFindingIds.has(prev.id));
      if (newlyResolved.length > 0) {
        setResolvedFindings(newlyResolved);
      }
    }

    // BASELINE IMMUTABILITY RULE: After completed validation, newly validated state becomes latest baseline
    setBaselineSnapshot(createEnvironmentSnapshot(environment, result));
    setLastAppliedRemediation(null);
    setValidationResult(result);
    setIsValidationStale(false);
  }, [
    validatorEngine,
    environment,
    validationResult,
    baselineSnapshot,
    lastAppliedRemediation,
  ]);

  const handleLoadScenario = useCallback(
    (scenarioId: string) => {
      setActiveScenarioId(scenarioId);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedAttackPathId(null);
      setSelectedCompromisedNodeId(null);
      setFocusedElement(null);
      setHoveredFinding(null);
      setResolvedFindings([]);
      setLastAppliedRemediation(null);

      // Cleanly instantiate new environment
      const newEnv = instantiateScenario(scenarioId);
      const newResult = validatorEngine.evaluate(newEnv);

      setEnvironment(newEnv);
      setValidationResult(newResult);
      // Clean baseline snapshot matching new scenario
      setBaselineSnapshot(createEnvironmentSnapshot(newEnv, newResult));
      // Stale verification and deltas from previous scenario are cleanly purged
      setLatestVerification(null);
      setIsValidationStale(false);
      bumpGraphVersion();
    },
    [validatorEngine, bumpGraphVersion]
  );

  const handleResetScenario = useCallback(() => {
    handleLoadScenario(activeScenarioId);
  }, [handleLoadScenario, activeScenarioId]);

  const handleUpdateNodePosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      const updated = environment.updateNodePosition(nodeId, x, y);
      if (updated) {
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleCreateNode = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      const newNode = environment.createNode(type, position);
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      setIsValidationStale(true);
      bumpGraphVersion();
    },
    [environment, bumpGraphVersion]
  );

  const handleCreateEdge = useCallback(
    (sourceId: string, targetId: string) => {
      try {
        const newEdge = environment.createEdge(sourceId, targetId);
        setSelectedEdgeId(newEdge.id);
        setSelectedNodeId(null);
        setIsValidationStale(true);
        bumpGraphVersion();
      } catch (err) {
        console.error('Edge creation failed:', err);
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const deleted = environment.removeNode(nodeId);
      if (deleted) {
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
        if (selectedCompromisedNodeId === nodeId) setSelectedCompromisedNodeId(null);
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, selectedNodeId, selectedCompromisedNodeId, bumpGraphVersion]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const deleted = environment.removeEdge(edgeId);
      if (deleted) {
        if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, selectedEdgeId, bumpGraphVersion]
  );

  const handleUpdateNodeConfig = useCallback(
    (nodeId: string, config: Parameters<typeof environment.updateNodeConfig>[1]) => {
      const updated = environment.updateNodeConfig(nodeId, config);
      if (updated) {
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleUpdateEdgeConfig = useCallback(
    (edgeId: string, config: Parameters<typeof environment.updateEdgeConfig>[1]) => {
      const updated = environment.updateEdgeConfig(edgeId, config);
      if (updated) {
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion]
  );

  // Focus and Canvas navigation
  const handleLocateElement = useCallback(
    (target: { id: string; type: 'node' | 'edge' }) => {
      setFocusedElement({ ...target, timestamp: Date.now() });
      if (target.type === 'node') {
        setSelectedNodeId(target.id);
        setSelectedEdgeId(null);
      } else {
        setSelectedEdgeId(target.id);
        setSelectedNodeId(null);
      }
    },
    []
  );

  // Apply deterministic remediation action
  const handleApplyRemediation = useCallback(
    (action: RemediationAction) => {
      if (!action.isAutomated) return;

      if (action.type === 'deny-edge' && action.targetEdgeId) {
        environment.updateEdgeConfig(action.targetEdgeId, { access: 'deny' });
      } else if (action.type === 'remove-edge' && action.targetEdgeId) {
        environment.removeEdge(action.targetEdgeId);
      } else if (action.type === 'enable-encryption' && action.targetEdgeId) {
        environment.updateEdgeConfig(action.targetEdgeId, {
          encrypted: true,
          protocol: 'HTTPS',
        });
      } else if (action.type === 'restrict-port' && action.targetEdgeId) {
        const edge = environment.getEdge(action.targetEdgeId);
        const targetNode = edge ? environment.getNode(edge.target) : undefined;
        const portVal = targetNode?.service?.port ?? 443;
        environment.updateEdgeConfig(action.targetEdgeId, {
          ports: String(portVal),
          portConfig: { type: 'single', value: portVal },
        });
      } else if (action.type === 'align-port' && action.targetEdgeId) {
        const edge = environment.getEdge(action.targetEdgeId);
        const targetNode = edge ? environment.getNode(edge.target) : undefined;
        const portVal = targetNode?.service?.port ?? 443;
        environment.updateEdgeConfig(action.targetEdgeId, {
          ports: String(portVal),
          portConfig: { type: 'single', value: portVal },
        });
      }

      // Record applied remediation for subsequent fix verification attribution
      setLastAppliedRemediation({
        actionId: action.id,
        type: action.type,
        title: action.title,
      });

      // Mark validation as STALE (discipline principle)
      setIsValidationStale(true);
      bumpGraphVersion();
    },
    [environment, bumpGraphVersion]
  );

  const handleExportJson = () => {
    const jsonStr = serializeEnvironment(environment);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${environment.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-topology.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeScenario = getScenarioById(activeScenarioId);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d0f12] text-[#e6edf3] overflow-hidden select-none">
      {/* Top Navigation */}
      <TopNav
        currentScenarioId={activeScenarioId}
        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        onValidate={handleValidate}
        onExport={handleExportJson}
        environment={environment}
        latestVerification={latestVerification}
        validationResult={validationResult}
        isValidationStale={isValidationStale}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        <ComponentPalette
          onAddNodeType={(type) => {
            handleCreateNode(type, { x: 300, y: 250 });
          }}
        />
        <NetworkCanvas
          environment={environment}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          selectedAttackPath={selectedAttackPath}
          blastRadiusResult={blastRadiusResult}
          onSelectNode={setSelectedNodeId}
          onSelectEdge={setSelectedEdgeId}
          onUpdateNodePosition={handleUpdateNodePosition}
          onCreateNode={handleCreateNode}
          onCreateEdge={handleCreateEdge}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          activeFindings={validationResult?.findings ?? []}
          hoveredFinding={hoveredFinding}
          focusedElement={focusedElement}
          activeScenarioId={activeScenarioId}
          onOpenScenarioLab={() => setIsScenarioModalOpen(true)}
          onLoadScenario={handleLoadScenario}
        />
        <InspectorPanel
          environment={environment}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          findings={validationResult?.findings ?? []}
          onAnalyzeBlastRadius={handleAnalyzeBlastRadius}
          onUpdateNodeConfig={handleUpdateNodeConfig}
          onUpdateEdgeConfig={handleUpdateEdgeConfig}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
        />
      </div>

      {/* Security Findings & Fix Verification Drawer */}
      <FindingsDrawer
        findings={validationResult?.findings ?? []}
        environment={environment}
        validationResult={validationResult}
        isValidationStale={isValidationStale}
        resolvedFindings={resolvedFindings}
        latestVerification={latestVerification}
        attackPathAnalysis={attackPathAnalysis}
        selectedAttackPathId={selectedAttackPathId}
        onSelectAttackPath={setSelectedAttackPathId}
        blastRadiusResult={blastRadiusResult}
        selectedCompromisedNodeId={selectedCompromisedNodeId}
        onSelectCompromisedNode={setSelectedCompromisedNodeId}
        onClearBlastRadius={() => setSelectedCompromisedNodeId(null)}
        onSelectNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setSelectedEdgeId(null);
        }}
        onLocateElement={handleLocateElement}
        onHoverFinding={setHoveredFinding}
        onApplyRemediation={handleApplyRemediation}
        onClearResolved={() => setResolvedFindings([])}
        onRequestValidate={handleValidate}
      />

      {/* Scenario Lab Picker Modal */}
      <ScenarioModal
        isOpen={isScenarioModalOpen}
        activeScenarioId={activeScenarioId}
        onClose={() => setIsScenarioModalOpen(false)}
        onSelectScenario={handleLoadScenario}
      />

      {/* Reset Scenario Confirmation Modal */}
      <ResetScenarioModal
        isOpen={isResetModalOpen}
        scenarioName={activeScenario?.name ?? 'Current Scenario'}
        onClose={() => setIsResetModalOpen(false)}
        onConfirmReset={handleResetScenario}
      />
    </div>
  );
};

export default App;
