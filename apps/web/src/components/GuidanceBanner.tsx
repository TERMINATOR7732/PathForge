import React, { useState, useEffect } from 'react';
import { Compass, X, ArrowRight } from 'lucide-react';
import { Finding, ValidationResult } from '@pathforge/shared';
import { AttackPath, FixVerificationResult } from '@pathforge/core';

interface GuidanceBannerProps {
  isValidationStale: boolean;
  latestVerification?: FixVerificationResult | null;
  validationResult?: ValidationResult | null;
  selectedFinding?: Finding | null;
  selectedAttackPath?: AttackPath | null;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onValidate?: () => void;
}

export const GuidanceBanner: React.FC<GuidanceBannerProps> = ({
  isValidationStale,
  latestVerification,
  validationResult,
  selectedFinding,
  selectedAttackPath,
  selectedNodeId,
  selectedEdgeId,
  onValidate,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastStateHash, setLastStateHash] = useState('');

  // Compute state fingerprint to allow redisplay on genuine state transition
  const currentStateHash = `${isValidationStale}-${latestVerification?.status ?? ''}-${
    selectedAttackPath?.id ?? ''
  }-${selectedFinding?.id ?? ''}-${selectedNodeId ?? ''}-${selectedEdgeId ?? ''}-${
    validationResult?.findings.length ?? 0
  }`;

  useEffect(() => {
    if (currentStateHash !== lastStateHash) {
      setLastStateHash(currentStateHash);
      setIsDismissed(false);
    }
  }, [currentStateHash, lastStateHash]);

  if (isDismissed) {
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="absolute bottom-14 left-4 z-20 px-2.5 py-1 rounded bg-[#11151c]/90 hover:bg-[#161b24] border border-[#212631] text-[11px] text-[#8b949e] hover:text-[#58a6ff] flex items-center space-x-1.5 shadow-md backdrop-blur-sm transition-colors cursor-pointer"
        title="Show next step guidance"
      >
        <Compass className="w-3.5 h-3.5 text-[#58a6ff]" />
        <span>Next Step</span>
      </button>
    );
  }

  const getGuidance = () => {
    if (latestVerification) {
      if (latestVerification.status === 'verified') {
        return {
          badge: 'DEFEND & PROVE',
          badgeColor: 'text-[#3fb950] bg-[#238636]/20 border-[#238636]/50',
          text: `Fresh verification complete: ${latestVerification.resolvedFindings.length} issue(s) resolved with zero regressions. Check gate verdict below.`,
          actionLabel: null,
          onAction: undefined,
        };
      }
      return {
        badge: 'VERIFICATION ATTN',
        badgeColor: 'text-[#f0883e] bg-[#f0883e]/20 border-[#f0883e]/50',
        text: `Fresh verification complete: ${latestVerification.stillPresentFindings.length} issue(s) remaining. Review outstanding risks in bottom console.`,
        actionLabel: null,
        onAction: undefined,
      };
    }

    if (isValidationStale) {
      return {
        badge: 'ENVIRONMENT CHANGED',
        badgeColor: 'text-[#e3b341] bg-[#d29922]/20 border-[#d29922]/50',
        text: 'Environment changed after analysis. Revalidate to check the result.',
        actionLabel: 'Analyze Now',
        onAction: onValidate,
      };
    }

    if (selectedAttackPath) {
      return {
        badge: 'ATTACK PATH',
        badgeColor: 'text-[#f85149] bg-[#da3633]/20 border-[#da3633]/50',
        text: `Threat path selected (${selectedAttackPath.entryPoint.name} → ${selectedAttackPath.target.name}). Follow the highlighted path to see how the threat reaches the target.`,
        actionLabel: null,
        onAction: undefined,
      };
    }

    if (selectedFinding) {
      return {
        badge: 'FINDING SELECTED',
        badgeColor: 'text-[#f85149] bg-[#da3633]/20 border-[#da3633]/50',
        text: `Finding selected: "${selectedFinding.title}". Review root cause in the right inspector or apply automated remediation.`,
        actionLabel: null,
        onAction: undefined,
      };
    }

    if (selectedNodeId || selectedEdgeId) {
      return {
        badge: 'EXPLORING',
        badgeColor: 'text-[#58a6ff] bg-[#388bfd]/20 border-[#388bfd]/50',
        text: 'Select a component or connection to inspect it. Configure policies or test blast radius in the right inspector.',
        actionLabel: null,
        onAction: undefined,
      };
    }

    if (validationResult && validationResult.findings.length > 0) {
      return {
        badge: 'ANALYSIS COMPLETED',
        badgeColor: 'text-[#f0883e] bg-[#f0883e]/20 border-[#f0883e]/50',
        text: 'Select a finding in the bottom console to understand the risk and explore attack vectors.',
        actionLabel: null,
        onAction: undefined,
      };
    }

    if (validationResult && validationResult.findings.length === 0) {
      return {
        badge: 'HARDENED BASELINE',
        badgeColor: 'text-[#3fb950] bg-[#238636]/20 border-[#238636]/50',
        text: 'Zero security violations detected. Explore connections or add a direct connection from Internet to test defenses.',
        actionLabel: null,
        onAction: undefined,
      };
    }

    return {
      badge: 'SCENARIO LOADED',
      badgeColor: 'text-[#58a6ff] bg-[#388bfd]/20 border-[#388bfd]/50',
      text: 'Explore the connections, then run an analysis.',
      actionLabel: 'Analyze System',
      onAction: onValidate,
    };
  };

  const guidance = getGuidance();

  return (
    <div className="absolute top-3 left-4 z-20 max-w-lg rounded-md bg-[#11151c]/92 border border-[#252c38] p-2 px-3 shadow-lg backdrop-blur-sm text-xs font-sans flex items-center space-x-2.5 transition-all">
      <div className="flex items-center space-x-1.5 shrink-0">
        <Compass className="w-3.5 h-3.5 text-[#58a6ff]" />
        <span
          className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-bold font-mono ${guidance.badgeColor}`}
        >
          {guidance.badge}
        </span>
      </div>

      <div className="text-[11px] text-[#c9d1d9] flex-1 leading-snug">
        <span className="text-[#8b949e] font-semibold mr-1">Your next step:</span>
        {guidance.text}
      </div>

      {guidance.actionLabel && guidance.onAction && (
        <button
          onClick={guidance.onAction}
          className="px-2 py-0.5 rounded bg-[#1f6feb] hover:bg-[#388bfd] text-white text-[10px] font-semibold flex items-center space-x-1 shrink-0 transition-colors cursor-pointer shadow-xs"
        >
          <span>{guidance.actionLabel}</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </button>
      )}

      <button
        onClick={() => setIsDismissed(true)}
        className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#212631] transition-colors shrink-0 cursor-pointer"
        title="Dismiss guidance"
        aria-label="Dismiss guidance"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
