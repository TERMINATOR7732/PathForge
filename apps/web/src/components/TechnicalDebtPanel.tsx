import React, { useState } from 'react';
import {
  TechnicalDebtAssessment,
  DebtCategory,
  DebtPriority,
  DebtStatus,
  DebtRating,
} from '@pathforge/core';
import {
  Coins,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  SlidersHorizontal,
  Shield,
  Activity,
  Boxes,
  Lock,
  FlaskConical,
  Server,
  Network,
} from 'lucide-react';

interface TechnicalDebtPanelProps {
  assessment: TechnicalDebtAssessment;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onSelectTab?: (
    tab:
      | 'findings'
      | 'attack-paths'
      | 'blast-radius'
      | 'verification'
      | 'architecture'
      | 'readiness'
      | 'testing'
      | 'debt'
  ) => void;
}

export const TechnicalDebtPanel: React.FC<TechnicalDebtPanelProps> = ({
  assessment,
  onLocateElement,
  onSelectTab: _onSelectTab,
}) => {
  const [activeSection, setActiveSection] = useState<
    'backlog' | 'categories' | 'roadmap' | 'governance'
  >('backlog');
  const [priorityFilter, setPriorityFilter] = useState<'all' | DebtPriority>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DebtCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DebtStatus>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(
    assessment.items[0]?.id ?? null
  );

  const { summary, items, activeItems } = assessment;

  // Deterministic resolution roadmap from sorted active items
  const resolutionRoadmap = activeItems.map((item, idx) => ({
    step: idx + 1,
    itemId: item.id,
    priority: item.priority,
    priorityScore: item.priorityScore,
    title: item.title,
    rationale: item.summary,
    recommendation: item.recommendation,
  }));

  // Rating badge styling
  const getRatingBadge = (rating: DebtRating) => {
    switch (rating) {
      case 'LOW_DEBT':
        return {
          bg: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/40',
          bar: 'bg-[#238636]',
          label: 'LOW DEBT',
        };
      case 'MANAGEABLE':
        return {
          bg: 'bg-[#2ea043]/15 text-[#3fb950] border-[#2ea043]/40',
          bar: 'bg-[#2ea043]',
          label: 'MANAGEABLE',
        };
      case 'ELEVATED':
        return {
          bg: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
          bar: 'bg-[#d29922]',
          label: 'ELEVATED DEBT',
        };
      case 'HIGH':
        return {
          bg: 'bg-[#f0883e]/15 text-[#f0883e] border-[#f0883e]/40',
          bar: 'bg-[#f0883e]',
          label: 'HIGH DEBT',
        };
      case 'SEVERE':
      default:
        return {
          bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
          bar: 'bg-[#da3633]',
          label: 'SEVERE DEBT',
        };
    }
  };

  const getPriorityBadge = (priority: DebtPriority) => {
    switch (priority) {
      case 'P0':
        return 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/50';
      case 'P1':
        return 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/50';
      case 'P2':
        return 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/50';
      case 'P3':
      default:
        return 'bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/50';
    }
  };

  const getStatusBadge = (status: DebtStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-[#f85149]/10 text-[#f85149] border-[#f85149]/30';
      case 'MITIGATED':
        return 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30';
      case 'UNVERIFIED':
      default:
        return 'bg-[#8b949e]/15 text-[#8b949e] border-[#8b949e]/30';
    }
  };

  const getCategoryIcon = (cat: DebtCategory) => {
    switch (cat) {
      case 'security-debt':
        return <Shield className="w-3.5 h-3.5 text-[#f85149]" />;
      case 'architecture-debt':
        return <Boxes className="w-3.5 h-3.5 text-[#f0883e]" />;
      case 'resilience-debt':
        return <Activity className="w-3.5 h-3.5 text-[#d29922]" />;
      case 'access-control-debt':
        return <Lock className="w-3.5 h-3.5 text-[#e3b341]" />;
      case 'testing-debt':
        return <FlaskConical className="w-3.5 h-3.5 text-[#58a6ff]" />;
      case 'operational-debt':
        return <Server className="w-3.5 h-3.5 text-[#bc8cff]" />;
      case 'complexity-debt':
      default:
        return <Network className="w-3.5 h-3.5 text-[#a5d6ff]" />;
    }
  };

  const ratingInfo = getRatingBadge(summary.rating);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0d0f13] text-[#c9d1d9] font-mono text-xs">
      {/* Top Banner: Score, Rating & Key Counts */}
      <div className="p-4 border-b border-[#222630] bg-[#111318]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-[#161b22] border border-[#30363d] text-[#e3b341]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold tracking-wide text-[#f0f6fc]">
                  TECHNICAL DEBT & RISK BACKLOG
                </span>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold tracking-wider ${ratingInfo.bg}`}
                >
                  {ratingInfo.label}
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] mt-0.5">
                Deterministic structural debt tracking & engineering risk prioritization
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Score Indicator */}
            <div className="flex flex-col items-end">
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-bold text-[#f0f6fc]">
                  {summary.overallScore}
                </span>
                <span className="text-[11px] text-[#8b949e]">/ 100</span>
              </div>
              <span className="text-[10px] text-[#8b949e] uppercase tracking-wider">
                Debt Health Score
              </span>
            </div>
          </div>
        </div>

        {/* Health Score Bar */}
        <div className="mt-3 w-full bg-[#21262d] h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${ratingInfo.bar}`}
            style={{ width: `${Math.max(5, summary.overallScore)}%` }}
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-3 pt-3 border-t border-[#222630]/60">
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d]/60">
            <div className="text-[10px] text-[#8b949e]">ACTIVE DEBT</div>
            <div className="text-base font-bold text-[#f0f6fc] mt-0.5">
              {summary.activeCount}
            </div>
          </div>
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d]/60">
            <div className="text-[10px] text-[#f85149]">P0 BLOCKERS</div>
            <div className="text-base font-bold text-[#f85149] mt-0.5">
              {summary.p0Count}
            </div>
          </div>
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d]/60">
            <div className="text-[10px] text-[#f0883e]">P1 HIGH RISK</div>
            <div className="text-base font-bold text-[#f0883e] mt-0.5">
              {summary.p1Count}
            </div>
          </div>
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d]/60">
            <div className="text-[10px] text-[#d29922]">P2 STRUCTURAL</div>
            <div className="text-base font-bold text-[#d29922] mt-0.5">
              {summary.p2Count}
            </div>
          </div>
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d]/60">
            <div className="text-[10px] text-[#58a6ff]">P3 CLEANUP</div>
            <div className="text-base font-bold text-[#58a6ff] mt-0.5">
              {summary.p3Count}
            </div>
          </div>
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d]/60">
            <div className="text-[10px] text-[#3fb950]">MITIGATED</div>
            <div className="text-base font-bold text-[#3fb950] mt-0.5">
              {summary.mitigatedCount}
            </div>
          </div>
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d]/60">
            <div className="text-[10px] text-[#8b949e]">UNVERIFIED</div>
            <div className="text-base font-bold text-[#8b949e] mt-0.5">
              {summary.unverifiedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#222630] bg-[#111318] px-4 space-x-1">
        <button
          onClick={() => setActiveSection('backlog')}
          className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
            activeSection === 'backlog'
              ? 'border-[#58a6ff] text-[#f0f6fc]'
              : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          PRIORITIZED BACKLOG ({items.length})
        </button>
        <button
          onClick={() => setActiveSection('categories')}
          className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
            activeSection === 'categories'
              ? 'border-[#58a6ff] text-[#f0f6fc]'
              : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          CATEGORIES & SPREAD
        </button>
        <button
          onClick={() => setActiveSection('roadmap')}
          className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
            activeSection === 'roadmap'
              ? 'border-[#58a6ff] text-[#f0f6fc]'
              : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          RESOLUTION ROADMAP ({resolutionRoadmap.length})
        </button>
        <button
          onClick={() => setActiveSection('governance')}
          className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
            activeSection === 'governance'
              ? 'border-[#58a6ff] text-[#f0f6fc]'
              : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          GOVERNANCE & BOUNDARIES
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* SECTION 1: PRIORITIZED BACKLOG */}
        {activeSection === 'backlog' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#161b22] rounded border border-[#30363d]/60">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-[11px] text-[#8b949e] flex items-center mr-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                  Priority:
                </span>
                {(['all', 'P0', 'P1', 'P2', 'P3'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(p)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                      priorityFilter === p
                        ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#1f6feb]/50 font-semibold'
                        : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-[#c9d1d9]'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-[11px] text-[#8b949e]">Status:</span>
                {(['all', 'ACTIVE', 'MITIGATED', 'UNVERIFIED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                      statusFilter === s
                        ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#1f6feb]/50 font-semibold'
                        : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-[#c9d1d9]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Items List */}
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center bg-[#161b22] rounded border border-[#30363d]/60">
                <CheckCircle2 className="w-8 h-8 text-[#3fb950] mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-[#f0f6fc]">
                  No technical debt items match current filters
                </p>
                <p className="text-xs text-[#8b949e] mt-1">
                  Adjust priority or status filters above to view other recorded debt items.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded border transition-colors ${
                        isExpanded
                          ? 'bg-[#161b22] border-[#388bfd]/50'
                          : 'bg-[#161b22]/70 border-[#30363d]/60 hover:border-[#388bfd]/30'
                      }`}
                    >
                      {/* Header Row */}
                      <div
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className="p-3 cursor-pointer flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {getCategoryIcon(item.category)}
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getPriorityBadge(
                              item.priority
                            )}`}
                          >
                            {item.priority}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${getStatusBadge(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                          <span className="font-semibold text-[#f0f6fc] truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-[#8b949e] px-1.5 py-0.2 rounded bg-[#21262d]">
                            {item.definitionId}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="flex items-center space-x-1">
                            <span className="text-[11px] text-[#8b949e]">Score:</span>
                            <span className="text-xs font-bold text-[#f0f6fc]">
                              {item.priorityScore}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#8b949e]">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-[#222630] space-y-3">
                          {/* Summary */}
                          <div>
                            <div className="text-[10px] text-[#8b949e] uppercase font-semibold">
                              Observable Summary
                            </div>
                            <p className="text-xs text-[#c9d1d9] mt-0.5 leading-relaxed">
                              {item.summary}
                            </p>
                          </div>

                          {/* Why It Matters / Future Cost */}
                          <div className="p-2.5 rounded bg-[#1c2128] border border-[#30363d] space-y-1">
                            <div className="flex items-center space-x-1.5 text-[#e3b341]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-semibold">
                                Why It Matters (Future Engineering Cost)
                              </span>
                            </div>
                            <p className="text-xs text-[#c9d1d9] leading-relaxed">
                              {item.whyItMatters}
                            </p>
                            <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-[#30363d]/60 text-[10px] text-[#8b949e]">
                              <span>Impact Type:</span>
                              <span className="text-[#f0f6fc] font-semibold">
                                {item.debtImpact}
                              </span>
                              <span className="mx-1">•</span>
                              <span>Future Risk:</span>
                              <span className="text-[#f0f6fc] font-semibold">
                                {item.futureChangeImpact}
                              </span>
                            </div>
                          </div>

                          {/* Priority Calculation Factors */}
                          <div>
                            <div className="text-[10px] text-[#8b949e] uppercase font-semibold mb-1">
                              Transparent Priority Factors ({item.priorityScore} pts)
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.priorityFactors.map((f) => (
                                <span
                                  key={f.id}
                                  className="px-2 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[10px] text-[#c9d1d9]"
                                >
                                  {f.label}{' '}
                                  <span className="text-[#58a6ff] font-semibold">
                                    (+{f.points})
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Evidence & Caused By */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="p-2 rounded bg-[#0d0f13] border border-[#30363d]/60">
                              <div className="text-[10px] text-[#8b949e] uppercase font-semibold mb-1">
                                Concrete Evidence Source ({item.sourceAnalysis})
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {item.evidence.length > 0 ? (
                                  item.evidence.map((ev) => (
                                    <span
                                      key={ev}
                                      className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[10px] text-[#8b949e]"
                                    >
                                      {ev}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-[#8b949e]">
                                    No direct validation findings
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="p-2 rounded bg-[#0d0f13] border border-[#30363d]/60">
                              <div className="text-[10px] text-[#8b949e] uppercase font-semibold mb-1">
                                Affected Components
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {item.affectedNodeIds.map((nodeId) => (
                                  <button
                                    key={nodeId}
                                    onClick={() =>
                                      onLocateElement({ id: nodeId, type: 'node' })
                                    }
                                    className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[10px] text-[#58a6ff] hover:border-[#58a6ff] flex items-center space-x-1"
                                    title="Locate node on canvas"
                                  >
                                    <Crosshair className="w-2.5 h-2.5 mr-0.5" />
                                    <span>{nodeId}</span>
                                  </button>
                                ))}
                                {item.affectedEdgeIds.map((edgeId) => (
                                  <button
                                    key={edgeId}
                                    onClick={() =>
                                      onLocateElement({ id: edgeId, type: 'edge' })
                                    }
                                    className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[10px] text-[#bc8cff] hover:border-[#bc8cff] flex items-center space-x-1"
                                    title="Locate edge on canvas"
                                  >
                                    <Crosshair className="w-2.5 h-2.5 mr-0.5" />
                                    <span>{edgeId}</span>
                                  </button>
                                ))}
                                {item.affectedNodeIds.length === 0 &&
                                  item.affectedEdgeIds.length === 0 && (
                                    <span className="text-[10px] text-[#8b949e]">
                                      Global topology attribute
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Recommendation */}
                          <div className="p-2 rounded bg-[#161b22] border border-[#30363d]/60">
                            <div className="text-[10px] text-[#3fb950] uppercase font-semibold mb-0.5">
                              Recommended Engineering Remediation
                            </div>
                            <p className="text-xs text-[#c9d1d9] leading-relaxed">
                              {item.recommendation}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: CATEGORIES & SPREAD */}
        {activeSection === 'categories' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(
                [
                  {
                    cat: 'security-debt' as DebtCategory,
                    label: 'Security Debt',
                    desc: 'Shortcuts, unencrypted links, and direct exposures.',
                  },
                  {
                    cat: 'architecture-debt' as DebtCategory,
                    label: 'Architecture Debt',
                    desc: 'Tier bypasses, flat topologies, and unsegmented networks.',
                  },
                  {
                    cat: 'resilience-debt' as DebtCategory,
                    label: 'Resilience Debt',
                    desc: 'Single points of failure and bottleneck concentrations.',
                  },
                  {
                    cat: 'access-control-debt' as DebtCategory,
                    label: 'Access-Control Debt',
                    desc: 'Wildcard port ranges and broad trust perimeters.',
                  },
                  {
                    cat: 'testing-debt' as DebtCategory,
                    label: 'Testing Debt',
                    desc: 'Unverified critical security properties and missing baselines.',
                  },
                  {
                    cat: 'operational-debt' as DebtCategory,
                    label: 'Operational Debt',
                    desc: 'Unmodeled operational controls (backups, telemetry).',
                  },
                  {
                    cat: 'complexity-debt' as DebtCategory,
                    label: 'Complexity Debt',
                    desc: 'High connectivity concentration and dense mesh topologies.',
                  },
                ] as const
              ).map(({ cat, label, desc }) => {
                const count = summary.byCategory[cat] ?? 0;
                const catItems = items.filter((i) => i.category === cat);
                const hasP0 = catItems.some((i) => i.priority === 'P0');
                return (
                  <div
                    key={cat}
                    onClick={() => {
                      setCategoryFilter(cat);
                      setActiveSection('backlog');
                    }}
                    className="p-3 bg-[#161b22] rounded border border-[#30363d]/60 hover:border-[#58a6ff]/50 cursor-pointer transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(cat)}
                        <span className="font-semibold text-[#f0f6fc] text-xs">
                          {label}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          hasP0
                            ? 'bg-[#da3633]/20 text-[#f85149] border border-[#da3633]/40'
                            : count > 0
                            ? 'bg-[#21262d] text-[#c9d1d9]'
                            : 'bg-[#21262d]/50 text-[#8b949e]'
                        }`}
                      >
                        {count} item{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8b949e]">{desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: RESOLUTION ROADMAP */}
        {activeSection === 'roadmap' && (
          <div className="space-y-4">
            <div className="p-3 bg-[#161b22] rounded border border-[#30363d]/60">
              <div className="text-xs font-semibold text-[#f0f6fc]">
                Deterministic Engineering Resolution Order
              </div>
              <p className="text-[11px] text-[#8b949e] mt-0.5">
                Calculated strictly by Priority Score, Severity, Category, and ID tie-breaking.
                Addressing items in this exact sequence minimizes compound architectural risk.
              </p>
            </div>

            <div className="space-y-2">
              {resolutionRoadmap.map((step) => {
                const item = items.find((i) => i.id === step.itemId);
                return (
                  <div
                    key={step.step}
                    className="p-3 bg-[#161b22] rounded border border-[#30363d]/60 flex items-start space-x-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center text-xs font-bold text-[#58a6ff] shrink-0 mt-0.5">
                      {step.step}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getPriorityBadge(
                              step.priority
                            )}`}
                          >
                            {step.priority}
                          </span>
                          <span className="font-semibold text-[#f0f6fc] text-xs">
                            {step.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#8b949e]">
                          Score: {step.priorityScore} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8b949e] leading-relaxed">
                        {step.rationale}
                      </p>
                      {item && (
                        <div className="pt-1.5 flex items-center space-x-2">
                          <span className="text-[10px] text-[#3fb950] font-semibold">
                            Action:
                          </span>
                          <span className="text-[10px] text-[#c9d1d9]">
                            {item.recommendation}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 4: GOVERNANCE & BOUNDARIES */}
        {activeSection === 'governance' && (
          <div className="space-y-3 p-4 bg-[#161b22] rounded border border-[#30363d]/60 text-xs leading-relaxed space-y-3">
            <div className="flex items-center space-x-2 text-[#58a6ff] font-semibold">
              <Shield className="w-4 h-4" />
              <span>PathForge Technical Debt Governance Principles</span>
            </div>
            <p className="text-[#8b949e]">
              Unlike traditional vulnerability scanners that only report today's broken rules,
              PathForge treats technical debt as structural compromises that make the architecture
              progressively harder to secure, operate, evolve, and verify over time.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded bg-[#0d0f13] border border-[#30363d]/60 space-y-1">
                <div className="font-semibold text-[#f0f6fc]">
                  1. Zero Monetary Fiction
                </div>
                <p className="text-[11px] text-[#8b949e]">
                  No fake dollar estimates ($12,400 to remediate) or artificial developer-hours.
                  Prioritization is grounded strictly in structural graph reachability, severity, and blast radius.
                </p>
              </div>
              <div className="p-3 rounded bg-[#0d0f13] border border-[#30363d]/60 space-y-1">
                <div className="font-semibold text-[#f0f6fc]">
                  2. Honest Scope Disclosures
                </div>
                <p className="text-[11px] text-[#8b949e]">
                  Operational controls (backup policies, log streaming, alerting pipelines) are classified as
                  UNVERIFIED evidence debt without pretending to inspect live cloud hypervisors.
                </p>
              </div>
              <div className="p-3 rounded bg-[#0d0f13] border border-[#30363d]/60 space-y-1">
                <div className="font-semibold text-[#f0f6fc]">
                  3. Revalidation-Verified Resolution
                </div>
                <p className="text-[11px] text-[#8b949e]">
                  A technical debt item is only marked MITIGATED when an immutable revalidation
                  comparison snapshot proves that the underlying architectural flaw has been eliminated.
                </p>
              </div>
              <div className="p-3 rounded bg-[#0d0f13] border border-[#30363d]/60 space-y-1">
                <div className="font-semibold text-[#f0f6fc]">
                  4. ₹0 Operating Model
                </div>
                <p className="text-[11px] text-[#8b949e]">
                  Every calculation runs locally and deterministically in-browser. Zero LLM calls, zero cloud telemetry,
                  zero external databases.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
