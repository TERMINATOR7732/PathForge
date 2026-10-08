import React, { useState } from 'react';
import {
  TestingIntelligenceResult,
  PropertyVerificationStatus,
  CoverageLevel,
} from '@pathforge/core';
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Layers,
  Crosshair,
  SlidersHorizontal,
  History,
  FileCheck2,
} from 'lucide-react';

interface TestingIntelligencePanelProps {
  intelligence: TestingIntelligenceResult;
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
  ) => void;
}

export const TestingIntelligencePanel: React.FC<TestingIntelligencePanelProps> = ({
  intelligence,
  onLocateElement,
  onSelectTab,
}) => {
  const [activeSection, setActiveSection] = useState<
    'all' | 'gaps' | 'properties' | 'categories' | 'regressions' | 'recommendations'
  >('all');
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED'>('all');

  const {
    score,
    level,
    summary,
    coverage,
    categories,
    properties,
    gaps,
    recommendations,
    regressions,
  } = intelligence;

  // Level Badge helper
  const getLevelBadge = (lvl: CoverageLevel) => {
    switch (lvl) {
      case 'EXCELLENT':
        return {
          bg: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/40',
          bar: 'bg-[#238636]',
        };
      case 'GOOD':
        return {
          bg: 'bg-[#2ea043]/15 text-[#3fb950] border-[#2ea043]/40',
          bar: 'bg-[#2ea043]',
        };
      case 'MODERATE':
        return {
          bg: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
          bar: 'bg-[#d29922]',
        };
      case 'WEAK':
        return {
          bg: 'bg-[#f0883e]/15 text-[#f0883e] border-[#f0883e]/40',
          bar: 'bg-[#f0883e]',
        };
      case 'INSUFFICIENT':
      default:
        return {
          bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
          bar: 'bg-[#da3633]',
        };
    }
  };

  const getStatusIcon = (status: PropertyVerificationStatus) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb950]" />;
      case 'PARTIAL':
        return <AlertTriangle className="w-3.5 h-3.5 text-[#d29922]" />;
      case 'UNVERIFIED':
      default:
        return <AlertOctagon className="w-3.5 h-3.5 text-[#f85149]" />;
    }
  };

  const getStatusPill = (status: PropertyVerificationStatus) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/30';
      case 'PARTIAL':
        return 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/30';
      case 'UNVERIFIED':
      default:
        return 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30';
    }
  };

  const getGapSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/50';
      case 'high':
        return 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/50';
      case 'medium':
        return 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/50';
      case 'low':
      default:
        return 'bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/50';
    }
  };

  const levelInfo = getLevelBadge(level);

  const filteredProperties =
    propertyFilter === 'all'
      ? properties
      : properties.filter((p) => p.status === propertyFilter);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0d0f13] text-[#c9d1d9] font-mono text-xs">
      {/* Top Banner: Score, Level & Key Metrics */}
      <div className="p-4 border-b border-[#222630] bg-[#111318]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-[#161b22] border border-[#30363d] text-[#58a6ff]">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold tracking-wide text-[#f0f6fc]">
                  TESTING INTELLIGENCE
                </span>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold tracking-wider ${levelInfo.bg}`}
                >
                  {level}
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] mt-0.5">
                Deterministic verification & test coverage analysis
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#f0f6fc] tracking-tight">
                {score}
                <span className="text-xs text-[#8b949e] font-normal"> / 100</span>
              </div>
              <div className="text-[10px] text-[#8b949e] uppercase tracking-wider">
                Coverage Score
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-3 text-[11px] text-[#8b949e] bg-[#161b22] p-2.5 rounded border border-[#21262d] leading-relaxed">
          {summary}
        </div>

        {/* Coverage Progress Bars */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Critical Coverage */}
          <div className="bg-[#161b22] p-2.5 rounded border border-[#21262d]">
            <div className="flex justify-between items-center text-[10px] text-[#8b949e] mb-1.5 uppercase tracking-wider">
              <span>Critical Coverage</span>
              <span className="font-semibold text-[#f0f6fc]">{coverage.criticalCoverage}%</span>
            </div>
            <div className="w-full bg-[#21262d] h-2 rounded overflow-hidden">
              <div
                className={`h-full ${
                  coverage.criticalCoverage >= 80
                    ? 'bg-[#238636]'
                    : coverage.criticalCoverage >= 50
                    ? 'bg-[#d29922]'
                    : 'bg-[#da3633]'
                }`}
                style={{ width: `${coverage.criticalCoverage}%` }}
              />
            </div>
          </div>

          {/* High Coverage */}
          <div className="bg-[#161b22] p-2.5 rounded border border-[#21262d]">
            <div className="flex justify-between items-center text-[10px] text-[#8b949e] mb-1.5 uppercase tracking-wider">
              <span>High Coverage</span>
              <span className="font-semibold text-[#f0f6fc]">{coverage.highCoverage}%</span>
            </div>
            <div className="w-full bg-[#21262d] h-2 rounded overflow-hidden">
              <div
                className={`h-full ${
                  coverage.highCoverage >= 80
                    ? 'bg-[#238636]'
                    : coverage.highCoverage >= 50
                    ? 'bg-[#d29922]'
                    : 'bg-[#da3633]'
                }`}
                style={{ width: `${coverage.highCoverage}%` }}
              />
            </div>
          </div>

          {/* Overall Coverage */}
          <div className="bg-[#161b22] p-2.5 rounded border border-[#21262d]">
            <div className="flex justify-between items-center text-[10px] text-[#8b949e] mb-1.5 uppercase tracking-wider">
              <span>Overall Coverage</span>
              <span className="font-semibold text-[#f0f6fc]">{coverage.overallCoverage}%</span>
            </div>
            <div className="w-full bg-[#21262d] h-2 rounded overflow-hidden">
              <div
                className={`h-full ${
                  coverage.overallCoverage >= 80
                    ? 'bg-[#238636]'
                    : coverage.overallCoverage >= 50
                    ? 'bg-[#d29922]'
                    : 'bg-[#da3633]'
                }`}
                style={{ width: `${coverage.overallCoverage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric Counts */}
        <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-[#21262d]/60">
          <div className="flex items-center space-x-4">
            <span className="text-[#3fb950] flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{coverage.verifiedProperties} Verified</span>
            </span>
            <span className="text-[#d29922] flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{coverage.partialProperties} Partial</span>
            </span>
            <span className="text-[#f85149] flex items-center space-x-1">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>{coverage.unverifiedProperties} Unverified</span>
            </span>
          </div>

          <div className="text-[#8b949e] text-[10px]">
            {properties.length} Total Properties Evaluated
          </div>
        </div>
      </div>

      {/* Filter Tabs Navigation */}
      <div className="flex items-center space-x-1 px-4 py-2 border-b border-[#222630] bg-[#161b22] overflow-x-auto">
        <button
          onClick={() => setActiveSection('all')}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${
            activeSection === 'all'
              ? 'bg-[#21262d] text-[#f0f6fc] font-semibold'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveSection('gaps')}
          className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center space-x-1 ${
            activeSection === 'gaps'
              ? 'bg-[#21262d] text-[#f0f6fc] font-semibold'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <span>Coverage Gaps</span>
          {gaps.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#da3633]/20 text-[#f85149]">
              {gaps.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSection('properties')}
          className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center space-x-1 ${
            activeSection === 'properties'
              ? 'bg-[#21262d] text-[#f0f6fc] font-semibold'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <span>Properties</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#30363d] text-[#8b949e]">
            {properties.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSection('categories')}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${
            activeSection === 'categories'
              ? 'bg-[#21262d] text-[#f0f6fc] font-semibold'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setActiveSection('regressions')}
          className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center space-x-1 ${
            activeSection === 'regressions'
              ? 'bg-[#21262d] text-[#f0f6fc] font-semibold'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <span>Regressions</span>
          {regressions.status === 'regressions-detected' && (
            <span className="w-2 h-2 rounded-full bg-[#f85149]" />
          )}
        </button>
        <button
          onClick={() => setActiveSection('recommendations')}
          className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center space-x-1 ${
            activeSection === 'recommendations'
              ? 'bg-[#21262d] text-[#f0f6fc] font-semibold'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <span>Recommendations</span>
          {recommendations.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#30363d] text-[#8b949e]">
              {recommendations.length}
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-6">
        {/* Regression Status Banner (Visible in All or Regressions) */}
        {(activeSection === 'all' || activeSection === 'regressions') && (
          <div className="bg-[#161b22] rounded border border-[#21262d] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-[#58a6ff]" />
                <span className="font-semibold text-[#f0f6fc] text-xs">
                  REGRESSION STATUS
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase ${
                  regressions.status === 'healthy'
                    ? 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/30'
                    : regressions.status === 'regressions-detected'
                    ? 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30'
                    : 'bg-[#8b949e]/15 text-[#8b949e] border-[#8b949e]/30'
                }`}
              >
                {regressions.status === 'healthy'
                  ? 'Healthy Baseline'
                  : regressions.status === 'regressions-detected'
                  ? 'Regressions Detected'
                  : 'No Baseline'}
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e] leading-relaxed">
              {regressions.summary}
            </p>
            {regressions.baselineTimestamp && (
              <div className="mt-2 text-[10px] text-[#8b949e] flex items-center space-x-2">
                <Clock className="w-3 h-3 text-[#58a6ff]" />
                <span>Baseline established: {regressions.baselineTimestamp}</span>
              </div>
            )}
            {regressions.regressedFindings.length > 0 && (
              <div className="mt-2.5 p-2 rounded bg-[#da3633]/10 border border-[#da3633]/20 text-[11px] text-[#f85149] flex items-center justify-between">
                <div>
                  <span className="font-semibold">Reintroduced findings: </span>
                  {regressions.regressedFindings.join(', ')}
                </div>
                {onSelectTab && (
                  <button
                    onClick={() => onSelectTab('findings')}
                    className="ml-2 px-2 py-0.5 rounded bg-[#da3633]/20 hover:bg-[#da3633]/30 text-[#f85149] text-[10px] font-medium transition-colors shrink-0"
                  >
                    Inspect Findings
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Category Coverage Summaries (Visible in All or Categories) */}
        {(activeSection === 'all' || activeSection === 'categories') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>Category Coverage Breakdown</span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {categories.map((cat) => (
                <div
                  key={cat.category}
                  className="bg-[#161b22] rounded border border-[#21262d] p-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[#f0f6fc] text-xs">
                      {cat.name}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        cat.score >= 80
                          ? 'text-[#3fb950]'
                          : cat.score >= 50
                          ? 'text-[#d29922]'
                          : 'text-[#f85149]'
                      }`}
                    >
                      {cat.score}%
                    </span>
                  </div>
                  <div className="w-full bg-[#21262d] h-1.5 rounded overflow-hidden mb-2">
                    <div
                      className={`h-full ${
                        cat.score >= 80
                          ? 'bg-[#238636]'
                          : cat.score >= 50
                          ? 'bg-[#d29922]'
                          : 'bg-[#da3633]'
                      }`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
                    <span>{cat.totalProperties} properties</span>
                    <span>
                      {cat.verified} verified · {cat.partial} partial · {cat.unverified} unverified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coverage Gaps (Visible in All or Gaps) */}
        {(activeSection === 'all' || activeSection === 'gaps') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider flex items-center space-x-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-[#f85149]" />
                <span>Verification Gaps ({gaps.length})</span>
              </span>
            </div>

            {gaps.length === 0 ? (
              <div className="bg-[#161b22] p-4 rounded border border-[#21262d] text-center text-[#8b949e] text-xs">
                Zero verification gaps identified. All modeled security properties are fully verified.
              </div>
            ) : (
              <div className="space-y-2.5">
                {gaps.map((gap) => (
                  <div
                    key={gap.id}
                    className="bg-[#161b22] rounded border border-[#21262d] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${getGapSeverityBadge(
                            gap.severity
                          )}`}
                        >
                          {gap.severity}
                        </span>
                        <span className="font-semibold text-[#f0f6fc] text-xs">
                          {gap.title}
                        </span>
                      </div>
                      {(gap.relatedNodeIds.length > 0 || gap.relatedEdgeIds.length > 0) && (
                        <button
                          onClick={() => {
                            if (gap.relatedNodeIds.length > 0) {
                              onLocateElement({ id: gap.relatedNodeIds[0], type: 'node' });
                            } else if (gap.relatedEdgeIds.length > 0) {
                              onLocateElement({ id: gap.relatedEdgeIds[0], type: 'edge' });
                            }
                          }}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] text-[10px] transition-colors"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Locate</span>
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-[#8b949e] leading-relaxed">
                      <span className="text-[#c9d1d9] font-medium">Why it matters: </span>
                      {gap.whyItMatters}
                    </div>

                    <div className="text-[11px] text-[#8b949e] bg-[#0d0f13] p-2 rounded border border-[#21262d] leading-relaxed">
                      <span className="text-[#58a6ff] font-medium">Recommended test: </span>
                      {gap.recommendedTest}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Verification Properties (Visible in All or Properties) */}
        {(activeSection === 'all' || activeSection === 'properties') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider flex items-center space-x-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>Security Properties Catalog</span>
              </span>

              {/* Status Filter */}
              <div className="flex items-center space-x-1">
                {(['all', 'VERIFIED', 'PARTIAL', 'UNVERIFIED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setPropertyFilter(st)}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      propertyFilter === st
                        ? 'bg-[#30363d] text-[#f0f6fc] font-semibold'
                        : 'text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    {st === 'all' ? 'All' : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {filteredProperties.map((p) => (
                <div
                  key={p.property.id}
                  className="bg-[#161b22] rounded border border-[#21262d] p-2.5 flex flex-col space-y-1.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(p.status)}
                      <span className="font-medium text-[#f0f6fc] text-xs">
                        {p.property.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded border text-[9px] font-semibold uppercase ${getStatusPill(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-[#8b949e] uppercase">
                        {p.property.importance} (w: {p.weight})
                      </span>
                      {(p.affectedNodeIds.length > 0 || p.affectedEdgeIds.length > 0) && (
                        <button
                          onClick={() => {
                            if (p.affectedNodeIds.length > 0) {
                              onLocateElement({ id: p.affectedNodeIds[0], type: 'node' });
                            } else if (p.affectedEdgeIds.length > 0) {
                              onLocateElement({ id: p.affectedEdgeIds[0], type: 'edge' });
                            }
                          }}
                          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] text-[9px] transition-colors"
                        >
                          <Crosshair className="w-2.5 h-2.5" />
                          <span>Locate</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#8b949e] leading-relaxed">
                    {p.notes || p.property.description}
                  </p>

                  {p.evidenceList.length > 0 && (
                    <div className="mt-1 flex items-center space-x-2 text-[10px] text-[#8b949e]">
                      <span className="text-[#3fb950]">Evidence:</span>
                      {p.evidenceList.map((e) => (
                        <span
                          key={e.id}
                          className="px-1.5 py-0.2 rounded bg-[#21262d] text-[#c9d1d9] border border-[#30363d]"
                        >
                          {e.source}: {e.description}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Tests (Visible in All or Recommendations) */}
        {(activeSection === 'all' || activeSection === 'recommendations') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider flex items-center space-x-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>Deterministic Test Recommendations</span>
              </span>
            </div>

            {recommendations.length === 0 ? (
              <div className="bg-[#161b22] p-4 rounded border border-[#21262d] text-center text-[#8b949e] text-xs">
                No outstanding test recommendations. Coverage is complete.
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="bg-[#161b22] rounded border border-[#21262d] p-2.5 flex items-start space-x-3 text-xs"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center text-[10px] text-[#58a6ff] font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-[#c9d1d9] leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
