import { VerificationReport } from '../types.js';

/**
 * Serializes a VerificationReport into formatted, machine-readable JSON.
 */
export function formatReportAsJson(report: VerificationReport): string {
  return JSON.stringify(report, null, 2);
}
