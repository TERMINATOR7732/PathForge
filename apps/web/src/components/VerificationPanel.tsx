import React from 'react';
import { FixVerificationResult } from '@pathforge/core';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Crosshair,
  Wrench,
  FileCheck,
  AlertOctagon,
  Layers,
} from 'lucide-react';

interface VerificationPanelProps {
  verification: FixVerificationResult | null;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onSelectNode: (nodeId: string) => void;
  onRequestValidate: () => void;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  verification,
  onLocateElement,
  onRequestValidate,
}) => {
  if (!verification) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center font-mono space-y-3">
        <FileCheck className="w-10 h-10 text-[#58a6ff]/60" />
        <div className="text-sm font-semibold text-[#e6edf3]">
          No Validated Baseline Available
        </div>
        <p className="text-xs text-[#8b949e] max-w-md leading-relaxed">
          Validate this environment to establish a verified baseline. As you apply
          remediations or change infrastructure, revalidating will prove that security findings
          have been genuinely eliminated.
        </p>
        <button
          onClick={onRequestValidate}
          className="mt-2 px-3 py-1.5 rounded bg-[#238636] text-white hover:bg-[#2ea043] transition-colors text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Validate Environment to Establish Baseline</span>
        </button>
      </div>
    );
  }

  const {
    status,
    headline,
    summaryMessage,
    resolvedFindings,
    newFindings,
    stillPresentFindings,
    summaryDelta,
    appliedRemediation,
    diff,
  } = verification;

  const isVerified = status === 'verified';
  const hasRegressions = newFindings.length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-[#0d0f12] text-xs font-mono space-y-4">
      {/* 1. Verification Outcome Header */}
      <div
        className={`p-3.5 rounded border space-y-2 ${
          isVerified
            ? 'bg-[#122319] border-[#238636]/60 text-[#7ee787]'
            : hasRegressions
            ? 'bg-[#291b15] border-[#f0883e]/60 text-[#f0883e]'
            : 'bg-[#161a22] border-[#30363d] text-[#c9d1d9]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isVerified ? (
              <CheckCircle2 className="w-5 h-5 text-[#3fb950]" />
            ) : hasRegressions ? (
              <AlertTriangle className="w-5 h-5 text-[#f0883e]" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-[#8b949e]" />
            )}
            <span className="font-bold text-sm tracking-wide">{headline}</span>
          </div>

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
              isVerified
                ? 'bg-[#1b3826] border-[#3fb950] text-[#7ee787]'
                : hasRegressions
                ? 'bg-[#3b2318] border-[#f0883e] text-[#f0883e]'
                : 'bg-[#21262d] border-[#30363d] text-[#8b949e]'
            }`}
          >
            {status.toUpperCase()}
          </span>
        </div>

        <p className="text-[11px] text-[#c9d1d9] leading-relaxed">
          {summaryMessage}
        </p>

        {appliedRemediation && (
          <div className="pt-1 flex items-center space-x-1.5 text-[10px] text-[#8b949e]">
            <Wrench className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Applied Fix:</span>
            <strong className="text-[#e6edf3]">{appliedRemediation.title}</strong>
          </div>
        )}
      </div>

      {/* 2. Verification Metric Delta Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Resolved */}
        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
          <div className="text-[10px] uppercase text-[#8b949e] font-semibold">Resolved Findings</div>
          <div className="text-xl font-bold text-[#3fb950] font-mono">
            {resolvedFindings.length}
          </div>
          <div className="text-[10px] text-[#5c6370]">verified eliminated</div>
        </div>

        {/* Still Present */}
        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
          <div className="text-[10px] uppercase text-[#8b949e] font-semibold">Still Present</div>
          <div className="text-xl font-bold text-[#c9d1d9] font-mono">
            {stillPresentFindings.length}
          </div>
          <div className="text-[10px] text-[#5c6370]">unresolved issues</div>
        </div>

        {/* New Findings */}
        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
          <div className="text-[10px] uppercase text-[#8b949e] font-semibold">New Findings</div>
          <div
            className={`text-xl font-bold font-mono ${
              newFindings.length > 0 ? 'text-[#f0883e]' : 'text-[#8b949e]'
            }`}
          >
            {newFindings.length}
          </div>
          <div className="text-[10px] text-[#5c6370]">introduced in fix</div>
        </div>

        {/* Production Gate */}
        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
          <div className="text-[10px] uppercase text-[#8b949e] font-semibold">Production Gate</div>
          <div className="text-sm font-bold font-mono flex items-center space-x-1 pt-1">
            <span
              className={
                summaryDelta.productionGate.before === 'PASSED'
                  ? 'text-[#3fb950]'
                  : 'text-[#f85149]'
              }
            >
              {summaryDelta.productionGate.before}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#5c6370]" />
            <span
              className={
                summaryDelta.productionGate.after === 'PASSED'
                  ? 'text-[#3fb950]'
                  : 'text-[#f85149]'
              }
            >
              {summaryDelta.productionGate.after}
            </span>
          </div>
          <div className="text-[10px] text-[#5c6370]">policy compliance</div>
        </div>
      </div>

      {/* 3. Severity Breakdown Deltas */}
      <div className="p-2.5 rounded bg-[#12151b] border border-[#222630] flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <span className="text-[#8b949e] font-semibold uppercase">Severity Delta:</span>
        <div className="flex items-center space-x-4">
          <span>
            Critical:{' '}
            <strong className="text-[#c9d1d9] font-mono">
              {summaryDelta.critical.before} → {summaryDelta.critical.after}
            </strong>
          </span>
          <span>
            High:{' '}
            <strong className="text-[#c9d1d9] font-mono">
              {summaryDelta.high.before} → {summaryDelta.high.after}
            </strong>
          </span>
          <span>
            Medium:{' '}
            <strong className="text-[#c9d1d9] font-mono">
              {summaryDelta.medium.before} → {summaryDelta.medium.after}
            </strong>
          </span>
          <span>
            Total:{' '}
            <strong className="text-[#c9d1d9] font-mono">
              {summaryDelta.total.before} → {summaryDelta.total.after}
            </strong>
          </span>
        </div>
      </div>

      {/* 4. Resolved Findings Detailed Comparison (Before vs After) */}
      {resolvedFindings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#3fb950] border-b border-[#222630] pb-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>VERIFIED RESOLVED FINDINGS ({resolvedFindings.length})</span>
          </div>

          <div className="space-y-3">
            {resolvedFindings.map((rf) => (
              <div
                key={rf.finding.id}
                className="p-3 rounded bg-[#14171e] border border-[#238636]/40 space-y-2.5"
              >
                {/* Finding Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#183424] text-[#7ee787] border border-[#3fb950]/50 text-[9px] font-bold uppercase">
                        VERIFIED RESOLVED
                      </span>
                      <span className="text-white font-medium text-xs">{rf.finding.title}</span>
                    </div>
                    <div className="text-[10px] text-[#5c6370] mt-0.5">
                      Rule: {rf.finding.ruleId} · Category: {rf.finding.category}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-[#1e2738] text-[#58a6ff] border border-[#388bfd]/30 text-[10px] font-semibold">
                      {rf.changeSummary}
                    </span>
                    {rf.finding.affectedNodes.length > 0 && (
                      <button
                        onClick={() =>
                          onLocateElement({ id: rf.finding.affectedNodes[0], type: 'node' })
                        }
                        className="p-1 rounded bg-[#161b22] text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#21262d] transition-colors"
                        title="Locate on canvas"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Before vs After Flow Comparison Box */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                  {/* Before */}
                  <div className="p-2 rounded bg-[#1c1315] border border-[#da3633]/30 space-y-1">
                    <div className="text-[9px] uppercase font-bold text-[#f85149] flex items-center justify-between">
                      <span>BEFORE STATE</span>
                      <span className="text-[8px] bg-[#381619] px-1 rounded">VIOLATION ACTIVE</span>
                    </div>
                    <div className="flex items-center space-x-1.5 font-mono text-[#c9d1d9] pt-0.5 truncate">
                      <span className="font-semibold text-white truncate">
                        {rf.beforeState.sourceName ?? 'Source'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[#f85149] shrink-0" />
                      <span className="px-1 py-0.2 rounded bg-[#381619] text-[#f85149] font-bold text-[9px] shrink-0">
                        {rf.beforeState.access?.toUpperCase() ?? 'ALLOW'}{' '}
                        {rf.beforeState.protocol ?? ''}:{rf.beforeState.ports ?? ''}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[#f85149] shrink-0" />
                      <span className="font-semibold text-white truncate">
                        {rf.beforeState.targetName ?? 'Target'}
                      </span>
                    </div>
                  </div>

                  {/* After */}
                  <div className="p-2 rounded bg-[#101b16] border border-[#238636]/40 space-y-1">
                    <div className="text-[9px] uppercase font-bold text-[#3fb950] flex items-center justify-between">
                      <span>CURRENT STATE</span>
                      <span className="text-[8px] bg-[#142e20] text-[#7ee787] px-1 rounded">
                        SECURED
                      </span>
                    </div>
                    {rf.afterState?.isRemoved ? (
                      <div className="text-[10px] text-[#7ee787] font-semibold pt-0.5">
                        ✓ Insecure connection permanently severed / removed.
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 font-mono text-[#c9d1d9] pt-0.5 truncate">
                        <span className="font-semibold text-white truncate">
                          {rf.afterState?.sourceName ?? 'Source'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#3fb950] shrink-0" />
                        <span className="px-1 py-0.2 rounded bg-[#183424] text-[#7ee787] font-bold text-[9px] shrink-0">
                          {rf.afterState?.access?.toUpperCase() ?? 'DENY'}{' '}
                          {rf.afterState?.protocol ?? ''}:{rf.afterState?.ports ?? ''}
                          {rf.afterState?.encrypted ? ' [TLS]' : ''}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#3fb950] shrink-0" />
                        <span className="font-semibold text-white truncate">
                          {rf.afterState?.targetName ?? 'Target'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Explanation */}
                <div className="text-[11px] text-[#8b949e] leading-relaxed pt-0.5 border-t border-[#222630]/60">
                  <strong className="text-[#3fb950]">Verification Proof:</strong>{' '}
                  {rf.verificationDetails}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. New Findings Section (Regressions) */}
      {newFindings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#f0883e] border-b border-[#222630] pb-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>NEW PROBLEMS INTRODUCED IN THIS REVALIDATION ({newFindings.length})</span>
          </div>

          <div className="space-y-2">
            {newFindings.map((nf) => (
              <div
                key={nf.finding.id}
                className="p-3 rounded bg-[#201814] border border-[#f0883e]/40 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#3b2318] text-[#f0883e] border border-[#f0883e]/50 text-[9px] font-bold uppercase">
                        NEWLY INTRODUCED
                      </span>
                      <span className="text-white font-medium text-xs">{nf.finding.title}</span>
                    </div>
                    <div className="text-[10px] text-[#5c6370]">
                      Rule: {nf.finding.ruleId} · Severity: {nf.finding.severity}
                    </div>
                  </div>

                  {nf.finding.affectedNodes.length > 0 && (
                    <button
                      onClick={() =>
                        onLocateElement({ id: nf.finding.affectedNodes[0], type: 'node' })
                      }
                      className="p-1 rounded bg-[#161b22] text-[#8b949e] hover:text-[#f0883e] transition-colors"
                      title="Locate on canvas"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-[#c9d1d9] leading-relaxed">
                  <strong className="text-[#f0883e]">Trigger Reason:</strong> {nf.whyItAppeared}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Still Present Findings Section */}
      {stillPresentFindings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#8b949e] border-b border-[#222630] pb-1.5">
            <AlertOctagon className="w-4 h-4" />
            <span>STILL PRESENT FINDINGS ({stillPresentFindings.length})</span>
          </div>

          <div className="space-y-1.5">
            {stillPresentFindings.map((sf) => (
              <div
                key={sf.finding.id}
                className="p-2 rounded bg-[#14171d] border border-[#222630] flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-[10px] text-[#5c6370] font-mono">{sf.finding.ruleId}</span>
                  <span className="text-[#c9d1d9] truncate font-medium">{sf.finding.title}</span>
                </div>
                {sf.finding.affectedNodes.length > 0 && (
                  <button
                    onClick={() =>
                      onLocateElement({ id: sf.finding.affectedNodes[0], type: 'node' })
                    }
                    className="p-1 text-[#8b949e] hover:text-[#58a6ff]"
                    title="Locate on canvas"
                  >
                    <Crosshair className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Underlying Infrastructure Changes Diff */}
      {diff.changes.length > 0 && (
        <div className="p-3 rounded bg-[#12151b] border border-[#222630] space-y-2">
          <div className="flex items-center space-x-1.5 text-[10px] uppercase text-[#8b949e] font-semibold">
            <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Infrastructure Delta from Last Validated Baseline:</span>
          </div>
          <div className="space-y-1 text-[10px]">
            {diff.changes.map((change) => (
              <div
                key={change.id}
                className="flex items-center justify-between text-[#8b949e] font-mono"
              >
                <span className="text-[#c9d1d9]">{change.label}</span>
                <span className="text-[9px] uppercase px-1 rounded bg-[#1a1f29] text-[#58a6ff]">
                  {change.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
