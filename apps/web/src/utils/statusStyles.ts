/**
 * PathForge Standardized Semantic Status System
 *
 * Implements a strict, disciplined vocabulary for engineering states:
 * - Positive: PASS, VERIFIED, RESOLVED, READY
 * - Attention: WARN, PARTIAL, STALE, NEEDS ATTENTION
 * - Negative: BLOCK, CRITICAL, REGRESSION, NOT READY
 * - Evidence: UNVERIFIED, INSUFFICIENT EVIDENCE
 */

export type PositiveStatus = 'PASS' | 'VERIFIED' | 'RESOLVED' | 'READY';
export type AttentionStatus = 'WARN' | 'PARTIAL' | 'STALE' | 'NEEDS ATTENTION';
export type NegativeStatus = 'BLOCK' | 'CRITICAL' | 'REGRESSION' | 'NOT READY';
export type EvidenceStatus = 'UNVERIFIED' | 'INSUFFICIENT EVIDENCE';

export type StandardSemanticStatus =
  | PositiveStatus
  | AttentionStatus
  | NegativeStatus
  | EvidenceStatus;

export interface StatusStyleConfig {
  bg: string;
  text: string;
  border: string;
  pillClass: string;
}

export function getSemanticStatusStyle(status: string): StatusStyleConfig {
  const norm = status.trim().toUpperCase();

  switch (norm) {
    // Positive
    case 'PASS':
    case 'VERIFIED':
    case 'RESOLVED':
    case 'READY':
      return {
        bg: 'bg-[#238636]/15',
        text: 'text-[#3fb950]',
        border: 'border-[#238636]/50',
        pillClass: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/50',
      };

    // Attention
    case 'WARN':
    case 'PARTIAL':
    case 'STALE':
    case 'STALE — RE-ANALYZE REQUIRED':
    case 'NEEDS ATTENTION':
      return {
        bg: 'bg-[#d29922]/15',
        text: 'text-[#d29922]',
        border: 'border-[#d29922]/50',
        pillClass: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/50',
      };

    // Negative
    case 'BLOCK':
    case 'CRITICAL':
    case 'REGRESSION':
    case 'NOT READY':
      return {
        bg: 'bg-[#da3633]/15',
        text: 'text-[#f85149]',
        border: 'border-[#da3633]/50',
        pillClass: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/50',
      };

    // Evidence
    case 'UNVERIFIED':
    case 'INSUFFICIENT EVIDENCE':
    case 'INSUFFICIENT_EVIDENCE':
    default:
      return {
        bg: 'bg-[#30363d]/30',
        text: 'text-[#8b949e]',
        border: 'border-[#30363d]',
        pillClass: 'bg-[#30363d]/30 text-[#8b949e] border-[#30363d]',
      };
  }
}

/**
 * Authoritative label for invalidated analyses across the entire product.
 */
export const STALE_STATUS_LABEL = 'STALE — RE-ANALYZE REQUIRED';
