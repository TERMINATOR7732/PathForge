import { VerificationReport } from '../types.js';

/**
 * Generates standalone, print-friendly HTML for browser Print -> Save as PDF.
 * Operates with 0 external network dependencies.
 */
export function formatReportAsPrintableHtml(report: VerificationReport): string {
  const {
    metadata,
    environment,
    executiveSummary,
    securityDelta,
    resolvedFindings,
    stillPresentFindings,
    regressions,
    infrastructureChanges,
    remediation,
    productionGate,
  } = report;

  const isPassed = productionGate === 'PASSED';
  const hasRegressions = regressions.length > 0;

  const statusColor = isPassed
    ? '#2ea043'
    : hasRegressions
    ? '#d29922'
    : '#cf222e';

  const statusBg = isPassed
    ? '#dafbe1'
    : hasRegressions
    ? '#fff8c5'
    : '#ffebe9';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PathForge Verification Report - ${escapeHtml(environment.name)}</title>
  <style>
    @page {
      margin: 1.5cm;
      size: letter portrait;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1f2328;
      background: #ffffff;
      line-height: 1.5;
      font-size: 13px;
      margin: 0;
      padding: 24px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    .header {
      border-bottom: 2px solid #d0d7de;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-weight: 700;
      font-size: 18px;
      color: #0969da;
      letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 12px;
      color: #656d76;
      margin-top: 2px;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      background: ${statusBg};
      color: ${statusColor};
      border: 1px solid ${statusColor};
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 24px;
      font-size: 11px;
    }
    .meta-item strong {
      display: block;
      color: #656d76;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #d0d7de;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
      color: #1f2328;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #d0d7de;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #f6f8fa;
      color: #656d76;
      font-size: 11px;
      text-transform: uppercase;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    }
    .card {
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .card-resolved {
      border-left: 4px solid #2ea043;
    }
    .card-regression {
      border-left: 4px solid #cf222e;
      background: #fff8f8;
    }
    .card-unresolved {
      border-left: 4px solid #d29922;
    }
    .flow-box {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 4px;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 11px;
      line-height: 1.6;
    }
    .print-btn {
      background: #0969da;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
    <button class="print-btn" onclick="window.print()">Print Report / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="brand">PATHFORGE</div>
      <div class="subtitle">Infrastructure Security Verification Report · Build. Break. Defend. Prove.</div>
    </div>
    <div class="status-badge">
      ${escapeHtml(executiveSummary.headline)}
    </div>
  </div>

  <div class="metadata-grid">
    <div class="meta-item">
      <strong>Environment Name</strong>
      <span class="mono">${escapeHtml(environment.name)}</span>
    </div>
    <div class="meta-item">
      <strong>Environment ID</strong>
      <span class="mono">${escapeHtml(environment.id)}</span>
    </div>
    <div class="meta-item">
      <strong>Generated Timestamp</strong>
      <span class="mono">${escapeHtml(metadata.generatedAt)}</span>
    </div>
    <div class="meta-item">
      <strong>Production Gate</strong>
      <span class="mono" style="font-weight: bold; color: ${statusColor};">${escapeHtml(productionGate)}</span>
    </div>
  </div>

  <h2>1. Executive Summary</h2>
  <p>${escapeHtml(executiveSummary.narrative)}</p>
  ${
    remediation
      ? `<div class="flow-box">
          <strong>Applied Remediation:</strong> ${escapeHtml(remediation.title)} (<span class="mono">${escapeHtml(remediation.type)}</span>)<br>
          <strong>Outcome:</strong> ${escapeHtml(remediation.outcome)}
        </div>`
      : ''
  }

  <h2>2. Security Delta Summary</h2>
  ${
    securityDelta
      ? `<table>
          <thead>
            <tr>
              <th>Severity</th>
              <th style="text-align: center;">Before (Baseline)</th>
              <th style="text-align: center;">After (Revalidated)</th>
              <th style="text-align: center;">Delta</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Critical Findings</strong></td>
              <td class="mono" style="text-align: center;">${securityDelta.critical.before}</td>
              <td class="mono" style="text-align: center;">${securityDelta.critical.after}</td>
              <td class="mono" style="text-align: center;">${securityDelta.critical.delta}</td>
            </tr>
            <tr>
              <td><strong>High Findings</strong></td>
              <td class="mono" style="text-align: center;">${securityDelta.high.before}</td>
              <td class="mono" style="text-align: center;">${securityDelta.high.after}</td>
              <td class="mono" style="text-align: center;">${securityDelta.high.delta}</td>
            </tr>
            <tr>
              <td><strong>Medium Findings</strong></td>
              <td class="mono" style="text-align: center;">${securityDelta.medium.before}</td>
              <td class="mono" style="text-align: center;">${securityDelta.medium.after}</td>
              <td class="mono" style="text-align: center;">${securityDelta.medium.delta}</td>
            </tr>
            <tr>
              <td><strong>Total Findings</strong></td>
              <td class="mono" style="text-align: center;"><strong>${securityDelta.total.before}</strong></td>
              <td class="mono" style="text-align: center;"><strong>${securityDelta.total.after}</strong></td>
              <td class="mono" style="text-align: center;"><strong>${securityDelta.total.delta}</strong></td>
            </tr>
            <tr>
              <td><strong>Production Gate</strong></td>
              <td class="mono" style="text-align: center;">${securityDelta.productionGate.before}</td>
              <td class="mono" style="text-align: center;"><strong>${securityDelta.productionGate.after}</strong></td>
              <td class="mono" style="text-align: center;">${securityDelta.productionGate.after}</td>
            </tr>
          </tbody>
        </table>`
      : '<p><em>No comparative baseline delta recorded.</em></p>'
  }

  <h2>3. Verified Resolved Findings (${resolvedFindings.length})</h2>
  ${
    resolvedFindings.length > 0
      ? resolvedFindings
          .map(
            (rf) => `<div class="card card-resolved">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <strong class="mono" style="color: #1a7f37;">[${escapeHtml(rf.ruleId)}] ${escapeHtml(rf.title)}</strong>
            <span class="mono" style="font-size: 10px; background: #dafbe1; color: #1a7f37; padding: 2px 6px; border-radius: 4px;">${escapeHtml(rf.resolutionType)}</span>
          </div>
          <div class="flow-box">
            BEFORE: ${escapeHtml(rf.beforeState.sourceName ?? 'Source')} → [${escapeHtml(rf.beforeState.access?.toUpperCase() ?? 'ALLOW')} ${escapeHtml(rf.beforeState.protocol ?? '')}:${escapeHtml(rf.beforeState.ports ?? '')}] → ${escapeHtml(rf.beforeState.targetName ?? 'Target')}<br>
            AFTER:  ${
              rf.afterState?.isRemoved
                ? '[CONNECTION PERMANENTLY REMOVED]'
                : `${escapeHtml(rf.afterState?.sourceName ?? 'Source')} → [${escapeHtml(rf.afterState?.access?.toUpperCase() ?? 'DENY')} ${escapeHtml(rf.afterState?.protocol ?? '')}:${escapeHtml(rf.afterState?.ports ?? '')}${rf.afterState?.encrypted ? ' TLS' : ''}] → ${escapeHtml(rf.afterState?.targetName ?? 'Target')}`
            }
          </div>
          <div style="font-size: 11px; color: #656d76;">
            <strong>Verification Proof:</strong> ${escapeHtml(rf.verificationProof)}
          </div>
        </div>`
          )
          .join('')
      : '<p><em>Zero findings resolved in this cycle.</em></p>'
  }

  <h2>4. Still Present Findings (${stillPresentFindings.length})</h2>
  ${
    stillPresentFindings.length > 0
      ? stillPresentFindings
          .map(
            (sf) => `<div class="card card-unresolved">
          <strong class="mono">[${escapeHtml(sf.ruleId)}] ${escapeHtml(sf.title)}</strong> (${escapeHtml(sf.severity.toUpperCase())})<br>
          <span style="font-size: 11px; color: #656d76;">${escapeHtml(sf.unchangedContext)}</span>
        </div>`
          )
          .join('')
      : '<p><em>Zero unresolved findings remain detected.</em></p>'
  }

  <h2>5. Security Regressions (${regressions.length})</h2>
  ${
    regressions.length > 0
      ? regressions
          .map(
            (reg) => `<div class="card card-regression">
          <strong class="mono" style="color: #cf222e;">[${escapeHtml(reg.ruleId)}] ${escapeHtml(reg.title)}</strong> (${escapeHtml(reg.severity.toUpperCase())})<br>
          <span style="font-size: 11px;">Trigger: ${escapeHtml(reg.whyItAppeared)}</span>
        </div>`
          )
          .join('')
      : '<p><em>Zero newly introduced regressions detected.</em></p>'
  }

  <h2>6. Infrastructure Change Log (${infrastructureChanges.length})</h2>
  ${
    infrastructureChanges.length > 0
      ? `<ul>
          ${infrastructureChanges
            .map(
              (c) => `<li><span class="mono">${escapeHtml(c.label)}</span> (${escapeHtml(c.type)}): ${escapeHtml(c.description)}</li>`
            )
            .join('')}
        </ul>
        <p style="font-size: 10px; color: #656d76;"><em>Note: Node presentation coordinates are excluded from security diffs.</em></p>`
      : '<p><em>No infrastructure modifications recorded.</em></p>'
  }
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
