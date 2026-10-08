import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  Download,
  Terminal,
  RotateCcw,
  ChevronDown,
  Layers,
  FileText,
  FileCode,
  Printer,
  Image,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { ValidationResult } from '@pathforge/shared';
import { Environment, FixVerificationResult, getScenarioById } from '@pathforge/core';
import {
  exportReportAsMarkdown,
  exportReportAsJson,
  printOrSaveReportAsHtml,
  exportEnvironmentSvg,
} from '../utils/exportHelpers.js';

interface TopNavProps {
  currentScenarioId: string;
  onOpenScenarioModal: () => void;
  onOpenResetModal: () => void;
  onValidate: () => void;
  onExport: () => void;
  environment?: Environment;
  latestVerification?: FixVerificationResult | null;
  validationResult: ValidationResult | null;
  isValidationStale?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentScenarioId,
  onOpenScenarioModal,
  onOpenResetModal,
  onValidate,
  onExport,
  environment,
  latestVerification = null,
  validationResult,
  isValidationStale = false,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setIsExportOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const currentScenario = getScenarioById(currentScenarioId);
  const scenarioName = currentScenario?.name ?? 'Custom Environment';
  const findingsCount = validationResult?.findings.length ?? 0;
  const criticalCount =
    validationResult?.findings.filter((f) => f.severity === 'critical').length ?? 0;

  return (
    <header className="h-10 border-b border-[#1c212c] bg-[#0a0c10] flex items-center justify-between px-3 select-none z-30 font-mono">
      {/* Left: Brand, Environment Selector, Validation State */}
      <div className="flex items-center space-x-2.5">
        {/* Brand */}
        <div className="flex items-center space-x-1.5 pr-1">
          <div className="w-4.5 h-4.5 rounded-[2px] bg-[#58a6ff]/10 border border-[#58a6ff]/40 flex items-center justify-center text-[#58a6ff]">
            <Terminal className="w-3 h-3" />
          </div>
          <span className="font-bold text-xs tracking-wider text-[#f0f3f6]">
            PATHFORGE
          </span>
        </div>

        <div className="h-3.5 w-px bg-[#1c212c]" />

        {/* Environment / Scenario Selector */}
        <button
          onClick={onOpenScenarioModal}
          className="flex items-center space-x-1.5 px-2 py-1 rounded border border-[#1c212c] bg-[#11141c] hover:border-[#2f3747] hover:bg-[#161a24] text-xs transition-colors group"
          title="Switch Environment Scenario"
        >
          <Layers className="w-3 h-3 text-[#58a6ff]" />
          <span className="text-[#c9d1d9] group-hover:text-white font-medium text-[11px] truncate max-w-[200px]">
            {scenarioName}
          </span>
          <ChevronDown className="w-3 h-3 text-[#7d8590] group-hover:text-[#c9d1d9]" />
        </button>

        {/* Real-Time Security State Badge */}
        {isValidationStale ? (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#d29922]/15 text-[#d29922] border border-[#d29922]/40 animate-pulse">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>STALE — RE-ANALYZE REQUIRED</span>
          </span>
        ) : criticalCount > 0 ? (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#da3633]/15 text-[#f85149] border border-[#da3633]/40">
            <ShieldAlert className="w-2.5 h-2.5" />
            <span>{criticalCount} CRITICAL ISSUE{criticalCount > 1 ? 'S' : ''}</span>
          </span>
        ) : findingsCount > 0 ? (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0883e]/15 text-[#f0883e] border border-[#f0883e]/40">
            <ShieldAlert className="w-2.5 h-2.5" />
            <span>{findingsCount} FINDING{findingsCount > 1 ? 'S' : ''}</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#238636]/15 text-[#3fb950] border border-[#238636]/40">
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>VERIFIED SECURE</span>
          </span>
        )}
      </div>

      {/* Center: Engineering Core Sequence */}
      <div className="hidden lg:flex items-center space-x-2 text-[10px] text-[#484f58] tracking-wider uppercase font-semibold">
        <span className="text-[#8b949e]">BUILD</span>
        <ArrowRight className="w-2.5 h-2.5 text-[#30363d]" />
        <span className="text-[#f85149]">BREAK</span>
        <ArrowRight className="w-2.5 h-2.5 text-[#30363d]" />
        <span className="text-[#58a6ff]">DEFEND</span>
        <ArrowRight className="w-2.5 h-2.5 text-[#30363d]" />
        <span className="text-[#3fb950]">PROVE</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2">
        {/* Reset Scenario */}
        <button
          onClick={onOpenResetModal}
          className="px-2 py-1 rounded border border-[#1c212c] bg-[#11141c] hover:border-[#2f3747] hover:bg-[#161a24] text-[#8b949e] hover:text-[#c9d1d9] text-[11px] font-medium transition-colors flex items-center space-x-1"
          title="Reset topology to baseline scenario state"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Primary Action: Re-Analyze Environment */}
        <button
          onClick={onValidate}
          className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm ${
            isValidationStale
              ? 'bg-[#d29922] text-[#0d0f12] hover:bg-[#e3b341] font-bold'
              : 'bg-[#1f6feb] text-white hover:bg-[#388bfd]'
          }`}
          title="Execute deterministic security validation and rule engine"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isValidationStale ? 'Re-Analyze System' : 'Analyze System'}</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <button
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="px-2 py-1 rounded border border-[#1c212c] bg-[#11141c] hover:border-[#2f3747] hover:bg-[#161a24] text-[#8b949e] hover:text-white text-[11px] font-medium transition-colors flex items-center space-x-1"
            title="Export Evidence & Reports"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-2.5 h-2.5 text-[#7d8590]" />
          </button>

          {isExportOpen && (
            <div className="absolute right-0 mt-1 w-52 rounded bg-[#0f1218] border border-[#2f3747] shadow-xl py-1 z-50 text-xs font-mono">
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-[#484f58] font-bold border-b border-[#1c212c]">
                Engineering Exports
              </div>

              {environment && validationResult && (
                <>
                  <button
                    onClick={() => {
                      exportReportAsMarkdown({
                        environment,
                        validationResult,
                        verification: latestVerification ?? null,
                      });
                      setIsExportOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#161c28] hover:text-[#58a6ff] flex items-center space-x-2 text-[11px]"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#58a6ff]" />
                    <span>Markdown Report (.md)</span>
                  </button>

                  <button
                    onClick={() => {
                      exportReportAsJson({
                        environment,
                        validationResult,
                        verification: latestVerification ?? null,
                      });
                      setIsExportOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#161c28] hover:text-[#58a6ff] flex items-center space-x-2 text-[11px]"
                  >
                    <FileCode className="w-3.5 h-3.5 text-[#3fb950]" />
                    <span>Audit Report (.json)</span>
                  </button>

                  <button
                    onClick={() => {
                      exportEnvironmentSvg(environment);
                      setIsExportOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#161c28] hover:text-[#58a6ff] flex items-center space-x-2 text-[11px]"
                  >
                    <Image className="w-3.5 h-3.5 text-[#f0883e]" />
                    <span>Vector Diagram (.svg)</span>
                  </button>

                  <button
                    onClick={() => {
                      printOrSaveReportAsHtml({
                        environment,
                        validationResult,
                        verification: latestVerification ?? null,
                      });
                      setIsExportOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#161c28] hover:text-[#58a6ff] flex items-center space-x-2 text-[11px]"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#bc8cff]" />
                    <span>Print / PDF Document</span>
                  </button>
                </>
              )}

              <div className="my-1 border-t border-[#1c212c]" />

              <button
                onClick={() => {
                  onExport();
                  setIsExportOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#161c28] hover:text-white flex items-center space-x-2 text-[11px]"
              >
                <Download className="w-3.5 h-3.5 text-[#7d8590]" />
                <span>Topology Definition (.json)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
