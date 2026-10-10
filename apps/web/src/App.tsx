import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  serializeEnvironment,
  deserializeEnvironment,
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
  analyzeArchitecture,
  assessProductionReadiness,
  assessTestingIntelligence,
  assessTechnicalDebt,
  analyzeInfrastructureChanges,
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
import { UnsavedChangesModal } from './components/UnsavedChangesModal.js';
import { GuidanceBanner } from './components/GuidanceBanner.js';
import { GuidedTourModal } from './components/GuidedTourModal.js';
import { SearchNodesModal } from './components/SearchNodesModal.js';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.js';
import { loadUiPreferences, saveUiPreferences } from './utils/uiPreferences.js';

export const App: React.FC = () => {
  const initialScenarioId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('scenario');
      if (s === 'scratch' || s === 'empty') return s;
      if (s && getScenarioById(s)) return s;
    }
    return getDefaultScenario().id;
  }, []);

  const [activeScenarioId, setActiveScenarioId] = useState<string>(initialScenarioId);

  // Scenario Chooser first-use auto-open (Phase C)
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // If scenario explicitly requested in query, don't open chooser
      if (params.has('scenario')) return false;
      const visited = localStorage.getItem('pathforge_visited');
      if (!visited) {
        localStorage.setItem('pathforge_visited', 'true');
        return true;
      }
    }
    return false;
  });

  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState<boolean>(false);
  const [pendingScenarioId, setPendingScenarioId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Guided Tour modal state (Phase D)
  const [isTourOpen, setIsTourOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tour') === 'true') return true;
    }
    return false;
  });

  // Selection states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
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

  // Persistent UI Preferences (Inspector open by default: true)
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(() => {
    return loadUiPreferences().isInspectorOpen;
  });

  const handleToggleInspector = useCallback(() => {
    setIsInspectorOpen((prev) => {
      const next = !prev;
      saveUiPreferences({ isInspectorOpen: next });
      return next;
    });
  }, []);

  // Modal dialog states
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Initialize rule engine
  const validatorEngine = useMemo(() => {
    const registry = createDefaultRuleRegistry();
    return new ValidatorEngine(registry);
  }, []);

  // Load and hold authoritative Environment instance
  const [environment, setEnvironment] = useState<Environment>(() => {
    if (initialScenarioId === 'scratch' || initialScenarioId === 'empty') {
      return new Environment({
        id: 'env-scratch',
        name: 'Custom Architecture',
        description: 'Blank infrastructure canvas ready for custom modeling.',
      });
    }
    return instantiateScenario(initialScenarioId);
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

  // Architecture Analysis (Phase 2.4)
  const architectureResult = useMemo(() => {
    return analyzeArchitecture(environment);
  }, [environment, graphVersion]);

  // Production Readiness Assessment (Phase 2.5)
  const productionReadiness = useMemo(() => {
    return assessProductionReadiness(environment, {
      validationResult,
      attackPathAnalysis,
      architectureAnalysis: architectureResult,
      blastRadiusAnalysis: blastRadiusResult,
      fixVerification: latestVerification,
    });
  }, [
    environment,
    graphVersion,
    validationResult,
    attackPathAnalysis,
    architectureResult,
    blastRadiusResult,
    latestVerification,
  ]);

  // Testing Intelligence (Phase 2.6)
  const testingIntelligence = useMemo(() => {
    return assessTestingIntelligence(environment, {
      validationResult,
      attackPathAnalysis,
      architectureAnalysis: architectureResult,
      blastRadiusAnalysis: blastRadiusResult,
      fixVerification: latestVerification,
      scenarioId: activeScenarioId,
    });
  }, [
    environment,
    graphVersion,
    validationResult,
    attackPathAnalysis,
    architectureResult,
    blastRadiusResult,
    latestVerification,
    activeScenarioId,
  ]);

  // Technical Debt & Risk Tracking (Phase 2.7)
  const technicalDebt = useMemo(() => {
    return assessTechnicalDebt(environment, {
      validationResult,
      attackPathAnalysis,
      architectureAnalysis: architectureResult,
      blastRadiusAnalysis: blastRadiusResult,
      productionReadiness,
      testingIntelligence,
      fixVerification: latestVerification,
      scenarioId: activeScenarioId,
    });
  }, [
    environment,
    graphVersion,
    validationResult,
    attackPathAnalysis,
    architectureResult,
    blastRadiusResult,
    productionReadiness,
    testingIntelligence,
    latestVerification,
    activeScenarioId,
  ]);

  // Continuous Change Analysis (Phase 3.1)
  const changeAnalysis = useMemo(() => {
    if (!baselineSnapshot) return null;
    return analyzeInfrastructureChanges(baselineSnapshot, environment, {
      beforeValidationResult: baselineSnapshot.validationResult,
      afterValidationResult: validationResult ?? undefined,
      evaluateValidation: (e) => validatorEngine.evaluate(e),
    });
  }, [
    baselineSnapshot,
    environment,
    graphVersion,
    validationResult,
    validatorEngine,
  ]);

  const handleCaptureBaseline = useCallback(() => {
    const currentVal = validationResult ?? validatorEngine.evaluate(environment);
    setBaselineSnapshot(createEnvironmentSnapshot(environment, currentVal));
  }, [environment, validationResult, validatorEngine]);

  const handleAnalyzeBlastRadius = useCallback((nodeId: string) => {
    setSelectedCompromisedNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSelectedFinding(null);
    setSelectedAttackPathId(null);
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

  // Unconditional load implementation
  const handleForceLoadScenario = useCallback(
    (scenarioId: string) => {
      setActiveScenarioId(scenarioId);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedFinding(null);
      setSelectedAttackPathId(null);
      setSelectedCompromisedNodeId(null);
      setFocusedElement(null);
      setHoveredFinding(null);
      setResolvedFindings([]);
      setLastAppliedRemediation(null);
      setHasUnsavedChanges(false);
      setUndoStack([]);
      setRedoStack([]);

      // Support "Build from Scratch" (Phase C option 5)
      let newEnv: Environment;
      if (scenarioId === 'scratch' || scenarioId === 'empty') {
        newEnv = new Environment({
          id: 'env-scratch',
          name: 'Custom Architecture',
          description: 'Blank infrastructure canvas ready for custom modeling.',
        });
      } else {
        newEnv = instantiateScenario(scenarioId);
      }

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

  // Scenario loading with unsaved changes protection (Phase F)
  const handleLoadScenario = useCallback(
    (scenarioId: string) => {
      if (hasUnsavedChanges) {
        setPendingScenarioId(scenarioId);
        setIsUnsavedModalOpen(true);
      } else {
        handleForceLoadScenario(scenarioId);
      }
    },
    [hasUnsavedChanges, handleForceLoadScenario]
  );

  const handleResetScenario = useCallback(() => {
    handleForceLoadScenario(activeScenarioId);
  }, [handleForceLoadScenario, activeScenarioId]);

  // History Snapshot Management (Undo / Redo)
  const pushHistorySnapshot = useCallback(() => {
    const serialized = serializeEnvironment(environment);
    setUndoStack((prev) => [...prev.slice(-29), serialized]);
    setRedoStack([]);
  }, [environment]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousSnapshot = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    const currentSnapshot = serializeEnvironment(environment);
    setRedoStack((prev) => [...prev.slice(-29), currentSnapshot]);
    setUndoStack(newUndoStack);

    try {
      const restoredEnv = deserializeEnvironment(previousSnapshot);
      setEnvironment(restoredEnv);
      const newResult = validatorEngine.evaluate(restoredEnv);
      setValidationResult(newResult);
      setIsValidationStale(true);
      setHasUnsavedChanges(true);
      if (selectedNodeId && !restoredEnv.getNode(selectedNodeId)) {
        setSelectedNodeId(null);
      }
      if (selectedEdgeId && !restoredEnv.getEdge(selectedEdgeId)) {
        setSelectedEdgeId(null);
      }
      bumpGraphVersion();
    } catch (err) {
      console.error('Failed to restore undo state:', err);
    }
  }, [undoStack, environment, validatorEngine, selectedNodeId, selectedEdgeId, bumpGraphVersion]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    const currentSnapshot = serializeEnvironment(environment);
    setUndoStack((prev) => [...prev.slice(-29), currentSnapshot]);
    setRedoStack(newRedoStack);

    try {
      const restoredEnv = deserializeEnvironment(nextSnapshot);
      setEnvironment(restoredEnv);
      const newResult = validatorEngine.evaluate(restoredEnv);
      setValidationResult(newResult);
      setIsValidationStale(true);
      setHasUnsavedChanges(true);
      if (selectedNodeId && !restoredEnv.getNode(selectedNodeId)) {
        setSelectedNodeId(null);
      }
      if (selectedEdgeId && !restoredEnv.getEdge(selectedEdgeId)) {
        setSelectedEdgeId(null);
      }
      bumpGraphVersion();
    } catch (err) {
      console.error('Failed to restore redo state:', err);
    }
  }, [redoStack, environment, validatorEngine, selectedNodeId, selectedEdgeId, bumpGraphVersion]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+K, ?, Alt+I)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // If any modal dialog is open, do not intercept workbench shortcuts
      if (typeof document !== 'undefined' && document.querySelector('[role="dialog"]')) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z (without shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Quick Search: Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      // Shortcuts help: ? (without ctrl/meta/alt)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Toggle Inspector: Alt+I
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleToggleInspector();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo, handleToggleInspector]);

  // Selection handlers to ensure coherent contextual panel state (Phase E)
  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setSelectedEdgeId(null);
      setSelectedFinding(null);
      setSelectedAttackPathId(null);
    }
  }, []);

  const handleSelectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    if (id) {
      setSelectedNodeId(null);
      setSelectedFinding(null);
      setSelectedAttackPathId(null);
    }
  }, []);

  const handleSelectFinding = useCallback((finding: Finding | null) => {
    setSelectedFinding(finding);
    if (finding) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedAttackPathId(null);
    }
  }, []);

  const handleSelectAttackPath = useCallback((pathId: string | null) => {
    setSelectedAttackPathId(pathId);
    if (pathId) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedFinding(null);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedFinding(null);
    setSelectedAttackPathId(null);
    setSelectedCompromisedNodeId(null);
  }, []);

  // Graph mutations with unsaved changes tracking (Phase F)
  const handleUpdateNodePosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      const updated = environment.updateNodePosition(nodeId, x, y);
      if (updated) {
        setHasUnsavedChanges(true);
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleCreateNode = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      pushHistorySnapshot();
      const newNode = environment.createNode(type, position);
      handleSelectNode(newNode.id);
      setIsValidationStale(true);
      setHasUnsavedChanges(true);
      bumpGraphVersion();
    },
    [environment, handleSelectNode, bumpGraphVersion, pushHistorySnapshot]
  );

  const handleCreateEdge = useCallback(
    (sourceId: string, targetId: string) => {
      try {
        pushHistorySnapshot();
        const newEdge = environment.createEdge(sourceId, targetId);
        handleSelectEdge(newEdge.id);
        setIsValidationStale(true);
        setHasUnsavedChanges(true);
        bumpGraphVersion();
      } catch (err) {
        console.error('Edge creation failed:', err);
      }
    },
    [environment, handleSelectEdge, bumpGraphVersion, pushHistorySnapshot]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      pushHistorySnapshot();
      const deleted = environment.removeNode(nodeId);
      if (deleted) {
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
        if (selectedCompromisedNodeId === nodeId) setSelectedCompromisedNodeId(null);
        setIsValidationStale(true);
        setHasUnsavedChanges(true);
        bumpGraphVersion();
      }
    },
    [environment, selectedNodeId, selectedCompromisedNodeId, bumpGraphVersion, pushHistorySnapshot]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      pushHistorySnapshot();
      const deleted = environment.removeEdge(edgeId);
      if (deleted) {
        if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
        setIsValidationStale(true);
        setHasUnsavedChanges(true);
        bumpGraphVersion();
      }
    },
    [environment, selectedEdgeId, bumpGraphVersion, pushHistorySnapshot]
  );

  const handleUpdateNodeConfig = useCallback(
    (nodeId: string, config: Parameters<typeof environment.updateNodeConfig>[1]) => {
      pushHistorySnapshot();
      const updated = environment.updateNodeConfig(nodeId, config);
      if (updated) {
        setIsValidationStale(true);
        setHasUnsavedChanges(true);
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion, pushHistorySnapshot]
  );

  const handleUpdateEdgeConfig = useCallback(
    (edgeId: string, config: Parameters<typeof environment.updateEdgeConfig>[1]) => {
      pushHistorySnapshot();
      const updated = environment.updateEdgeConfig(edgeId, config);
      if (updated) {
        setIsValidationStale(true);
        setHasUnsavedChanges(true);
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion, pushHistorySnapshot]
  );

  // Focus and Canvas navigation
  const handleLocateElement = useCallback(
    (target: { id: string; type: 'node' | 'edge' }) => {
      setFocusedElement({ ...target, timestamp: Date.now() });
      if (target.type === 'node') {
        handleSelectNode(target.id);
      } else {
        handleSelectEdge(target.id);
      }
    },
    [handleSelectNode, handleSelectEdge]
  );

  // Apply deterministic remediation action
  const handleApplyRemediation = useCallback(
    (action: RemediationAction) => {
      if (!action.isAutomated) return;

      pushHistorySnapshot();

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

      // Mark validation as STALE and record unsaved changes
      setIsValidationStale(true);
      setHasUnsavedChanges(true);
      bumpGraphVersion();
    },
    [environment, bumpGraphVersion, pushHistorySnapshot]
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
    setHasUnsavedChanges(false);
  };

  // Close scenario chooser and offer guided tour if entering workspace for the first time
  const handleCloseScenarioModal = useCallback(() => {
    setIsScenarioModalOpen(false);
    if (typeof window !== 'undefined') {
      const tourCompleted = localStorage.getItem('pathforge_tour_completed');
      if (!tourCompleted) {
        setIsTourOpen(true);
      }
    }
  }, []);

  const activeScenario = getScenarioById(activeScenarioId);
  const pendingScenario =
    pendingScenarioId === 'scratch'
      ? { name: 'Build from Scratch' }
      : pendingScenarioId
      ? getScenarioById(pendingScenarioId)
      : null;

  return (
    <div className="pf-shell h-screen w-screen max-w-full flex flex-col bg-[var(--pf-bg-app)] text-[var(--pf-text-primary)] overflow-hidden select-none font-sans">
      {/* Top Navigation */}
      <TopNav
        currentScenarioId={activeScenarioId}
        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        onValidate={handleValidate}
        onExport={handleExportJson}
        environment={environment}
        latestVerification={latestVerification}
        validationResult={validationResult}
        isValidationStale={isValidationStale}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={handleToggleInspector}
      />

      {/* Main Workspace Body */}
      <div className="pf-shell-main flex-1 flex overflow-hidden min-h-0">
        <ComponentPalette
          onAddNodeType={(type) => {
            handleCreateNode(type, { x: 300, y: 250 });
          }}
        />

        {/* Center Canvas Area with Contextual Guidance Banner */}
        <div className="relative flex-1 flex overflow-hidden min-h-0">
          <NetworkCanvas
            environment={environment}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            selectedAttackPath={selectedAttackPath}
            blastRadiusResult={blastRadiusResult}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onUpdateNodePosition={handleUpdateNodePosition}
            onNodeDragStart={pushHistorySnapshot}
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

          {/* State-Derived 'Your Next Step' Guidance Banner (Phase D) */}
          <GuidanceBanner
            isValidationStale={isValidationStale}
            latestVerification={latestVerification}
            validationResult={validationResult}
            selectedFinding={selectedFinding}
            selectedAttackPath={selectedAttackPath}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onValidate={handleValidate}
          />
        </div>

        {/* Contextual Right Inspector (Phase E) */}
        <InspectorPanel
          environment={environment}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          selectedFinding={selectedFinding}
          selectedAttackPath={selectedAttackPath}
          findings={validationResult?.findings ?? []}
          isOpen={isInspectorOpen}
          onToggleOpen={handleToggleInspector}
          onClearSelection={handleClearSelection}
          onApplyRemediation={handleApplyRemediation}
          onLocateElement={handleLocateElement}
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
        onSelectAttackPath={handleSelectAttackPath}
        blastRadiusResult={blastRadiusResult}
        selectedCompromisedNodeId={selectedCompromisedNodeId}
        onSelectCompromisedNode={setSelectedCompromisedNodeId}
        onClearBlastRadius={() => setSelectedCompromisedNodeId(null)}
        architectureResult={architectureResult}
        productionReadiness={productionReadiness}
        testingIntelligence={testingIntelligence}
        technicalDebt={technicalDebt}
        changeAnalysis={changeAnalysis}
        baselineSnapshot={baselineSnapshot}
        selectedFindingId={selectedFinding?.id ?? null}
        onSelectFinding={handleSelectFinding}
        onCaptureBaseline={handleCaptureBaseline}
        onSelectNode={(nodeId) => {
          handleSelectNode(nodeId);
        }}
        onLocateElement={handleLocateElement}
        onHoverFinding={setHoveredFinding}
        onApplyRemediation={handleApplyRemediation}
        onClearResolved={() => setResolvedFindings([])}
        onRequestValidate={handleValidate}
      />

      {/* Scenario Lab Picker Modal (Phase C) */}
      <ScenarioModal
        isOpen={isScenarioModalOpen}
        activeScenarioId={activeScenarioId}
        onClose={handleCloseScenarioModal}
        onSelectScenario={(scenarioId) => {
          handleLoadScenario(scenarioId);
          handleCloseScenarioModal();
        }}
      />

      {/* Reset Scenario Confirmation Modal */}
      <ResetScenarioModal
        isOpen={isResetModalOpen}
        scenarioName={activeScenario?.name ?? 'Current Scenario'}
        onClose={() => setIsResetModalOpen(false)}
        onConfirmReset={handleResetScenario}
      />

      {/* Unsaved Changes Confirmation Modal (Phase F) */}
      <UnsavedChangesModal
        isOpen={isUnsavedModalOpen}
        targetScenarioName={pendingScenario?.name ?? 'Target Scenario'}
        onStay={() => {
          setIsUnsavedModalOpen(false);
          setPendingScenarioId(null);
        }}
        onConfirmDiscard={() => {
          if (pendingScenarioId) {
            handleForceLoadScenario(pendingScenarioId);
          }
          setIsUnsavedModalOpen(false);
          setPendingScenarioId(null);
        }}
      />

      {/* Guided Tour Modal (Phase D) */}
      <GuidedTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />

      {/* Node Quick Search Modal (Ctrl+K) */}
      <SearchNodesModal
        isOpen={isSearchOpen}
        environment={environment}
        onClose={() => setIsSearchOpen(false)}
        onSelectNode={(nodeId) => {
          handleLocateElement({ id: nodeId, type: 'node' });
        }}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};

export default App;
