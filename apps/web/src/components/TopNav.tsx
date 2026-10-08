import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Download,
  RotateCcw,
  ChevronDown,
  Layers,
  FileText,
  FileCode,
  Printer,
  Image,
  AlertTriangle,
  ArrowRight,
  Shield,
  Activity,
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
  const scenarioName = currentScenario?.name ?? 'Custom Architecture';
  const findingsCount = validationResult?.findings.length ?? 0;
  const criticalCount =
    validationResult?.findings.filter((f) => f.severity === 'critical').length ?? 0;
  const highCount =
    validationResult?.findings.filter((f) => f.severity === 'high').length ?? 0;

  return (
    <header className="pf-shell-header h-11 border-b border-[var(--pf-border-default)] bg-[var(--pf-bg-panel)] flex items-center justify-between px-3.5 select-none z-30 font-sans">
      {/* 1. PRODUCT BRAND & ENVIRONMENT SELECTOR */}
      <div className="flex items-center space-x-3">
        {/* Brand */}
        <div className="flex items-center space-x-2 pr-1">
          <div className="w-6 h-6 rounded bg-[var(--pf-accent-subtle)] border border-[var(--pf-border-focus)] flex items-center justify-center text-[var(--pf-accent)]">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-bold text-sm tracking-tight text-[var(--pf-text-primary)] font-sans">
              PATHFORGE
            </span>
            <span className="text-[10px] text-[var(--pf-text-muted)] font-mono tracking-wider uppercase">
              WORKBENCH
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-[var(--pf-border-subtle)]" />

        {/* Environment / Scenario Selector */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] uppercase font-semibold text-[var(--pf-text-muted)] tracking-wider hidden sm:inline">
            Scenario:
          </span>
          <button
            onClick={onOpenScenarioModal}
            className="pf-btn pf-btn-secondary flex items-center space-x-2 px-2.5 py-1 text-xs"
            title="Switch Environment Scenario (Ctrl+O)"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--pf-accent)]" />
            <span className="text-xs font-semibold text-[var(--pf-text-primary)] truncate max-w-[210px]">
              {scenarioName}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--pf-text-muted)]" />
          </button>
        </div>
      </div>

      {/* 2. CENTER: ENGINEERING CORE PIPELINE (Build -> Break -> Defend -> Prove) */}
      <div className="hidden xl:flex items-center space-x-2.5 px-3 py-1 rounded bg-[var(--pf-bg-app)] border border-[var(--pf-border-subtle)] text-[11px] font-sans">
        <span className="text-[var(--pf-text-muted)] font-semibold tracking-wide">BUILD</span>
        <ArrowRight className="w-3 h-3 text-[var(--pf-text-subtle)]" />
        <span className="text-[var(--pf-danger)] font-semibold tracking-wide">BREAK</span>
        <ArrowRight className="w-3 h-3 text-[var(--pf-text-subtle)]" />
        <span className="text-[var(--pf-info)] font-semibold tracking-wide">DEFEND</span>
        <ArrowRight className="w-3 h-3 text-[var(--pf-text-subtle)]" />
        <span className="text-[var(--pf-success)] font-semibold tracking-wide">PROVE</span>
      </div>

      {/* 3. RIGHT: VALIDATION STATE & WORKBENCH ACTIONS */}
      <div className="flex items-center space-x-2.5">
        {/* Real-Time Security State Badge */}
        {isValidationStale ? (
          <span className="pf-badge pf-status-warning animate-pulse">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>STALE · RE-ANALYZE</span>
          </span>
        ) : criticalCount > 0 ? (
          <span className="pf-badge pf-status-critical">
            <ShieldAlert className="w-3 h-3 shrink-0" />
            <span>{criticalCount} CRITICAL</span>
          </span>
        ) : highCount > 0 ? (
          <span className="pf-badge pf-status-high">
            <ShieldAlert className="w-3 h-3 shrink-0" />
            <span>{highCount} HIGH RISK</span>
          </span>
        ) : findingsCount > 0 ? (
          <span className="pf-badge pf-status-warning">
            <ShieldAlert className="w-3 h-3 shrink-0" />
            <span>{findingsCount} FINDING{findingsCount > 1 ? 'S' : ''}</span>
          </span>
        ) : (
          <span className="pf-badge pf-status-verified">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>VERIFIED SECURE</span>
          </span>
        )}

        {/* Primary Action: Analyze System */}
        <button
          onClick={onValidate}
          className="pf-btn pf-btn-primary px-3 py-1.5 text-xs font-semibold shadow-xs"
          title="Run complete deterministic security analysis"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Analyze System</span>
        </button>

        {/* Reset Scenario Action */}
        <button
          onClick={onOpenResetModal}
          className="pf-btn pf-btn-secondary px-2.5 py-1.5 text-xs"
          title="Reset environment topology to baseline"
        >
          <RotateCcw className="w-3 h-3 text-[var(--pf-text-muted)]" />
          <span className="hidden md:inline">Reset</span>
        </button>

        {/* Export Dropdown Menu */}
        <div className="relative" ref={exportDropdownRef}>
          <button
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="pf-btn pf-btn-secondary px-2.5 py-1.5 text-xs"
            title="Export Reports & Diagrams"
          >
            <Download className="w-3 h-3 text-[var(--pf-text-muted)]" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 text-[var(--pf-text-muted)]" />
          </button>

          {isExportOpen && (
            <div className="absolute right-0 mt-1.5 w-56 rounded border border-[#303746] bg-[#161b24] shadow-xl py-1 z-50 text-xs font-sans">
              <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-[#8b949e] border-b border-[#212631]">
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
                    className="w-full px-3 py-2 text-left text-[#c9d1d9] hover:bg-[#212631] hover:text-[#58a6ff] flex items-center space-x-2 transition-colors"
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
                    className="w-full px-3 py-2 text-left text-[#c9d1d9] hover:bg-[#212631] hover:text-[#3fb950] flex items-center space-x-2 transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5 text-[#3fb950]" />
                    <span>Audit Report (.json)</span>
                  </button>

                  <button
                    onClick={() => {
                      exportEnvironmentSvg(environment);
                      setIsExportOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[#c9d1d9] hover:bg-[#212631] hover:text-[#f0883e] flex items-center space-x-2 transition-colors"
                  >
                    <Image className="w-3.5 h-3.5 text-[#f0883e]" />
                    <span>Architecture SVG (.svg)</span>
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
                    className="w-full px-3 py-2 text-left text-[#c9d1d9] hover:bg-[#212631] hover:text-[#bc8cff] flex items-center space-x-2 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#bc8cff]" />
                    <span>Print / PDF Document</span>
                  </button>
                </>
              )}

              <div className="my-1 border-t border-[#212631]" />

              <button
                onClick={() => {
                  onExport();
                  setIsExportOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-[#c9d1d9] hover:bg-[#212631] hover:text-white flex items-center space-x-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#8b949e]" />
                <span>Topology Model (.json)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
