import { VerificationReport } from '../types.js';

/**
 * Formats a VerificationReport into a clean, GitHub-flavored Markdown engineering artifact.
 */
export function formatReportAsMarkdown(report: VerificationReport): string {
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

  const lines: string[] = [];

  // Header
  lines.push('# PATHFORGE');
  lines.push('## Infrastructure Security Verification Report');
  lines.push('');
  lines.push('> **Build. Break. Defend. Prove.**');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Metadata Table
  lines.push('### Report Metadata');
  lines.push('');
  lines.push('| Attribute | Value |');
  lines.push('| :--- | :--- |');
  lines.push(`| **Environment Name** | \`${environment.name}\` |`);
  lines.push(`| **Environment ID** | \`${environment.id}\` |`);
  lines.push(`| **Generated Timestamp** | \`${metadata.generatedAt}\` |`);
  lines.push(`| **Report Version** | \`v${metadata.reportVersion}\` (Engine \`v${metadata.toolVersion}\`) |`);
  lines.push(`| **Infrastructure Scale** | \`${environment.nodeCount} nodes\`, \`${environment.edgeCount} edges\` |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Executive Summary
  lines.push('## 1. Executive Summary');
  lines.push('');
  const statusUpper = executiveSummary.status.toUpperCase();
  lines.push(`- **Verification Outcome**: **\`${statusUpper}\`**`);
  lines.push(`- **Production Gate**: **\`${productionGate}\`**`);
  lines.push(`- **Evaluation Time**: \`${executiveSummary.evaluatedAt}\``);
  if (executiveSummary.baselineTimestamp) {
    lines.push(`- **Baseline Timestamp**: \`${executiveSummary.baselineTimestamp}\``);
  }
  lines.push('');
  lines.push(`### ${executiveSummary.headline}`);
  lines.push('');
  lines.push(executiveSummary.narrative);
  lines.push('');

  // Remediation Information
  if (remediation) {
    lines.push('### Applied Remediation Trail');
    lines.push('');
    lines.push(`- **Action**: **${remediation.title}**`);
    lines.push(`- **Type**: \`${remediation.type}\``);
    lines.push(`- **Action ID**: \`${remediation.actionId}\``);
    lines.push(`- **Remediation Result**: **\`${remediation.outcome}\`**`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // 2. Before / After Security Delta
  lines.push('## 2. Before / After Security Delta Summary');
  lines.push('');
  if (securityDelta) {
    lines.push('| Metric | Baseline (Before) | Revalidated (After) | Delta |');
    lines.push('| :--- | :---: | :---: | :---: |');
    lines.push(`| **Critical Findings** | ${securityDelta.critical.before} | ${securityDelta.critical.after} | ${securityDelta.critical.delta > 0 ? `+${securityDelta.critical.delta}` : securityDelta.critical.delta} |`);
    lines.push(`| **High Findings** | ${securityDelta.high.before} | ${securityDelta.high.after} | ${securityDelta.high.delta > 0 ? `+${securityDelta.high.delta}` : securityDelta.high.delta} |`);
    lines.push(`| **Medium Findings** | ${securityDelta.medium.before} | ${securityDelta.medium.after} | ${securityDelta.medium.delta > 0 ? `+${securityDelta.medium.delta}` : securityDelta.medium.delta} |`);
    lines.push(`| **Low Findings** | ${securityDelta.low.before} | ${securityDelta.low.after} | ${securityDelta.low.delta > 0 ? `+${securityDelta.low.delta}` : securityDelta.low.delta} |`);
    lines.push(`| **Total Findings** | **${securityDelta.total.before}** | **${securityDelta.total.after}** | **${securityDelta.total.delta > 0 ? `+${securityDelta.total.delta}` : securityDelta.total.delta}** |`);
    lines.push(`| **Production Gate** | **\`${securityDelta.productionGate.before}\`** | **\`${securityDelta.productionGate.after}\`** | **${securityDelta.productionGate.after === 'PASSED' ? 'PASSED' : 'BLOCKED'}** |`);
    lines.push('');
  } else {
    lines.push('*No comparative baseline delta recorded for this evaluation cycle.*');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // 3. Resolved Findings
  lines.push(`## 3. Verified Resolved Findings (${resolvedFindings.length})`);
  lines.push('');
  if (resolvedFindings.length > 0) {
    for (const rf of resolvedFindings) {
      lines.push(`### [${rf.ruleId}] ${rf.title}`);
      lines.push('');
      lines.push(`- **Severity**: \`${rf.severity.toUpperCase()}\``);
      lines.push(`- **Category**: \`${rf.category}\``);
      lines.push(`- **Resolution Classification**: \`${rf.resolutionType}\` (${rf.changeSummary})`);
      lines.push(`- **Affected Components**: Nodes \`[${rf.affectedNodes.join(', ')}]\`, Edges \`[${rf.affectedEdges.join(', ')}]\``);
      lines.push('');
      lines.push('#### Verification Flow Comparison:');
      lines.push('```text');
      lines.push(`BEFORE: ${rf.beforeState.sourceName ?? 'Source'} → [${rf.beforeState.access?.toUpperCase() ?? 'ALLOW'} ${rf.beforeState.protocol ?? ''}:${rf.beforeState.ports ?? ''}] → ${rf.beforeState.targetName ?? 'Target'}`);
      if (rf.afterState?.isRemoved) {
        lines.push('AFTER:  [CONNECTION PERMANENTLY REMOVED / ISOLATED]');
      } else if (rf.afterState) {
        lines.push(`AFTER:  ${rf.afterState.sourceName ?? 'Source'} → [${rf.afterState.access?.toUpperCase() ?? 'DENY'} ${rf.afterState.protocol ?? ''}:${rf.afterState.ports ?? ''}${rf.afterState.encrypted ? ' TLS' : ''}] → ${rf.afterState.targetName ?? 'Target'}`);
      }
      lines.push('```');
      lines.push('');
      lines.push(`**Verification Proof**: ${rf.verificationProof}`);
      lines.push('');
    }
  } else {
    lines.push('*Zero findings were resolved in this verification cycle.*');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // 4. Still Present Findings
  lines.push(`## 4. Still Present / Unresolved Findings (${stillPresentFindings.length})`);
  lines.push('');
  if (stillPresentFindings.length > 0) {
    lines.push('> ⚠️ **NOTICE**: Unresolved security violations persist in this environment. The production gate remains **`BLOCKED`**.');
    lines.push('');
    for (const sf of stillPresentFindings) {
      lines.push(`- **[${sf.ruleId}] ${sf.title}** (\`${sf.severity.toUpperCase()}\`): ${sf.unchangedContext}`);
    }
    lines.push('');
  } else {
    lines.push('*Zero unresolved findings remain detected.*');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // 5. Regressions (New Findings)
  lines.push(`## 5. Security Regressions (${regressions.length})`);
  lines.push('');
  if (regressions.length > 0) {
    lines.push('> 🚨 **REGRESSION WARNING**: New security violations were introduced after the previous baseline. Verification requires immediate engineering attention.');
    lines.push('');
    for (const reg of regressions) {
      lines.push(`### [${reg.ruleId}] ${reg.title} (\`${reg.severity.toUpperCase()}\`)`);
      lines.push(`- **Trigger Cause**: ${reg.whyItAppeared}`);
      lines.push(`- **Affected Nodes**: \`[${reg.affectedNodes.join(', ')}]\``);
      lines.push('');
    }
  } else {
    lines.push('*Zero newly introduced security regressions detected.*');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // 6. Infrastructure Change Log
  lines.push(`## 6. Infrastructure Change Log (${infrastructureChanges.length})`);
  lines.push('');
  if (infrastructureChanges.length > 0) {
    for (const change of infrastructureChanges) {
      lines.push(`- **${change.label}** (\`${change.type}\`): ${change.description}`);
    }
    lines.push('');
    lines.push('*Note: Presentation coordinates (x, y) represent canvas layout only and are explicitly excluded from configuration diffs.*');
  } else {
    lines.push('*No infrastructure topology changes detected.*');
  }
  lines.push('');

  return lines.join('\n');
}
