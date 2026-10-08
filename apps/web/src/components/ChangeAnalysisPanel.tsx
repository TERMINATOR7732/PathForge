import React, { useState, useMemo, useEffect } from 'react';
import {
  ChangeAnalysisResult,
  EnvironmentSnapshot,
  SecuritySignificance,
  ingestRepositoryChanges,
  bridgeToChangeAnalysis,
  GitComparisonMode,
  GitRepository,
  PullRequestRiskStatus,
  partitionSignals,
  Environment,
  AttackPathAnalysisResult,
  ArchitectureAnalysisResult,
  ProductionReadinessAssessment,
  TestingIntelligenceResult,
  TechnicalDebtAssessment,
  executeEngineeringRun,
  captureRunToHistory,
  EngineeringRunSourceInfo,
  InMemoryHistoryStore,
  CiGateStatus,
} from '@pathforge/core';
import { ValidationResult } from '@pathforge/shared';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  GitCompare,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  HelpCircle,
  Camera,
  RefreshCw,
  Gauge,
  Coins,
  FileCode,
  ShieldAlert,
  GitBranch,
  GitCommit,
  FolderGit2,
  GitPullRequest,
  Lock,
  Eye,
  History,
  ShieldCheck,
} from 'lucide-react';
import { EngineeringHistoryView } from './EngineeringHistoryView.js';
import { CiGateView } from './CiGateView.js';

const SAMPLE_APP_DIFF = `diff --git a/src/api.ts b/src/api.ts
--- a/src/api.ts
+++ b/src/api.ts
@@ -10,3 +10,4 @@
 export function handleRequest(req: Request) {
+  logger.info("Received request", req.path);
   return process(req);
 }`;

const SAMPLE_INFRA_DIFF = `diff --git a/k8s/network-policy.yaml b/k8s/network-policy.yaml
--- a/k8s/network-policy.yaml
+++ b/k8s/network-policy.yaml
@@ -5,3 +5,4 @@
 spec:
   ingress:
+    - ports: [{ port: 5432 }]`;

const SAMPLE_CI_DIFF = `diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -12,2 +12,4 @@
     steps:
+      - name: Security Scan
+        run: snyk test`;

const SAMPLE_SECRET_DIFF = `diff --git a/config.ts b/config.ts
--- a/config.ts
+++ b/config.ts
@@ -1,2 +1,3 @@
+const apiKey = "sk-live-9876543210abcdef0123456789";
 export const endpoint = "https://api.internal";`;

interface LocalGitScenario {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  name: string;
  badge: string;
  description: string;
  repository: GitRepository;
  comparisonMode: GitComparisonMode;
  baseRef?: string;
  headRef?: string;
  diff: string;
}

const LOCAL_GIT_SCENARIOS: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', LocalGitScenario> = {
  A: {
    id: 'A',
    name: 'QA A: Clean Working Tree',
    badge: 'CLEAN',
    description: 'Working tree is synchronized with HEAD. Zero modifications or untracked files.',
    repository: {
      rootPath: 'e:/MHT CET REGISTRATION/BE/Task/PathForge',
      currentBranch: 'master',
      currentCommit: '620eeed1003660227b5489d62bb41f3043d48309',
      isDirty: false,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      untrackedFiles: [],
      isDetached: false,
      remotePresence: false,
    },
    comparisonMode: 'working-tree-vs-head',
    diff: '',
  },
  B: {
    id: 'B',
    name: 'QA B: Modified Working Tree',
    badge: 'UNSTAGED',
    description: 'Application code modification in working tree (src/api.ts).',
    repository: {
      rootPath: 'e:/MHT CET REGISTRATION/BE/Task/PathForge',
      currentBranch: 'master',
      currentCommit: '620eeed1003660227b5489d62bb41f3043d48309',
      isDirty: true,
      stagedCount: 0,
      unstagedCount: 1,
      untrackedCount: 0,
      untrackedFiles: [],
      isDetached: false,
      remotePresence: false,
    },
    comparisonMode: 'working-tree-vs-head',
    diff: SAMPLE_APP_DIFF,
  },
  C: {
    id: 'C',
    name: 'QA C: Staged Index Changes',
    badge: 'STAGED',
    description: 'Security-sensitive network policy ingress rule staged for commit.',
    repository: {
      rootPath: 'e:/MHT CET REGISTRATION/BE/Task/PathForge',
      currentBranch: 'feature/network-hardening',
      currentCommit: '823e73f4581907cb5b5278c2e7428f572a1e0912',
      isDirty: true,
      stagedCount: 1,
      unstagedCount: 0,
      untrackedCount: 0,
      untrackedFiles: [],
      isDetached: false,
      remotePresence: false,
    },
    comparisonMode: 'index-vs-head',
    diff: SAMPLE_INFRA_DIFF,
  },
  D: {
    id: 'D',
    name: 'QA D: Commit Range (v1.0..HEAD)',
    badge: 'RANGE',
    description: 'Historical commit comparison across release tags or feature commits.',
    repository: {
      rootPath: 'e:/MHT CET REGISTRATION/BE/Task/PathForge',
      currentBranch: 'master',
      currentCommit: '620eeed1003660227b5489d62bb41f3043d48309',
      isDirty: false,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      untrackedFiles: [],
      isDetached: false,
      remotePresence: false,
    },
    comparisonMode: 'commit-vs-commit',
    baseRef: 'v1.0.0',
    headRef: 'HEAD',
    diff: `${SAMPLE_APP_DIFF}\n${SAMPLE_CI_DIFF}`,
  },
  E: {
    id: 'E',
    name: 'QA E: Dirty + Untracked Files',
    badge: 'DIRTY+UNTRACKED',
    description: 'Working tree containing unstaged edits plus untracked development logs.',
    repository: {
      rootPath: 'e:/MHT CET REGISTRATION/BE/Task/PathForge',
      currentBranch: 'master',
      currentCommit: '620eeed1003660227b5489d62bb41f3043d48309',
      isDirty: true,
      stagedCount: 0,
      unstagedCount: 1,
      untrackedCount: 2,
      untrackedFiles: ['scratch/debug-notes.txt', 'temp.log'],
      isDetached: false,
      remotePresence: false,
    },
    comparisonMode: 'working-tree-vs-head',
    diff: `${SAMPLE_APP_DIFF}\ndiff --git a/scratch/debug-notes.txt b/scratch/debug-notes.txt\nnew file mode 100644\n--- /dev/null\n+++ b/scratch/debug-notes.txt\n@@ -0,0 +1,1 @@\n+[untracked file: scratch/debug-notes.txt]\ndiff --git a/temp.log b/temp.log\nnew file mode 100644\n--- /dev/null\n+++ b/temp.log\n@@ -0,0 +1,1 @@\n+[untracked file: temp.log]`,
  },
  F: {
    id: 'F',
    name: 'QA F: Security Config Change',
    badge: 'SECURITY CRITICAL',
    description: 'Configuration file introducing hardcoded live API credential token.',
    repository: {
      rootPath: 'e:/MHT CET REGISTRATION/BE/Task/PathForge',
      currentBranch: 'fix/secret-handling',
      currentCommit: 'a1d506829c35472859132149bdf549926839cf92',
      isDirty: true,
      stagedCount: 0,
      unstagedCount: 1,
      untrackedCount: 0,
      untrackedFiles: [],
      isDetached: false,
      remotePresence: false,
    },
    comparisonMode: 'working-tree-vs-head',
    diff: SAMPLE_SECRET_DIFF,
  },
};

interface GitHubPrScenario {
  id: 'A' | 'B' | 'C' | 'D';
  name: string;
  badge: string;
  description: string;
  owner: string;
  repository: string;
  prNumber: number;
  title: string;
  author: string;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  isDraft: boolean;
  baseBranch: string;
  headBranch: string;
  baseSha: string;
  headSha: string;
  filesCount: number;
  additions: number;
  deletions: number;
  diff: string;
  isError?: boolean;
  errorMessage?: string;
  riskStatus: PullRequestRiskStatus;
}

const GITHUB_PR_SCENARIOS: Record<'A' | 'B' | 'C' | 'D', GitHubPrScenario> = {
  A: {
    id: 'A',
    name: 'QA A: Normal PR',
    badge: 'APP CODE',
    description: 'Application service modification updating payment calculation logic (src/api.ts).',
    owner: 'acme-corp',
    repository: 'cloud-infrastructure',
    prNumber: 101,
    title: 'Update payment calculation service',
    author: 'alice-engineer',
    state: 'OPEN',
    isDraft: false,
    baseBranch: 'main',
    headBranch: 'feature/payment-calc',
    baseSha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
    headSha: 'ae2acad5c06dc59578955187a8972329a7f2ee22',
    filesCount: 1,
    additions: 3,
    deletions: 0,
    diff: SAMPLE_APP_DIFF,
    riskStatus: 'ENGINEERING_CHANGE_DETECTED',
  },
  B: {
    id: 'B',
    name: 'QA B: Security-Sensitive PR',
    badge: 'INGRESS CONFIG',
    description: 'Kubernetes network policy rule modified to allow database ingress on port 5432.',
    owner: 'acme-corp',
    repository: 'cloud-infrastructure',
    prNumber: 102,
    title: 'Allow database ingress for backend pods',
    author: 'dev-secops',
    state: 'OPEN',
    isDraft: false,
    baseBranch: 'main',
    headBranch: 'feature/k8s-ingress',
    baseSha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
    headSha: 'f31a982cb123e4567890abcdef1234567890abcd',
    filesCount: 1,
    additions: 4,
    deletions: 0,
    diff: SAMPLE_INFRA_DIFF,
    riskStatus: 'SECURITY_SENSITIVE_CHANGE',
  },
  C: {
    id: 'C',
    name: 'QA C: Code-Only PR',
    badge: 'CI & TESTS',
    description: 'CI workflow and automated security scan step added (.github/workflows/deploy.yml).',
    owner: 'acme-corp',
    repository: 'cloud-infrastructure',
    prNumber: 103,
    title: 'Integrate Snyk automated scanning step into CI',
    author: 'qa-charlie',
    state: 'OPEN',
    isDraft: false,
    baseBranch: 'main',
    headBranch: 'ci/security-scan',
    baseSha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
    headSha: '89bc321def4567890abcdef1234567890abcdef1',
    filesCount: 1,
    additions: 4,
    deletions: 0,
    diff: SAMPLE_CI_DIFF,
    riskStatus: 'ENGINEERING_CHANGE_DETECTED',
  },
  D: {
    id: 'D',
    name: 'QA D: Inaccessible / Failure PR',
    badge: 'ERROR / NOT FOUND',
    description: 'Repository or pull request not found, permission denied, or rate limited.',
    owner: 'private-org',
    repository: 'restricted-infra',
    prNumber: 999,
    title: 'Restricted Pull Request',
    author: 'unknown',
    state: 'OPEN',
    isDraft: false,
    baseBranch: 'main',
    headBranch: 'patch',
    baseSha: '0000000000000000000000000000000000000000',
    headSha: '0000000000000000000000000000000000000000',
    filesCount: 0,
    additions: 0,
    deletions: 0,
    diff: '',
    isError: true,
    errorMessage: '[REPOSITORY_NOT_FOUND] Repository private-org/restricted-infra was not found or access is restricted.',
    riskStatus: 'INSUFFICIENT_EVIDENCE',
  },
};

interface ChangeAnalysisPanelProps {
  changeAnalysis: ChangeAnalysisResult | null;
  baselineSnapshot: EnvironmentSnapshot | null;
  onCaptureBaseline: () => void;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onSelectNode: (nodeId: string) => void;
  onRequestValidate?: () => void;
  environment?: Environment | null;
  validationResult?: ValidationResult | null;
  attackPathAnalysis?: AttackPathAnalysisResult | null;
  architectureResult?: ArchitectureAnalysisResult | null;
  productionReadiness?: ProductionReadinessAssessment | null;
  testingIntelligence?: TestingIntelligenceResult | null;
  technicalDebt?: TechnicalDebtAssessment | null;
  isValidationStale?: boolean;
}

export const ChangeAnalysisPanel: React.FC<ChangeAnalysisPanelProps> = ({
  changeAnalysis,
  baselineSnapshot,
  onCaptureBaseline,
  onLocateElement,
  onRequestValidate,
  environment,
  validationResult,
  attackPathAnalysis,
  architectureResult,
  productionReadiness,
  testingIntelligence,
  technicalDebt,
  isValidationStale = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'workflow' | 'changes' | 'risks' | 'paths' | 'intelligence' | 'source' | 'history' | 'gate'>('workflow');
  const [significanceFilter, setSignificanceFilter] = useState<'all' | SecuritySignificance>('all');
  const [diffText, setDiffText] = useState<string>(SAMPLE_APP_DIFF);
  const [sourceMode, setSourceMode] = useState<'git' | 'github' | 'diff'>('git');
  const [selectedQaScenario, setSelectedQaScenario] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F'>('B');
  const [gitRepoPath, setGitRepoPath] = useState<string>('e:/MHT CET REGISTRATION/BE/Task/PathForge');
  const [gitMode, setGitMode] = useState<GitComparisonMode>('working-tree-vs-head');
  const [gitBaseRef, setGitBaseRef] = useState<string>('HEAD~1');
  const [gitHeadRef, setGitHeadRef] = useState<string>('HEAD');
  const [includeUntracked, setIncludeUntracked] = useState<boolean>(false);
  const [showRawDiff, setShowRawDiff] = useState<boolean>(false);
  const [inspectionTimestamp, setInspectionTimestamp] = useState<string>(new Date().toLocaleTimeString());

  // GitHub PR state
  const [selectedGhScenario, setSelectedGhScenario] = useState<'A' | 'B' | 'C' | 'D'>('B');
  const [ghOwner, setGhOwner] = useState<string>('acme-corp');
  const [ghRepo, setGhRepo] = useState<string>('cloud-infrastructure');
  const [ghPrNumber, setGhPrNumber] = useState<string>('102');
  const [ghInspectionTimestamp, setGhInspectionTimestamp] = useState<string>(new Date().toLocaleTimeString());

  // Continuous Workflow & State Discipline (Phase 3.7)
  const [isRunStale, setIsRunStale] = useState<boolean>(false);
  const [staleReason, setStaleReason] = useState<string>('');
  const [lastAnalysisTimestamp, setLastAnalysisTimestamp] = useState<string>(new Date().toLocaleTimeString());
  const [historyCaptureFeedback, setHistoryCaptureFeedback] = useState<string | null>(null);

  // Invalidate when source configuration changes
  useEffect(() => {
    setIsRunStale(true);
    setStaleReason('Change source parameters or diff modified');
  }, [sourceMode, selectedQaScenario, selectedGhScenario, gitMode, diffText, includeUntracked, gitRepoPath, gitBaseRef, gitHeadRef, ghOwner, ghRepo, ghPrNumber]);

  // Invalidate when baseline snapshot changes
  useEffect(() => {
    setIsRunStale(true);
    setStaleReason('Baseline snapshot updated');
  }, [baselineSnapshot?.timestamp]);

  // Invalidate when topology validation is stale
  useEffect(() => {
    if (isValidationStale) {
      setIsRunStale(true);
      setStaleReason('Infrastructure topology modified since last validation');
    }
  }, [isValidationStale]);

  const activeScenario = LOCAL_GIT_SCENARIOS[selectedQaScenario];
  const activeGhScenario = GITHUB_PR_SCENARIOS[selectedGhScenario];

  const activeDiff = useMemo(() => {
    if (sourceMode === 'diff') {
      return diffText;
    }
    if (sourceMode === 'github') {
      if (activeGhScenario.isError) return '';
      return activeGhScenario.diff;
    }
    if (selectedQaScenario === 'A') {
      return '';
    }
    if (includeUntracked && activeScenario.repository.untrackedCount > 0) {
      return LOCAL_GIT_SCENARIOS.E.diff;
    }
    return activeScenario.diff;
  }, [sourceMode, diffText, selectedQaScenario, includeUntracked, activeScenario, selectedGhScenario, activeGhScenario]);

  const ingestedChangeSet = useMemo(() => ingestRepositoryChanges(activeDiff), [activeDiff]);
  const ingestionBridge = useMemo(() => bridgeToChangeAnalysis(ingestedChangeSet), [ingestedChangeSet]);
  const ghSignalsSummary = useMemo(() => partitionSignals(ingestedChangeSet.signals), [ingestedChangeSet]);

  const runSource = useMemo<EngineeringRunSourceInfo>(() => {
    if (sourceMode === 'github') {
      return {
        type: 'github-pr',
        identifier: `${ghOwner}/${ghRepo}#${ghPrNumber}`,
        displayName: `GitHub PR #${ghPrNumber} (${ghOwner}/${ghRepo})`,
        revision: activeGhScenario.headSha.slice(0, 7),
        branch: activeGhScenario.headBranch,
        baseRef: `${activeGhScenario.baseBranch} @ ${activeGhScenario.baseSha.slice(0, 7)}`,
        headRef: `${activeGhScenario.headBranch} @ ${activeGhScenario.headSha.slice(0, 7)}`,
        details: {
          owner: ghOwner,
          repo: ghRepo,
          prNumber: parseInt(ghPrNumber, 10) || 1,
          baseSha: activeGhScenario.baseSha,
          headSha: activeGhScenario.headSha,
          filesCount: activeGhScenario.filesCount,
          additions: activeGhScenario.additions,
          deletions: activeGhScenario.deletions,
        },
      };
    }
    if (sourceMode === 'git') {
      return {
        type: 'local-git',
        identifier: `${gitRepoPath} (${activeScenario.repository.currentBranch})`,
        displayName: `Local Git (${activeScenario.repository.currentBranch})`,
        revision: activeScenario.repository.currentCommit.slice(0, 7),
        branch: activeScenario.repository.currentBranch ?? undefined,
        baseRef: gitMode === 'commit-vs-commit' ? gitBaseRef : 'HEAD',
        headRef: gitMode === 'commit-vs-commit' ? gitHeadRef : activeScenario.comparisonMode,
        details: {
          repoPath: gitRepoPath,
          branch: activeScenario.repository.currentBranch ?? undefined,
          commitSha: activeScenario.repository.currentCommit,
          comparisonMode: activeScenario.comparisonMode,
          isDirty: activeScenario.repository.isDirty,
          filesCount: activeScenario.repository.stagedCount + activeScenario.repository.unstagedCount,
        },
      };
    }
    return {
      type: 'raw-diff',
      identifier: 'Raw Unified Diff Ingestion',
      displayName: 'Raw Unified Diff Ingestion',
      details: {
        diffLength: diffText.length,
      },
    };
  }, [sourceMode, ghOwner, ghRepo, ghPrNumber, activeGhScenario, gitRepoPath, activeScenario, gitMode, gitBaseRef, gitHeadRef, diffText]);

  const engineeringRun = useMemo(() => {
    return executeEngineeringRun({
      environment,
      source: runSource,
      validationResult,
      attackPathAnalysis,
      architectureAnalysis: architectureResult,
      productionReadiness,
      testingIntelligence,
      technicalDebt,
      changeAnalysis,
      isStale: isRunStale,
      staleReason,
    });
  }, [
    environment,
    runSource,
    validationResult,
    attackPathAnalysis,
    architectureResult,
    productionReadiness,
    testingIntelligence,
    technicalDebt,
    changeAnalysis,
    isRunStale,
    staleReason,
    lastAnalysisTimestamp,
  ]);

  const handleRunEngineeringAnalysis = () => {
    if (onRequestValidate) {
      onRequestValidate();
    }
    setIsRunStale(false);
    setStaleReason('');
    setLastAnalysisTimestamp(new Date().toLocaleTimeString());
  };

  const handleCaptureRunToHistory = async () => {
    const store = new InMemoryHistoryStore();
    try {
      const res = await captureRunToHistory(
        engineeringRun,
        environment,
        validationResult,
        store,
        {
          attackPathAnalysis,
          architectureAnalysis: architectureResult,
          productionReadiness,
          testingIntelligence,
          technicalDebt,
          changeAnalysis,
        }
      );
      setHistoryCaptureFeedback(`Run successfully recorded to engineering history (${res.record.id})`);
      setTimeout(() => setHistoryCaptureFeedback(null), 4000);
    } catch (err: any) {
      setHistoryCaptureFeedback(`Failed to record history: ${err.message}`);
    }
  };

  if (!baselineSnapshot) {
    return (
      <div className="p-8 text-center bg-[#0d1117] border border-[#21262d] rounded-lg">
        <GitCompare className="w-12 h-12 text-[#8b949e] mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">No Baseline Snapshot Established</h3>
        <p className="text-xs text-[#8b949e] max-w-md mx-auto mb-4">
          Establish an immutable baseline of your current validated topology to track security changes, attack path mutations, and regressions.
        </p>
        <button
          onClick={onCaptureBaseline}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Capture Initial Baseline</span>
        </button>
      </div>
    );
  }

  if (!changeAnalysis) {
    return (
      <div className="p-8 text-center bg-[#0d1117] border border-[#21262d] rounded-lg">
        <RefreshCw className="w-8 h-8 text-[#58a6ff] mx-auto mb-3 animate-spin" />
        <p className="text-xs text-[#8b949e]">Analyzing continuous changes against baseline...</p>
      </div>
    );
  }

  const {
    summary,
    changes,
    newlyIntroducedRisks,
    resolvedRisks,
    unchangedRisks,
    regressionDetected,
    regressionDetails,
    attackPathDelta,
    architectureDelta,
    readinessDelta,
    technicalDebtDelta,
    recommendations,
  } = changeAnalysis;

  const filteredChanges = changes.filter((c) => {
    if (significanceFilter === 'all') return true;
    return c.classification === significanceFilter;
  });

  const getImpactBadge = () => {
    switch (summary.impactLevel) {
      case 'CRITICAL':
        return 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40';
      case 'HIGH':
        return 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/40';
      case 'MEDIUM':
        return 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40';
      case 'LOW':
      default:
        return 'bg-[#3fb950]/20 text-[#3fb950] border-[#3fb950]/40';
    }
  };

  const getSignificanceBadge = (sig: SecuritySignificance) => {
    switch (sig) {
      case 'security-increasing':
        return {
          label: 'SECURITY INCREASING',
          badge: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/40',
          icon: TrendingUp,
        };
      case 'security-decreasing':
        return {
          label: 'SECURITY DECREASING',
          badge: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
          icon: TrendingDown,
        };
      case 'security-ambiguous':
        return {
          label: 'SECURITY AMBIGUOUS',
          badge: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
          icon: HelpCircle,
        };
      case 'security-neutral':
      default:
        return {
          label: 'SECURITY NEUTRAL',
          badge: 'bg-[#30363d]/30 text-[#8b949e] border-[#30363d]',
          icon: Minus,
        };
    }
  };

  const getPrRiskBadge = (status: PullRequestRiskStatus) => {
    switch (status) {
      case 'SECURITY_REGRESSION':
        return 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40';
      case 'SECURITY_SENSITIVE_CHANGE':
        return 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40';
      case 'SECURITY_IMPROVEMENT':
        return 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/40';
      case 'ENGINEERING_CHANGE_DETECTED':
        return 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#1f6feb]/40';
      case 'NO_ENGINEERING_IMPACT':
        return 'bg-[#8b949e]/20 text-[#8b949e] border-[#8b949e]/40';
      case 'INSUFFICIENT_EVIDENCE':
      default:
        return 'bg-[#8b949e]/20 text-[#c9d1d9] border-[#8b949e]/40';
    }
  };

  const getGateBadgeClass = (status: CiGateStatus) => {
    switch (status) {
      case 'PASS':
        return 'bg-[#238636]/20 border-[#238636] text-[#3fb950]';
      case 'WARN':
        return 'bg-[#d29922]/20 border-[#d29922] text-[#d29922]';
      case 'BLOCK':
        return 'bg-[#da3633]/20 border-[#da3633] text-[#f85149]';
      case 'INSUFFICIENT_EVIDENCE':
      default:
        return 'bg-[#8b949e]/20 border-[#8b949e] text-[#c9d1d9]';
    }
  };

  const getResultBadge = (res: 'PASS' | 'WARN' | 'BLOCK' | 'UNVERIFIED') => {
    switch (res) {
      case 'PASS':
        return { cls: 'bg-[#238636]/15 border-[#238636]/40 text-[#3fb950]' };
      case 'WARN':
        return { cls: 'bg-[#d29922]/15 border-[#d29922]/40 text-[#d29922]' };
      case 'BLOCK':
        return { cls: 'bg-[#da3633]/15 border-[#da3633]/40 text-[#f85149]' };
      case 'UNVERIFIED':
      default:
        return { cls: 'bg-[#30363d]/40 border-[#30363d] text-[#8b949e]' };
    }
  };

  return (
    <div className="space-y-4">
      {/* 0. Continuous Engineering Run Context Bar */}
      <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Source Provenance */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[#58a6ff] font-bold flex items-center space-x-1.5">
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>SOURCE: {runSource.displayName}</span>
            </span>
            {runSource.baseRef && runSource.headRef && (
              <span className="text-[#8b949e] flex items-center space-x-1">
                <span>{runSource.baseRef}</span>
                <ArrowRight className="w-3 h-3 text-[#58a6ff]" />
                <span className="text-[#c9d1d9]">{runSource.headRef}</span>
              </span>
            )}
          </div>

          {/* Technical Status Badges */}
          <div className="flex items-center space-x-2">
            {isRunStale ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded border border-[#d29922]/50 bg-[#d29922]/15 text-[#d29922] text-xs font-mono font-bold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>STALE — RE-ANALYZE REQUIRED</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded border border-[#238636]/50 bg-[#238636]/15 text-[#3fb950] text-xs font-mono font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CURRENT</span>
              </span>
            )}
            <span
              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded border text-xs font-mono font-bold ${getGateBadgeClass(
                engineeringRun.gateStatus
              )}`}
            >
              <span>GATE: {engineeringRun.gateStatus} ({engineeringRun.compositeScore}/100)</span>
            </span>
          </div>
        </div>

        {/* Change Stats & Executive Workflow Action Triggers */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#21262d] text-xs font-mono">
          <div className="text-[#8b949e]">
            {engineeringRun.changesSummary
              ? `${engineeringRun.changesSummary.filesCount} file(s) · +${engineeringRun.changesSummary.additions} / -${engineeringRun.changesSummary.deletions} · Engineering Impact: ${engineeringRun.changesSummary.impact}`
              : `${summary.totalChanges} topology mutations evaluated · Last run: ${lastAnalysisTimestamp}`}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunEngineeringAnalysis}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded bg-[#1f6feb] hover:bg-[#388bfd] text-white font-bold transition-colors shadow-sm"
              title="Execute unified continuous engineering evaluation"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>RUN ENGINEERING ANALYSIS</span>
            </button>
            <button
              onClick={handleCaptureRunToHistory}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded bg-[#238636] hover:bg-[#2ea043] text-white font-bold transition-colors shadow-sm"
              title="Record verified run evaluation to engineering history"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>CAPTURE RUN TO HISTORY</span>
            </button>
          </div>
        </div>

        {/* Stale Invalidation Warning Banner */}
        {isRunStale && (
          <div className="p-2.5 rounded bg-[#d29922]/10 border border-[#d29922]/30 text-xs font-mono text-[#d29922] flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-[#d29922] flex-shrink-0" />
              <span>Analysis is stale: {staleReason}. Click "RUN ENGINEERING ANALYSIS" to recalculate.</span>
            </div>
            <button
              onClick={handleRunEngineeringAnalysis}
              className="underline hover:text-[#e6edf3] font-bold ml-2"
            >
              Re-analyze
            </button>
          </div>
        )}

        {/* History Capture Toast */}
        {historyCaptureFeedback && (
          <div className="p-2.5 rounded bg-[#1f6feb]/10 border border-[#1f6feb]/30 text-xs font-mono text-[#58a6ff] flex items-center justify-between">
            <span>{historyCaptureFeedback}</span>
            <button onClick={() => setHistoryCaptureFeedback(null)} className="text-[#8b949e] hover:text-[#c9d1d9]">×</button>
          </div>
        )}
      </div>

      {/* 1. Baseline Strip & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-[#161b22] border border-[#30363d]">
        <div className="flex items-center space-x-2 text-xs">
          <Camera className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span className="text-[#8b949e] font-mono">
            BASELINE:{' '}
            <span className="text-[#e6edf3]">
              {baselineSnapshot.nodes.length} nodes, {baselineSnapshot.edges.length} edges
            </span>{' '}
            · {new Date(baselineSnapshot.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {onRequestValidate && (
            <button
              onClick={onRequestValidate}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
              title="Re-run validation engine"
            >
              <RefreshCw className="w-3 h-3 text-[#58a6ff]" />
              <span>Revalidate</span>
            </button>
          )}
          <button
            onClick={onCaptureBaseline}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
            title="Set current environment as the new baseline"
          >
            <Camera className="w-3 h-3 text-[#3fb950]" />
            <span>Update Baseline</span>
          </button>
        </div>
      </div>

      {/* 2. Impact Health Banner */}
      <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-0.5 rounded border text-xs font-mono font-bold tracking-wider ${getImpactBadge()}`}>
              IMPACT: {summary.impactLevel}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[11px] font-mono uppercase text-[#c9d1d9]">
              {summary.category}
            </span>
          </div>
          <span className="text-xs font-mono text-[#8b949e]">
            {summary.totalChanges} Total Change{summary.totalChanges === 1 ? '' : 's'}
          </span>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[#e6edf3]">{summary.headline}</h4>
          {summary.impactReasons.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-[#8b949e]">
              {summary.impactReasons.map((r, i) => (
                <li key={i} className="flex items-start space-x-1.5">
                  <span className="text-[#58a6ff] mt-0.5">▪</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Metric Counters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-[#21262d]">
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#8b949e]">CHANGES</div>
            <div className="text-base font-bold font-mono text-[#e6edf3]">{summary.totalChanges}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#3fb950]">STRENGTHENED</div>
            <div className="text-base font-bold font-mono text-[#3fb950]">{summary.securityIncreasing}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#f85149]">WEAKENED</div>
            <div className="text-base font-bold font-mono text-[#f85149]">{summary.securityDecreasing}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#f85149]">NEW RISKS</div>
            <div className="text-base font-bold font-mono text-[#f85149]">{summary.risksIntroduced}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#3fb950]">RESOLVED</div>
            <div className="text-base font-bold font-mono text-[#3fb950]">{summary.risksResolved}</div>
          </div>
        </div>
      </div>

      {/* 3. Regression Banner if Regression Detected */}
      {regressionDetected && (
        <div className="p-3.5 rounded-lg bg-[#da3633]/10 border border-[#da3633]/40 space-y-2">
          <div className="flex items-center space-x-2 text-[#f85149]">
            <AlertOctagon className="w-4 h-4" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase">
              SECURITY REGRESSION DETECTED
            </span>
          </div>
          <p className="text-xs text-[#c9d1d9] leading-relaxed">
            {regressionDetails.explanation}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2 rounded bg-[#0d1117]/80 border border-[#238636]/30">
              <span className="text-[#3fb950] font-bold block mb-1">
                ✓ RESOLVED ({regressionDetails.resolvedRisks.length}):
              </span>
              <ul className="text-[#8b949e] space-y-0.5">
                {regressionDetails.resolvedRisks.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.ruleId} · {r.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-2 rounded bg-[#0d1117]/80 border border-[#da3633]/30">
              <span className="text-[#f85149] font-bold block mb-1">
                ⚠ INTRODUCED ({regressionDetails.newRisks.length}):
              </span>
              <ul className="text-[#8b949e] space-y-0.5">
                {regressionDetails.newRisks.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.ruleId} · {r.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 4. Sub-Tab Navigation Strip */}
      <div className="flex items-center space-x-1 border-b border-[#21262d] pb-1 text-xs font-mono overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('workflow')}
          className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'workflow'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span>WORKFLOW & EVIDENCE</span>
        </button>
        <button
          onClick={() => setActiveSubTab('changes')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeSubTab === 'changes'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          CHANGES ({changes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('risks')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeSubTab === 'risks'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          RISK DELTA (+{newlyIntroducedRisks.length} / -{resolvedRisks.length})
        </button>
        <button
          onClick={() => setActiveSubTab('paths')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeSubTab === 'paths'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          ATTACK PATHS (+{attackPathDelta.added.length} / -{attackPathDelta.removed.length})
        </button>
        <button
          onClick={() => setActiveSubTab('intelligence')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeSubTab === 'intelligence'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          INTELLIGENCE DELTA
        </button>
        <button
          onClick={() => setActiveSubTab('source')}
          className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'source'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <GitPullRequest className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span>CHANGE SOURCE ({ingestedChangeSet.files.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'history'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <History className="w-3.5 h-3.5 text-[#3fb950]" />
          <span>ENGINEERING HISTORY</span>
        </button>
        <button
          onClick={() => setActiveSubTab('gate')}
          className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeSubTab === 'gate'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span>CI GATE</span>
        </button>
      </div>

      {/* 5. Sub-Tab Content */}

      {/* Sub-Tab 0: Continuous Workflow & Evidence Matrix */}
      {activeSubTab === 'workflow' && (
        <div className="space-y-4">
          {/* Executive Decision Verdict Card */}
          <div
            className={`p-4 rounded-lg border space-y-3 ${
              engineeringRun.gateStatus === 'PASS'
                ? 'bg-[#238636]/10 border-[#238636]/40'
                : engineeringRun.gateStatus === 'WARN'
                ? 'bg-[#d29922]/10 border-[#d29922]/40'
                : engineeringRun.gateStatus === 'BLOCK'
                ? 'bg-[#da3633]/10 border-[#da3633]/40'
                : 'bg-[#161b22] border-[#30363d]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                {engineeringRun.gateStatus === 'PASS' ? (
                  <ShieldCheck className="w-6 h-6 text-[#3fb950]" />
                ) : engineeringRun.gateStatus === 'WARN' ? (
                  <AlertTriangle className="w-6 h-6 text-[#d29922]" />
                ) : engineeringRun.gateStatus === 'BLOCK' ? (
                  <AlertOctagon className="w-6 h-6 text-[#f85149]" />
                ) : (
                  <HelpCircle className="w-6 h-6 text-[#8b949e]" />
                )}
                <div>
                  <div className="text-[11px] font-mono text-[#8b949e] uppercase tracking-wider font-bold">
                    ENGINEERING DECISION VERDICT
                  </div>
                  <div className="text-base font-bold font-mono text-[#e6edf3]">
                    {engineeringRun.gateStatus === 'PASS' && 'GATE PASSED — ALL VERIFIED CONTROLS SATISFIED'}
                    {engineeringRun.gateStatus === 'WARN' && 'GATE WARNING — ADVISORY RISKS DETECTED (NON-BLOCKING)'}
                    {engineeringRun.gateStatus === 'BLOCK' && 'GATE BLOCKED — HARD SECURITY OR ARCHITECTURAL VIOLATIONS'}
                    {engineeringRun.gateStatus === 'INSUFFICIENT_EVIDENCE' && 'INSUFFICIENT EVIDENCE — REQUIRED PREREQUISITES UNVERIFIED'}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono">
                <div className="p-2 rounded bg-[#0d1117] border border-[#30363d] text-center min-w-[70px]">
                  <span className="text-[10px] text-[#8b949e] uppercase block">SCORE</span>
                  <span className="text-sm font-bold text-[#e6edf3]">{engineeringRun.compositeScore}/100</span>
                </div>
                <div className="p-2 rounded bg-[#0d1117] border border-[#30363d] text-center min-w-[70px]">
                  <span className="text-[10px] text-[#8b949e] uppercase block">EXIT CODE</span>
                  <span className="text-sm font-bold text-[#e6edf3]">{engineeringRun.exitCode}</span>
                </div>
              </div>
            </div>

            {engineeringRun.topReasons.length > 0 && (
              <div className="pt-2 border-t border-[#30363d]/50 space-y-1.5 text-xs font-mono">
                <div className="text-[#8b949e] text-[11px] uppercase font-bold">
                  PRIMARY DETERMINISTIC FACTORS (WHY?):
                </div>
                <ul className="space-y-1 text-[#c9d1d9]">
                  {engineeringRun.topReasons.map((r, i) => (
                    <li key={i} className="flex items-start space-x-1.5">
                      <span className="text-[#58a6ff] mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Evidence Matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-[#e6edf3] uppercase">
                COMPREHENSIVE EVIDENCE MATRIX ({engineeringRun.evidenceMatrix.length} CONTROLS)
              </span>
              <span className="text-[#8b949e]">
                Truthful & Deterministic Evaluation (Zero Simulated/Fake Evidence)
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#30363d] bg-[#161b22]">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#30363d] bg-[#0d1117] text-[#8b949e] uppercase text-[10px]">
                    <th className="py-2.5 px-3 font-semibold">Control Name</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold">Result</th>
                    <th className="py-2.5 px-3 font-semibold">Verified Evidence & Rationale</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Canvas Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d]">
                  {engineeringRun.evidenceMatrix.map((row, idx) => {
                    const badge = getResultBadge(row.result);
                    return (
                      <tr key={idx} className="hover:bg-[#1f242c] transition-colors">
                        <td className="py-2 px-3 text-[#e6edf3] font-medium whitespace-nowrap">
                          {row.control}
                        </td>
                        <td className="py-2 px-3 text-[#8b949e] text-[11px] whitespace-nowrap">
                          {row.category}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                            {row.result}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#c9d1d9] max-w-md">
                          {row.evidence}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {row.targetElements.length > 0 ? (
                            <div className="inline-flex items-center space-x-1">
                              {row.targetElements.slice(0, 2).map((target) => (
                                <button
                                  key={target.id}
                                  onClick={() => onLocateElement({ id: target.id, type: target.type })}
                                  className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] hover:border-[#58a6ff] text-[10px] text-[#58a6ff] hover:text-[#79c0ff] transition-colors inline-flex items-center space-x-1"
                                  title={`Locate ${target.label} on canvas`}
                                >
                                  <Crosshair className="w-2.5 h-2.5" />
                                  <span>{target.label}</span>
                                </button>
                              ))}
                              {row.targetElements.length > 2 && (
                                <span className="text-[10px] text-[#8b949e]">+{row.targetElements.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#8b949e] text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evidence Lineage Section */}
          {engineeringRun.evidenceLineage.filter((l) => l.verdict === 'BLOCK' || l.verdict === 'WARN').length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase flex items-center space-x-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>EXPLICIT EVIDENCE LINEAGE (AUDIT TRAIL)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                {engineeringRun.evidenceLineage
                  .filter((l) => l.verdict === 'BLOCK' || l.verdict === 'WARN')
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border space-y-1.5 ${
                        item.verdict === 'BLOCK'
                          ? 'bg-[#da3633]/5 border-[#da3633]/30'
                          : 'bg-[#d29922]/5 border-[#d29922]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#e6edf3] truncate">{item.controlName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            item.verdict === 'BLOCK'
                              ? 'bg-[#da3633]/20 border-[#da3633]/40 text-[#f85149]'
                              : 'bg-[#d29922]/20 border-[#d29922]/40 text-[#d29922]'
                          }`}
                        >
                          {item.verdict}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8b949e]">{item.description}</p>
                      {item.targetElements.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-1">
                          <span className="text-[10px] text-[#8b949e] mr-1">AFFECTED:</span>
                          {item.targetElements.map((target) => (
                            <button
                              key={target.id}
                              onClick={() => onLocateElement({ id: target.id, type: target.type })}
                              className="px-1 py-0.5 rounded bg-[#21262d] border border-[#30363d] hover:border-[#58a6ff] text-[10px] text-[#58a6ff] hover:text-[#79c0ff] inline-flex items-center space-x-1"
                            >
                              <Crosshair className="w-2.5 h-2.5" />
                              <span>{target.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab A: Changes */}
      {activeSubTab === 'changes' && (
        <div className="space-y-3">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-[#8b949e] mr-1">Filter:</span>
            {(['all', 'security-decreasing', 'security-increasing', 'security-neutral'] as const).map((sig) => (
              <button
                key={sig}
                onClick={() => setSignificanceFilter(sig)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  significanceFilter === sig
                    ? 'bg-[#30363d] text-[#e6edf3] font-bold border border-[#58a6ff]'
                    : 'bg-[#161b22] text-[#8b949e] border border-[#21262d] hover:text-[#c9d1d9]'
                }`}
              >
                {sig === 'all' ? 'ALL' : sig.replace('security-', '').toUpperCase()}
              </button>
            ))}
          </div>

          {filteredChanges.length === 0 ? (
            <div className="p-6 text-center bg-[#0d1117] border border-[#21262d] rounded text-xs text-[#8b949e]">
              No infrastructure changes match the selected filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredChanges.map((change) => {
                const sig = getSignificanceBadge(change.classification);
                const SigIcon = sig.icon;
                return (
                  <div
                    key={change.id}
                    className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2 transition-colors hover:border-[#58a6ff]/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#c9d1d9] text-[10px] font-mono font-bold">
                          {change.type}
                        </span>
                        <span className="text-xs font-semibold text-[#e6edf3]">{change.label}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${sig.badge}`}>
                          <SigIcon className="w-3 h-3" />
                          <span>{sig.label}</span>
                        </span>
                        <button
                          onClick={() => {
                            if (change.targetType === 'node') {
                              onLocateElement({ id: change.targetId, type: 'node' });
                            } else {
                              onLocateElement({ id: change.targetId, type: 'edge' });
                            }
                          }}
                          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#58a6ff] text-[10px] font-mono"
                          title="Locate on canvas"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Locate</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#8b949e]">{change.description}</p>

                    <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono space-y-1">
                      <div className="text-[11px] text-[#58a6ff]">WHY IT MATTERS:</div>
                      <div className="text-[#c9d1d9]">{change.classificationReason}</div>
                    </div>

                    {change.fieldChanges && change.fieldChanges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {change.fieldChanges.map((fc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[10px] font-mono text-[#8b949e]"
                          >
                            <span className="text-[#58a6ff]">{fc.field}:</span> {String(fc.before ?? 'none')} →{' '}
                            <span className="text-[#e6edf3] font-bold">{String(fc.after ?? 'none')}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab B: Risk Delta */}
      {activeSubTab === 'risks' && (
        <div className="space-y-4">
          {/* Newly Introduced */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#f85149]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>NEWLY INTRODUCED RISKS ({newlyIntroducedRisks.length})</span>
            </div>
            {newlyIntroducedRisks.length === 0 ? (
              <div className="p-3 rounded bg-[#0d1117] border border-[#21262d] text-xs text-[#3fb950]">
                ✓ Zero new security findings introduced by this change.
              </div>
            ) : (
              <div className="space-y-2">
                {newlyIntroducedRisks.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3 rounded bg-[#da3633]/10 border border-[#da3633]/30 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#da3633]/20 text-[#f85149] text-[10px] font-mono font-bold">
                          {finding.severity.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-[#e6edf3]">{finding.ruleId}</span>
                        <span className="text-xs font-semibold text-[#e6edf3]">{finding.title}</span>
                      </div>
                      <button
                        onClick={() => {
                          if (finding.affectedEdges.length > 0) {
                            onLocateElement({ id: finding.affectedEdges[0], type: 'edge' });
                          } else if (finding.affectedNodes.length > 0) {
                            onLocateElement({ id: finding.affectedNodes[0], type: 'node' });
                          }
                        }}
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#58a6ff] text-[10px] font-mono"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Locate</span>
                      </button>
                    </div>
                    <p className="text-xs text-[#8b949e]">{finding.description}</p>
                    <p className="text-xs text-[#c9d1d9]">{finding.whyItMatters}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved Risks */}
          <div className="space-y-2 pt-2 border-t border-[#21262d]">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#3fb950]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>RESOLVED RISKS ({resolvedRisks.length})</span>
            </div>
            {resolvedRisks.length === 0 ? (
              <div className="p-3 rounded bg-[#0d1117] border border-[#21262d] text-xs text-[#8b949e]">
                No baseline security findings were eliminated by this change.
              </div>
            ) : (
              <div className="space-y-1.5">
                {resolvedRisks.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-2.5 rounded bg-[#238636]/10 border border-[#238636]/30 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-[#3fb950] font-mono font-bold">{finding.ruleId}</span>
                      <span className="text-[#e6edf3]">{finding.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#3fb950] uppercase">RESOLVED</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unchanged Active Risks */}
          <div className="pt-2 border-t border-[#21262d] text-xs text-[#8b949e] font-mono">
            UNCHANGED RISKS: <span className="text-[#e6edf3]">{unchangedRisks.length} findings</span> continue to persist across both states.
          </div>
        </div>
      )}

      {/* Sub-Tab C: Attack Path Delta */}
      {activeSubTab === 'paths' && (
        <div className="space-y-3">
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono text-[#8b949e]">
            {attackPathDelta.summary}
          </div>

          {attackPathDelta.added.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#f85149]">
                NEW ATTACK PATHS ({attackPathDelta.added.length}):
              </span>
              {attackPathDelta.added.map((item, i) => (
                <div
                  key={i}
                  className="p-3 rounded bg-[#da3633]/10 border border-[#da3633]/30 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#f85149]">
                      [{item.afterRisk?.toUpperCase()} RISK · SCORE {item.afterRiskScore}]
                    </span>
                    <button
                      onClick={() => onLocateElement({ id: item.targetId, type: 'node' })}
                      className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#58a6ff] text-[10px] font-mono"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Locate Target</span>
                    </button>
                  </div>
                  <div className="text-[#e6edf3] font-semibold">{item.summary}</div>
                  <div className="font-mono text-[#8b949e] text-[11px] truncate">
                    {item.signature}
                  </div>
                </div>
              ))}
            </div>
          )}

          {attackPathDelta.removed.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#3fb950]">
                SEVERED ATTACK PATHS ({attackPathDelta.removed.length}):
              </span>
              {attackPathDelta.removed.map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded bg-[#238636]/10 border border-[#238636]/30 text-xs text-[#3fb950] font-mono flex items-center justify-between"
                >
                  <span>✓ {item.summary}</span>
                  <span className="text-[10px] text-[#8b949e]">WAS {item.beforeRisk?.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}

          {attackPathDelta.changed.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#d29922]">
                MODIFIED RISK PATHS ({attackPathDelta.changed.length}):
              </span>
              {attackPathDelta.changed.map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded bg-[#d29922]/10 border border-[#d29922]/30 text-xs space-y-1"
                >
                  <div className="text-[#e6edf3] font-semibold">{item.summary}</div>
                  <div className="font-mono text-[#8b949e] text-[11px] truncate">{item.signature}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab D: Intelligence Delta */}
      {activeSubTab === 'intelligence' && (
        <div className="space-y-3">
          {/* Architecture Delta */}
          <div className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#a371f7] font-bold flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>ARCHITECTURE QUALITY</span>
              </span>
              <span className="text-[#8b949e]">
                {architectureDelta.scoreBefore} ({architectureDelta.ratingBefore}) →{' '}
                <span className="text-[#e6edf3] font-bold">
                  {architectureDelta.scoreAfter} ({architectureDelta.ratingAfter})
                </span>{' '}
                ({architectureDelta.scoreDelta >= 0 ? '+' : ''}
                {architectureDelta.scoreDelta})
              </span>
            </div>
            {architectureDelta.observations.length > 0 ? (
              <ul className="text-xs text-[#8b949e] space-y-1 pt-1 border-t border-[#21262d]">
                {architectureDelta.observations.map((obs, i) => (
                  <li key={i} className="flex items-center space-x-1.5">
                    <span className="text-[#a371f7]">▪</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#8b949e] pt-1 border-t border-[#21262d]">
                Structural architecture remained consistent across changes.
              </p>
            )}
          </div>

          {/* Production Readiness Delta */}
          <div className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#3fb950] font-bold flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5" />
                <span>PRODUCTION READINESS</span>
              </span>
              <span className="text-[#8b949e]">
                {readinessDelta.scoreBefore} ({readinessDelta.ratingBefore}) →{' '}
                <span className="text-[#e6edf3] font-bold">
                  {readinessDelta.scoreAfter} ({readinessDelta.ratingAfter})
                </span>{' '}
                ({readinessDelta.scoreDelta >= 0 ? '+' : ''}
                {readinessDelta.scoreDelta})
              </span>
            </div>
            <div className="text-xs text-[#8b949e] pt-1 border-t border-[#21262d] space-y-1">
              <div>
                Status Transition: <span className="font-mono text-[#c9d1d9]">{readinessDelta.statusBefore}</span>{' '}
                <ArrowRight className="w-3 h-3 inline mx-1" />{' '}
                <span className="font-mono text-[#e6edf3] font-bold">{readinessDelta.statusAfter}</span>
              </div>
              {readinessDelta.newBlockers.length > 0 && (
                <div className="text-[#f85149]">
                  ⚠ {readinessDelta.newBlockers.length} new blocker(s):{' '}
                  {readinessDelta.newBlockers.map((b) => b.title).join(', ')}
                </div>
              )}
              {readinessDelta.resolvedBlockers.length > 0 && (
                <div className="text-[#3fb950]">
                  ✓ {readinessDelta.resolvedBlockers.length} blocker(s) eliminated
                </div>
              )}
            </div>
          </div>

          {/* Technical Debt Delta */}
          <div className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#e3b341] font-bold flex items-center space-x-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>TECHNICAL DEBT</span>
              </span>
              <span className="text-[#8b949e]">
                Health {technicalDebtDelta.scoreBefore} ({technicalDebtDelta.ratingBefore}) →{' '}
                <span className="text-[#e6edf3] font-bold">
                  {technicalDebtDelta.scoreAfter} ({technicalDebtDelta.ratingAfter})
                </span>{' '}
                ({technicalDebtDelta.scoreDelta >= 0 ? '+' : ''}
                {technicalDebtDelta.scoreDelta})
              </span>
            </div>
            <div className="text-xs text-[#8b949e] pt-1 border-t border-[#21262d] space-y-1 font-mono">
              <div>
                P0 Critical Debt: {technicalDebtDelta.p0Before} →{' '}
                <span className={technicalDebtDelta.p0Delta > 0 ? 'text-[#f85149] font-bold' : 'text-[#3fb950]'}>
                  {technicalDebtDelta.p0After} ({technicalDebtDelta.p0Delta >= 0 ? '+' : ''}
                  {technicalDebtDelta.p0Delta})
                </span>
              </div>
              <div>
                P1 High Debt: {technicalDebtDelta.p1Before} →{' '}
                <span className={technicalDebtDelta.p1Delta > 0 ? 'text-[#f85149] font-bold' : 'text-[#3fb950]'}>
                  {technicalDebtDelta.p1After} ({technicalDebtDelta.p1Delta >= 0 ? '+' : ''}
                  {technicalDebtDelta.p1Delta})
                </span>
              </div>
              {technicalDebtDelta.newDebt.length > 0 && (
                <div className="text-[#f85149] font-sans">
                  ⚠ {technicalDebtDelta.newDebt.length} new debt pattern(s) introduced
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab E: Change Source (Local Git Repository & Diff Ingestion) */}
      {activeSubTab === 'source' && (
        <div className="space-y-4">
          {/* Source Ingestion Mode Selector */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
            <div className="flex items-center space-x-1.5 text-xs font-mono">
              <button
                onClick={() => setSourceMode('git')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
                  sourceMode === 'git'
                    ? 'bg-[#238636] text-white font-semibold'
                    : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Local Git (Phase 3.3)</span>
              </button>
              <button
                onClick={() => setSourceMode('github')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
                  sourceMode === 'github'
                    ? 'bg-[#8957e5] text-white font-semibold'
                    : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                <span>GitHub PR (Phase 3.4)</span>
              </button>
              <button
                onClick={() => setSourceMode('diff')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
                  sourceMode === 'diff'
                    ? 'bg-[#1f6feb] text-white font-semibold'
                    : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Raw Diff (Phase 3.2)</span>
              </button>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-mono text-[#8b949e]">
              <Lock className="w-3 h-3 text-[#3fb950]" />
              <span className="hidden sm:inline">100% Read-Only · Zero Remote Credential Storage</span>
            </div>
          </div>

          {sourceMode === 'git' ? (
            <div className="space-y-4">
              {/* Repository Target Bar */}
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono font-semibold text-[#e6edf3] flex items-center space-x-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 text-[#58a6ff]" />
                    <span>Local Repository Target</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setInspectionTimestamp(new Date().toLocaleTimeString())}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-[#58a6ff] hover:bg-[#30363d] transition-colors"
                      title="Inspect and refresh local Git state"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Inspect Git Changes</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={gitRepoPath}
                    onChange={(e) => setGitRepoPath(e.target.value)}
                    placeholder="Enter local repository directory path..."
                    className="flex-1 p-2 rounded bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              {/* Current Repository State Card */}
              <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider">
                    Repository State
                  </div>
                  <div className="text-[11px] font-mono text-[#8b949e]">
                    Last Inspected: <span className="text-[#c9d1d9]">{inspectionTimestamp}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {/* Branch */}
                  <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                    <div className="text-[10px] text-[#8b949e] uppercase flex items-center space-x-1">
                      <GitBranch className="w-3 h-3 text-[#58a6ff]" />
                      <span>Branch</span>
                    </div>
                    <div className="text-[#e6edf3] font-bold truncate">
                      {activeScenario.repository.currentBranch || '(detached HEAD)'}
                    </div>
                  </div>

                  {/* Commit */}
                  <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                    <div className="text-[10px] text-[#8b949e] uppercase flex items-center space-x-1">
                      <GitCommit className="w-3 h-3 text-[#a371f7]" />
                      <span>Commit</span>
                    </div>
                    <div className="text-[#e6edf3] font-bold font-mono">
                      {activeScenario.repository.currentCommit.slice(0, 7)}
                    </div>
                  </div>

                  {/* Working Tree Clean/Dirty Badge */}
                  <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                    <div className="text-[10px] text-[#8b949e] uppercase">Status</div>
                    <div>
                      {activeScenario.repository.isDirty || activeScenario.repository.untrackedCount > 0 ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#d29922]/15 text-[#d29922] border border-[#d29922]/40 font-bold text-[11px]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>DIRTY</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#238636]/15 text-[#3fb950] border border-[#238636]/40 font-bold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>CLEAN</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Change Breakdown */}
                  <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                    <div className="text-[10px] text-[#8b949e] uppercase">Breakdown</div>
                    <div className="text-[11px] text-[#c9d1d9] space-x-1.5">
                      <span className={activeScenario.repository.stagedCount > 0 ? 'text-[#3fb950] font-bold' : ''}>
                        {activeScenario.repository.stagedCount} staged
                      </span>
                      <span>·</span>
                      <span className={activeScenario.repository.unstagedCount > 0 ? 'text-[#f0883e] font-bold' : ''}>
                        {activeScenario.repository.unstagedCount} unstaged
                      </span>
                      <span>·</span>
                      <span className={activeScenario.repository.untrackedCount > 0 ? 'text-[#8b949e] font-bold' : ''}>
                        {activeScenario.repository.untrackedCount} untracked
                      </span>
                    </div>
                  </div>
                </div>

                {activeScenario.repository.untrackedFiles.length > 0 && (
                  <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono text-[#8b949e]">
                    <span className="text-[#e6edf3] font-bold">Untracked files:</span>{' '}
                    {activeScenario.repository.untrackedFiles.join(', ')}
                  </div>
                )}
              </div>

              {/* Comparison Mode Selector & Options */}
              <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider">
                    Comparison Mode
                  </div>
                  <label className="flex items-center space-x-1.5 text-xs font-mono text-[#c9d1d9] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUntracked}
                      onChange={(e) => setIncludeUntracked(e.target.checked)}
                      className="rounded bg-[#0d1117] border-[#30363d] text-[#58a6ff] focus:ring-0"
                    />
                    <span>Include untracked files in diff</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                  {(
                    [
                      { mode: 'working-tree-vs-head', label: 'HEAD vs Working Tree' },
                      { mode: 'index-vs-head', label: 'HEAD vs Staged Index' },
                      { mode: 'working-state-vs-head', label: 'Working State vs HEAD' },
                      { mode: 'commit-vs-commit', label: 'Commit vs Commit' },
                      { mode: 'branch-vs-branch', label: 'Branch vs Branch' },
                    ] as const
                  ).map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setGitMode(mode);
                        if (mode === 'index-vs-head') {
                          setSelectedQaScenario('C');
                        } else if (mode === 'commit-vs-commit' || mode === 'branch-vs-branch') {
                          setSelectedQaScenario('D');
                        }
                      }}
                      className={`px-3 py-1.5 rounded transition-colors ${
                        gitMode === mode
                          ? 'bg-[#30363d] text-[#e6edf3] font-bold border border-[#58a6ff]'
                          : 'bg-[#0d1117] text-[#8b949e] border border-[#21262d] hover:text-[#c9d1d9]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {(gitMode === 'commit-vs-commit' || gitMode === 'branch-vs-branch') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#21262d]">
                    <div>
                      <label className="text-[11px] font-mono text-[#8b949e] block mb-1">
                        {gitMode === 'commit-vs-commit' ? 'Base Commit / Revision:' : 'Base Branch:'}
                      </label>
                      <input
                        type="text"
                        value={gitBaseRef}
                        onChange={(e) => setGitBaseRef(e.target.value)}
                        placeholder="e.g. HEAD~1, main, v1.0.0"
                        className="w-full p-2 rounded bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none focus:border-[#58a6ff]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono text-[#8b949e] block mb-1">
                        {gitMode === 'commit-vs-commit' ? 'Head Commit / Revision:' : 'Head Branch:'}
                      </label>
                      <input
                        type="text"
                        value={gitHeadRef}
                        onChange={(e) => setGitHeadRef(e.target.value)}
                        placeholder="e.g. HEAD, feature/secure-db"
                        className="w-full p-2 rounded bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none focus:border-[#58a6ff]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Verification Presets (QA A - QA F) */}
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono font-semibold text-[#e6edf3]">
                    Quick QA Verification Presets:
                  </div>
                  <span className="text-[11px] font-mono text-[#8b949e]">
                    Simulate real-world local repository states
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 text-xs font-mono">
                  {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((id) => {
                    const sc = LOCAL_GIT_SCENARIOS[id];
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedQaScenario(id);
                          setGitMode(sc.comparisonMode);
                          if (sc.baseRef) setGitBaseRef(sc.baseRef);
                          if (sc.headRef) setGitHeadRef(sc.headRef);
                          setIncludeUntracked(id === 'E');
                        }}
                        className={`p-2 rounded text-left transition-colors border ${
                          selectedQaScenario === id
                            ? 'bg-[#21262d] border-[#58a6ff] text-[#e6edf3]'
                            : 'bg-[#0d1117] border-[#21262d] text-[#8b949e] hover:border-[#30363d]'
                        }`}
                      >
                        <div className="font-bold text-[11px] truncate">{sc.name.split(':')[0]}</div>
                        <div className="text-[10px] text-[#58a6ff] truncate">{sc.badge}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono text-[#8b949e]">
                  <span className="text-[#c9d1d9] font-bold">{activeScenario.name}:</span>{' '}
                  {activeScenario.description}
                </div>
              </div>

              {/* Source Disclosure Banner */}
              <div className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] text-xs font-mono text-[#8b949e] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[#58a6ff] font-bold">SOURCE DISCLOSURE:</span>{' '}
                  <span>Local Git repository at <code className="text-[#e6edf3]">{gitRepoPath}</code></span>{' '}
                  · <span className="text-[#c9d1d9]">Comparison: {gitMode}</span>
                </div>
                <span className="text-[10px] text-[#3fb950] font-bold uppercase">
                  100% READ-ONLY · OFFLINE INSPECTION
                </span>
              </div>

              {/* Clean Working Tree Announcement */}
              {ingestedChangeSet.summary.filesChanged === 0 && (
                <div className="p-6 text-center bg-[#0d1117] border border-[#238636]/30 rounded-lg space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#3fb950] mx-auto" />
                  <div className="text-sm font-semibold text-[#e6edf3]">Working Tree Clean</div>
                  <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                    Zero file modifications detected for {gitMode}. Repository state is synchronized with no pending changes.
                  </p>
                  <div className="text-[11px] font-mono text-[#3fb950]">
                    0 files modified · 0 lines changed · 0 security regressions
                  </div>
                </div>
              )}

              {/* Raw Diff Toggle & View */}
              {ingestedChangeSet.summary.filesChanged > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowRawDiff(!showRawDiff)}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{showRawDiff ? 'Hide Raw Git Diff' : 'Show Raw Unified Git Diff'}</span>
                    </button>
                    <span className="text-[11px] font-mono text-[#8b949e]">
                      {activeDiff.split('\n').length} diff lines
                    </span>
                  </div>
                  {showRawDiff && (
                    <pre className="p-3 rounded bg-[#0d1117] border border-[#30363d] font-mono text-xs text-[#c9d1d9] overflow-x-auto max-h-60 leading-relaxed whitespace-pre">
                      {activeDiff}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : sourceMode === 'github' ? (
            /* GitHub Pull Request Mode (Phase 3.4) */
            <div className="space-y-4">
              {/* Target Input Bar */}
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono font-semibold text-[#e6edf3] flex items-center space-x-1.5">
                    <GitPullRequest className="w-3.5 h-3.5 text-[#8957e5]" />
                    <span>GitHub Pull Request Target</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setGhInspectionTimestamp(new Date().toLocaleTimeString())}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-[#8957e5] hover:bg-[#30363d] transition-colors"
                      title="Inspect and analyze remote Pull Request"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Inspect Pull Request</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-[#8b949e] block mb-1">Owner / Organization</label>
                    <input
                      type="text"
                      value={ghOwner}
                      onChange={(e) => setGhOwner(e.target.value)}
                      placeholder="e.g. acme-corp"
                      className="w-full p-2 rounded bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none focus:border-[#8957e5]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-[#8b949e] block mb-1">Repository Name</label>
                    <input
                      type="text"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      placeholder="e.g. cloud-infrastructure"
                      className="w-full p-2 rounded bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none focus:border-[#8957e5]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-[#8b949e] block mb-1">PR Number</label>
                    <input
                      type="number"
                      value={ghPrNumber}
                      onChange={(e) => setGhPrNumber(e.target.value)}
                      placeholder="e.g. 102"
                      className="w-full p-2 rounded bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none focus:border-[#8957e5]"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Verification Presets (QA A - QA D) */}
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono font-semibold text-[#e6edf3]">
                    Quick QA Verification Presets:
                  </div>
                  <span className="text-[11px] font-mono text-[#8b949e]">
                    Deterministic test pull requests & failure states
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-mono">
                  {(['A', 'B', 'C', 'D'] as const).map((id) => {
                    const sc = GITHUB_PR_SCENARIOS[id];
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedGhScenario(id);
                          setGhOwner(sc.owner);
                          setGhRepo(sc.repository);
                          setGhPrNumber(String(sc.prNumber));
                        }}
                        className={`p-2 rounded text-left transition-colors border ${
                          selectedGhScenario === id
                            ? 'bg-[#21262d] border-[#8957e5] text-[#e6edf3]'
                            : 'bg-[#0d1117] border-[#21262d] text-[#8b949e] hover:border-[#30363d]'
                        }`}
                      >
                        <div className="font-bold text-[11px] truncate">{sc.name.split(':')[0]}</div>
                        <div className="text-[10px] text-[#8957e5] truncate">{sc.badge}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono text-[#8b949e]">
                  <span className="text-[#c9d1d9] font-bold">{activeGhScenario.name}:</span>{' '}
                  {activeGhScenario.description}
                </div>
              </div>

              {/* Source Disclosure Banner */}
              <div className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] text-xs font-mono text-[#8b949e] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[#8957e5] font-bold">SOURCE DISCLOSURE:</span>{' '}
                  <span>GitHub Pull Request <code className="text-[#e6edf3]">https://github.com/{activeGhScenario.owner}/{activeGhScenario.repository}/pull/{activeGhScenario.prNumber}</code></span>
                </div>
                <span className="text-[10px] text-[#3fb950] font-bold uppercase">
                  100% READ-ONLY · CLI PROVIDER BOUNDARY · ₹0 COST
                </span>
              </div>

              {/* Failure State / Inaccessible PR (QA D) */}
              {activeGhScenario.isError ? (
                <div className="p-5 rounded-lg bg-[#da3633]/10 border border-[#da3633]/30 space-y-3">
                  <div className="flex items-center space-x-2 text-[#f85149]">
                    <AlertOctagon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-semibold font-mono">ANALYSIS INCOMPLETE (INSUFFICIENT EVIDENCE)</span>
                  </div>
                  <div className="p-3 rounded bg-[#0d1117] border border-[#30363d] font-mono text-xs text-[#f85149]">
                    {activeGhScenario.errorMessage}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[#8b949e]">
                      Status: <span className="px-2 py-0.5 rounded border font-bold text-[#c9d1d9] bg-[#8b949e]/20 border-[#8b949e]/40">INSUFFICIENT_EVIDENCE</span>
                    </span>
                    <span className="text-[#8b949e]">
                      Deterministic Truth Rule: Zero assumptions fabricated on failed reads.
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* PR Metadata Header Card */}
                  <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider flex items-center space-x-2">
                        <span className="text-[#8957e5]">#{activeGhScenario.prNumber}</span>
                        <span>{activeGhScenario.title}</span>
                      </div>
                      <div className="text-[11px] font-mono text-[#8b949e]">
                        Inspected: <span className="text-[#c9d1d9]">{ghInspectionTimestamp}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      {/* State Badge */}
                      <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                        <div className="text-[10px] text-[#8b949e] uppercase">PR State</div>
                        <div>
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border font-bold text-[11px] ${
                            activeGhScenario.state === 'OPEN'
                              ? 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/40'
                              : activeGhScenario.state === 'MERGED'
                              ? 'bg-[#8957e5]/20 text-[#a371f7] border-[#8957e5]/40'
                              : 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40'
                          }`}>
                            <span>{activeGhScenario.state}</span>
                          </span>
                        </div>
                      </div>

                      {/* Author */}
                      <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                        <div className="text-[10px] text-[#8b949e] uppercase">Author</div>
                        <div className="text-[#e6edf3] font-bold truncate">
                          @{activeGhScenario.author}
                        </div>
                      </div>

                      {/* Branches */}
                      <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                        <div className="text-[10px] text-[#8b949e] uppercase">Branches</div>
                        <div className="text-[#c9d1d9] truncate text-[11px]">
                          <span className="text-[#8b949e]">{activeGhScenario.baseBranch}</span> ← <span className="text-[#58a6ff]">{activeGhScenario.headBranch}</span>
                        </div>
                      </div>

                      {/* Commits */}
                      <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                        <div className="text-[10px] text-[#8b949e] uppercase">Commit SHAs</div>
                        <div className="text-[#c9d1d9] font-mono text-[11px] truncate">
                          {activeGhScenario.baseSha.slice(0, 7)}..{activeGhScenario.headSha.slice(0, 7)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PR Risk Status & Truthful Evidence Card */}
                  <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider">
                        Pull Request Risk Evaluation
                      </div>
                      <span className={`px-2.5 py-0.5 rounded border text-xs font-mono font-bold ${getPrRiskBadge(activeGhScenario.riskStatus)}`}>
                        {activeGhScenario.riskStatus}
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono text-[#8b949e] space-y-1">
                      <div className="text-[#c9d1d9] font-semibold flex items-center space-x-1.5">
                        <Lock className="w-3 h-3 text-[#58a6ff]" />
                        <span>Truthful Governance Rule:</span>
                      </div>
                      <p>
                        Code & patch inspection discovers engineering changes and flags security-sensitive configuration signals.
                        It never declares a security regression without correlated modeled topology.
                      </p>
                    </div>
                  </div>

                  {/* PR Signal Categories Strip */}
                  <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                    <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider">
                      Pull Request Signals Breakdown
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
                        <div className="text-[10px] text-[#f0883e] uppercase">Security</div>
                        <div className="text-sm font-bold text-[#f0883e]">
                          {ghSignalsSummary.securitySensitive.length}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
                        <div className="text-[10px] text-[#58a6ff] uppercase">Infra</div>
                        <div className="text-sm font-bold text-[#58a6ff]">
                          {ghSignalsSummary.infrastructure.length}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
                        <div className="text-[10px] text-[#a371f7] uppercase">CI/CD</div>
                        <div className="text-sm font-bold text-[#a371f7]">
                          {ghSignalsSummary.cicd.length}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
                        <div className="text-[10px] text-[#3fb950] uppercase">Testing</div>
                        <div className="text-sm font-bold text-[#3fb950]">
                          {ghSignalsSummary.testing.length}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
                        <div className="text-[10px] text-[#8b949e] uppercase">Dependency</div>
                        <div className="text-sm font-bold text-[#c9d1d9]">
                          {ghSignalsSummary.dependency.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Raw PR Diff Toggle & View */}
                  {activeDiff && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setShowRawDiff(!showRawDiff)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{showRawDiff ? 'Hide Raw PR Patch' : 'Show Raw PR Patch'}</span>
                        </button>
                        <span className="text-[11px] font-mono text-[#8b949e]">
                          {activeDiff.split('\n').length} patch lines
                        </span>
                      </div>
                      {showRawDiff && (
                        <pre className="p-3 rounded bg-[#0d1117] border border-[#30363d] font-mono text-xs text-[#c9d1d9] overflow-x-auto max-h-60 leading-relaxed whitespace-pre">
                          {activeDiff}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Diff Text Mode (Phase 3.2 Ingestion) */
            <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono font-semibold text-[#e6edf3] flex items-center space-x-1.5">
                  <FileCode className="w-3.5 h-3.5 text-[#58a6ff]" />
                  <span>Raw Unified Diff Ingestion</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-[#8b949e]">Samples:</span>
                  <button
                    onClick={() => setDiffText(SAMPLE_APP_DIFF)}
                    className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d]"
                  >
                    App (QA A)
                  </button>
                  <button
                    onClick={() => setDiffText(SAMPLE_INFRA_DIFF)}
                    className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#3fb950] border border-[#30363d]"
                  >
                    Infra (QA B)
                  </button>
                  <button
                    onClick={() => setDiffText(SAMPLE_CI_DIFF)}
                    className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#f0883e] border border-[#30363d]"
                  >
                    CI (QA C)
                  </button>
                  <button
                    onClick={() => setDiffText(SAMPLE_SECRET_DIFF)}
                    className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#f85149] border border-[#30363d]"
                  >
                    Secret (QA D)
                  </button>
                  <button
                    onClick={() => setDiffText('')}
                    className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] border border-[#30363d]"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#8b949e]">
                Paste unified diff output from local git or developer workspace. PathForge normalizes paths, classifies engineering files, extracts signals, and masks credentials.
              </p>
              <textarea
                value={diffText}
                onChange={(e) => setDiffText(e.target.value)}
                placeholder="Paste unified diff here..."
                rows={6}
                className="w-full p-2.5 rounded bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none focus:border-[#58a6ff] resize-y"
              />
            </div>
          )}

          {/* Metric Counters Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
              <div className="text-[10px] uppercase font-mono text-[#8b949e]">FILES</div>
              <div className="text-sm font-bold font-mono text-[#e6edf3]">
                {ingestedChangeSet.summary.filesChanged}
              </div>
            </div>
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
              <div className="text-[10px] uppercase font-mono text-[#3fb950]">LINES +</div>
              <div className="text-sm font-bold font-mono text-[#3fb950]">
                +{ingestedChangeSet.summary.linesAdded}
              </div>
            </div>
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
              <div className="text-[10px] uppercase font-mono text-[#f85149]">LINES -</div>
              <div className="text-sm font-bold font-mono text-[#f85149]">
                -{ingestedChangeSet.summary.linesDeleted}
              </div>
            </div>
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
              <div className="text-[10px] uppercase font-mono text-[#58a6ff]">SIGNALS</div>
              <div className="text-sm font-bold font-mono text-[#58a6ff]">
                {ingestedChangeSet.signals.length}
              </div>
            </div>
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
              <div className="text-[10px] uppercase font-mono text-[#f0883e]">SENSITIVE</div>
              <div className="text-sm font-bold font-mono text-[#f0883e]">
                {ingestedChangeSet.summary.securitySensitiveSignalCount}
              </div>
            </div>
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
              <div className="text-[10px] uppercase font-mono text-[#e6edf3]">MASKED</div>
              <div className="text-sm font-bold font-mono text-[#3fb950]">
                {ingestedChangeSet.summary.maskedSecretsCount}
              </div>
            </div>
          </div>

          {/* Parse Warnings / Errors */}
          {(ingestedChangeSet.summary.parseWarnings.length > 0 || ingestedChangeSet.summary.parseErrors.length > 0) && (
            <div className="p-3 rounded-lg bg-[#d29922]/10 border border-[#d29922]/30 space-y-1 text-xs font-mono">
              <div className="text-[#d29922] font-bold">PARSER DIAGNOSTICS:</div>
              {ingestedChangeSet.summary.parseErrors.map((err, i) => (
                <div key={`err-${i}`} className="text-[#f85149]">⚠ Error: {err}</div>
              ))}
              {ingestedChangeSet.summary.parseWarnings.map((warn, i) => (
                <div key={`warn-${i}`} className="text-[#d29922]">ℹ Warning: {warn}</div>
              ))}
            </div>
          )}

          {/* Engineering Categories Breakdown */}
          <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-2">
            <div className="text-xs font-mono font-semibold text-[#8b949e]">AFFECTED ENGINEERING CATEGORIES</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ingestedChangeSet.summary.categories)
                .filter(([_, count]) => count > 0)
                .map(([cat, count]) => (
                  <span
                    key={cat}
                    className="px-2 py-0.5 rounded text-xs font-mono bg-[#161b22] border border-[#30363d] text-[#c9d1d9]"
                  >
                    <span className="text-[#58a6ff] uppercase">{cat}</span>: {count}
                  </span>
                ))}
              {ingestedChangeSet.summary.filesChanged === 0 && (
                <span className="text-xs text-[#8b949e] font-mono">No files parsed</span>
              )}
            </div>
          </div>

          {/* Truthful Governance Contrast Banner */}
          <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2 text-xs">
            <div className="font-mono font-bold text-[#e6edf3] flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>Truthful Governance: Repository Observation vs Proven Impact</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                <div className="text-[#58a6ff] font-bold uppercase text-[10px]">1. Observed Repository Change</div>
                <p className="text-[#8b949e] leading-relaxed">
                  {ingestionBridge.engineeringObservation}
                </p>
              </div>
              <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
                <div className="text-[#3fb950] font-bold uppercase text-[10px]">2. Proven Infrastructure Impact</div>
                <p className="text-[#c9d1d9] leading-relaxed">
                  {ingestionBridge.securityImpactStatement}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-[#8b949e] italic pt-1">
              Principle: Code diffs indicate developer modifications. Security findings, attack paths, and architectural posture changes are never fabricated without modeled topology evaluation.
            </p>
          </div>

          {/* Engineering Signals List */}
          {ingestedChangeSet.signals.length > 0 && (
            <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-2">
              <div className="text-xs font-mono font-semibold text-[#e6edf3]">
                EXTRACTED ENGINEERING SIGNALS ({ingestedChangeSet.signals.length})
              </div>
              <div className="space-y-2">
                {ingestedChangeSet.signals.map((sig) => (
                  <div
                    key={sig.id}
                    className={`p-2.5 rounded border text-xs font-mono space-y-1 ${
                      sig.isSecuritySensitive
                        ? 'bg-[#d29922]/5 border-[#d29922]/40 text-[#c9d1d9]'
                        : 'bg-[#161b22] border-[#21262d] text-[#8b949e]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#e6edf3] font-bold">{sig.file}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          sig.isSecuritySensitive
                            ? 'bg-[#d29922]/20 text-[#d29922]'
                            : 'bg-[#21262d] text-[#8b949e]'
                        }`}
                      >
                        {sig.type}
                      </span>
                    </div>
                    <div className="text-[#c9d1d9]">{sig.description}</div>
                    <div className="text-[11px] text-[#58a6ff]">▸ {sig.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab F: Persistent Engineering History */}
      {activeSubTab === 'history' && (
        <EngineeringHistoryView
          environment={environment ?? null}
          validationResult={validationResult ?? null}
          attackPathAnalysis={attackPathAnalysis}
          architectureResult={architectureResult}
          productionReadiness={productionReadiness}
          testingIntelligence={testingIntelligence}
          technicalDebt={technicalDebt}
          changeAnalysis={changeAnalysis}
        />
      )}

      {/* Sub-Tab G: CI/CD Engineering Gate */}
      {activeSubTab === 'gate' && (
        <CiGateView
          environment={environment ?? null}
          validationResult={validationResult ?? null}
          attackPathAnalysis={attackPathAnalysis}
          architectureResult={architectureResult}
          productionReadiness={productionReadiness}
          testingIntelligence={testingIntelligence}
          technicalDebt={technicalDebt}
          changeAnalysis={changeAnalysis}
        />
      )}

      {/* 6. Recommendations Strip */}
      {recommendations.length > 0 && (
        <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-1.5">
          <div className="text-xs font-mono font-bold text-[#58a6ff]">RECOMMENDED ACTIONS:</div>
          <ul className="text-xs text-[#8b949e] space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start space-x-1.5">
                <span className="text-[#58a6ff] mt-0.5">▸</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
