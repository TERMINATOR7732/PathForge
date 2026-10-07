import React, { useState, useMemo, useCallback } from 'react';
import { deserializeEnvironment, serializeEnvironment, Environment } from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine, RemediationAction } from '@pathforge/validator';
import { NodeType, ValidationResult, Finding } from '@pathforge/shared';

import standardEnvJson from '../../../environments/demo/standard-web-app.json';
import chaosEnvJson from '../../../environments/demo/compromised-direct-db.json';

import { TopNav } from './components/TopNav.js';
import { ComponentPalette } from './components/ComponentPalette.js';
import { NetworkCanvas } from './components/canvas/NetworkCanvas.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { FindingsDrawer } from './components/FindingsDrawer.js';

export const App: React.FC = () => {
  const [activeEnvType, setActiveEnvType] = useState<string>('standard-web');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isValidationStale, setIsValidationStale] = useState<boolean>(false);

  // Investigation & Focus state
  const [hoveredFinding, setHoveredFinding] = useState<Finding | null>(null);
  const [focusedElement, setFocusedElement] = useState<{
    id: string;
    type: 'node' | 'edge';
    timestamp: number;
  } | null>(null);
  const [resolvedFindings, setResolvedFindings] = useState<Finding[]>([]);

  // graphVersion integer counter to trigger reactive UI re-renders on domain graph mutation
  const [, setGraphVersion] = useState<number>(0);
  const bumpGraphVersion = useCallback(() => setGraphVersion((v) => v + 1), []);

  // Initialize rule engine
  const validatorEngine = useMemo(() => {
    const registry = createDefaultRuleRegistry();
    return new ValidatorEngine(registry);
  }, []);

  // Load and hold authoritative Environment instance
  const [environment, setEnvironment] = useState<Environment>(() => {
    return deserializeEnvironment(standardEnvJson);
  });

  // Compute validation result
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(() => {
    return validatorEngine.evaluate(environment);
  });

  const handleValidate = useCallback(() => {
    const previousFindings = validationResult?.findings ?? [];
    const result = validatorEngine.evaluate(environment);

    // Compute resolved findings (findings present previously that are now resolved)
    const newFindingIds = new Set(result.findings.map((f) => f.id));
    const newlyResolved = previousFindings.filter((prev) => !newFindingIds.has(prev.id));

    if (newlyResolved.length > 0) {
      setResolvedFindings(newlyResolved);
    }

    setValidationResult(result);
    setIsValidationStale(false);
  }, [validatorEngine, environment, validationResult]);

  const handleSelectEnv = (envId: string) => {
    setActiveEnvType(envId);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFocusedElement(null);
    setHoveredFinding(null);
    setResolvedFindings([]);
    const newEnv = deserializeEnvironment(
      envId === 'standard-web' ? standardEnvJson : chaosEnvJson
    );
    setEnvironment(newEnv);
    setValidationResult(validatorEngine.evaluate(newEnv));
    setIsValidationStale(false);
    bumpGraphVersion();
  };

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
        console.warn('Failed to create edge:', err);
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const removed = environment.removeNode(nodeId);
      if (removed) {
        if (selectedNodeId === nodeId) {
          setSelectedNodeId(null);
        }
        setSelectedEdgeId(null);
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, selectedNodeId, bumpGraphVersion]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const removed = environment.removeEdge(edgeId);
      if (removed) {
        if (selectedEdgeId === edgeId) {
          setSelectedEdgeId(null);
        }
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, selectedEdgeId, bumpGraphVersion]
  );

  const handleUpdateNodeConfig = useCallback(
    (
      nodeId: string,
      patch: Parameters<Environment['updateNodeConfig']>[1]
    ) => {
      const updated = environment.updateNodeConfig(nodeId, patch);
      if (updated) {
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleUpdateEdgeConfig = useCallback(
    (
      edgeId: string,
      patch: Parameters<Environment['updateEdgeConfig']>[1]
    ) => {
      const updated = environment.updateEdgeConfig(edgeId, patch);
      if (updated) {
        setIsValidationStale(true);
        bumpGraphVersion();
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleLocateElement = useCallback(
    (target: { id: string; type: 'node' | 'edge' }) => {
      if (target.type === 'node') {
        setSelectedNodeId(target.id);
        setSelectedEdgeId(null);
      } else {
        setSelectedEdgeId(target.id);
        setSelectedNodeId(null);
      }
      setFocusedElement({ id: target.id, type: target.type, timestamp: Date.now() });
    },
    []
  );

  const handleApplyRemediation = useCallback(
    (action: RemediationAction) => {
      if (action.apply) {
        const success = action.apply(environment);
        if (success) {
          setIsValidationStale(true);
          bumpGraphVersion();
        }
      }
    },
    [environment, bumpGraphVersion]
  );

  const handleExport = () => {
    const jsonStr = serializeEnvironment(environment, true);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${environment.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d0f12] text-[#d1d5db]">
      {/* Top Header */}
      <TopNav
        currentEnvId={activeEnvType}
        onSelectEnv={handleSelectEnv}
        onValidate={handleValidate}
        onExport={handleExport}
        validationResult={validationResult}
        isValidationStale={isValidationStale}
      />

      {/* Main Workspace (Palette | Canvas | Inspector) */}
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
        />
        <InspectorPanel
          environment={environment}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          findings={validationResult?.findings ?? []}
          onUpdateNodeConfig={handleUpdateNodeConfig}
          onUpdateEdgeConfig={handleUpdateEdgeConfig}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
        />
      </div>

      {/* Security Findings Explanatory Drawer */}
      <FindingsDrawer
        findings={validationResult?.findings ?? []}
        environment={environment}
        isValidationStale={isValidationStale}
        resolvedFindings={resolvedFindings}
        onSelectNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setSelectedEdgeId(null);
        }}
        onLocateElement={handleLocateElement}
        onHoverFinding={setHoveredFinding}
        onApplyRemediation={handleApplyRemediation}
        onClearResolved={() => setResolvedFindings([])}
      />
    </div>
  );
};

export default App;
