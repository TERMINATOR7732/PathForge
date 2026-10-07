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

---

## Phase 3 — Defense, Verification & Proof ("Prove")

### Phase 3.1 — Remediation Recommendations
- Automated suggestions for defensive placement (where to place firewalls, WAFs, bastions)
- Least-privilege port restriction suggestions

### Phase 3.2 — Simulated Defensive Interventions
- "What-If" defense staging mode (simulate adding a firewall without modifying baseline)
- Live preview of attack path breakage

### Phase 3.3 — Before/After Graph Comparison
- Visual side-by-side diff of topology graphs
- Diff of findings and attack paths

### Phase 3.4 — Attack-Path Elimination Verification ("Prove")
- Formal proof report: "Attack Path `P-01` is eliminated. Reachability = `UNREACHABLE`."
- Verification certificate of hardened architecture

### Phase 3.5 — Chaos Lab & Drift Simulation
- Random or scenario-based network sabotage (e.g., firewall rule dropped, port opened)
- Student / engineer challenges: fix the topology within 3 moves

### Phase 3.6 — Assess Mode & Harden Mode Workflows
- **Assess Mode**: Audit existing topologies, highlight risks and compliance gaps
- **Harden Mode**: Step-by-step guided security transformation

### Phase 3.7 — Infrastructure-as-Code (IaC) Import & Export
- Import parser for Terraform HCL graph / AWS CloudFormation / Docker Compose
- Export hardened topology to Terraform or network policy manifests
