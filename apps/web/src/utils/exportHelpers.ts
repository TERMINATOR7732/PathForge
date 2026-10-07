import {
  Environment,
  FixVerificationResult,
  generateVerificationReport,
  formatReportAsJson,
  formatReportAsMarkdown,
  formatReportAsPrintableHtml,
  exportEnvironmentAsSvg,
  serializeEnvironment,
} from '@pathforge/core';
import { ValidationResult } from '@pathforge/shared';

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openPrintWindow(htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}

export interface ExportReportOptions {
  environment: Environment;
  validationResult: ValidationResult | null;
  verification: FixVerificationResult | null;
}

function getSafeFilenamePrefix(environment: Environment): string {
  return environment.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-');
}

function ensureValidationResult(
  environmentId: string,
  result: ValidationResult | null
): ValidationResult {
  if (result) return result;
  return {
    environmentId,
    evaluatedAt: new Date().toISOString(),
    rulesEvaluated: 0,
    summary: {
      passed: false,
      totalFindings: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
    },
    findings: [],
  };
}

export function exportReportAsMarkdown({
  environment,
  validationResult,
  verification,
}: ExportReportOptions): void {
  const currentResult = ensureValidationResult(environment.id, validationResult);
  const report = generateVerificationReport({
    environment,
    currentResult,
    verification,
  });
  const markdown = formatReportAsMarkdown(report);
  const prefix = getSafeFilenamePrefix(environment);
  downloadFile(markdown, `${prefix}-verification-report.md`, 'text/markdown;charset=utf-8');
}

export function exportReportAsJson({
  environment,
  validationResult,
  verification,
}: ExportReportOptions): void {
  const currentResult = ensureValidationResult(environment.id, validationResult);
  const report = generateVerificationReport({
    environment,
    currentResult,
    verification,
  });
  const json = formatReportAsJson(report);
  const prefix = getSafeFilenamePrefix(environment);
  downloadFile(json, `${prefix}-verification-report.json`, 'application/json;charset=utf-8');
}

export function printOrSaveReportAsHtml({
  environment,
  validationResult,
  verification,
}: ExportReportOptions): void {
  const currentResult = ensureValidationResult(environment.id, validationResult);
  const report = generateVerificationReport({
    environment,
    currentResult,
    verification,
  });
  const html = formatReportAsPrintableHtml(report);
  openPrintWindow(html);
}

export function exportEnvironmentSvg(environment: Environment): void {
  const svg = exportEnvironmentAsSvg(environment, { includeTitle: true });
  const prefix = getSafeFilenamePrefix(environment);
  downloadFile(svg, `${prefix}-architecture.svg`, 'image/svg+xml;charset=utf-8');
}

export function exportTopologyModelJson(environment: Environment): void {
  const json = serializeEnvironment(environment);
  const prefix = getSafeFilenamePrefix(environment);
  downloadFile(json, `${prefix}-topology.json`, 'application/json;charset=utf-8');
}
