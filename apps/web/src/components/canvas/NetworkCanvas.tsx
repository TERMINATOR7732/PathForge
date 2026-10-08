import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Environment,
  InfrastructureEdge,
  InfrastructureNode,
  AttackPath,
  BlastRadiusAnalysisResult,
} from '@pathforge/core';
import { Finding, NodeType, NodeZone } from '@pathforge/shared';
import { Flame, ShieldCheck, AlertOctagon, AlertTriangle, Layers, Plus } from 'lucide-react';
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
  blastRadiusResult?: BlastRadiusAnalysisResult | null;
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

interface TrustZoneCluster {
  zone: NodeZone;
  label: string;
  subLabel: string;
  stroke: string;
  fill: string;
  headerColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeCount: number;
}

const ZONE_METADATA: Record<
  NodeZone,
  { label: string; subLabel: string; stroke: string; fill: string; headerColor: string }
> = {
  public: {
    label: 'PUBLIC ZONE',
    subLabel: 'UNTRUSTED / INTERNET',
    stroke: '#3b4354',
    fill: 'rgba(28, 34, 46, 0.25)',
    headerColor: '#8b949e',
  },
  dmz: {
    label: 'DMZ / PERIMETER',
    subLabel: 'INGRESS & REVERSE PROXY',
    stroke: '#1b7c75',
    fill: 'rgba(20, 52, 54, 0.22)',
    headerColor: '#39c5bb',
  },
  internal: {
    label: 'INTERNAL ZONE',
    subLabel: 'APPLICATION & SERVICES',
    stroke: '#1f6feb',
    fill: 'rgba(20, 38, 64, 0.22)',
    headerColor: '#58a6ff',
  },
  restricted: {
    label: 'RESTRICTED ZONE',
    subLabel: 'DATABASE & DATA TIER',
    stroke: '#9e6a03',
    fill: 'rgba(46, 38, 18, 0.25)',
    headerColor: '#e3b341',
  },
  management: {
    label: 'MANAGEMENT ZONE',
    subLabel: 'ADMINISTRATION & CONTROL',
    stroke: '#8957e5',
    fill: 'rgba(40, 24, 60, 0.22)',
    headerColor: '#bc8cff',
  },
  private: {
    label: 'INTERNAL PRIVATE',
    subLabel: 'PRIVATE SEGMENT',
    stroke: '#1f6feb',
    fill: 'rgba(20, 38, 64, 0.22)',
    headerColor: '#58a6ff',
  },
};

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  environment,
  selectedNodeId,
  selectedEdgeId,
  selectedAttackPath,
  blastRadiusResult,
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
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 40 });
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
  const [isDismissedEmptyState, setIsDismissedEmptyState] = useState<boolean>(false);

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

  // Attack Path Traversal Index
  const attackPathNodesList = useMemo(() => {
    return selectedAttackPath?.nodes ?? [];
  }, [selectedAttackPath]);

  const attackPathEdgesList = useMemo(() => {
    return selectedAttackPath?.edges ?? [];
  }, [selectedAttackPath]);

  const attackPathNodeIds = useMemo(() => {
    return new Set(attackPathNodesList.map((n) => n.id));
  }, [attackPathNodesList]);

  const attackPathEdgeIds = useMemo(() => {
    return new Set(attackPathEdgesList.map((e) => e.id));
  }, [attackPathEdgesList]);

  // Blast Radius Traversal Index
  const lateralReachableNodesMap = useMemo(() => {
    const map = new Map<string, { depth: number; isCritical: boolean }>();
    if (!blastRadiusResult) return map;
    for (const node of blastRadiusResult.blastRadius.reachableNodes) {
      map.set(node.id, { depth: node.depth, isCritical: node.isCritical });
    }
    return map;
  }, [blastRadiusResult]);

  const lateralEdgeIds = useMemo(() => {
    if (!blastRadiusResult) return new Set<string>();
    return new Set(blastRadiusResult.blastRadius.reachableEdges.map((e) => e.id));
  }, [blastRadiusResult]);

  const compromisedNodeId = blastRadiusResult?.blastRadius.compromisedNode.id ?? null;

  // Active focus modes that trigger background dimming
  const isAttackPathFocused = selectedAttackPath !== null && selectedAttackPath !== undefined;
  const isBlastRadiusFocused = !isAttackPathFocused && compromisedNodeId !== null;

  // Center on focused element when requested (e.g. from "Locate on Canvas")
  useEffect(() => {
    if (!focusedElement) return;

    if (focusedElement.type === 'node') {
      const node = environment.getNode(focusedElement.id);
      if (node && containerRef.current) {
        const targetX = node.position.x + 102;
        const targetY = node.position.y + 37;
        const viewportW = containerRef.current.clientWidth;
        const viewportH = containerRef.current.clientHeight;

        setPan({
          x: Math.round(viewportW / 2 - targetX * zoom),
          y: Math.round(viewportH / 2 - targetY * zoom),
        });
      }
    } else if (focusedElement.type === 'edge') {
      const edge = environment.getEdge(focusedElement.id);
      if (edge && containerRef.current) {
        const sNode = environment.getNode(edge.source);
        const tNode = environment.getNode(edge.target);
        if (sNode && tNode) {
          const midX = (sNode.position.x + tNode.position.x) / 2 + 102;
          const midY = (sNode.position.y + tNode.position.y) / 2 + 37;
          const viewportW = containerRef.current.clientWidth;
          const viewportH = containerRef.current.clientHeight;

          setPan({
            x: Math.round(viewportW / 2 - midX * zoom),
            y: Math.round(viewportH / 2 - midY * zoom),
          });
        }
      }
    }
  }, [focusedElement, environment, zoom]);

  // Coordinate conversion helper
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

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.3), 2.5);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'INPUT') {
        setIsSpacePressed(true);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        (e.target as HTMLElement).tagName !== 'INPUT'
      ) {
        if (selectedNodeId) {
          onDeleteNode(selectedNodeId);
          onSelectNode(null);
        } else if (selectedEdgeId) {
          onDeleteEdge(selectedEdgeId);
          onSelectEdge(null);
        }
      } else if (e.key === 'Escape') {
        onSelectNode(null);
        onSelectEdge(null);
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
  }, [selectedNodeId, selectedEdgeId, onDeleteNode, onDeleteEdge, onSelectNode, onSelectEdge]);

  // Node Drag Initiation Handler
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
  const handleStartConnection = (sourceNodeId: string, handleX: number, handleY: number) => {
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
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
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
      onUpdateNodePosition(dragNode.id, dragNode.currentX, dragNode.currentY);
      setDragNode(null);
    }

    if (connectionDraft) {
      if (hoveredTargetNodeId && hoveredTargetNodeId !== connectionDraft.sourceNodeId) {
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
      x: Math.round(canvasPos.x - 102),
      y: Math.round(canvasPos.y - 37),
    };

    onCreateNode(nodeType, dropPosition);
  };

  // Controls Handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z * 1.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, z / 1.2));
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 50, y: 40 });
  };

  const nodes = environment.getNodes();
  const edges = environment.getEdges();

  // Compute Trust Zone Clusters on Canvas
  const trustZoneClusters = useMemo<TrustZoneCluster[]>(() => {
    const zonesMap = new Map<NodeZone, InfrastructureNode[]>();
    for (const node of nodes) {
      const zone = (node.metadata.zone as NodeZone) || 'internal';
      const existing = zonesMap.get(zone) || [];
      existing.push(node);
      zonesMap.set(zone, existing);
    }

    const clusters: TrustZoneCluster[] = [];

    zonesMap.forEach((zoneNodes, zone) => {
      if (zoneNodes.length === 0) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const n of zoneNodes) {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + 204);
        maxY = Math.max(maxY, n.position.y + 74);
      }

      const padX = 28;
      const padTop = 32;
      const padBottom = 22;

      const meta = ZONE_METADATA[zone] || ZONE_METADATA.internal;

      clusters.push({
        zone,
        label: meta.label,
        subLabel: meta.subLabel,
        stroke: meta.stroke,
        fill: meta.fill,
        headerColor: meta.headerColor,
        x: Math.round(minX - padX),
        y: Math.round(minY - padTop),
        width: Math.round(maxX - minX + padX * 2),
        height: Math.round(maxY - minY + padTop + padBottom),
        nodeCount: zoneNodes.length,
      });
    });

    return clusters;
  }, [nodes]);

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
        {/* SVG Layer for Trust Zones, Edges, and Connection Draft */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: '4000px', height: '3000px' }}
        >
          <defs>
            <marker
              id="arrowhead-normal"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#3b4354" />
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
            <marker
              id="arrowhead-lateral"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#a371f7" />
            </marker>
            <marker
              id="arrowhead-denied"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#3b4354" />
            </marker>
          </defs>

          {/* 1. Trust Zone Enclosure Boundaries */}
          {trustZoneClusters.map((cluster) => (
            <g key={`zone-${cluster.zone}`} className="pointer-events-none">
              {/* Subtle Zone Backdrop Rect */}
              <rect
                x={cluster.x}
                y={cluster.y}
                width={cluster.width}
                height={cluster.height}
                rx={6}
                fill={cluster.fill}
                stroke={cluster.stroke}
                strokeWidth={1}
                strokeDasharray="4 4"
                className="transition-all duration-150"
              />

              {/* Technical Zone Header Tag */}
              <text
                x={cluster.x + 10}
                y={cluster.y + 16}
                fill={cluster.headerColor}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
                letterSpacing="0.05em"
              >
                {cluster.label}
              </text>

              <text
                x={cluster.x + 10}
                y={cluster.y + 26}
                fill="#596372"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="0.04em"
              >
                {cluster.subLabel} · {cluster.nodeCount} ASSET{cluster.nodeCount > 1 ? 'S' : ''}
              </text>
            </g>
          ))}

          {/* 2. Graph Directional Edges */}
          {edges.map((edge: InfrastructureEdge) => {
            const sourceNode = environment.getNode(edge.source);
            const targetNode = environment.getNode(edge.target);
            if (!sourceNode || !targetNode) return null;

            const isSelected = selectedEdgeId === edge.id;
            const isOnAttackPath = attackPathEdgeIds.has(edge.id);
            const attackHopOrder = isOnAttackPath
              ? attackPathEdgesList.findIndex((e) => e.id === edge.id) + 1
              : null;
            const isLateralMovement = lateralEdgeIds.has(edge.id);

            // Compute Dimming: If attack path or blast radius is focused, dim unrelated edges
            const isDimmed =
              (isAttackPathFocused && !isOnAttackPath) ||
              (isBlastRadiusFocused && !isLateralMovement);

            return (
              <CanvasEdge
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                isSelected={isSelected}
                isVulnerable={affectedEdges.has(edge.id)}
                isHoveredFromFinding={hoveredFindingEdges.has(edge.id)}
                isFocusedTarget={
                  focusedElement?.type === 'edge' && focusedElement.id === edge.id
                }
                isOnAttackPath={isOnAttackPath}
                attackHopOrder={attackHopOrder}
                isLateralMovement={isLateralMovement}
                isDimmed={isDimmed}
                onSelect={(edgeId) => {
                  onSelectEdge(edgeId);
                  onSelectNode(null);
                }}
              />
            );
          })}

          {/* 3. Temporary Connection Draft Line */}
          {connectionDraft && <ConnectionPreview draft={connectionDraft} />}
        </svg>

        {/* Nodes Interactive DOM Layer */}
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

            const isOnAttackPath = attackPathNodeIds.has(node.id);
            const attackHopIndex = isOnAttackPath
              ? attackPathNodesList.findIndex((n) => n.id === node.id) + 1
              : null;
            const isAttackTarget =
              isOnAttackPath && attackHopIndex === attackPathNodesList.length;

            const isCompromisedOrigin = node.id === compromisedNodeId;
            const lateralInfo = lateralReachableNodesMap.get(node.id);

            // Compute Dimming: If attack path or blast radius is focused, dim unrelated nodes
            const isDimmed =
              (isAttackPathFocused && !isOnAttackPath) ||
              (isBlastRadiusFocused && !isCompromisedOrigin && !lateralInfo);

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
                isOnAttackPath={isOnAttackPath}
                attackHopIndex={attackHopIndex}
                isAttackTarget={isAttackTarget}
                isCompromisedOrigin={isCompromisedOrigin}
                lateralDepth={lateralInfo?.depth ?? null}
                isLateralCritical={lateralInfo?.isCritical ?? false}
                isDimmed={isDimmed}
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

      {/* Mode / Environment Indicator Top Banner */}
      {selectedAttackPath ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-[#1c1114]/95 border border-[#f85149]/60 text-[#f85149] text-[11px] font-mono flex items-center space-x-2 shadow-lg backdrop-blur-sm pointer-events-none select-none">
          <Flame className="w-3.5 h-3.5 text-[#f85149]" />
          <span className="font-bold">ATTACK VECTOR ACTIVE:</span>
          <span className="text-[#f0f3f6]">
            {selectedAttackPath.entryPoint.name} → {selectedAttackPath.target.name}
          </span>
          <span className="text-[#8b949e]">·</span>
          <span className="text-[#f85149] font-bold">Risk: {selectedAttackPath.riskScore}/100</span>
        </div>
      ) : activeScenarioId === 'chaos-lab' ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-[#181124]/95 border border-[#8957e5]/50 text-[#bc8cff] text-[11px] font-mono flex items-center space-x-2 shadow-md backdrop-blur-sm pointer-events-none select-none">
          <Flame className="w-3.5 h-3.5 text-[#bc8cff]" />
          <span className="font-bold">CHAOS LAB ACTIVE</span>
          <span className="text-[#8b949e]">·</span>
          <span className="text-[#8b949e]">Insecure topologies allowed and analyzed</span>
        </div>
      ) : null}

      {/* Empty Canvas Workspace Prompt */}
      {nodes.length === 0 && !isDismissedEmptyState && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 p-4 select-none">
          <div className="w-full max-w-lg p-5 rounded bg-[#0d1016]/98 border border-[#1f2633] shadow-2xl backdrop-blur-md pointer-events-auto font-mono text-center space-y-4">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-[#58a6ff] font-bold">
                BUILD YOUR ENVIRONMENT
              </div>
              <p className="text-xs text-[#8b949e] max-w-md mx-auto leading-relaxed font-sans">
                Model your infrastructure and test how trust, exposure, and attack paths behave.
              </p>
            </div>

            {/* Quick Scenario Launch Grid */}
            <div className="grid grid-cols-2 gap-2 text-left text-xs">
              <button
                onClick={() => onLoadScenario?.('secure-web-app')}
                className="p-2.5 rounded bg-[#12161f] border border-[#1c222e] hover:border-[#3fb950] hover:bg-[#151f1a] transition-all text-left space-y-1 group"
              >
                <div className="flex items-center space-x-1.5 text-[#3fb950] font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secure Web App</span>
                </div>
                <div className="text-[10px] text-[#7d8590] group-hover:text-[#c9d1d9] leading-tight font-sans">
                  Hardened 3-tier architecture with zero critical findings.
                </div>
              </button>

              <button
                onClick={() => onLoadScenario?.('public-db-exposure')}
                className="p-2.5 rounded bg-[#12161f] border border-[#1c222e] hover:border-[#f85149] hover:bg-[#201316] transition-all text-left space-y-1 group"
              >
                <div className="flex items-center space-x-1.5 text-[#f85149] font-semibold text-xs">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Public DB Exposure</span>
                </div>
                <div className="text-[10px] text-[#7d8590] group-hover:text-[#c9d1d9] leading-tight font-sans">
                  Direct database exposure. Test defensive remediation.
                </div>
              </button>

              <button
                onClick={() => onLoadScenario?.('flat-network')}
                className="p-2.5 rounded bg-[#12161f] border border-[#1c222e] hover:border-[#f0883e] hover:bg-[#211812] transition-all text-left space-y-1 group"
              >
                <div className="flex items-center space-x-1.5 text-[#f0883e] font-semibold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Flat Network</span>
                </div>
                <div className="text-[10px] text-[#7d8590] group-hover:text-[#c9d1d9] leading-tight font-sans">
                  Insufficient segmentation exposing administrative assets.
                </div>
              </button>

              <button
                onClick={() => onLoadScenario?.('chaos-lab')}
                className="p-2.5 rounded bg-[#12161f] border border-[#1c222e] hover:border-[#bc8cff] hover:bg-[#1b1226] transition-all text-left space-y-1 group"
              >
                <div className="flex items-center space-x-1.5 text-[#bc8cff] font-semibold text-xs">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Chaos Lab</span>
                </div>
                <div className="text-[10px] text-[#7d8590] group-hover:text-[#c9d1d9] leading-tight font-sans">
                  Intentional multi-flaw adversarial playground.
                </div>
              </button>
            </div>

            {/* Scratch building */}
            <div className="pt-1 flex items-center justify-between border-t border-[#1c212c] text-xs">
              <button
                onClick={() => onOpenScenarioLab?.()}
                className="text-[#8b949e] hover:text-[#f0f3f6] transition-colors flex items-center space-x-1 text-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Browse Scenario Catalog</span>
              </button>

              <button
                onClick={() => setIsDismissedEmptyState(true)}
                className="px-3 py-1 rounded bg-[#1b2230] hover:bg-[#252f42] text-[#f0f3f6] text-xs font-semibold transition-colors flex items-center space-x-1 border border-[#2b3547]"
              >
                <Plus className="w-3.5 h-3.5 text-[#3fb950]" />
                <span>Build from Scratch</span>
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

      {/* Floating Technical Minimap */}
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
