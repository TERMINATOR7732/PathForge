import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Environment,
  InfrastructureNode,
  InfrastructureEdge,
  AttackPath,
  BlastRadiusAnalysisResult,
} from '@pathforge/core';
import { NodeType, NodeZone, Finding } from '@pathforge/shared';
import { CanvasNode, NODE_WIDTH, NODE_HEIGHT } from './CanvasNode.js';
import { CanvasEdge } from './CanvasEdge.js';
import { CanvasControls } from './CanvasControls.js';
import { CanvasMinimap } from './CanvasMinimap.js';
import { ConnectionPreview } from './ConnectionPreview.js';
import { Flame, Layers } from 'lucide-react';

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
  activeFindings?: Finding[];
  hoveredFinding?: Finding | null;
  focusedElement?: { id: string; type: 'node' | 'edge'; timestamp: number } | null;
  activeScenarioId?: string;
  onOpenScenarioLab?: () => void;
  onLoadScenario?: (scenarioId: string) => void;
}

interface TrustZoneCluster {
  zone: NodeZone;
  label: string;
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
  string,
  { label: string; stroke: string; fill: string; headerColor: string }
> = {
  public: {
    label: 'PUBLIC ZONE',
    stroke: '#484f58',
    fill: 'rgba(33, 38, 45, 0.25)',
    headerColor: '#8b949e',
  },
  dmz: {
    label: 'DMZ / PERIMETER',
    stroke: '#1b7c75',
    fill: 'rgba(27, 124, 117, 0.08)',
    headerColor: '#39c5bb',
  },
  internal: {
    label: 'INTERNAL APP TIER',
    stroke: '#1f6feb',
    fill: 'rgba(31, 111, 235, 0.08)',
    headerColor: '#58a6ff',
  },
  private: {
    label: 'INTERNAL PRIVATE',
    stroke: '#1f6feb',
    fill: 'rgba(31, 111, 235, 0.08)',
    headerColor: '#58a6ff',
  },
  restricted: {
    label: 'RESTRICTED DATA TIER',
    stroke: '#9e6a03',
    fill: 'rgba(158, 106, 3, 0.08)',
    headerColor: '#e3b341',
  },
  management: {
    label: 'MANAGEMENT & CONTROL',
    stroke: '#8957e5',
    fill: 'rgba(137, 87, 229, 0.08)',
    headerColor: '#bc8cff',
  },
};

// Helper to compute deterministic framing and viewport coordinates
function computeFitViewport(
  nodes: readonly InfrastructureNode[],
  containerW: number,
  containerH: number
): { pan: { x: number; y: number }; zoom: number } {
  if (nodes.length === 0) return { pan: { x: 0, y: 0 }, zoom: 1.0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.position.y + NODE_HEIGHT);
  }

  const graphW = Math.max(maxX - minX, 100);
  const graphH = Math.max(maxY - minY, 100);
  const graphCenterX = minX + graphW / 2;
  const graphCenterY = minY + graphH / 2;

  const padX = 55;
  const padY = 55;
  const availW = Math.max(containerW - padX * 2, 200);
  const availH = Math.max(containerH - padY * 2, 200);

  const scaleX = availW / graphW;
  const scaleY = availH / graphH;

  const newZoom = Number(Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.15).toFixed(2));
  const newPanX = Math.round(containerW / 2 - graphCenterX * newZoom);
  const newPanY = Math.round(containerH / 2 - graphCenterY * newZoom);

  return { pan: { x: newPanX, y: newPanY }, zoom: newZoom };
}

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
  activeFindings = [],
  hoveredFinding,
  focusedElement,
  activeScenarioId,
  onOpenScenarioLab: _onOpenScenarioLab,
  onLoadScenario,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport navigation state with deterministic initial framing
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 880,
    height: 700,
  });

  const [pan, setPan] = useState<{ x: number; y: number }>(() => {
    return computeFitViewport(environment.getNodes(), 880, 700).pan;
  });
  const [zoom, setZoom] = useState<number>(() => {
    return computeFitViewport(environment.getNodes(), 880, 700).zoom;
  });

  // Track container dimensions
  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      }
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  // Interaction State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [dragNode, setDragNode] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [connectionDraft, setConnectionDraft] = useState<{
    sourceNodeId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [hoveredTargetNodeId, setHoveredTargetNodeId] = useState<string | null>(null);

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

  // Auto-Fit Topology into Viewport
  const fitToGraph = useCallback(() => {
    const w =
      (containerRef.current && containerRef.current.clientWidth > 0
        ? containerRef.current.clientWidth
        : dimensions.width) || 880;
    const h =
      (containerRef.current && containerRef.current.clientHeight > 0
        ? containerRef.current.clientHeight
        : dimensions.height) || 700;

    const fit = computeFitViewport(environment.getNodes(), w, h);
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [environment, dimensions]);

  // Automatically trigger auto-fit when environment or scenario loads
  useEffect(() => {
    fitToGraph();
    const timer = setTimeout(() => {
      fitToGraph();
    }, 40);
    return () => clearTimeout(timer);
  }, [environment.id, activeScenarioId, fitToGraph]);

  // Center on focused element from findings table
  useEffect(() => {
    if (!focusedElement || !containerRef.current) return;
    if (focusedElement.type === 'node') {
      const node = environment.getNode(focusedElement.id);
      if (node) {
        const viewportW = containerRef.current.clientWidth;
        const viewportH = containerRef.current.clientHeight;
        const targetX = node.position.x + NODE_WIDTH / 2;
        const targetY = node.position.y + NODE_HEIGHT / 2;

        setPan({
          x: Math.round(viewportW / 2 - targetX * zoom),
          y: Math.round(viewportH / 2 - targetY * zoom),
        });
      }
    } else if (focusedElement.type === 'edge') {
      const edge = environment.getEdge(focusedElement.id);
      if (edge) {
        const sNode = environment.getNode(edge.source);
        const tNode = environment.getNode(edge.target);
        if (sNode && tNode) {
          const midX = (sNode.position.x + tNode.position.x + NODE_WIDTH) / 2;
          const midY = (sNode.position.y + tNode.position.y + NODE_HEIGHT) / 2;
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

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.35), 2.5);

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
      x: Math.round(canvasPos.x - NODE_WIDTH / 2),
      y: Math.round(canvasPos.y - NODE_HEIGHT / 2),
    };

    onCreateNode(nodeType, dropPosition);
  };

  // Controls Handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z * 1.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.35, z / 1.2));
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 50, y: 50 });
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
        maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
        maxY = Math.max(maxY, n.position.y + NODE_HEIGHT);
      }

      const padX = 16;
      const padTop = 26;
      const padBottom = 16;

      const meta = ZONE_METADATA[zone] || ZONE_METADATA.internal;

      clusters.push({
        zone,
        label: meta.label,
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

  // Set of nodes & edges involved in selected attack path
  const attackPathNodesMap = useMemo(() => {
    if (!selectedAttackPath) return new Map<string, { hopIndex: number; isOrigin: boolean; isTarget: boolean }>();
    const map = new Map<string, { hopIndex: number; isOrigin: boolean; isTarget: boolean }>();

    selectedAttackPath.nodes.forEach((n, idx) => {
      map.set(n.id, {
        hopIndex: idx,
        isOrigin: idx === 0,
        isTarget: idx === selectedAttackPath.nodes.length - 1,
      });
    });

    return map;
  }, [selectedAttackPath]);

  const attackPathEdgesMap = useMemo(() => {
    if (!selectedAttackPath) return new Map<string, number>();
    const map = new Map<string, number>();
    selectedAttackPath.edges.forEach((e, idx) => {
      map.set(e.id, idx + 1);
    });
    return map;
  }, [selectedAttackPath]);

  // Set of nodes & edges involved in blast radius
  const blastRadiusNodesMap = useMemo(() => {
    if (!blastRadiusResult) return new Map<string, { depth: number; isCritical: boolean }>();
    const map = new Map<string, { depth: number; isCritical: boolean }>();

    blastRadiusResult.blastRadius.reachableNodes.forEach((asset) => {
      map.set(asset.id, {
        depth: asset.depth,
        isCritical: asset.criticality === 'critical',
      });
    });

    return map;
  }, [blastRadiusResult]);

  const blastRadiusEdgesSet = useMemo(() => {
    if (!blastRadiusResult) return new Set<string>();
    const set = new Set<string>();
    blastRadiusResult.blastRadius.reachableEdges.forEach((e) => set.add(e.id));
    blastRadiusResult.blastRadius.lateralMovementSteps.forEach((step) => set.add(step.edgeId));
    return set;
  }, [blastRadiusResult]);

  // Nodes & Edges involved in hovered finding
  const hoveredFindingNodes = useMemo(() => {
    if (!hoveredFinding) return new Set<string>();
    return new Set(hoveredFinding.affectedNodes);
  }, [hoveredFinding]);

  const hoveredFindingEdges = useMemo(() => {
    if (!hoveredFinding) return new Set<string>();
    return new Set(hoveredFinding.affectedEdges);
  }, [hoveredFinding]);

  const isGlobalDimmingActive = Boolean(
    selectedAttackPath || blastRadiusResult || hoveredFinding
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 h-full overflow-hidden canvas-grid ${
        isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Dynamic Viewport Transform Surface */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG Plane for Trust Zones, Edges & Connection Preview */}
        <svg
          className="absolute top-0 left-0 overflow-visible pointer-events-auto"
          style={{ width: 1, height: 1 }}
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
              <polygon points="0 0, 7 3.5, 0 7" fill="#4b5563" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#58a6ff" />
            </marker>
            <marker
              id="arrowhead-vulnerable"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#f85149" />
            </marker>
            <marker
              id="arrowhead-attack"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#f85149" />
            </marker>
            <marker
              id="arrowhead-lateral"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#bc8cff" />
            </marker>
            <marker
              id="arrowhead-denied"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#5b6577" />
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
                rx={8}
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
                fontFamily="Inter, sans-serif"
                fontWeight="600"
                letterSpacing="0.04em"
              >
                {cluster.label}
              </text>
            </g>
          ))}

          {/* 2. Graph Directional Edges */}
          {edges.map((edge: InfrastructureEdge) => {
            const sourceNode = environment.getNode(edge.source);
            const targetNode = environment.getNode(edge.target);
            if (!sourceNode || !targetNode) return null;

            const isEdgeSelected = selectedEdgeId === edge.id;
            const isVulnerable = activeFindings.some((f) => f.affectedEdges.includes(edge.id));
            const isHovered = hoveredFindingEdges.has(edge.id);
            const isOnPath = attackPathEdgesMap.has(edge.id);
            const hopOrder = attackPathEdgesMap.get(edge.id) ?? null;
            const isLateral = blastRadiusEdgesSet.has(edge.id);

            const isDimmed =
              isGlobalDimmingActive && !isOnPath && !isLateral && !isHovered && !isEdgeSelected;

            return (
              <CanvasEdge
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                isSelected={isEdgeSelected}
                isVulnerable={isVulnerable}
                isHoveredFromFinding={isHovered}
                isOnAttackPath={isOnPath}
                attackHopOrder={hopOrder}
                isLateralMovement={isLateral}
                isDimmed={isDimmed}
                onSelect={onSelectEdge}
              />
            );
          })}

          {/* 3. In-flight Edge Creation Draft */}
          {connectionDraft && <ConnectionPreview draft={connectionDraft} />}
        </svg>

        {/* 4. Infrastructure Nodes Surface */}
        <div className="absolute top-0 left-0 pointer-events-auto">
          {nodes.map((node: InfrastructureNode) => {
            const isNodeSelected = selectedNodeId === node.id;
            const nodeFindings = activeFindings.filter((f) => f.affectedNodes.includes(node.id));
            const isCritical = nodeFindings.some((f) => f.severity === 'critical');
            const isHigh = nodeFindings.some((f) => f.severity === 'high');
            const isHovered = hoveredFindingNodes.has(node.id);

            // Attack path metadata
            const attackPathInfo = attackPathNodesMap.get(node.id);
            const isOnPath = Boolean(attackPathInfo);
            const hopIdx = attackPathInfo?.hopIndex ?? null;
            const isAttackOrigin = attackPathInfo?.isOrigin ?? false;
            const isAttackTarget = attackPathInfo?.isTarget ?? false;

            // Blast radius metadata
            const blastInfo = blastRadiusNodesMap.get(node.id);
            const isCompromisedOrigin = blastRadiusResult?.blastRadius.compromisedNode.id === node.id;
            const lateralDepth = blastInfo?.depth ?? null;
            const isLateralCritical = blastInfo?.isCritical ?? false;

            const isDimmed =
              isGlobalDimmingActive &&
              !isOnPath &&
              !blastInfo &&
              !isCompromisedOrigin &&
              !isHovered &&
              !isNodeSelected;

            const inEdges = environment.graph.getIncomingEdges(node.id);
            const outEdges = environment.graph.getOutgoingEdges(node.id);

            return (
              <CanvasNode
                key={node.id}
                node={node}
                isSelected={isNodeSelected}
                isCritical={isCritical}
                isHigh={isHigh}
                isHoveredFromFinding={isHovered}
                isConnectionTarget={hoveredTargetNodeId === node.id}
                isOnAttackPath={isOnPath}
                attackHopIndex={hopIdx}
                isAttackOrigin={isAttackOrigin}
                isAttackTarget={isAttackTarget}
                isCompromisedOrigin={isCompromisedOrigin}
                lateralDepth={lateralDepth}
                isLateralCritical={isLateralCritical}
                isDimmed={isDimmed}
                degree={{
                  inDegree: inEdges.length,
                  outDegree: outEdges.length,
                  total: inEdges.length + outEdges.length,
                }}
                onSelect={onSelectNode}
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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-md bg-[#181214]/95 border border-[#f85149]/60 text-[#f85149] text-xs font-sans flex items-center space-x-2.5 shadow-lg backdrop-blur-sm pointer-events-none select-none">
          <Flame className="w-4 h-4 text-[#f85149] shrink-0" />
          <span className="font-bold tracking-wide">ATTACK VECTOR:</span>
          <span className="text-[#f0f3f6] font-semibold">
            {selectedAttackPath.entryPoint.name} → {selectedAttackPath.target.name}
          </span>
          <span className="text-[#8b949e]">·</span>
          <span className="text-[#f85149] font-bold">
            Risk: {selectedAttackPath.riskScore}/100 ({selectedAttackPath.risk.toUpperCase()})
          </span>
          <span className="text-[#8b949e]">·</span>
          <span className="text-[#8b949e] font-mono">{selectedAttackPath.hopCount} Hops</span>
        </div>
      ) : activeScenarioId === 'chaos-lab' ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-md bg-[#181124]/95 border border-[#8957e5]/50 text-[#bc8cff] text-xs font-sans flex items-center space-x-2.5 shadow-md backdrop-blur-sm pointer-events-none select-none">
          <Flame className="w-4 h-4 text-[#bc8cff] shrink-0" />
          <span className="font-bold">CHAOS LAB ACTIVE</span>
          <span className="text-[#8b949e]">·</span>
          <span className="text-[#c9d1d9]">Arbitrary topologies evaluated dynamically</span>
        </div>
      ) : null}

      {/* Empty Canvas Workspace Prompt */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="p-8 max-w-md w-full bg-[#11151c]/90 border border-[#212631] rounded-xl text-center space-y-4 shadow-xl backdrop-blur-sm pointer-events-auto font-sans">
            <div className="w-12 h-12 rounded-full bg-[#1f6feb]/20 border border-[#388bfd]/50 flex items-center justify-center mx-auto text-[#58a6ff]">
              <Layers className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[#f0f3f6]">Empty Architecture Canvas</h2>
              <p className="text-xs text-[#8b949e] leading-relaxed">
                Drag infrastructure components from the left palette onto the canvas, or load a verified reference scenario below.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => onLoadScenario?.('secure-web-app')}
                className="p-2.5 rounded-md bg-[#161b24] hover:bg-[#1f2633] border border-[#212631] hover:border-[#388bfd] text-left transition-all cursor-pointer group"
              >
                <div className="text-xs font-semibold text-[#f0f3f6] group-hover:text-[#58a6ff]">
                  Secure Web App
                </div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">3-tier hardened baseline</div>
              </button>

              <button
                onClick={() => onLoadScenario?.('public-db-exposure')}
                className="p-2.5 rounded-md bg-[#161b24] hover:bg-[#1f2633] border border-[#212631] hover:border-[#da3633] text-left transition-all cursor-pointer group"
              >
                <div className="text-xs font-semibold text-[#f0f3f6] group-hover:text-[#f85149]">
                  Public DB Exposure
                </div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">Vulnerable ingress demo</div>
              </button>

              <button
                onClick={() => onLoadScenario?.('flat-network')}
                className="p-2.5 rounded-md bg-[#161b24] hover:bg-[#1f2633] border border-[#212631] hover:border-[#f0883e] text-left transition-all cursor-pointer group"
              >
                <div className="text-xs font-semibold text-[#f0f3f6] group-hover:text-[#f0883e]">
                  Flat Network
                </div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">Missing segmentation</div>
              </button>

              <button
                onClick={() => onLoadScenario?.('chaos-lab')}
                className="p-2.5 rounded-md bg-[#161b24] hover:bg-[#1f2633] border border-[#212631] hover:border-[#bc8cff] text-left transition-all cursor-pointer group"
              >
                <div className="text-xs font-semibold text-[#f0f3f6] group-hover:text-[#bc8cff]">
                  Chaos Lab
                </div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">Unconstrained sandbox</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Viewport Controls */}
      <CanvasControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onFitView={fitToGraph}
      />

      {/* Floating Canvas Minimap */}
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
