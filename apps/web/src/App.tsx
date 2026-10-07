import React, { useState, useMemo, useCallback } from 'react';
import { deserializeEnvironment, serializeEnvironment, Environment } from '@pathforge/core';
import { createDefaultRuleRegistry, ValidatorEngine } from '@pathforge/validator';
import { ValidationResult } from '@pathforge/shared';

import standardEnvJson from '../../../environments/demo/standard-web-app.json';
import chaosEnvJson from '../../../environments/demo/compromised-direct-db.json';

import { TopNav } from './components/TopNav.js';
import { ComponentPalette } from './components/ComponentPalette.js';
import { NetworkCanvas } from './components/NetworkCanvas.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { FindingsDrawer } from './components/FindingsDrawer.js';

export const App: React.FC = () => {
  const [activeEnvType, setActiveEnvType] = useState<string>('standard-web');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Initialize rule engine
  const validatorEngine = useMemo(() => {
    const registry = createDefaultRuleRegistry();
    return new ValidatorEngine(registry);
  }, []);

  // Parse active environment into core Domain instance
  const environment: Environment = useMemo(() => {
    const sourceJson =
      activeEnvType === 'standard-web' ? standardEnvJson : chaosEnvJson;
    return deserializeEnvironment(sourceJson);
  }, [activeEnvType]);

  // Compute validation result
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(() => {
    return validatorEngine.evaluate(environment);
  });

  const handleValidate = useCallback(() => {
    const result = validatorEngine.evaluate(environment);
    setValidationResult(result);
  }, [validatorEngine, environment]);

  const handleSelectEnv = (envId: string) => {
    setActiveEnvType(envId);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    const newEnv = deserializeEnvironment(
      envId === 'standard-web' ? standardEnvJson : chaosEnvJson
    );
    setValidationResult(validatorEngine.evaluate(newEnv));
  };

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
      />

      {/* Main Workspace (Palette | Canvas | Inspector) */}
      <div className="flex-1 flex overflow-hidden">
        <ComponentPalette />
        <NetworkCanvas
          environment={environment}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onSelectNode={setSelectedNodeId}
          onSelectEdge={setSelectedEdgeId}
          activeFindings={validationResult?.findings ?? []}
        />
        <InspectorPanel
          environment={environment}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          findings={validationResult?.findings ?? []}
        />
      </div>

      {/* Security Findings Explanatory Drawer */}
      <FindingsDrawer
        findings={validationResult?.findings ?? []}
        onSelectNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setSelectedEdgeId(null);
        }}
      />
    </div>
  );
};

export default App;
