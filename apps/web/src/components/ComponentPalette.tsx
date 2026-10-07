import React from 'react';
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
} from 'lucide-react';
import { CoreNodeType } from '@pathforge/shared';

interface PaletteItem {
  type: CoreNodeType;
  label: string;
  zone: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'internet', label: 'Internet', zone: 'public', icon: Globe },
  { type: 'firewall', label: 'Firewall / WAF', zone: 'perimeter', icon: Shield },
  { type: 'load_balancer', label: 'Load Balancer', zone: 'perimeter', icon: Layers },
  { type: 'web_server', label: 'Web Server', zone: 'dmz', icon: Server },
  { type: 'api_server', label: 'API Server', zone: 'private', icon: Cpu },
  { type: 'database', label: 'Database (SQL)', zone: 'restricted', icon: Database },
  { type: 'redis', label: 'Redis / Cache', zone: 'restricted', icon: Zap },
  { type: 'admin', label: 'Admin Portal', zone: 'management', icon: Lock },
  { type: 'vpn', label: 'VPN Gateway', zone: 'gateway', icon: KeyRound },
  { type: 'internal_network', label: 'Internal Net', zone: 'private', icon: Network },
  { type: 'external_network', label: 'External Net', zone: 'untrusted', icon: Share2 },
];

interface ComponentPaletteProps {
  onAddNodeType?: (type: CoreNodeType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onAddNodeType }) => {
  return (
    <aside className="w-56 border-r border-[#222630] bg-[#111318] flex flex-col h-full select-none">
      <div className="px-3 py-2.5 border-b border-[#222630] flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b949e] font-semibold">
          Node Palette
        </span>
        <span className="text-[10px] text-[#5c6370] font-mono">11 Types</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-[10px] uppercase font-mono text-[#5c6370] px-2 pt-1 pb-1">
          Infrastructure
        </div>
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/pathforge-node-type', item.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onAddNodeType?.(item.type)}
              className="group flex items-center justify-between px-2.5 py-1.5 rounded border border-transparent hover:border-[#2a303c] hover:bg-[#181c24] text-xs text-[#c9d1d9] transition-all cursor-grab active:cursor-grabbing hover:shadow-sm"
              title={`Drag onto canvas or click to add ${item.label}`}
            >
              <div className="flex items-center space-x-2">
                <Icon className="w-3.5 h-3.5 text-[#8b949e] group-hover:text-[#58a6ff] transition-colors" />
                <span className="font-mono text-xs">{item.label}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[#1f242e] text-[#8b949e] border border-[#2b323f]">
                  {item.zone}
                </span>
                <Plus className="w-2.5 h-2.5 text-[#5c6370] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-[#222630] bg-[#0d0f12]">
        <div className="text-[10px] font-mono text-[#5c6370] leading-relaxed">
          <span className="text-[#8b949e] font-medium">Interactive Canvas</span>
          <br />
          • Drag items from palette onto canvas
          <br />
          • Drag green port to connect nodes
          <br />
          • Press Delete / Backspace to remove
        </div>
      </div>
    </aside>
  );
};
