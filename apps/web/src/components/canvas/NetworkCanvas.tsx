import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Environment, InfrastructureEdge, InfrastructureNode, AttackPath } from '@pathforge/core';
import { Finding, NodeType } from '@pathforge/shared';
import { Flame } from 'lucide-react';
import { CanvasNode } from './CanvasNode.js';
import { CanvasEdge } from './CanvasEdge.js';
import { ConnectionPreview } from './ConnectionPreview.js';
import { CanvasControls } from './CanvasControls.js';
import { CanvasMinimap } from './CanvasMinimap.js';
import { ConnectionDraft } from './types.js';

interface NetworkCanvasProps {
  environment: Environment;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedAttackPath?: AttackPath | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
  onCreateNode: (type: NodeType, position: { x: number; y: number }) => void;
  onCreateEdge: (sourceId: string, targetId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  activeFindings: Finding[];
  hoveredFinding?: Finding | null;
  focusedElement?: { id: string; type: 'node' | 'edge'; timestamp: number } | null;
  activeScenarioId?: string;
  onOpenScenarioLab?: () => void;
  onLoadScenario?: (scenarioId: string) => void;
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  environment,
  selectedNodeId,
  selectedEdgeId,
  selectedAttackPath,
  onSelectNode,
  onSelectEdge,
  onUpdateNodePosition,
  onCreateNode,
  onCreateEdge,
  onDeleteNode,
  onDeleteEdge,
  activeFindings,
  hoveredFinding,
  focusedElement,
  activeScenarioId,
  onOpenScenarioLab,
  onLoadScenario,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport navigation state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 50 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 800,
  });

  // Track container dimensions for minimap
  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  // Node Dragging State
  const [dragNode, setDragNode] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Connection Dragging State
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [hoveredTargetNodeId, setHoveredTargetNodeId] = useState<string | null>(null);

  // Canvas Panning State
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // Findings index for styling
  const criticalAffectedNodes = new Set(
    activeFindings
      .filter((f) => f.severity === 'critical')
      .flatMap((f) => f.affectedNodes)
  );

  const highAffectedNodes = new Set(
    activeFindings
      .filter((f) => f.severity === 'high')
      .flatMap((f) => f.affectedNodes)
  );

  const affectedEdges = new Set(activeFindings.flatMap((f) => f.affectedEdges));

  const hoveredFindingNodes = useMemo(() => {
    return new Set(hoveredFinding?.affectedNodes ?? []);
  }, [hoveredFinding]);

  const hoveredFindingEdges = useMemo(() => {
    return new Set(hoveredFinding?.affectedEdges ?? []);
  }, [hoveredFinding]);

  const attackPathNodeIds = useMemo(() => {
    return new Set(selectedAttackPath?.nodes.map((n) => n.id) ?? []);
  }, [selectedAttackPath]);

  const attackPathEdgeIds = useMemo(() => {
    return new Set(selectedAttackPath?.edges.map((e) => e.id) ?? []);
  }, [selectedAttackPath]);

  // Center on focused element when requested (e.g. from "Locate on Canvas")
  useEffect(() => {
    if (!focusedElement) return;

    if (focusedElement.type === 'node') {
      const node = environment.getNode(focusedElement.id);
      if (node) {
        const targetPanX = dimensions.width / 2 - (node.position.x + 100) * zoom;
        const targetPanY = dimensions.height / 2 - (node.position.y + 45) * zoom;
        setPan({ x: targetPanX, y: targetPanY });
      }
    } else if (focusedElement.type === 'edge') {
      const edge = environment.getEdge(focusedElement.id);
      if (edge) {
        const s = environment.getNode(edge.source);
        const t = environment.getNode(edge.target);
        if (s && t) {
          const midX = (s.position.x + 200 + t.position.x) / 2;
          const midY = (s.position.y + 45 + t.position.y + 45) / 2;
          const targetPanX = dimensions.width / 2 - midX * zoom;
          const targetPanY = dimensions.height / 2 - midY * zoom;
          setPan({ x: targetPanX, y: targetPanY });
        }
      }
    }
  }, [focusedElement, environment, dimensions.width, dimensions.height, zoom]);

  // Convert client viewport coordinates to canvas space
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x, y };
    },
    [pan, zoom]
  );

  // Keyboard events: Space for panning, Delete/Backspace for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          onDeleteNode(selectedNodeId);
        } else if (selectedEdgeId) {
          e.preventDefault();
          onDeleteEdge(selectedEdgeId);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeId, selectedEdgeId, onDeleteNode, onDeleteEdge]);

  // Zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(2.5, Math.max(0.3, zoom * zoomFactor));

    // Keep point under cursor stationary
    const nextPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
    const nextPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  // Node Drag Handlers
  const handleStartDragNode = (nodeId: string, clientX: number, clientY: number) => {
    const node = environment.getNode(nodeId);
    if (!node) return;

    const canvasPos = screenToCanvas(clientX, clientY);
    setDragNode({
      id: nodeId,
      offsetX: canvasPos.x - node.position.x,
      offsetY: canvasPos.y - node.position.y,
      currentX: node.position.x,
      currentY: node.position.y,
    });
  };

  // Connection Start Handler
  const handleStartConnection = (
    sourceNodeId: string,
    handleX: number,
    handleY: number
  ) => {
    setConnectionDraft({
      sourceNodeId,
      startX: handleX,
      startY: handleY,
      currentX: handleX,
      currentY: handleY,
    });
  };

  // Canvas Mouse Down: initiates panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpacePressed || e.button === 0) {
      // Pan canvas
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      // Deselect if left clicked on empty canvas
      if (e.button === 0 && !isSpacePressed) {
        onSelectNode(null);
        onSelectEdge(null);
      }
    }
  };

  // Global Canvas Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (dragNode) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const newX = Math.round(canvasPos.x - dragNode.offsetX);
      const newY = Math.round(canvasPos.y - dragNode.offsetY);

      setDragNode((prev) => (prev ? { ...prev, currentX: newX, currentY: newY } : null));
      onUpdateNodePosition(dragNode.id, newX, newY);
      return;
    }

    if (connectionDraft) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setConnectionDraft((prev) =>
        prev
          ? {
              ...prev,
              currentX: Math.round(canvasPos.x),
              currentY: Math.round(canvasPos.y),
            }
          : null
      );
    }
  };

  // Global Canvas Mouse Up
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (dragNode) {
      // Final commit of node position to domain
      onUpdateNodePosition(dragNode.id, dragNode.currentX, dragNode.currentY);
      setDragNode(null);
    }

    if (connectionDraft) {
      if (
        hoveredTargetNodeId &&
        hoveredTargetNodeId !== connectionDraft.sourceNodeId
      ) {
        // Complete the connection
        onCreateEdge(connectionDraft.sourceNodeId, hoveredTargetNodeId);
      }
      setConnectionDraft(null);
      setHoveredTargetNodeId(null);
    }
  };

  // Palette Drag-and-Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/pathforge-node-type') as NodeType;
    if (!nodeType) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const dropPosition = {
      x: Math.round(canvasPos.x - 100),
      y: Math.round(canvasPos.y - 45),
    };

    onCreateNode(nodeType, dropPosition);
  };

  // Controls Handlers
  const handleZoomIn = () => {
    setZoom((z) => Math.min(2.5, z * 1.2));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.3, z / 1.2));
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 60, y: 50 });
  };

  const nodes = environment.getNodes();
  const edges = environment.getEdges();

  return (
    <div
      ref={containerRef}
      className={`flex-1 h-full canvas-grid relative overflow-hidden select-none ${
        isSpacePressed || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Zoom and Pan Content Container */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {/* SVG Edge and Arrow Layer */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: '4000px', height: '3000px' }}
        >
          <defs>
            <marker
              id="arrowhead-normal"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#4a5568" />
            </marker>
            <marker
              id="arrowhead-critical"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#f85149" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#58a6ff" />
            </marker>
          </defs>

          {/* Render Actual Graph Edges */}
          {edges.map((edge: InfrastructureEdge) => {
            const sourceNode = environment.getNode(edge.source);
            const targetNode = environment.getNode(edge.target);
            if (!sourceNode || !targetNode) return null;

            return (
              <CanvasEdge
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                isSelected={selectedEdgeId === edge.id}
                isVulnerable={affectedEdges.has(edge.id)}
                isHoveredFromFinding={hoveredFindingEdges.has(edge.id)}
                isFocusedTarget={
                  focusedElement?.type === 'edge' && focusedElement.id === edge.id
                }
                isOnAttackPath={attackPathEdgeIds.has(edge.id)}
                onSelect={(edgeId) => {
                  onSelectEdge(edgeId);
                  onSelectNode(null);
                }}
              />
            );
          })}

          {/* Render Temporary Connection Draft Line */}
          {connectionDraft && <ConnectionPreview draft={connectionDraft} />}
        </svg>

        {/* Nodes Layer */}
        <div className="absolute inset-0 pointer-events-auto">
          {nodes.map((node: InfrastructureNode) => {
            const degree = environment.graph.getDegree(node.id);
            const isSelected = selectedNodeId === node.id;
            const isCritical = criticalAffectedNodes.has(node.id);
            const isHigh = !isCritical && highAffectedNodes.has(node.id);
            const isConnectionTarget =
              connectionDraft !== null &&
              hoveredTargetNodeId === node.id &&
              node.id !== connectionDraft.sourceNodeId;

            return (
              <CanvasNode
                key={node.id}
                node={node}
                isSelected={isSelected}
                isCritical={isCritical}
                isHigh={isHigh}
                isConnectionTarget={isConnectionTarget}
                isHoveredFromFinding={hoveredFindingNodes.has(node.id)}
                isFocusedTarget={
                  focusedElement?.type === 'node' && focusedElement.id === node.id
                }
                isOnAttackPath={attackPathNodeIds.has(node.id)}
                degree={degree}
                onSelect={(nId) => {
                  onSelectNode(nId);
                  onSelectEdge(null);
                }}
                onStartDrag={handleStartDragNode}
                onStartConnection={handleStartConnection}
                onHoverConnectionTarget={setHoveredTargetNodeId}
              />
            );
          })}
        </div>
      </div>

      {/* Subtle Top-Center Affordance Banner */}
      {activeScenarioId === 'chaos-lab' ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-[#241733]/90 border border-[#8957e5]/50 text-[#d2a8ff] text-[11px] font-mono flex items-center space-x-1.5 shadow-md backdrop-blur-sm pointer-events-none select-none">
          <Flame className="w-3.5 h-3.5 text-[#d2a8ff]" />
          <span className="font-bold">CHAOS LAB</span>
          <span className="text-[#8b949e]">·</span>
          <span>Experiment freely. PathForge will not block insecure designs.</span>
        </div>
      ) : (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-[#13161c]/80 border border-[#222630]/80 text-[#8b949e] text-[10px] font-mono flex items-center space-x-1.5 backdrop-blur-sm pointer-events-none select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
          <span>Permissive Modeling Active · Insecure topologies allowed & analyzed</span>
        </div>
      )}

      {/* Empty Canvas First-Run Workflow Experience */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 p-4 select-none">
          <div className="w-full max-w-lg p-6 rounded-lg bg-[#111318]/95 border border-[#30363d] shadow-2xl backdrop-blur-md pointer-events-auto font-mono text-center space-y-4">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest text-[#58a6ff] font-bold">
                Build Your Environment
              </div>
              <p className="text-xs text-[#8b949e] max-w-md mx-auto leading-relaxed">
                Add infrastructure components to the canvas and connect them to model communication and trust boundaries.
              </p>
            </div>

            {/* 3 Core Product Steps */}
            <div className="grid grid-cols-3 gap-2 text-left text-[11px] pt-1">
              <div className="p-2.5 rounded bg-[#161b24] border border-[#222630] space-y-1">
                <span className="text-[10px] font-bold text-[#58a6ff] uppercase block">1. Validate</span>
                <span className="text-[#8b949e] text-[10px] leading-tight block">
                  Find security and topology misconfigurations deterministically.
                </span>
              </div>
              <div className="p-2.5 rounded bg-[#161b24] border border-[#222630] space-y-1">
                <span className="text-[10px] font-bold text-[#f0883e] uppercase block">2. Fix</span>
                <span className="text-[#8b949e] text-[10px] leading-tight block">
                  Apply recommended automated or manual remediations.
                </span>
              </div>
              <div className="p-2.5 rounded bg-[#161b24] border border-[#222630] space-y-1">
                <span className="text-[10px] font-bold text-[#3fb950] uppercase block">3. Prove</span>
                <span className="text-[#8b949e] text-[10px] leading-tight block">
                  Revalidate and verify that the attack surface was eliminated.
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => onLoadScenario?.('secure-web-app')}
                className="px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold transition-colors shadow-sm"
              >
                Load Secure Web App
              </button>
              <button
                onClick={() => onLoadScenario?.('public-db-exposure')}
                className="px-3 py-1.5 rounded bg-[#1f6feb] hover:bg-[#388bfd] text-white text-xs font-semibold transition-colors shadow-sm"
              >
                Load Public DB Lab
              </button>
              <button
                onClick={() => onOpenScenarioLab?.()}
                className="px-3 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-medium transition-colors"
              >
                Browse All Scenarios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Navigation Controls */}
      <CanvasControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      {/* Floating Minimap */}
      <CanvasMinimap
        nodes={nodes}
        pan={pan}
        zoom={zoom}
        canvasWidth={dimensions.width}
        canvasHeight={dimensions.height}
        onNavigate={(newPanX, newPanY) => setPan({ x: newPanX, y: newPanY })}
      />
    </div>
  );
};
