import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  X,
  Layers,
  Network,
  Play,
  ShieldAlert,
  Wrench,
  CheckCircle2,
} from 'lucide-react';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  description: string;
  keyPoints: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'The Infrastructure Canvas',
    icon: Layers,
    accentColor: 'text-[#58a6ff] bg-[#388bfd]/20 border-[#388bfd]/50',
    description:
      'The center viewport is your interactive topology canvas. Visualize systems across trust zones: Public ingress, DMZ perimeter, Internal application tier, and Restricted data tier.',
    keyPoints: [
      'Pan and zoom freely or click the center/fit button.',
      'Trust zone boundaries automatically cluster and frame nodes.',
      'Hover over components or connections to view instant details.',
    ],
  },
  {
    title: 'Components and Connections',
    icon: Network,
    accentColor: 'text-[#bc8cff] bg-[#8957e5]/20 border-[#8957e5]/50',
    description:
      'Model architectures using components from the left palette (Internet, Firewalls, Web Servers, APIs, Databases). Draw directional connections between node ports.',
    keyPoints: [
      'Click or drag palette items onto the canvas to place nodes.',
      'Connect ports to specify protocols (HTTPS, TCP, SSH) and access policies.',
      'Arbitrary and insecure connections are permitted so you can explore anti-patterns.',
    ],
  },
  {
    title: 'Running Security Analysis',
    icon: Play,
    accentColor: 'text-[#3fb950] bg-[#238636]/20 border-[#238636]/50',
    description:
      'Click "Analyze System" in the top bar to run the deterministic evaluation engine against your environment with zero network overhead.',
    keyPoints: [
      'Evaluates exposure, missing firewalls, and excessive trust.',
      'Computes lateral attack paths and blast radiuses from untrusted ingress.',
      'Assesses architecture health, testing intelligence, and production readiness.',
    ],
  },
  {
    title: 'Understanding Findings & Threat Paths',
    icon: ShieldAlert,
    accentColor: 'text-[#f85149] bg-[#da3633]/20 border-[#da3633]/50',
    description:
      'The bottom console organizes security issues by severity. Every finding explains what is wrong, why it matters, and how threat actors could exploit it.',
    keyPoints: [
      'Plain-English root causes and impact explanations come first.',
      'Click "Attack Paths" to trace multi-hop lateral traversal step-by-step.',
      'Click any finding or threat path to highlight it on the canvas and inspect details.',
    ],
  },
  {
    title: 'Changing the Modeled Environment',
    icon: Wrench,
    accentColor: 'text-[#e3b341] bg-[#d29922]/20 border-[#d29922]/50',
    description:
      'Test defensive hypotheses by editing connection properties in the right inspector, or clicking "Apply Fix" on a finding for automated remediation.',
    keyPoints: [
      'Restrict ports to match target services (e.g. 5432 for Postgres).',
      'Enforce TLS/HTTPS encryption or switch access policies to DENY.',
      'Move nodes between trust zones or insert perimeter reverse proxies.',
    ],
  },
  {
    title: 'Revalidating and Proving (Defend & Prove)',
    icon: CheckCircle2,
    accentColor: 'text-[#3fb950] bg-[#238636]/20 border-[#238636]/50',
    description:
      'After modifying your architecture, re-analyze to run automated fix verification against your previous baseline snapshot.',
    keyPoints: [
      'Strictly proves whether your fix eliminated the root cause.',
      'Verifies zero regressions were introduced into neighboring nodes.',
      'Check the automated CI Engineering Gate verdict (PASS / WARN / BLOCK).',
    ],
  },
];

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const Icon = currentStep.icon;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pathforge_tour_completed', 'true');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 font-sans select-none overflow-x-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleComplete();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
    >
      <div className="w-full max-w-lg min-w-0 rounded-lg bg-[#111318] border border-[#30363d] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3.5 border-b border-[#222630] bg-[#0d0f14] flex items-center justify-between min-w-0">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-[#388bfd]/15 border border-[#388bfd]/30 flex items-center justify-center text-[#58a6ff]">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <div>
              <span id="tour-modal-title" className="text-xs font-bold text-white tracking-wide uppercase">
                PathForge Guided Tour
              </span>
              <span className="text-[11px] text-[#8b949e] ml-2">
                Step {currentStepIndex + 1} of {TOUR_STEPS.length}
              </span>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#212631] transition-colors cursor-pointer"
            title="Skip tour (Esc)"
            aria-label="Skip guided tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 bg-[#0e1015] text-xs overflow-y-auto">
          {/* Step Title & Icon */}
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-lg border ${currentStep.accentColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {currentStep.title}
              </h3>
              <p className="text-[11px] text-[#8b949e] mt-0.5">
                Core engineering workflow concept
              </p>
            </div>
          </div>

          {/* Step Explanation */}
          <p className="text-[#c9d1d9] leading-relaxed text-xs">
            {currentStep.description}
          </p>

          {/* Key Bullet Points */}
          <div className="bg-[#12161f] p-3 rounded-md border border-[#1e2430] space-y-2">
            <div className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider">
              Key Capabilities:
            </div>
            <ul className="space-y-1.5 text-[11px] text-[#abb2bf]">
              {currentStep.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-[#58a6ff] font-bold shrink-0">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Step Indicator Dots */}
          <div className="flex items-center justify-center space-x-1.5 pt-1">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-6 bg-[#388bfd]'
                    : 'w-2 bg-[#212631] hover:bg-[#30363d]'
                }`}
                title={`Go to step ${idx + 1}`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#222630] bg-[#0d0f14] flex items-center justify-between text-xs">
          <button
            onClick={handleComplete}
            className="text-[#8b949e] hover:text-white transition-colors cursor-pointer text-xs font-medium"
          >
            Skip Tour
          </button>

          <div className="flex items-center space-x-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 rounded bg-[#212631] text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-3.5 py-1.5 rounded bg-[#1f6feb] text-white hover:bg-[#388bfd] transition-colors font-semibold flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <span>{isLast ? 'Get Started' : 'Next'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
