import React, { useState } from 'react';
import { Finding, Severity } from '@pathforge/shared';
import {
  ChevronUp,
  ChevronDown,
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldCheck,
  CheckCircle2,
  Wrench,
  HelpCircle,
} from 'lucide-react';

interface FindingsDrawerProps {
  findings: Finding[];
  onSelectNode: (nodeId: string) => void;
}

const getSeverityBadge = (sev: Severity) => {
  switch (sev) {
    case 'critical':
      return {
        bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30',
        icon: AlertOctagon,
      };
    case 'high':
      return {
        bg: 'bg-[#f0883e]/15 text-[#f0883e] border-[#f0883e]/30',
        icon: AlertTriangle,
      };
    case 'medium':
      return {
        bg: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/30',
        icon: AlertTriangle,
      };
    default:
      return {
        bg: 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/30',
        icon: Info,
      };
  }
};

export const FindingsDrawer: React.FC<FindingsDrawerProps> = ({
  findings,
  onSelectNode,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(
    findings[0]?.id ?? null
  );

  return (
    <div
      className={`border-t border-[#222630] bg-[#111318] transition-all duration-200 select-none flex flex-col ${
        isOpen ? 'h-64' : 'h-9'
      }`}
    >
      {/* Drawer Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-4 flex items-center justify-between border-b border-[#222630] cursor-pointer hover:bg-[#161a22] transition-colors"
      >
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="font-semibold text-[#e6edf3]">
            SECURITY FINDINGS & REASONING
          </span>
          <span className="px-1.5 py-0.2 rounded bg-[#1f242e] text-[#8b949e] border border-[#2b323f] text-[10px]">
            {findings.length} Finding{findings.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[#8b949e] text-xs font-mono">
          <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div className="flex-1 flex overflow-hidden">
          {findings.length === 0 ? (
            <div className="flex-1 flex items-center justify-center space-x-2 text-xs font-mono text-[#3fb950]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Zero security violations detected in this topology configuration.</span>
            </div>
          ) : (
            <>
              {/* Finding List (Left Side of Drawer) */}
              <div className="w-96 border-r border-[#222630] overflow-y-auto p-2 space-y-1">
                {findings.map((f) => {
                  const isExpanded = expandedFindingId === f.id;
                  const sevInfo = getSeverityBadge(f.severity);
                  const Icon = sevInfo.icon;

                  return (
                    <div
                      key={f.id}
                      onClick={() => setExpandedFindingId(f.id)}
                      className={`p-2 rounded border cursor-pointer text-xs font-mono transition-all ${
                        isExpanded
                          ? 'bg-[#181d26] border-[#388bfd]'
                          : 'bg-[#14171d] border-[#222630] hover:border-[#2e3440]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded border font-semibold flex items-center space-x-1 ${sevInfo.bg}`}
                        >
                          <Icon className="w-2.5 h-2.5 mr-0.5" />
                          <span>{f.severity}</span>
                        </span>
                        <span className="text-[10px] text-[#5c6370]">{f.ruleId}</span>
                      </div>
                      <div className="text-[#c9d1d9] font-medium truncate text-[11px]">
                        {f.title}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Finding Deep Dive (Right Side of Drawer — 6 Dimensions) */}
              <div className="flex-1 overflow-y-auto p-4 bg-[#0d0f12] text-xs font-mono space-y-3">
                {(() => {
                  const currentFinding =
                    findings.find((f) => f.id === expandedFindingId) ?? findings[0];
                  if (!currentFinding) return null;

                  return (
                    <div className="space-y-3">
                      {/* Title & Rule */}
                      <div className="flex items-baseline justify-between border-b border-[#222630] pb-2">
                        <div>
                          <span className="text-white font-medium text-sm">
                            {currentFinding.title}
                          </span>
                          <span className="text-[#5c6370] ml-2 text-[10px]">
                            Rule: {currentFinding.ruleId} · Category: {currentFinding.category}
                          </span>
                        </div>
                      </div>

                      {/* Explanation Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* What & Why */}
                        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
                          <div className="text-[10px] uppercase text-[#f85149] font-semibold flex items-center space-x-1">
                            <HelpCircle className="w-3 h-3" />
                            <span>1. What is Wrong & Why It Matters</span>
                          </div>
                          <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                            {currentFinding.whyItMatters}
                          </div>
                        </div>

                        {/* Impact & Exploitation */}
                        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
                          <div className="text-[10px] uppercase text-[#f0883e] font-semibold flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>2. Threat Impact & Exploitation Scenario</span>
                          </div>
                          <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                            {currentFinding.impact}
                          </div>
                        </div>

                        {/* Recommendation */}
                        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
                          <div className="text-[10px] uppercase text-[#388bfd] font-semibold flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>3. Recommended Architecture</span>
                          </div>
                          <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                            {currentFinding.recommendation}
                          </div>
                        </div>

                        {/* Remediation Action */}
                        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
                          <div className="text-[10px] uppercase text-[#3fb950] font-semibold flex items-center space-x-1">
                            <Wrench className="w-3 h-3" />
                            <span>4. Concrete Fix Steps</span>
                          </div>
                          <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                            {currentFinding.remediation}
                          </div>
                        </div>
                      </div>

                      {/* Affected Components */}
                      <div className="flex items-center space-x-2 pt-1 text-[11px]">
                        <span className="text-[#8b949e]">Affected Nodes:</span>
                        {currentFinding.affectedNodes.map((nId) => (
                          <button
                            key={nId}
                            onClick={() => onSelectNode(nId)}
                            className="px-2 py-0.5 rounded bg-[#1c2333] border border-[#388bfd]/30 text-[#58a6ff] hover:bg-[#253046] transition-colors"
                          >
                            {nId}
                          </button>
                        ))}
                        {currentFinding.affectedEdges.length > 0 && (
                          <>
                            <span className="text-[#8b949e] ml-2">Affected Edges:</span>
                            {currentFinding.affectedEdges.map((eId) => (
                              <span
                                key={eId}
                                className="px-1.5 py-0.5 rounded bg-[#2a1b1d] border border-[#da3633]/30 text-[#f85149]"
                              >
                                {eId}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
