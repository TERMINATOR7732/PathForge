import React, { useState, useMemo } from 'react';
import {
  Environment,
  AttackPathAnalysisResult,
  ArchitectureAnalysisResult,
  ProductionReadinessAssessment,
  TestingIntelligenceResult,
  TechnicalDebtAssessment,
  ChangeAnalysisResult,
  evaluateCiGate,
  DEFAULT_CI_GATE_POLICY,
  CiGatePolicy,
  CiGateStatus,
  formatCiGateJson,
} from '@pathforge/core';
import { ValidationResult } from '@pathforge/shared';
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
  Sliders,
  Terminal,
  Info,
} from 'lucide-react';

export interface CiGateViewProps {
  environment: Environment | null;
  validationResult: ValidationResult | null;
  attackPathAnalysis?: AttackPathAnalysisResult | null;
  architectureResult?: ArchitectureAnalysisResult | null;
  productionReadiness?: ProductionReadinessAssessment | null;
  testingIntelligence?: TestingIntelligenceResult | null;
  technicalDebt?: TechnicalDebtAssessment | null;
  changeAnalysis?: ChangeAnalysisResult | null;
}

export const CiGateView: React.FC<CiGateViewProps> = ({
  environment,
  validationResult,
  attackPathAnalysis,
  architectureResult,
  productionReadiness,
  testingIntelligence,
  technicalDebt,
  changeAnalysis,
}) => {
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [policyOverrides, setPolicyOverrides] = useState<Partial<CiGatePolicy>>({});
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);

  const activePolicy: CiGatePolicy = useMemo(() => {
    return {
      ...DEFAULT_CI_GATE_POLICY,
      ...policyOverrides,
    };
  }, [policyOverrides]);

  const gateResult = useMemo(() => {
    if (!environment) return null;

    return evaluateCiGate(
      {
        target: {
          targetType: 'environment-file',
          identifier: environment.name,
          environmentId: environment.id,
          environmentName: environment.name,
        },
        environment,
        validationResult,
        attackPathAnalysis,
        architectureAnalysis: architectureResult,
        productionReadiness,
        testingIntelligence,
        technicalDebt,
        changeAnalysis,
      },
      activePolicy
    );
  }, [
    environment,
    validationResult,
    attackPathAnalysis,
    architectureResult,
    productionReadiness,
    testingIntelligence,
    technicalDebt,
    changeAnalysis,
    activePolicy,
  ]);

  const ciCommand = `npm run gate -- environments/demo/standard-web-app.json --format json`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(ciCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  if (!environment || !gateResult) {
    return (
      <div className="p-8 text-center font-mono text-xs text-[#8b949e]">
        No active environment loaded for CI gate evaluation.
      </div>
    );
  }

  const getStatusBadge = (status: CiGateStatus) => {
    switch (status) {
      case 'PASS':
        return {
          bg: 'bg-[#238636]/20 border-[#238636] text-[#3fb950]',
          icon: ShieldCheck,
          label: 'GATE PASSED',
          exitCodeText: 'EXIT CODE: 0',
        };
      case 'WARN':
        return {
          bg: 'bg-[#d29922]/20 border-[#d29922] text-[#d29922]',
          icon: AlertTriangle,
          label: 'GATE WARNING',
          exitCodeText: 'EXIT CODE: 1',
        };
      case 'BLOCK':
        return {
          bg: 'bg-[#da3633]/20 border-[#da3633] text-[#f85149]',
          icon: AlertOctagon,
          label: 'GATE BLOCKED',
          exitCodeText: 'EXIT CODE: 2',
        };
      case 'INSUFFICIENT_EVIDENCE':
        return {
          bg: 'bg-[#a371f7]/20 border-[#a371f7] text-[#bc8cff]',
          icon: HelpCircle,
          label: 'INSUFFICIENT EVIDENCE',
          exitCodeText: 'EXIT CODE: 3',
        };
    }
  };

  const badge = getStatusBadge(gateResult.status);
  const StatusIcon = badge.icon;

  return (
    <div className="space-y-4">
      {/* 1. Header Banner & Status */}
      <div className={`p-4 rounded-lg border ${badge.bg} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center space-x-3">
          <StatusIcon className="w-8 h-8 flex-shrink-0" />
          <div>
            <div className="text-sm font-mono font-bold tracking-wider">{badge.label}</div>
            <div className="text-xs font-mono opacity-80">
              {badge.exitCodeText} · Score: {gateResult.score}/100 · Target: {environment.name}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPolicyEditor(!showPolicyEditor)}
            className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] font-mono text-xs border border-[#30363d] flex items-center space-x-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>{showPolicyEditor ? 'Hide Policy' : 'Policy Controls'}</span>
          </button>

          <button
            onClick={handleCopyCommand}
            className="px-3 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] font-mono text-xs border border-[#30363d] flex items-center space-x-1.5 transition-colors"
          >
            {copiedCommand ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#3fb950]" />
                <span className="text-[#3fb950]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8b949e]" />
                <span>COPY CI COMMAND</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Policy Settings Drawer (Collapsible) */}
      {showPolicyEditor && (
        <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#21262d] pb-2">
            <span className="text-[#e6edf3] font-bold">GATE POLICY SETTINGS</span>
            <span className="text-[11px] text-[#8b949e]">Config precedence: Defaults → .pathforge/gate.json → UI/CLI</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
            <label className="flex items-center space-x-2 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={activePolicy.blockOnCriticalFindings}
                onChange={(e) => setPolicyOverrides((p) => ({ ...p, blockOnCriticalFindings: e.target.checked }))}
                className="rounded bg-[#161b22] border-[#30363d]"
              />
              <span>Block on Critical Findings</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={activePolicy.blockOnHighRiskAttackPaths}
                onChange={(e) => setPolicyOverrides((p) => ({ ...p, blockOnHighRiskAttackPaths: e.target.checked }))}
                className="rounded bg-[#161b22] border-[#30363d]"
              />
              <span>Block on Critical Attack Paths</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={activePolicy.blockOnRegressions}
                onChange={(e) => setPolicyOverrides((p) => ({ ...p, blockOnRegressions: e.target.checked }))}
                className="rounded bg-[#161b22] border-[#30363d]"
              />
              <span>Block on Security Regressions</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={!activePolicy.allowWarnings}
                onChange={(e) => setPolicyOverrides((p) => ({ ...p, allowWarnings: !e.target.checked }))}
                className="rounded bg-[#161b22] border-[#30363d]"
              />
              <span>Strict Mode (Promote Warnings to Block)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={activePolicy.requireBaselineForRegression}
                onChange={(e) =>
                  setPolicyOverrides((p) => ({ ...p, requireBaselineForRegression: e.target.checked }))
                }
                className="rounded bg-[#161b22] border-[#30363d]"
              />
              <span>Require Baseline for Regression Check</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={activePolicy.requireTestingEvidence}
                onChange={(e) => setPolicyOverrides((p) => ({ ...p, requireTestingEvidence: e.target.checked }))}
                className="rounded bg-[#161b22] border-[#30363d]"
              />
              <span>Require Testing Intelligence</span>
            </label>
          </div>
        </div>
      )}

      {/* 3. Blocking Reasons */}
      {gateResult.blockingReasons.length > 0 && (
        <div className="p-3 rounded-lg bg-[#0d1117] border border-[#da3633]/40 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#f85149]">
            <AlertOctagon className="w-4 h-4" />
            <span>BLOCKING REASONS ({gateResult.blockingReasons.length})</span>
          </div>
          <div className="space-y-1.5">
            {gateResult.blockingReasons.map((reason) => (
              <div key={reason.id} className="p-2.5 rounded bg-[#161b22] border border-[#21262d] text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#e6edf3]">{reason.title}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#da3633]/20 text-[#f85149]">
                    {reason.category}
                  </span>
                </div>
                <div className="text-[#8b949e]">{reason.description}</div>
                {reason.evidence && reason.evidence.length > 0 && (
                  <div className="pt-1 text-[11px] text-[#c9d1d9] space-y-0.5">
                    {reason.evidence.slice(0, 3).map((ev, i) => (
                      <div key={i} className="flex items-start space-x-1">
                        <span className="text-[#f85149]">▸</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Warnings */}
      {gateResult.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-[#0d1117] border border-[#d29922]/40 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#d29922]">
            <AlertTriangle className="w-4 h-4" />
            <span>WARNINGS ({gateResult.warnings.length})</span>
          </div>
          <div className="space-y-1.5">
            {gateResult.warnings.map((warning) => (
              <div key={warning.id} className="p-2.5 rounded bg-[#161b22] border border-[#21262d] text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#e6edf3]">{warning.title}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#d29922]/20 text-[#d29922]">
                    {warning.category}
                  </span>
                </div>
                <div className="text-[#8b949e]">{warning.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Evidence Overview: Passed Controls vs Evidence Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Passed Controls */}
        <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-[#3fb950]">
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>PASSED CONTROLS ({gateResult.passedControls.length})</span>
            </span>
          </div>
          <div className="space-y-1 text-xs font-mono">
            {gateResult.passedControls.length === 0 ? (
              <div className="text-[11px] text-[#8b949e] italic">No controls verified yet.</div>
            ) : (
              gateResult.passedControls.map((ctrl) => (
                <div key={ctrl.id} className="p-2 rounded bg-[#161b22] border border-[#21262d]">
                  <div className="text-[#e6edf3] font-semibold">{ctrl.name}</div>
                  <div className="text-[11px] text-[#8b949e]">{ctrl.description}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Evidence Gaps / Unverified Controls */}
        <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-[#58a6ff]">
            <span className="flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>EVIDENCE GAPS (UNVERIFIED) ({gateResult.evidenceGaps.length})</span>
            </span>
          </div>
          <div className="space-y-1 text-xs font-mono">
            {gateResult.evidenceGaps.length === 0 ? (
              <div className="text-[11px] text-[#8b949e] italic">Zero evidence gaps.</div>
            ) : (
              gateResult.evidenceGaps.slice(0, 4).map((gap) => (
                <div key={gap.id} className="p-2 rounded bg-[#161b22] border border-[#21262d]">
                  <div className="text-[#c9d1d9] font-semibold">{gap.title}</div>
                  <div className="text-[11px] text-[#8b949e]">{gap.rationale}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. Machine-Readable JSON Export / Preview */}
      <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#e6edf3]">
            <Terminal className="w-4 h-4 text-[#58a6ff]" />
            <span className="font-bold">MACHINE-READABLE CI RESULT (JSON SCHEMA V1)</span>
          </div>
          <button
            onClick={() => setShowJsonPreview(!showJsonPreview)}
            className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-[11px]"
          >
            {showJsonPreview ? 'Hide JSON' : 'Show JSON'}
          </button>
        </div>

        {showJsonPreview && (
          <textarea
            readOnly
            value={formatCiGateJson(gateResult)}
            rows={10}
            className="w-full p-2 rounded bg-[#090d13] border border-[#30363d] text-[#79c0ff] text-[11px] font-mono resize-y"
          />
        )}
      </div>
    </div>
  );
};
