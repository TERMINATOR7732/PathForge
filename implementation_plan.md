# PathForge Implementation Plan

> **Build. Break. Defend. Prove.**
> Interactive Infrastructure Security Simulator & Learning Lab

---

## Roadmap Overview

```text
Phase 1: Infrastructure Modeling & Validation (In Progress — 1.1 Complete)
  │
  ├── Phase 2: Deterministic Attack Simulation
  │
  └── Phase 3: Defense, Remediation & Verification ("Prove")
```

---

## Phase 1 — Infrastructure Modeling & Validation

### Phase 1.1 — Project Foundation *(STATUS: COMPLETE)*
- [x] Repository initialization, monorepo structure (`packages/shared`, `packages/core`, `packages/validator`, `apps/web`)
- [x] Strict TypeScript configuration with composite project references
- [x] Core domain model: `Environment`, `InfrastructureNode`, `InfrastructureEdge`
- [x] Extensible Node types: `internet`, `firewall`, `load_balancer`, `web_server`, `api_server`, `database`, `redis`, `admin`, `vpn`, `internal_network`, `external_network`
- [x] Edge relationship model with initial protocol, ports, direction, trust, and encryption metadata
- [x] UI-agnostic `InfrastructureGraph` abstraction (directed adjacency maps, successors, predecessors, degree, cascading edge removals, cloning)
- [x] Deterministic JSON serialization and deserialization with strict schema validation
- [x] Validation architecture: `ValidationRule`, `ValidationContext`, `RuleRegistry`, `ValidatorEngine`, `ValidationResult`
- [x] Initial security rule implementations:
  - `PF-001` Public Database Exposure (Critical)
  - `PF-002` Public Admin Exposure (High)
  - `PF-003` Missing Security Boundary (High)
  - `PF-004` Untrusted Network → Internal Network (Critical)
  - `PF-005` Excessive Trust Relationship / Tier Bypass (Medium)
  - `PF-006` Invalid or Anomalous Topology (Medium)
  - `PF-007` Overly Broad Access (High)
- [x] Explanatory finding model answering: *what is wrong*, *why it matters*, *threat impact*, *recommended architecture*, and *concrete remediation*
- [x] Deterministic demo environments: `standard-web-app.json` (hardened baseline) and `compromised-direct-db.json` (chaos anti-pattern)
- [x] Technical workspace web UI foundation (Eraser/Botpress inspired aesthetic: Palette, Grid Canvas, Node/Edge Inspector, Security Findings Drawer)
- [x] Comprehensive test suite (29 unit & integration tests passing across all packages)

---

### Phase 1.2 — Interactive Visual Network Canvas & Drag-and-Drop Editor *(STATUS: COMPLETE)*
- [x] Direct interactive node dragging with real-time coordinate updates and domain persistence
- [x] Palette drag-and-drop & click-to-add to spawn new infrastructure nodes onto the canvas
- [x] Unique stable IDs and human-readable default names (`Database 2`, `Firewall 2`, etc.)
- [x] Interactive directional connection handles (drag from output port to input port with live bezier curve preview)
- [x] Unrestricted/permissive modeling enabling intentional security experiments (`Internet → Database`)
- [x] Node and edge selection with detailed metadata in `InspectorPanel`
- [x] Sensible deletion via keyboard (`Delete`/`Backspace`) and inspector with cascading edge removal in domain graph
- [x] Smooth pan navigation (middle mouse drag, space+drag, or canvas drag)
- [x] Smooth mouse wheel zoom, zoom controls (`+`, `-`, `Reset`), and interactive minimap overview
- [x] Outdated validation feedback with one-click re-evaluation integration
- [x] Automated test suite expanded to 40 tests covering domain sync, coordinate persistence, and manual QA flow

---

### Phase 1.3 — Node & Edge Deep Configuration *(STATUS: COMPLETE)*
- [x] Authoritative domain configuration models: `NodeZone`, `AssetCriticality`, `NodeServiceInfo`, `EdgeProtocol`, `EdgeAccess`, `EdgeRelationship`, `PortConfig`
- [x] Pure deterministic validation utilities: `validateCidrOrIp` (IPv4 & CIDR /0-/32), `parsePortInput` (single, range `8000-8080`, wildcard `ANY`), `isPortAllowed` (deterministic port reachability checker)
- [x] Node domain deep configuration: `updateConfig` with name, zone, CIDR validation, criticality, service port/proto, tags, and description
- [x] Edge domain deep configuration: `updateConfig` with protocol, ports, structured `portConfig`, access policy (`allow`/`deny`), encryption toggle, relationship, and `allowsPort(port)` evaluation
- [x] Full JSON serialization/deserialization fidelity preserving all semantic configuration fields
- [x] Interactive `InspectorPanel` forms with real-time validation error alerts and domain persistence
- [x] Enhanced visual canvas: `CanvasEdge` rendering protocol/port label, `[DENY]` badge, and encryption lock icon; `CanvasNode` rendering CIDR and service port badge
- [x] Comprehensive test suite: 70 unit and integration tests passing across 10 test files including QA workflows A-F

### Phase 1.4 — Security Validation Intelligence *(STATUS: COMPLETE)*
- [x] Configuration-aware PF-001 (Public Database Exposure) identifying ports (5432, 3306, 27017, 6379, 1433), service metadata, zones, criticality, and unencrypted channels
- [x] Configuration-aware PF-002 (Public Admin Exposure) identifying administrative ports (SSH 22, RDP 3389) on any host, with authorized Management zone exemption
- [x] Universal DENY edge filtering across all rules: configured DENY edges are never reported as allowed reachability
- [x] Contextual PF-007 (Overly Broad Access) evaluating source trust zones, target criticality, and exempting default-deny filtering rules
- [x] Enhanced PF-003, PF-004, and PF-005 with zone awareness and explicit `relationship: 'trust'` evaluation across perimeter boundaries
- [x] New deterministic rule PF-008: Unencrypted Sensitive Communication (flags cleartext traffic terminating at databases, restricted zones, or critical assets)
- [x] New deterministic rule PF-009: Service / Connection Mismatch (conservative detection of port/protocol conflicts with defined listeners)
- [x] Structured evidence model (`FindingEvidence`) capturing source, target, zones, criticality, protocol, ports, access policy, and encryption state
- [x] FindingsDrawer & InspectorPanel rendering rich structured evidence badges and semantic descriptions
- [x] Test suite expanded to 94 unit and integration tests passing across 11 test files (including 24 new tests for Phase 1.4)

### Phase 1.5 — Finding Explanation + Remediation UX *(STATUS: COMPLETE)*
- [x] 6-Dimensional Finding Deep Dive (What is wrong, why it matters, threat impact/exploitation scenario, recommended architecture, concrete fix steps, structured evidence, remediation actions)
- [x] Interactive "Locate on Canvas": Pan and center canvas to affected elements with visual ring/pulse animation and node/edge selection
- [x] Dynamic hover highlight: Hovering over finding cards in the drawer highlights affected nodes and edges on the canvas
- [x] Architectural Pattern Comparison: Side-by-side visual flow contrasting current flawed path against recommended secure defense architecture
- [x] Deterministic Remediation Engine (`@pathforge/validator/remediation`): Auto-generates safe actions (`deny-edge`, `remove-edge`, `enable-encryption`, `restrict-port`, `align-port`, `manual`)
- [x] Remediation Confirmation Modal: Explains exact policy changes and domain impacts before executing mutations
- [x] State Discipline: Remediation marks validation as STALE (`Topology Modified — Validation Stale`) without auto-resolving until user explicitly revalidates
- [x] Revalidation Resolution Tracking: Automatically detects eliminated findings upon revalidation and displays celebratory feedback (`🎉 1 Finding Resolved!`)
- [x] Multi-dimensional Finding Filters: Severity filters with count badges, Category selector, Asset selector, and professional empty states
- [x] Comprehensive test suite: 110 unit and integration tests passing across 12 test files (including 16 new tests for Phase 1.5)

### Phase 1.6 — Fix Verification & Before/After Comparison *(STATUS: COMPLETE)*
- [x] Validated Baseline Snapshot Module (`@pathforge/core/comparison`): Immutable, frozen deep-cloned captures of environment state and validation findings (`createEnvironmentSnapshot`).
- [x] Deterministic Infrastructure Diff Engine (`diffEnvironments`): Detects node additions, node removals, node config updates, edge additions, edge removals, and edge policy updates (`allow` ↔ `deny`, unencrypted ↔ encrypted, port restrictions).
- [x] Position Independence Principle: Presentation layout coordinates $(x, y)$ explicitly ignored in security diffs (moving nodes yields 0 security diffs).
- [x] Fix Verification Engine (`verifyFix`): Categorizes findings into Resolved ($\text{Before} - \text{After}$), Still Present ($\text{Before} \cap \text{After}$), and Newly Introduced ($\text{After} - \text{Before}$).
- [x] Deterministic Resolution Classification: Classifies fixes into `policy-change`, `encryption-change`, `port-restriction`, `edge-removal`, `node-reconfiguration`, or `topological-isolation`.
- [x] Regression & Integrity Defense: Flags regressions as `requires-attention` whenever fixes introduce new security violations.
- [x] Production Gate & Summary Deltas: Computes metric deltas (Critical, High, Medium, Low) and compliance gate transitions (`BLOCKED` → `PASSED`).
- [x] Verification UX (`VerificationPanel`): Status banner, metric cards, severity breakdown, Before vs After flow comparison for resolved findings, new finding regression alerts, and infrastructure delta audit log.
- [x] Findings Drawer Integration: Dual-mode header tabs (`ACTIVE FINDINGS` vs `FIX VERIFICATION`) with real-time status pill.
- [x] Comprehensive test suite: 121 unit and integration tests passing across 13 test files (11 new tests in `tests/fix-verification.test.ts`).

### Phase 1.7 — Demo Environments, Chaos Lab & Product Polish *(STATUS: COMPLETE)*
- [x] Scenario Library Module (`@pathforge/core/scenarios`): 4 deterministic prebuilt topologies:
  - Scenario A: **Secure Web Application** (Hardened 3-tier reference architecture, zero findings, Production Gate: PASSED)
  - Scenario B: **Public Database Exposure** (Intentional flaw for practicing the full Build → Break → Explain → Fix → Prove loop)
  - Scenario C: **Flat / Poorly Segmented Network** (Weak segmentation, co-locating Web, API, DB, Admin without firewall)
  - Scenario D: **Chaos Lab** (Deliberately compromised sandbox modeling multiple severe anti-patterns for free experimentation)
- [x] Scenario Selector UX (`ScenarioModal`): Compact engineering-tool modal with risk badges, purpose statements, learning objectives, and topology preview flows.
- [x] Permissive Chaos Lab Interaction: PathForge never blocks insecure connections; malformed data may be rejected, but insecure architecture is accepted and analyzed deterministically.
- [x] Chaos Lab Affordance & Status: Dedicated top banner ("CHAOS LAB · Experiment freely. PathForge will not block insecure designs") and permissive modeling chips.
- [x] Safe Scenario Reset (`ResetScenarioModal`): Cleanly reinstantiates pristine scenario definition, establishes fresh baseline snapshot, and purges all stale cross-scenario verifications.
- [x] Empty Canvas First-Run Experience: Centered workflow guide (`1. Validate → 2. Fix → 3. Prove`) with instant quick-load scenario actions on empty canvas.
- [x] Full Product Polish Pass: Visual consistency, uniform monospace styling, distinct status semantics (`VALIDATED`, `VALIDATION STALE`, `PRODUCTION GATE: BLOCKED/PASSED`, `VERIFICATION PASSED`, `VERIFICATION REQUIRES ATTENTION`).
- [x] Automated Test Suite: 137 unit and integration tests passing across 15 test files (including tests for scenario loading, expected security states, reset isolation, chaos workflows, and exact 5-step manual QA workflows).

### Phase 1.8 — Verification Reports & Engineering Export *(STATUS: COMPLETE)*
- [x] Authoritative Domain Verification Report Model (`packages/core/src/reports/`):
  - `VerificationReport`, `ReportMetadata`, `ReportExecutiveSummary`, `ReportSecurityDeltaSummary`, `ReportResolvedFinding`, `ReportUnresolvedFinding`, `ReportRegressionFinding`, `ReportInfrastructureChange`, `ReportRemediationRecord`, `ReportGateState`.
- [x] Deterministic Report Generator (`generateVerificationReport`):
  - Ingests `Environment`, `ValidationResult`, `EnvironmentSnapshot` baseline, `FixVerificationResult`, and applied remediation metadata.
  - Truthful semantics: accurately outputs `no-baseline` state without fabricating fake PASS metrics; enforces `BLOCKED` when unresolved findings or regressions persist.
- [x] 4 Multi-Format Engineering Formatters:
  - **Markdown Formatter (`formatReportAsMarkdown`)**: Clean GitHub-flavored Markdown with metadata table, executive summary, metric delta comparison grid, Before/After flow comparison boxes, regression warnings, and infrastructure change log.
  - **JSON Formatter (`formatReportAsJson`)**: Machine-readable JSON representation of the complete report schema for CI/CD pipelines and external tooling.
  - **Printable HTML Formatter (`formatReportAsPrintableHtml`)**: Standalone, print-optimized document with zero external network dependencies, styled for browser `Print → Save as PDF` with a strict ₹0 footprint.
  - **Vector Architecture Diagram Exporter (`exportEnvironmentAsSvg`)**: Mathematical SVG layout preserving all security semantics (directed flows, green TLS locks, dashed red `[DENY]` markers, zone colors, node types, service listeners).
- [x] Compact Export UX:
  - Engineering export strip in `VerificationPanel` (`Markdown (.md)`, `JSON (.json)`, `Print / PDF`, `Diagram (.svg)`).
  - Integrated `Export ▾` dropdown menu in `TopNav` covering both raw topology models and all verification artifacts.
- [x] Keyboard & Accessibility Hardening:
  - `Escape` key dismisses `ScenarioModal`, `ResetScenarioModal`, and `RemediationModal`.
  - Backdrop click dismissal and `role="dialog"` / `aria-modal="true"` on all modals.
  - Visible focus outlines and explicit `aria-label` tags on all icon-only action triggers.
- [x] Comprehensive Automated Test Suite:
  - 147 unit and integration tests passing across 16 test files (10 new tests in `tests/verification-reports.test.ts` covering passed reports, blocked reports, regressions, no-baseline truthfulness, JSON, Markdown, HTML, and SVG exports).

---

## Phase 2 — Attack Simulation (Deterministic Graph Traversal)

### Phase 2.1 — Attack Path Analysis Foundation *(STATUS: COMPLETE)*
- [x] Authoritative Domain Attack Path Engine (`packages/core/src/attack-path/`):
  - Data contracts: `AttackPath`, `AttackPathRisk` (`critical` | `high` | `medium` | `low`), `AttackPathNodeSummary`, `AttackPathEdgeSummary`, `TraversalStepFact`, `AttackPathSummary`, `AttackPathAnalysisResult`.
  - Deterministic entry point detection: discovers untrusted ingress (`zone === 'public'`, `type === 'internet'` / `'external_network'`).
  - Sensitive target identification: discovers crown jewels (`criticality === 'critical'` | `'high'`, `zone === 'restricted'`, `database`, `redis`, `admin`, `vpn`, `internal_network`).
  - Trust boundary transition tracking: zone normalization (aliasing `'private'` to `'internal'`) and boundary crossing detection.
  - Deterministic BFS reachability traversal: explores shortest directed attack paths over `ALLOW` edges, terminating at `DENY` barriers, cycle detection, and stable edge ordering.
  - Multi-hop traversal explanations: detailed `TraversalStepFact` records for each hop with step numbers, zones, protocols, ports, and human-readable transition rationale.
  - Deterministic risk scoring & factor attribution: assesses hop depth, target criticality, and trust boundaries crossed.
- [x] Automated Test Suite:
  - 162 unit and integration tests passing across 17 test files (15 new tests in `tests/attack-path.test.ts` covering entry points, sensitive targets, direct paths, multi-hop paths, reverse direction blocks, DENY barriers, cycle handling, deterministic IDs, visual layout coordinate isolation, and catalog scenarios `public-db-exposure`, `secure-web-app`, `chaos-lab`).
- [x] Attack Path Visualization & UX Integration:
  - `AttackPathsPanel`: Summary metric counters, multi-dimensional risk/criticality/entry-point filters, path list cards, step-by-step traversal breakdowns, deterministic "Why This Path Exists" facts, "Risk Factors", and "Locate Target" canvas action.
  - Interactive Canvas Highlighting: Selected attack paths highlighted in crimson dashed lines (`#f85149`, stroke-width: 2.5) on `CanvasEdge` and glowing crimson borders with `PATH` badges on `CanvasNode`.
  - Drawer Integration: Dedicated `ATTACK PATHS (${count})` tab in `FindingsDrawer` with Flame badge, full path selection synchronization, and stale status alerts.

### Phase 2.2 — Blast Radius & Lateral Movement Analysis *(STATUS: COMPLETE)*
- [x] Authoritative Domain Blast Radius Engine (`packages/core/src/blast-radius/`):
  - Data contracts: `BlastRadius`, `BlastRadiusImpact` (`critical` | `high` | `medium` | `low`), `BlastRadiusNodeSummary`, `BlastRadiusEdgeSummary`, `LateralMovementStep`, `TrustBoundaryTransition`, `BlastRadiusSummary`, `BlastRadiusAnalysisResult`, `BlastRadiusOptions`.
  - Directed BFS lateral movement traversal over `ALLOW` edges strictly starting from any compromised origin asset.
  - Strict DENY barrier enforcement: configured `DENY` edges block lateral traversal completely.
  - Strict edge directionality: upstream nodes remain unreachable without explicit reverse edges.
  - Cycle and self-loop termination without counting origin node as lateral movement.
  - Shortest lateral depth calculation (`lateralDepth`) per reachable node.
  - Unique trust boundary transition tracking across normalized security zones.
  - Reusable sensitivity and criticality classification (`isCriticalAsset`).
  - Explainable risk scoring, risk factors attribution, and numbered deterministic explanation facts ("Why this blast radius exists").
  - Batch analysis helper `analyzeAllBlastRadii(environment)` for complete environment assessment.
- [x] Comprehensive Automated Test Suite:
  - 179 unit and integration tests passing across 18 test files (17 tests in `tests/blast-radius.test.ts` covering basic reachability, depth, DENY barriers, directionality, cycles, trust boundaries, critical assets, branching, isolated nodes, coordinate isolation, determinism, and catalog scenarios).
- [x] Interactive UI Integration:
  - `BlastRadiusPanel`: Compromised origin selector, summary metric cards, impact badge, reachable assets table with criticality indicators, lateral movement flow steps with rationale, and explainability cards.
  - `AttackPathsPanel` integration: "Analyze Blast Radius" button allowing direct transition from attack path targets to lateral analysis.
  - `InspectorPanel` integration: "Analyze Blast Radius" button when inspecting any canvas node.
  - `FindingsDrawer` integration: Dedicated `BLAST RADIUS (${count})` tab with Radio icon and automatic tab switching upon node selection.
  - Canvas Visualization: Compromised origin pulsing amber ring (`#f0883e`) with `COMPROMISED` badge; reachable assets purple ring (`#a371f7`) with `LATERAL (+depth)` pills (or crimson `CRITICAL (+depth)`); lateral movement edges in dashed purple with purple arrowheads (`#a371f7`).

### Phase 2.3 — Risk-Weighted Attack Paths & Reachability Intelligence *(STATUS: COMPLETE)*
- [x] Dedicated Risk Evaluation Layer (`packages/core/src/attack-path/risk.ts`):
  - Architecture: Traversal discovers paths via directed BFS; dedicated risk layer evaluates and weights discovered paths without changing traversal semantics.
  - Deterministic 0–100 Integer Risk Score (`score` and `level`):
    - `75–100`: `critical`
    - `50–74`: `high`
    - `25–49`: `medium`
    - `0–24`: `low`
  - Explicit non-probability principle: scores prioritize modeled architectural exposure, not real-world exploit probability.
  - Observable Risk Factors: Entry exposure (Internet vs DMZ vs Internal), target criticality (`critical`, `high`, `medium`), sensitive roles (database, admin, redis), path depth (1-hop direct vs shallow vs deep), trust boundary crossings (0 unsegmented vs 1 vs 2+), wildcard ports/ANY protocols, administrative ports (22, 3389), cleartext sensitive communication.
  - Mitigating Architectural Defenses: TLS encryption, multi-tier segmentation insulations, discrete explicit port restrictions.
  - Dominant Factor Extraction: Top weighted reasons highlighting why a path is dangerous.
- [x] Reachability Intelligence Engine (`packages/core/src/attack-path/analyzer.ts`):
  - `mostDangerousPath`: Deterministic ordering by risk score desc, risk level desc, target criticality desc, hop count asc, stable ID asc.
  - `mostExposedAsset`: Sensitive asset reachable from the greatest number of distinct entry points (with tiebreaker).
  - `entryPointExposures`: Comprehensive reachability metrics per entry point.
  - `exposedAssets`: Comprehensive exposure intelligence per sensitive target.
- [x] Comprehensive Automated Test Suite:
  - 194 unit and integration tests passing across 19 test files (15 new tests in `tests/attack-path-risk.test.ts` covering direct public DB, internal low exposure, target criticality upgrades, public vs internal entry, cleartext vs TLS, wildcard ports, exact baseline scores, most dangerous path selection, most exposed asset selection, entry point exposures, byte-for-byte determinism, canvas coordinate independence, and catalog scenarios).
- [x] Interactive UI Intelligence (`AttackPathsPanel.tsx`):
  - Header intelligence banner: Quick-jump triggers to the Most Dangerous Path and Most Exposed Asset.
  - Risk cards displaying color-coded risk levels and scores (`CRITICAL · 92`).
  - Deep Risk Assessment inspection card with score progress bar, dominant factors, contributing factors with weights, and verified mitigating defensive controls.

### Phase 2.4 — Architecture Analysis Intelligence *(STATUS: COMPLETE)*
- [x] Core Architecture Intelligence Engine (`packages/core/src/architecture/`):
  - Data contracts: `ArchitectureTier`, `SegmentationQuality`, `TierSeparationQuality`, `DependencyConcentrationRating`, `ArchitectureRating`, `NodeTierAssignment`, `ZoneSummary`, `CrossZoneTransition`, `TopologyAnalysis`, `TierAnalysis`, `NodeDependencyProfile`, `SinglePointOfFailure`, `DependencyAnalysis`, `ArchitectureFinding`, `ArchitectureScore`, `ArchitectureProfile`, and `ArchitectureAnalysisResult`.
  - Deterministic Tier Inference (`tiers.ts`): maps components to `edge`, `perimeter`, `application`, `data`, `management`, and `internal`. Assigns `tier: 'unknown'` with low confidence to unrecognized types without forced classification.
  - Topology & Zone Analysis (`topology.ts`): zone summaries, cross-zone transitions, flat internal topology detection, and segmentation quality rating (`strong`, `moderate`, `weak`, `flat`).
  - Dependency & Fragility Analysis (`dependencies.ts`): in-degree/out-degree analysis, high-connectivity bottleneck detection, single points of failure (SPOF) with cautious phrasing, and dependency concentration rating (`low`, `moderate`, `high`).
  - Systemic Analyzer (`analyzer.ts`): architectural profile compilation, structured findings catalog (`ARCH-001` through `ARCH-007`), explainable 0–100 score calculation, and health rating (`EXCELLENT`, `GOOD`, `FAIR`, `POOR`, `CRITICAL`).
- [x] Comprehensive Automated Test Suite:
  - 210 unit and integration tests passing across 20 test files (16 new tests in `tests/architecture-analysis.test.ts` covering tier inference, unknown types, multi-tier layered architectures, direct edge-to-data detection, flat networks, multi-zone boundaries, privileged management exposure, dependency concentration, potential SPOF detection, explainable score deductions, canvas coordinate independence, byte-level determinism, and catalog scenarios `secure-web-app`, `public-db-exposure`, `flat-network`, and `chaos-lab`).
- [x] Interactive UI Intelligence (`ArchitecturePanel.tsx` & `FindingsDrawer.tsx`):
  - Dedicated `ARCHITECTURE (${count})` tab in `FindingsDrawer` with Layers icon.
  - Health score banner with color-coded rating badge, score bar, and itemized deduction breakdown.
  - Structural profile cards: Segmentation Quality, Tier Separation, SPOF Count, Dependency Concentration.
  - Multi-category finding filters (`ALL`, `TIER_BYPASS`, `SEGMENTATION`, `DEPENDENCY`, `MANAGEMENT`).
  - Deep architectural cards with "Why It Matters", observable graph facts, and actionable recommendations.
  - One-click "Locate" canvas action to instantly center and highlight affected elements.

### Phase 2.5 — Production Readiness Assessment *(STATUS: COMPLETE)*
- [x] Authoritative Domain Production Readiness Engine (`packages/core/src/production-readiness/`):
  - Data contracts: `ProductionReadinessStatus` (`READY`, `READY_WITH_WARNINGS`, `NOT_READY`, `INSUFFICIENT_EVIDENCE`), `ProductionReadinessRating` (`EXCELLENT`, `GOOD`, `NEEDS_ATTENTION`, `POOR`, `CRITICAL`), `ProductionGate`, `ProductionGateStatus`, `ReadinessCategoryId`, `ReadinessCategoryAssessment`, `BlockingReason`, `ReadinessWarning`, `UnverifiedControl`, `ReadinessEvidenceRecord`, `ProductionReadinessSummary`, and `ProductionReadinessAssessment`.
  - 6 Deterministic Production Gates (`gates.ts`): Critical Security Gate, High-Risk Exposure Gate, Network Architecture Gate, Resilience & Redundancy Gate, Communication Security Gate, and Operational Evidence Sufficiency Gate.
  - Explainable Scoring Model (`scoring.ts`): 7 weighted categories (Security 30%, Attack Exposure 20%, Architecture 20%, Access Control 10%, Communication Security 10%, Resilience 5%, Evidence Coverage 5%), itemized score deductions, and independent gate-driven status override.
  - Assessment Details & Truthful Disclosures (`assessment.ts`): Structured blocking reasons, non-blocking resilience warnings, objectively verified strengths, 10 unverified operational controls (backups, DR, monitoring, alerting, patching, secrets, IAM, incident response, deployment gates, runtime health), and actionable next steps.
  - Primary Analyzer (`analyzer.ts`): `assessProductionReadiness(environment, options)` composing existing validation, attack-path, blast-radius, and architecture results without algorithm duplication.
- [x] Comprehensive Automated Test Suite:
  - 231 unit and integration tests passing across 21 test files (21 new tests in `tests/production-readiness.test.ts` covering secure scenarios, public DB blocking, critical attack paths, management plane exposure, cleartext sensitive communication, flat network warnings, SPOF warnings, high dependency concentration, unmodeled operational controls as evidence gaps, determinism, coordinate independence, byte-for-byte serialization, structured blocking evidence, objective strengths verification, simultaneous chaos failures, high score awards, critical gate overrides, flaw fix transitions, DENY edge filtering, TLS communication verification, and single-node insufficient evidence).
- [x] Interactive UI Intelligence (`ProductionReadinessPanel.tsx` & `FindingsDrawer.tsx`):
  - Dedicated `READINESS (${score}/100)` tab in `FindingsDrawer` with Gauge icon.
  - Executive Verdict callout with cautious engineering tone.
  - 6 Production Gate cards with status pills, summaries, and reasons.
  - 7 Category health bars with weights, scores, and observations.
  - Blocking reasons cards with severity badges and one-click "Locate Asset" canvas action.
  - Resilience warnings cards with canvas locator.
  - Objectively verified strengths checklist.
  - Operational evidence gap disclosures for the 10 unverified runtime controls.
  - Recommended next steps for production.

### Phase 2.6 — Testing Intelligence *(STATUS: COMPLETE)*
- [x] Authoritative Domain Testing Intelligence Engine (`packages/core/src/testing-intelligence/`):
  - Data contracts (`types.ts`): `PropertyCategory`, `PropertyImportance`, `PropertyVerificationStatus`, `TestingEvidenceSource`, `CoverageLevel`, `SecurityPropertyDefinition`, `PropertyEvidence`, `TestingEvidence`, `PropertyEvaluation`, `CoverageGap`, `CategoryCoverageSummary`, `RegressionIntelligence`, `TestingCoverageSummary`, and `TestingIntelligenceResult`.
  - Authoritative 20-Property Security Catalog (`catalog.ts`):
    - Network Security: `public-ingress-control`, `database-isolation`, `management-plane-isolation`, `network-segmentation`, `deny-boundary-enforcement`
    - Communication Security: `sensitive-traffic-encryption`, `secure-protocol-enforcement`
    - Access Control: `least-privilege-access`, `wildcard-access-prevention`, `administrative-access-restriction`
    - Attack Resistance: `critical-asset-reachability`, `high-risk-attack-path-prevention`, `lateral-movement-containment`, `blast-radius-control`
    - Architecture: `tier-separation`, `dependency-concentration`, `single-point-of-failure-detection`, `perimeter-boundary`
    - Remediation: `finding-resolution-verification`, `regression-detection`
  - Deterministic Regression Intelligence (`regressions.ts`): Evaluates fix verification baseline transitions, distinguishing `healthy` (zero regressions), `regressions-detected` (with exact rule IDs of reintroduced flaws), and explicit `no-baseline`.
  - Evidence-Based Coverage Evaluator (`coverage.ts`): Evaluates evidence from unit tests, scenarios, fix verification, and graph invariants into `VERIFIED` (1.0 weight), `PARTIAL` (0.5 weight), or `UNVERIFIED` (0.0 weight). Zero fabricated coverage on sparse/empty environments.
  - Primary Testing Analyzer (`analyzer.ts`): `assessTestingIntelligence(environment, options)` calculating weighted scores (critical = 3, high = 2, normal = 1), qualitative levels (`EXCELLENT`, `GOOD`, `MODERATE`, `WEAK`, `INSUFFICIENT`), 6 category coverage summaries, structured coverage gaps sorted by severity, and deterministic test recommendations.
- [x] Comprehensive Automated Test Suite:
  - 253 unit and integration tests passing across 22 test files (22 new tests in `tests/testing-intelligence.test.ts` covering secure web app coverage, database isolation across scenarios, attack-path containment evidence, fix verification evidence, unmodeled operational properties, critical property weighting, half-weight partial evidence, deterministic calculation, canvas coordinate independence, byte-for-byte JSON serialization, category score accuracy, coverage gap severity mapping, deterministic recommendations, scenario catalog reuse, explicit no-baseline status, healthy regression status, regression detection, deterministic gap sorting, DENY boundary verification, encryption status verification, sparse environment protection, and operational capability verification without false claims).
- [x] Interactive UI Console (`TestingIntelligencePanel.tsx` & `FindingsDrawer.tsx`):
  - Dedicated `TESTING (${score}/100)` Tab 7 in `FindingsDrawer` with `FlaskConical` icon.
  - Engineering verification console styling with coverage score, qualitative level badge, and summary.
  - Critical Coverage, High Coverage, and Overall Coverage progress bars.
  - Section filters: `Overview`, `Coverage Gaps`, `Properties`, `Categories`, `Regressions`, `Recommendations`.
  - Regression status card with baseline tracking and warning alerts.
  - Category breakdown cards with scores, mini progress bars, and property counts.
  - Structured coverage gap cards with severity badges, "Why It Matters", "Recommended Test", and one-click "Locate" canvas integration.
  - Security property catalog with status pills (`VERIFIED`, `PARTIAL`, `UNVERIFIED`) and evidence provenance tags.
  - Ordered deterministic test recommendations.

### Phase 2.7 — Technical Debt & Engineering Risk Tracking *(STATUS: COMPLETE)*
- [x] Authoritative Domain Technical Debt Engine (`packages/core/src/technical-debt/`):
  - Data contracts (`types.ts`): `DebtCategory` (security, architecture, resilience, access-control, testing, operational, complexity), `DebtSeverity` (CRITICAL, HIGH, MEDIUM, LOW), `DebtPriority` (P0, P1, P2, P3), `DebtStatus` (ACTIVE, MITIGATED, UNVERIFIED), `DebtImpactType`, `FutureChangeImpact`, `DebtSourceAnalysis`, `PriorityFactor`, `TechnicalDebtDefinition`, `TechnicalDebtItem`, `DebtRating` (LOW_DEBT, MANAGEABLE, ELEVATED, HIGH, SEVERE), `TechnicalDebtSummary`, `TechnicalDebtAssessment`, `TechnicalDebtOptions`.
  - Authoritative 22-Pattern Debt Catalog (`catalog.ts`):
    - Security Debt: `TD-001` (Public Sensitive Asset Exposure), `TD-002` (Unencrypted Sensitive Communication), `TD-003` (Excessive Trust Relationship), `TD-004` (Broad Network Access)
    - Architecture Debt: `TD-005` (Flat Network Architecture), `TD-006` (Tier Bypass), `TD-007` (Weak Perimeter Segmentation), `TD-008` (Dependency Concentration)
    - Resilience Debt: `TD-009` (Potential Single Point of Failure), `TD-010` (Critical Dependency Concentration)
    - Access-Control Debt: `TD-011` (Wildcard Access), `TD-012` (Excessive Administrative Reachability), `TD-013` (Overly Broad Protocol/Port Access)
    - Testing Debt: `TD-014` (Missing Critical Verification Coverage), `TD-015` (Missing Regression Baseline), `TD-016` (Unverified High-Risk Property)
    - Operational Debt: `TD-017` (Missing Operational Evidence), `TD-018` (Unverified Recovery Controls), `TD-019` (Unverified Monitoring/Alerting)
    - Complexity Debt: `TD-020` (High Connectivity Concentration), `TD-021` (Excessive Trust Boundaries), `TD-022` (Infrastructure Topology Complexity)
  - Deterministic Prioritization & Scoring (`prioritization.ts`): Transparent 0–100 formula prioritizing items into `P0` (80–100), `P1` (60–79), `P2` (35–59), `P3` (0–34) using base severity points (`CRITICAL`: 40, `HIGH`: 30, `MEDIUM`: 20, `LOW`: 10), strict tie-breaking (`score → severity → category → id`), and aggregate health rating (`LOW_DEBT`: 90–100, `MANAGEABLE`: 75–89, `ELEVATED`: 50–74, `HIGH`: 25–49, `SEVERE`: 0–24).
  - Evidence-Based Debt Detectors (`detectors.ts`): Evaluates existing validation, attack-path, architecture, readiness, testing, and fix verification evidence. Handles `ACTIVE`, `MITIGATED` (via revalidation proof), and `UNVERIFIED` (for unmodeled runtime controls).
  - Primary Debt Analyzer (`analyzer.ts`): `assessTechnicalDebt(environment, options)` producing structured summary, active/mitigated/unverified collections, category distribution, and deterministic recommendations.
- [x] Comprehensive Automated Test Suite:
  - 280 unit and integration tests passing across 23 test files (27 tests in `tests/technical-debt.test.ts` including explicit 10 boundary tests across rating thresholds and severity weight/score clamping tests, plus reference secure web app, public database exposure, flat network architecture, unencrypted sensitive links, wildcard ANY:ANY access, SPOF resilience bottlenecks, fan-in dependency concentration, testing coverage gaps, missing regression baseline, unmodeled operational controls as UNVERIFIED debt, authentic evidence provenance without fabrication, determinism, P0–P3 mapping, strict tie-breaking, canvas coordinate independence, explicit DENY boundary filtering, TLS encryption clearing, revalidation-verified mitigation, active finding retention, deterministic sorting, byte-for-byte serialization, category aggregation, sparse/empty topology protection, operational capability truthfulness, and catalog integrity).
- [x] Interactive UI Console (`TechnicalDebtPanel.tsx` & `FindingsDrawer.tsx`):
  - Dedicated `DEBT (${activeCount} active)` Tab 8 in `FindingsDrawer` with `Coins` icon.
  - Debt health score banner with color-coded rating badge, score bar, and metric counters (Active, P0, P1, P2, P3, Mitigated, Unverified).
  - Sub-tabs: `PRIORITIZED BACKLOG`, `CATEGORIES & SPREAD`, `RESOLUTION ROADMAP`, `GOVERNANCE & BOUNDARIES`.
  - Filter toolbar for Priority (`ALL`, `P0`, `P1`, `P2`, `P3`) and Status (`ALL`, `ACTIVE`, `MITIGATED`, `UNVERIFIED`).
  - Prioritized debt cards with "Why It Matters (Future Engineering Cost)", transparent priority factor points, evidence provenance tags, and interactive "Locate" canvas actions.
  - Interactive Categories & Spread breakdown cards with item counters and P0 indicators.
  - Deterministic step-by-step Resolution Roadmap.
  - Governance & Scope Boundary disclosures explaining ₹0 operating model, no fake monetary estimates, and verified mitigation requirements.

---

---

## Phase 3 — Continuous Security Engineering & Verification

### Phase 3.1 — Continuous Engineering & Change Analysis Foundation *(STATUS: COMPLETE)*
- [x] Authoritative Domain Change Analysis Engine (`packages/core/src/change-analysis/`):
  - Data contracts (`types.ts`):
    - `EngineeringChangeType`: `NODE_ADDED`, `NODE_REMOVED`, `NODE_CONFIG_CHANGED`, `EDGE_ADDED`, `EDGE_REMOVED`, `EDGE_CONFIG_CHANGED`
    - `SecuritySignificance`: `security-increasing`, `security-decreasing`, `security-neutral`, `security-ambiguous`
    - `ChangeImpactLevel`: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
    - `ChangeCategory`: `topology`, `policy`, `encryption`, `exposure`, `attack-surface`, `configuration`
    - `InfrastructureChangeItem`: id, type, category, targetId, targetType, summary, securitySignificance, significanceReason, details, beforeState, afterState
    - `AttackPathDelta`: addedPaths, removedPaths, unchangedPaths, riskScoreBefore, riskScoreAfter, riskScoreDelta
    - `ArchitectureDelta`: tierBypassDelta, flatTopologyDelta, dataIngressDelta, managementExposureDelta, dependencyConcentrationDelta, structuralShifts
    - `ReadinessDelta`: scoreBefore, scoreAfter, scoreDelta, ratingBefore, ratingAfter, newBlockers, resolvedBlockers, newWarnings, resolvedWarnings
    - `TechnicalDebtDelta`: scoreBefore, scoreAfter, scoreDelta, p0Delta, p1Delta, newDebt, resolvedDebt
    - `RegressionDetails`: regressionDetected, description, resolvedCount, introducedCount, introducedRules, introducedSeverities
    - `ChangeAnalysisSummary`: totalChanges, securityIncreasingCount, securityDecreasingCount, securityNeutralCount, securityAmbiguousCount, overallSignificance, impactLevel, netRiskDelta
    - `ChangeAnalysisResult`: beforeSnapshot, afterSnapshot, changes, newlyIntroducedRisks, resolvedRisks, unchangedRisks, attackPathDelta, architectureDelta, readinessDelta, technicalDebtDelta, regression, summary, recommendations
  - Deterministic Classification Engine (`classification.ts`):
    - Maps `diffEnvironments` output to `InfrastructureChangeItem`
    - Deterministic significance classification (`security-increasing`, `security-decreasing`, `security-neutral`, `security-ambiguous`)
    - Detailed engineering rationale explaining why each mutation strengthens or weakens defenses
  - Impact Evaluation & Regression Engine (`impact.ts`):
    - Regression detection: flags `regressionDetected: true` when a change resolves $\ge 1$ risks while introducing $\ge 1$ new risks
    - Impact scoring: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` driven by critical findings, attack paths, readiness blockers, and P0/P1 debt
  - Primary Change Analyzer (`analyzer.ts`):
    - `analyzeInfrastructureChanges(before, after, options)` orchestrating diffs, signature-based finding comparisons, attack paths, architecture, readiness, debt, regressions, and recommendations
- [x] Comprehensive Automated Test Suite:
  - 321 unit and integration tests passing across 24 test files (41 tests in `tests/change-analysis.test.ts` covering node additions, node removals, node config updates, edge additions, edge removals, edge policy updates, security significance classifications, risk deltas, finding signature tracking across reconfigurations, regression detection, readiness deltas, technical debt deltas, determinism, coordinate independence, byte-for-byte serialization, empty environment safety, and boundary validation).
- [x] Interactive UI Console (`ChangeAnalysisPanel.tsx` & `FindingsDrawer.tsx`):
  - Dedicated `CHANGES` Tab 9 in `FindingsDrawer` with `GitCompare` icon.
  - Active baseline indicator (`Baseline Active`, `No Baseline`) with capture baseline trigger.
  - Overall change impact badge (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and summary metric counters.
  - Regression alert banner (`SECURITY REGRESSION DETECTED`) highlighting introduced vulnerabilities.
  - Sub-tabs: `CHANGES`, `RISK DELTA`, `ATTACK PATHS`, `INTELLIGENCE DELTA`.
  - Filter toolbar for Significance (`ALL`, `INCREASING`, `DECREASING`, `NEUTRAL`, `AMBIGUOUS`).
  - Interactive cards with "Locate" canvas actions.
  - Deterministic recommendations for hardening.
- [x] Strict Scope Boundaries & Governance:
  - 100% local-first, zero telemetry, zero LLM dependencies, ₹0 operating cost.
  - External PR/CI automation and persistent history tracking deferred to subsequent Phase 3 milestones.

---

### Phase 3.2 — Repository Change Ingestion Foundation *(STATUS: COMPLETE)*
- [x] Authoritative Domain Repository Ingestion Engine (`packages/core/src/change-ingestion/`):
  - Data contracts (`types.ts`):
    - `FileChangeType`: `ADDED`, `MODIFIED`, `DELETED`, `RENAMED`
    - `FileCategory`: `infrastructure`, `cicd`, `application`, `security-config`, `documentation`, `tests`, `dependencies`, `unknown`
    - `EngineeringSignalType`: 18 discrete deterministic signal types across security, infra, CI/CD, testing, and dependencies
    - `EngineeringSignal`: id, type, category, file, description, hint, isSecuritySensitive
    - `DiffHunkLine`, `DiffHunk`, `NormalizedFileChange`, `ChangeIngestionSummary`, `NormalizedChangeSet`
    - Source abstractions: `UnifiedDiffSource`, `StructuredChangeSetSource`, `RepositorySnapshotSource`, `ChangeSource`
  - Deterministic Unified Diff Parser (`parser.ts`):
    - Supports added (`new file mode`), deleted (`deleted file mode`), modified, and renamed (`rename from/to`) files
    - Multi-file and multi-hunk diff parsing with accurate line additions, deletions, and context tracking
    - Binary file indicators (`Binary files ... differ` / `GIT binary patch`)
    - Structured parse diagnostics with warnings/errors without crashing
  - Deterministic Path Normalization & Secret Masking (`normalizer.ts`):
    - Replaces backslashes, strips quotes, strips `./`, collapses duplicate slashes, strips `a/` and `b/` prefixes
    - Preserves `/dev/null` special token
    - Strictly rejects absolute paths (`/etc/passwd`, `C:/repo`) and directory traversals (`../`)
    - Secret masking for private keys, AWS access keys, GitHub tokens, generic API keys (`sk-...`), JWT tokens, and key-value credential assignments with `[REDACTED_...]` tags
    - Deterministic ID and signature generation (`FNV-1a` 32-bit hashing without UUIDs or timestamps)
  - Deterministic File Classification (`classifier.ts`):
    - Classifies files into 8 engineering categories
    - Evaluates tests, dependencies, CI/CD, and security configs before generic patterns
    - Unrecognized files remain explicitly classified as `unknown`
  - Deterministic Engineering Signals (`signals.ts`):
    - Extracts context hints for infrastructure, CI/CD, testing, dependencies, and security
    - Truthful governance: Signals are observations, NOT vulnerability findings
  - Phase 3.1 Bridge & Truthful Governance (`mapper.ts`):
    - Explicitly separates observed repository changes from proven infrastructure security posture
    - Bridges to `analyzeInfrastructureChanges` when modeled environments are supplied
    - Zero topology fabrication from code diffs
  - Primary Ingestion Orchestrator (`ingest.ts`):
    - `ingestRepositoryChanges(source, options)` supporting unified diff text, structured changes, and repository snapshots
    - Deterministic sorting by canonical path ensuring file ordering independence
- [x] Comprehensive Automated Test Suite:
  - 372 unit and integration tests passing across 25 test files (51 tests in `tests/change-ingestion.test.ts` covering empty diffs, single/multi-file diffs, additions, deletions, renames, multi-hunks, line metrics, malformed headers/hunks, path normalization, absolute path rejection, directory traversal rejection, file classification, engineering signals, determinism, file ordering independence, hunk stability, stable change IDs, secret masking, binary files, duplicate entries, unknown mapping, structured change sources, snapshot comparisons, truthful governance, and Phase 3.1 bridging).
- [x] Interactive UI Integration (`ChangeAnalysisPanel.tsx`):
  - Dedicated `CHANGE SOURCE (DIFF)` sub-tab in `ChangeAnalysisPanel`
  - Live unified diff editor with preset quick-load buttons for QA examples A (App), B (Infra), C (CI), and D (Secret)
  - Metric counters strip (Files, Lines +, Lines -, Signals, Sensitive, Masked)
  - Category breakdown badges, parser diagnostics, signal cards with hints
  - Truthful Governance disclosure banner contrasting observed repository changes against proven infrastructure impact.
- [x] Strict Scope Boundaries & Governance:
  - 100% local-first, zero telemetry, zero LLM dependencies, ₹0 operating cost.
  - GitHub OAuth, GitHub API, GitHub webhooks, PR comments, and cloud scanning strictly deferred to future Phase 3 milestones.

---

### Phase 3.3 — Local Git Repository Change Analysis *(STATUS: COMPLETE)*
- [x] Pure Deterministic Core Git Domain (`packages/core/src/git/`):
  - `types.ts`: `GitComparisonMode`, `GitRepository`, `GitCommit`, `GitDiffOptions`, `GitDiffResult`, `GitAnalysisResult`, `GitCommandResult`, `GitCommandOptions`, `GitCommandExecutor`, `GitErrorCode`, `GitError`
  - `refs.ts`: Pure deterministic ref validation (`validateGitRevision`), ref range parsing (`parseRevisionRange`), preventing flag injection (`-`), shell metacharacters, and directory traversal
  - `command.ts`: Whitelist of permitted read-only Git subcommands (`rev-parse`, `status`, `branch`, `log`, `diff`, `show`, `ls-files`, `remote`, `version`), non-shell process execution with timeout/buffer limits, rejecting dangerous flags (`--exec`, `--ext-cmd`, `-c`, `--config`), `createNodeGitExecutor()`, and deterministic `createMockGitExecutor()`
  - `repository.ts`: Repository root discovery (`discoverRepository`) supporting root and nested paths, full state inspection (`getRepositoryState`) for branch, commit SHA, detached HEAD, staged/unstaged counts, deterministically sorted untracked files, and remote presence without leaking credentials
  - `diff.ts`: Unified diff generation (`generateGitDiff`) across 5 comparison modes (`working-tree-vs-head`, `index-vs-head`, `working-state-vs-head`, `commit-vs-commit`, `branch-vs-branch`), rename detection (`-M`), deterministic untracked file handling, and full ingestion bridging (`analyzeGitChanges`)
  - `history.ts`: Commit history (`getCommitHistory`) and commit metadata (`getCommitMetadata`) parsing author, subject, parents, and timestamps (display-only invariant: timestamps never participate in semantic change hashing)
  - `index.ts`: Module exports integrated into `@pathforge/core`
- [x] Comprehensive Automated Test Suite:
  - 424 unit and integration tests passing across 26 test files (52 tests in `tests/local-git.test.ts` covering repository discovery, nested discovery, non-git directories, git command failure, permission/not-found handling, clean/dirty repositories, staged/unstaged counts, untracked file inclusion, detached HEAD, unborn branches, 5 comparison modes, commit metadata, revision safety, shell injection prevention, Phase 3.2 ingestion reuse, Phase 3.1 change analysis bridging, determinism across executions, and live repository untouched safety verification).
- [x] Interactive UI Integration (`ChangeAnalysisPanel.tsx` · `LOCAL GIT & DIFF`):
  - Toggle between Local Git repository inspection and raw unified diff
  - Local repository target input with "Inspect Git Changes" action
  - Repository state overview card with branch, commit, `CLEAN`/`DIRTY` badge, and staged/unstaged/untracked breakdown
  - 5 Comparison mode buttons with revision inputs for commit/branch ranges
  - Untracked file inclusion toggle
  - 6 Quick QA verification presets (QA A Clean, QA B Modified, QA C Staged, QA D Commit Range, QA E Dirty+Untracked, QA F Security Config)
  - Source disclosure banner and expandable raw unified Git diff viewer
- [x] Strict Scope Boundaries & Governance:
  - Read-only Git inspection strictly enforced.
  - Zero mutating commands executed (`checkout`, `commit`, `push`, `pull`, `fetch`, `reset`, `stash`, `merge`, `rebase`).
  - 100% offline, local-first, zero telemetry, zero LLM dependencies, ₹0 operating cost.
  - GitHub API, OAuth, PR comments, and CI/CD webhooks strictly scheduled for future Phase 3 milestones.

---

### Phase 3.4 — Read-only GitHub Repository & Pull Request Integration *(STATUS: COMPLETE)*
- [x] Pure Deterministic Core GitHub Domain (`packages/core/src/github/`):
  - `types.ts`: `GitHubRepositoryReference`, `GitHubPullRequestReference`, `PullRequestMetadata`, `PullRequestFile`, `PullRequestRiskStatus`, `PullRequestEvidence`, `GitHubAnalysisResult`, `GitHubError`, `GitHubProvider`
  - `repository.ts`: Owner/repository format validation, canonical string representation (`owner/repo`), repository URL parsing (`https://github.com/owner/repo`), metadata retrieval
  - `pull-request.ts`: Pull request ref parsing (`owner/repo#123`, `https://github.com/owner/repo/pull/123`), PR metadata validation, normalized changed file listing with deterministic sorting and binary detection
  - `diff.ts`: Unified diff / patch extraction and normalization, canonical patch synthesis fallback from changed files, binary diff marker support
  - `provider.ts`: Read-only provider abstraction, deterministic `MockGitHubProvider` for 100% offline testing, `SystemGitHubCliProvider` utilizing authenticated system `gh` CLI without token prompts or secret storage, and automatic `sanitizeErrorMessage()` token redaction (`ghp_`, `gho_`, `Bearer`, `sk-`, `AKIA`)
  - `mapper.ts`: Direct reuse of Phase 3.2 `ingestRepositoryChanges()` without code duplication, partitioned signals summary (`partitionSignals`)
  - `analyzer.ts`: Orchestrated `analyzePullRequest()` flow, building structured `PullRequestEvidence`, computing deterministic `PullRequestRiskStatus` (`NO_ENGINEERING_IMPACT`, `ENGINEERING_CHANGE_DETECTED`, `SECURITY_SENSITIVE_CHANGE`, `SECURITY_REGRESSION`, `SECURITY_IMPROVEMENT`, `INSUFFICIENT_EVIDENCE`), and Phase 3.1 `bridgeToChangeAnalysis()` connection
  - `index.ts`: Module exports integrated into `@pathforge/core`
- [x] Comprehensive Automated Test Suite:
  - 481 unit and integration tests passing across 27 test files (57 tests in `tests/github-pr.test.ts` covering repository refs, PR refs, PR metadata, changed files, diff normalization, Phase 3.2 ingestion reuse, truthful governance, PR risk statuses, determinism across executions, provider error handling, credential sanitization, and read-only invariants).
- [x] Interactive UI Integration (`ChangeAnalysisPanel.tsx` · `GITHUB PR (Phase 3.4)`):
  - 3-way source toggle: `Local Git (Phase 3.3)`, `GitHub PR (Phase 3.4)`, `Raw Diff (Phase 3.2)`
  - Target input fields for Owner, Repository, and PR Number with "Inspect Pull Request" action
  - 4 Quick QA verification presets: QA A Normal PR, QA B Security-Sensitive PR, QA C Code-Only PR, QA D Failure / Inaccessible PR
  - Structured failure state card displaying `ANALYSIS INCOMPLETE (INSUFFICIENT EVIDENCE)` and sanitized provider errors
  - PR Header Card displaying PR number, title, author, state badge (`OPEN`/`MERGED`/`CLOSED`), base/head branches and commit SHAs, line stats
  - Source disclosure banner: `Source: GitHub Pull Request ...` with `100% READ-ONLY · CLI PROVIDER BOUNDARY · ₹0 COST` badge
  - Pull Request Risk Evaluation card with Truthful Governance Rule disclosure
  - Category Signals breakdown strip (Security, Infra, CI/CD, Testing, Dependency)
  - Expandable raw unified PR patch viewer with diff line counter
- [x] Strict Scope Boundaries & Governance:
  - 100% read-only inspection.
  - Zero token or credential storage in PathForge domain models.
  - Zero PR comments, review comments, Checks API, status checks, automatic merging, pushing commits, branch creation, GitHub Actions, webhooks, or cloud telemetry.
  - ₹0 operating cost, local-first.

---

### Phase 3.5 — Engineering Change Rules & Policy Enforcement *(PLANNED)*
- Guardrail rules preventing merges that introduce security regressions
- Configurable failure criteria (e.g., fail if new critical risk or P0 debt introduced)
- Deterministic change approval gates

### Phase 3.6 — CI/CD & Headless Verification CLI *(PLANNED)*
- Headless CLI runner for executing change analysis in local git hooks and CI pipelines
- Output formats: JSON, JUnit XML, Markdown summaries
- PR comment markdown generator for GitHub / GitLab diff reviews

### Phase 3.7 — Continuous Engineering History & Multi-Snapshot Evolution *(PLANNED)*
- Local timeline of engineering changes across editing sessions
- Snapshot version tree and change history navigation
- Time-series progression of readiness, debt, and risk scores

### Phase 3.8 — Infrastructure-as-Code (IaC) Continuous Drift Detection *(PLANNED)*
- Import parser for Terraform / Docker Compose diffs
- Compare modeled state against intended infrastructure code changes
