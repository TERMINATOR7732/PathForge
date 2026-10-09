import React from 'react';
import {
  ScenarioDefinition,
  getAllScenarios,
} from '@pathforge/core';
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Flame,
  CheckCircle2,
  X,
  ArrowRight,
  Layers,
  Sparkles,
  PlusCircle,
} from 'lucide-react';

interface ScenarioModalProps {
  isOpen: boolean;
  activeScenarioId: string;
  onClose: () => void;
  onSelectScenario: (scenarioId: string) => void;
}

interface ScenarioOptionItem {
  id: string;
  name: string;
  shortDescription: string;
  purpose: string;
  riskBadge: {
    bg: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  };
  isRecommended?: boolean;
  isScratch?: boolean;
  flowPreview?: string;
}

const getRiskBadge = (level: ScenarioDefinition['riskLevel'], label: string) => {
  switch (level) {
    case 'hardened':
      return {
        bg: 'bg-[#14261b] text-[#3fb950] border-[#238636]/60',
        icon: ShieldCheck,
        label,
      };
    case 'critical':
      return {
        bg: 'bg-[#2d1519] text-[#f85149] border-[#da3633]/60',
        icon: AlertOctagon,
        label,
      };
    case 'high':
      return {
        bg: 'bg-[#291b15] text-[#f0883e] border-[#f0883e]/60',
        icon: AlertTriangle,
        label,
      };
    case 'chaos':
      return {
        bg: 'bg-[#241733] text-[#d2a8ff] border-[#8957e5]/60',
        icon: Flame,
        label,
      };
  }
};

export const ScenarioModal: React.FC<ScenarioModalProps> = ({
  isOpen,
  activeScenarioId,
  onClose,
  onSelectScenario,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const catalogScenarios = getAllScenarios();

  // Map into the ordered 5 options specified in Phase C:
  // 1. Exposed database (recommended for beginners)
  // 2. Flat network
  // 3. Chaos Lab
  // 4. Secure web application
  // 5. Build from scratch
  const publicDb = catalogScenarios.find((s) => s.id === 'public-db-exposure');
  const flatNet = catalogScenarios.find((s) => s.id === 'flat-network');
  const chaosLab = catalogScenarios.find((s) => s.id === 'chaos-lab');
  const secureWeb = catalogScenarios.find((s) => s.id === 'secure-web-app');

  const scenarioItems: ScenarioOptionItem[] = [
    ...(publicDb
      ? [
          {
            id: publicDb.id,
            name: 'Exposed Database',
            shortDescription: 'Understand public database reachability and access restrictions.',
            purpose:
              'Simulate a PostgreSQL database mistakenly exposed to public Internet ingress with no perimeter boundary. Learn how automated remediation restricts access.',
            riskBadge: getRiskBadge(publicDb.riskLevel, 'Critical Exposure'),
            isRecommended: true,
            flowPreview: publicDb.topologyPreview,
          },
        ]
      : []),
    ...(flatNet
      ? [
          {
            id: flatNet.id,
            name: 'Flat Network',
            shortDescription: 'Explore segmentation weaknesses and possible lateral movement.',
            purpose:
              'Analyze lateral traversal risks when internal corporate subnets bridge directly to incoming traffic without DMZ reverse proxies or VLAN isolation.',
            riskBadge: getRiskBadge(flatNet.riskLevel, 'High Risk'),
            flowPreview: flatNet.topologyPreview,
          },
        ]
      : []),
    ...(chaosLab
      ? [
          {
            id: chaosLab.id,
            name: 'Chaos Lab',
            shortDescription: 'Experiment with deliberately unsafe or unrealistic connections.',
            purpose:
              'Multi-zone sandbox featuring anomalous bypasses, unencrypted channels, and extreme blast radiuses. Freely experiment with arbitrary topology changes.',
            riskBadge: getRiskBadge(chaosLab.riskLevel, 'Unconstrained Chaos'),
            flowPreview: chaosLab.topologyPreview,
          },
        ]
      : []),
    ...(secureWeb
      ? [
          {
            id: secureWeb.id,
            name: 'Secure Web Application',
            shortDescription: 'Explore a well-structured application architecture.',
            purpose:
              'Production-ready 3-tier reference model: Ingress WAF, DMZ reverse proxy, microservice API tier, and isolated relational database and Redis cache.',
            riskBadge: getRiskBadge(secureWeb.riskLevel, 'Hardened Baseline'),
            flowPreview: secureWeb.topologyPreview,
          },
        ]
      : []),
    {
      id: 'scratch',
      name: 'Build from Scratch',
      shortDescription: 'Start with an empty canvas and place your own components and connections.',
      purpose:
        'A blank engineering workspace. Drag components from the left palette onto the canvas, connect ports, and test your own architecture ideas against the security validator.',
      riskBadge: {
        bg: 'bg-[#161b24] text-[#8b949e] border-[#30363d]',
        icon: PlusCircle,
        label: 'Empty Canvas',
      },
      isScratch: true,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 font-sans select-none overflow-x-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-modal-title"
    >
      <div className="w-full max-w-3xl min-w-0 rounded-lg bg-[#111318] border border-[#30363d] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3.5 border-b border-[#222630] bg-[#0d0f14] flex items-center justify-between min-w-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-[#388bfd]/15 border border-[#388bfd]/30 flex items-center justify-center text-[#58a6ff]">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div id="scenario-modal-title" className="text-sm font-semibold text-white tracking-wide">
                What would you like to explore?
              </div>
              <div className="text-[11px] text-[#8b949e]">
                Select a verified reference model or start building your own infrastructure
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#212631] focus:outline-hidden focus:ring-1 focus:ring-[#388bfd] transition-colors cursor-pointer"
            title="Close chooser (Esc)"
            aria-label="Close scenario chooser"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scenarios List */}
        <div className="p-4 overflow-y-auto space-y-3 bg-[#0e1015]">
          {scenarioItems.map((item) => {
            const isActive =
              (item.id === 'scratch' && activeScenarioId === 'scratch') ||
              item.id === activeScenarioId;
            const BadgeIcon = item.riskBadge.icon;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-md border transition-all text-xs space-y-2 ${
                  isActive
                    ? 'bg-[#161b24] border-[#388bfd]/80 shadow-md ring-1 ring-[#388bfd]/40'
                    : item.isRecommended
                    ? 'bg-[#13161c] border-[#388bfd]/50 hover:border-[#388bfd]'
                    : 'bg-[#13161c] border-[#222630] hover:border-[#30363d]'
                }`}
              >
                {/* Title & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">
                        {item.name}
                      </span>
                      {item.isRecommended && (
                        <span className="px-2 py-0.5 rounded bg-[#388bfd]/20 text-[#58a6ff] border border-[#388bfd]/50 text-[10px] font-bold flex items-center space-x-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>RECOMMENDED FOR BEGINNERS</span>
                        </span>
                      )}
                      {isActive && (
                        <span className="px-2 py-0.5 rounded bg-[#238636]/20 text-[#3fb950] border border-[#238636]/50 text-[10px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8b949e]">
                      {item.shortDescription}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center space-x-1.5 border shrink-0 ${item.riskBadge.bg}`}
                  >
                    <BadgeIcon className="w-3 h-3" />
                    <span>{item.riskBadge.label}</span>
                  </span>
                </div>

                {/* Purpose / Narrative */}
                <div className="text-[11px] text-[#c9d1d9] leading-relaxed bg-[#0c0e12] p-2 rounded border border-[#1b1f27]">
                  {item.purpose}
                </div>

                {/* Flow preview & action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-[#8b949e] border-t border-[#1e232d] min-w-0">
                  <div className="flex items-center space-x-1.5 min-w-0 overflow-hidden w-full sm:w-auto">
                    {item.flowPreview && (
                      <>
                        <span className="text-[#5c6370] shrink-0">Flow:</span>
                        <span className="font-mono text-[#abb2bf] text-[10px] truncate block min-w-0">
                          {item.flowPreview}
                        </span>
                      </>
                    )}
                    {item.isScratch && (
                      <span className="text-[#5c6370] shrink-0">Workspace:</span>
                    )}
                    {item.isScratch && (
                      <span className="text-[#abb2bf] text-[10px] truncate block min-w-0">Empty canvas ready for drag-and-drop modeling</span>
                    )}
                  </div>

                  {isActive ? (
                    <div className="flex items-center space-x-1 text-[#3fb950] text-[11px] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Loaded in Canvas</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectScenario(item.id);
                        onClose();
                      }}
                      className="px-3 py-1 rounded bg-[#1f6feb] text-white hover:bg-[#388bfd] transition-colors text-xs font-semibold flex items-center space-x-1.5 shadow-sm cursor-pointer shrink-0 self-end sm:self-auto"
                    >
                      <span>{item.isScratch ? 'Start Empty Canvas' : 'Load Scenario'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#222630] bg-[#0d0f14] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#8b949e]">
          <div className="text-[#8b949e]">
            Deterministic local-first security simulator. Insecure connections are permitted and analyzed.
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded bg-[#212631] text-[#c9d1d9] hover:text-white hover:bg-[#303746] transition-colors text-xs font-medium cursor-pointer"
            >
              Skip to Workbench
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
