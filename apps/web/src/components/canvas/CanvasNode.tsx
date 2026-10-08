import React from 'react';
import { InfrastructureNode } from '@pathforge/core';
import {
  Globe,
  Shield,
  Layers,
  Server,
  Cpu,
  Database,
  Zap,
  Lock,
  KeyRound,
  Network,
  Share2,
  Flame,
  Radio,
  Crosshair,
} from 'lucide-react';

interface CanvasNodeProps {
  node: InfrastructureNode;
  isSelected: boolean;
  isCritical: boolean;
  isHigh: boolean;
  isConnectionTarget: boolean;
  isHoveredFromFinding?: boolean;
  isFocusedTarget?: boolean;
  isOnAttackPath?: boolean;
  attackHopIndex?: number | null;
  isAttackTarget?: boolean;
  isCompromisedOrigin?: boolean;
  lateralDepth?: number | null;
  isLateralCritical?: boolean;
  isDimmed?: boolean;
  degree: { inDegree: number; outDegree: number; total: number };
  onSelect: (nodeId: string) => void;
  onStartDrag: (nodeId: string, clientX: number, clientY: number) => void;
  onStartConnection: (sourceNodeId: string, handleX: number, handleY: number) => void;
  onHoverConnectionTarget: (nodeId: string | null) => void;
}

interface NodeCategoryConfig {
  category: string;
  color: string;
  accentBorder: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getNodeCategoryConfig(type: string): NodeCategoryConfig {
  switch (type) {
    case 'internet':
      return { category: 'EXTERNAL', color: '#7d8590', accentBorder: '#484f58', icon: Globe };
    case 'external_network':
      return { category: 'EXTERNAL', color: '#7d8590', accentBorder: '#484f58', icon: Share2 };
    case 'firewall':
      return { category: 'PERIMETER', color: '#39c5bb', accentBorder: '#1b7c75', icon: Shield };
    case 'load_balancer':
      return { category: 'PERIMETER', color: '#39c5bb', accentBorder: '#1b7c75', icon: Layers };
    case 'vpn':
      return { category: 'GATEWAY', color: '#39c5bb', accentBorder: '#1b7c75', icon: KeyRound };
    case 'web_server':
      return { category: 'COMPUTE', color: '#58a6ff', accentBorder: '#1f6feb', icon: Server };
    case 'api_server':
      return { category: 'COMPUTE', color: '#58a6ff', accentBorder: '#1f6feb', icon: Cpu };
    case 'database':
      return { category: 'DATA', color: '#e3b341', accentBorder: '#9e6a03', icon: Database };
    case 'redis':
      return { category: 'CACHE', color: '#e3b341', accentBorder: '#9e6a03', icon: Zap };
    case 'admin':
      return { category: 'ADMIN', color: '#bc8cff', accentBorder: '#8957e5', icon: Lock };
    case 'internal_network':
    default:
      return { category: 'NETWORK', color: '#58a6ff', accentBorder: '#1f6feb', icon: Network };
  }
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  node,
  isSelected,
  isCritical,
  isHigh,
  isConnectionTarget,
  isHoveredFromFinding,
  isFocusedTarget,
  isOnAttackPath = false,
  attackHopIndex = null,
  isAttackTarget = false,
  isCompromisedOrigin = false,
  lateralDepth = null,
  isLateralCritical = false,
  isDimmed = false,
  degree,
  onSelect,
  onStartDrag,
  onStartConnection,
  onHoverConnectionTarget,
}) => {
  const catConfig = getNodeCategoryConfig(node.type);
  const Icon = catConfig.icon;

  // Base workstation node surface
  let borderClass = 'border-[#1c212c] hover:border-[#2f3747]';
  let bgClass = 'bg-[#0f1218]';
  let shadowClass = 'shadow-sm';

  if (isFocusedTarget) {
    borderClass = 'border-[#58a6ff] ring-2 ring-[#58a6ff]/60 shadow-[0_0_16px_rgba(88,166,255,0.35)]';
    bgClass = 'bg-[#121926]';
  } else if (isCompromisedOrigin) {
    borderClass = 'border-[#f0883e] ring-2 ring-[#f0883e]/70 shadow-[0_0_14px_rgba(240,136,62,0.3)]';
    bgClass = 'bg-[#1a1410]';
  } else if (isOnAttackPath) {
    borderClass = isAttackTarget
      ? 'border-[#f85149] ring-2 ring-[#f85149]/80 shadow-[0_0_18px_rgba(248,81,73,0.4)]'
      : 'border-[#f85149] ring-1 ring-[#f85149]/60 shadow-[0_0_12px_rgba(248,81,73,0.25)]';
    bgClass = 'bg-[#181114]';
  } else if (lateralDepth !== null && lateralDepth !== undefined) {
    if (isLateralCritical) {
      borderClass = 'border-[#f85149] ring-1 ring-[#f85149]/60 shadow-[0_0_12px_rgba(248,81,73,0.25)]';
      bgClass = 'bg-[#181114]';
    } else {
      borderClass = 'border-[#a371f7] ring-1 ring-[#a371f7]/50 shadow-[0_0_10px_rgba(163,113,247,0.2)]';
      bgClass = 'bg-[#14101d]';
    }
  } else if (isHoveredFromFinding) {
    borderClass = 'border-[#f0883e] ring-1 ring-[#f0883e]/70 shadow-[0_0_10px_rgba(240,136,62,0.3)]';
    bgClass = 'bg-[#16120e]';
  } else if (isConnectionTarget) {
    borderClass = 'border-[#388bfd] ring-2 ring-[#388bfd]/50';
    bgClass = 'bg-[#111a28]';
  } else if (isSelected) {
    borderClass = 'border-[#58a6ff] ring-1 ring-[#58a6ff]/70 shadow-md';
    bgClass = 'bg-[#131822]';
  } else if (isCritical) {
    borderClass = 'border-[#f85149]/70 hover:border-[#f85149]';
  } else if (isHigh) {
    borderClass = 'border-[#f0883e]/60 hover:border-[#f0883e]';
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(node.id);
    onStartDrag(node.id, e.clientX, e.clientY);
  };

  const handleOutputHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Output port handle located at midpoint right: x + 204, y + 37
    onStartConnection(node.id, node.position.x + 204, node.position.y + 37);
  };

  const zoneName = (node.metadata.zone ?? 'internal').toUpperCase();
  const cidrText = node.metadata.cidr || node.id;
  const servicePort = node.metadata.service?.port;
  const serviceProtocol = node.metadata.service?.protocol ?? 'TCP';
  const criticality = node.metadata.criticality ?? 'medium';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: '204px',
      }}
      className={`group rounded-sm border ${borderClass} ${bgClass} ${shadowClass} select-none z-10 cursor-grab active:cursor-grabbing transition-[opacity,box-shadow,border-color] duration-150 ${
        isDimmed ? 'opacity-20 hover:opacity-70' : 'opacity-100'
      }`}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => onHoverConnectionTarget(node.id)}
      onMouseLeave={() => onHoverConnectionTarget(null)}
    >
      {/* Input Connection Handle (Left Midpoint) */}
      <div
        className="absolute -left-[5px] top-[32px] w-[9px] h-[9px] rounded-full bg-[#0d1016] border border-[#58a6ff] hover:bg-[#58a6ff] hover:scale-125 transition-transform z-20 cursor-pointer"
        title="Input Connection Port"
        onMouseEnter={() => onHoverConnectionTarget(node.id)}
      />

      {/* Output Connection Handle (Right Midpoint) */}
      <div
        className="absolute -right-[5px] top-[32px] w-[9px] h-[9px] rounded-full bg-[#0d1016] border border-[#3fb950] hover:bg-[#3fb950] hover:scale-125 transition-transform z-20 cursor-crosshair"
        title="Drag from here to connect downstream asset"
        onMouseDown={handleOutputHandleMouseDown}
      />

      {/* Category Indicator Accent Stripe (Left edge) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xs"
        style={{ backgroundColor: catConfig.color }}
      />

      {/* Node Header Row */}
      <div className="flex items-center justify-between pl-3 pr-2 pt-1.5 pb-1 border-b border-[#1c212c]/80 text-[10px] font-mono leading-none">
        <div className="flex items-center space-x-1.5 truncate">
          <span style={{ color: catConfig.color }} className="inline-flex shrink-0">
            <Icon className="w-3 h-3" />
          </span>
          <span className="text-[#8b949e] uppercase font-medium tracking-tight truncate">
            {node.type.replace('_', ' ')}
          </span>
        </div>

        {/* Status / Zone Badge */}
        {isCompromisedOrigin ? (
          <span className="inline-flex items-center space-x-1 text-[9px] text-[#f0883e] font-semibold bg-[#f0883e]/15 px-1 rounded border border-[#f0883e]/30">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            <span>ORIGIN</span>
          </span>
        ) : isOnAttackPath ? (
          <span className="inline-flex items-center space-x-0.5 text-[9px] text-[#f85149] font-bold bg-[#f85149]/15 px-1 rounded border border-[#f85149]/40">
            {isAttackTarget ? (
              <>
                <Crosshair className="w-2.5 h-2.5 mr-0.5" />
                <span>TARGET</span>
              </>
            ) : attackHopIndex !== null ? (
              <>
                <Flame className="w-2.5 h-2.5 mr-0.5" />
                <span>HOP {attackHopIndex}</span>
              </>
            ) : (
              <span>ON PATH</span>
            )}
          </span>
        ) : lateralDepth !== null && lateralDepth !== undefined ? (
          <span
            className={`inline-flex items-center text-[9px] font-semibold px-1 rounded border ${
              isLateralCritical
                ? 'text-[#f85149] bg-[#f85149]/15 border-[#f85149]/30'
                : 'text-[#d2a8ff] bg-[#d2a8ff]/15 border-[#d2a8ff]/30'
            }`}
          >
            +{lateralDepth} HOP
          </span>
        ) : isCritical ? (
          <span className="inline-flex items-center text-[9px] text-[#f85149] font-bold bg-[#f85149]/15 px-1 rounded border border-[#f85149]/30">
            CRITICAL
          </span>
        ) : (
          <span className="text-[9px] text-[#7d8590] tracking-tight">
            {zoneName}
          </span>
        )}
      </div>

      {/* Node Body Row: Asset Identity */}
      <div className="pl-3 pr-2.5 py-1.5">
        <div
          className="text-xs font-semibold text-[#f0f3f6] truncate font-sans tracking-tight"
          title={node.name}
        >
          {node.name}
        </div>

        {/* Technical Metadata Row */}
        <div className="flex items-center justify-between text-[10px] font-mono text-[#7d8590] mt-1">
          <span className="truncate max-w-[110px]" title={cidrText}>
            {cidrText}
          </span>

          <div className="flex items-center space-x-1 shrink-0">
            {servicePort ? (
              <span className="text-[9px] text-[#58a6ff] bg-[#161c28] px-1 py-0.2 rounded border border-[#232c3d] font-mono">
                {serviceProtocol}:{servicePort}
              </span>
            ) : null}

            {criticality === 'critical' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#f85149]" title="Critical Asset" />
            ) : criticality === 'high' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#f0883e]" title="High Criticality" />
            ) : null}
          </div>
        </div>
      </div>

      {/* Node Footer: Compact Technical Connectivity */}
      <div className="flex items-center justify-between pl-3 pr-2.5 py-0.5 border-t border-[#1c212c]/60 text-[9px] font-mono text-[#484f58] bg-[#090b0f]/60">
        <span className="text-[#656d76]">deg: {degree.inDegree}↓ {degree.outDegree}↑</span>
        <span className="uppercase text-[#656d76]">{catConfig.category}</span>
      </div>
    </div>
  );
};
