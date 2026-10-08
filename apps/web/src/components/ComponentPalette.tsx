import React, { useState } from 'react';
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
  Plus,
  ChevronLeft,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { CoreNodeType } from '@pathforge/shared';

interface PaletteItem {
  type: CoreNodeType;
  label: string;
  zone: string;
  category: 'perimeter' | 'compute' | 'data' | 'mgmt' | 'net';
  icon: React.ComponentType<{ className?: string }>;
}

const PALETTE_GROUPS: {
  id: string;
  title: string;
  items: PaletteItem[];
}[] = [
  {
    id: 'perimeter',
    title: 'PERIMETER & INGRESS',
    items: [
      { type: 'internet', label: 'Internet', zone: 'public', category: 'perimeter', icon: Globe },
      { type: 'firewall', label: 'Firewall / WAF', zone: 'dmz', category: 'perimeter', icon: Shield },
      { type: 'load_balancer', label: 'Load Balancer', zone: 'dmz', category: 'perimeter', icon: Layers },
      { type: 'vpn', label: 'VPN Gateway', zone: 'dmz', category: 'perimeter', icon: KeyRound },
    ],
  },
  {
    id: 'compute',
    title: 'COMPUTE & APP TIER',
    items: [
      { type: 'web_server', label: 'Web Server', zone: 'dmz', category: 'compute', icon: Server },
      { type: 'api_server', label: 'API Server', zone: 'internal', category: 'compute', icon: Cpu },
    ],
  },
  {
    id: 'data',
    title: 'DATA TIER',
    items: [
      { type: 'database', label: 'Database (SQL)', zone: 'restricted', category: 'data', icon: Database },
      { type: 'redis', label: 'Redis / Cache', zone: 'restricted', category: 'data', icon: Zap },
    ],
  },
  {
    id: 'mgmt',
    title: 'MANAGEMENT & CONTROL',
    items: [
      { type: 'admin', label: 'Admin Portal', zone: 'management', category: 'mgmt', icon: Lock },
    ],
  },
  {
    id: 'net',
    title: 'NETWORK SEGMENTS',
    items: [
      { type: 'internal_network', label: 'Internal Net', zone: 'internal', category: 'net', icon: Network },
      { type: 'external_network', label: 'External Net', zone: 'public', category: 'net', icon: Share2 },
    ],
  },
];

interface ComponentPaletteProps {
  onAddNodeType?: (type: CoreNodeType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onAddNodeType }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`border-r border-[#1c212c] bg-[#0c0e14] flex flex-col h-full select-none transition-all duration-150 z-20 ${
        isCollapsed ? 'w-11' : 'w-48'
      }`}
    >
      {/* Header Bar */}
      <div className="h-9 px-2.5 border-b border-[#1c212c] flex items-center justify-between bg-[#0a0c10]">
        {!isCollapsed && (
          <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8b949e] font-semibold">
            <Boxes className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Asset Palette</span>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded text-[#7d8590] hover:text-[#f0f3f6] hover:bg-[#151922] transition-colors ml-auto"
          title={isCollapsed ? 'Expand Asset Palette' : 'Collapse Palette'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Palette Items List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-2.5">
        {PALETTE_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1">
            {!isCollapsed && (
              <div className="text-[9px] uppercase font-mono tracking-wider text-[#484f58] px-1 font-semibold">
                {group.title}
              </div>
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;

                if (isCollapsed) {
                  return (
                    <button
                      key={item.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/pathforge-node-type', item.type);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => onAddNodeType?.(item.type)}
                      className="w-8 h-8 rounded border border-transparent hover:border-[#2f3747] hover:bg-[#151922] flex items-center justify-center text-[#8b949e] hover:text-[#58a6ff] transition-all cursor-grab active:cursor-grabbing mx-auto"
                      title={`${item.label} (${item.zone}) — Drag to canvas or click to add`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                }

                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/pathforge-node-type', item.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAddNodeType?.(item.type)}
                    className="group flex items-center justify-between px-2 py-1.5 rounded border border-transparent hover:border-[#222a38] hover:bg-[#12161f] text-xs text-[#c9d1d9] transition-all cursor-grab active:cursor-grabbing"
                    title={`Drag onto canvas or click to add ${item.label}`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Icon className="w-3.5 h-3.5 text-[#7d8590] group-hover:text-[#58a6ff] shrink-0 transition-colors" />
                      <span className="font-sans text-[11px] font-medium truncate text-[#d0d7de] group-hover:text-white">
                        {item.label}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-[#161a24] text-[#7d8590] border border-[#202634] uppercase">
                        {item.zone.slice(0, 4)}
                      </span>
                      <Plus className="w-2.5 h-2.5 text-[#58a6ff] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Hints */}
      {!isCollapsed && (
        <div className="p-2 border-t border-[#1c212c] bg-[#090b0f] text-[9px] font-mono text-[#484f58] space-y-0.5">
          <div className="text-[#7d8590] font-semibold">WORKBENCH CONTROLS</div>
          <div>• Drag port to connect</div>
          <div>• Space + Drag to pan</div>
          <div>• Del / Backspace to remove</div>
        </div>
      )}
    </aside>
  );
};
