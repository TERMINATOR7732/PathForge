# PathForge

> **Build. Break. Defend. Prove.**

PathForge is an interactive infrastructure security simulator and learning lab. It enables engineers, architects, and security practitioners to visually design virtual infrastructure topologies, intentionally introduce misconfigurations or anti-patterns, understand why those designs are dangerous through deterministic explanatory reasoning, safely simulate attacks against modeled environments, apply defensive remediations, and verify that attack paths have been eliminated.

PathForge is **not** a real-world penetration-testing tool. It operates entirely against a modeled, deterministic virtual graph.

---

## The Core Product Loop

```text
Build → Validate → Break → Simulate Attack → Explain → Defend → Fix → Re-test → Prove
```

1. **Build**: Visually assemble multi-tier network topologies using component nodes (Internet, Firewalls, Load Balancers, Web/API clusters, Databases, Caches, VPNs, Management planes).
2. **Validate**: Deterministically check topology against architectural security rules.
3. **Break**: Intentionally create dangerous or anti-pattern connections (e.g., `Internet → Database`) without software friction.
4. **Simulate Attack**: Trace adversarial reachability from untrusted entry points to high-value assets.
5. **Explain**: Receive structured 6-dimensional explanations answering *what*, *why*, *impact*, *recommendations*, and *remediation*.
6. **Defend**: Architect protective boundaries (DMZs, firewalls, reverse proxies, segmentation).
7. **Fix**: Remove vulnerable links or insert security controls.
8. **Re-test**: Automatically re-evaluate topology graphs.
9. **Prove**: Mathematically and deterministically verify that the attack path is eliminated.

---

## Architectural Principles

- **Deterministic**: The core graph traversal and validation rules are pure engineering algorithms. For identical inputs, validation and reachability produce identical results every time.
- **LLM-Free Security Engine**: The core security reasoning does **NOT** rely on external LLM APIs. Rule evaluation is local, auditable, and instant.
- **Local-First & Free-First**: Runs 100% locally with zero cloud dependencies, zero external database requirements, and a ₹0 operating cost.
- **Modular & Decoupled**: Clear separation across tiers:
  ```text
  Domain / Graph Model  (@pathforge/core)
          ↓
  Validation Engine     (@pathforge/validator)
          ↓
  Application & UI      (@pathforge/web)
  ```
  The core graph and security logic have **zero** dependency on React or UI libraries.
- **Chaos Lab UX Principle**: The workspace never blocks users from creating "bad" infrastructure. Creating mistakes is the primary vehicle for learning and proving defense.

---

## Visual & Workspace Philosophy

PathForge is built as a **serious engineering and security workspace**, taking inspiration from the restrained interaction quality of tools like **Eraser.io** and **Botpress Studio**:

- **Canvas is the Product**: Large, high-density workspace with an engineering grid background rather than a dashboard cluttered with marketing cards.
- **Technical Restraint**: Monospace accents (`JetBrains Mono`), 1px slate structural borders, subtle selection outlines, and crisp status badges.
- **Zero Decorative Blobs**: No generic SaaS gradients, no purple AI glows, no glassmorphism, no meaningless metric cards, and no cartoonish illustrations.
- **Information Density**: Compact side panels with instant property inspection and deep diagnostic logs.

---

## Project Structure

```text
PathForge/
├── apps/
│   └── web/                     # Vite + React 19 workspace UI shell
│       ├── src/
│       │   ├── components/      # TopNav, Palette, Inspector, FindingsDrawer
│       │   │   └── canvas/      # NetworkCanvas, CanvasNode, CanvasEdge, ConnectionPreview, CanvasControls, CanvasMinimap
│       │   ├── App.tsx          # Workspace coordinator
│       │   └── index.css        # Technical dark canvas theme
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   ├── shared/                  # Common domain contracts, severities, schemas
│   │   └── src/types.ts         # Finding, NodeType, EdgeDefinition, ValidationResult
│   ├── core/                    # Domain models & Graph abstraction
│   │   ├── src/domain/          # Environment, InfrastructureNode, InfrastructureEdge
│   │   ├── src/graph/           # InfrastructureGraph adjacency & traversal primitives
│   │   └── src/serialization/  # Deterministic JSON export/import & validation
│   └── validator/               # Deterministic rule engine & registry
│       ├── src/engine/          # ValidatorEngine runner & summary aggregator
│       ├── src/registry/        # RuleRegistry (register, enable, disable, query)
│       └── src/rules/           # PF-001 through PF-007 implementation rules
│
├── environments/
│   └── demo/
│       ├── standard-web-app.json     # Hardened 3-tier baseline (passes validation)
│       └── compromised-direct-db.json # Chaos lab testbed (triggers critical findings)
│
├── tests/                       # Automated test suite (Vitest — 372 tests passing across 25 test files)
│   ├── node.test.ts             # Node domain lifecycle & mutations
│   ├── edge.test.ts             # Edge domain lifecycle & metadata
│   ├── graph.test.ts            # Graph traversals, degrees, cascading deletions
│   ├── environment.test.ts      # Environment delegation, creation helpers & JSON serialization
│   ├── rules.test.ts            # PF-001 through PF-009 deterministic evaluation
│   ├── demo-environment.test.ts # Verification of standard baseline JSON
│   ├── chaos-loop.test.ts       # Full Build-Break-Defend-Fix lifecycle test
│   ├── editor-integration.test.ts # Phase 1.2 interactive canvas & domain sync tests
│   ├── deep-configuration.test.ts # Phase 1.3 node & edge deep config, CIDR/port validation, QA A-F
│   ├── semantic-validation.test.ts # Phase 1.4 semantic security validation, positive/negative/DENY tests
│   ├── remediation-ux.test.ts   # Phase 1.5 finding explanation & safe remediation tests
│   ├── fix-verification.test.ts # Phase 1.6 baseline snapshot, diff & fix verification tests
│   ├── scenario-lab.test.ts     # Phase 1.7 scenario library & chaos workflow tests
│   ├── phase17-manual-qa.test.ts # Phase 1.7 automated 5-step manual QA test suite
│   ├── verification-reports.test.ts # Phase 1.8 verification report model & export tests
│   ├── attack-path.test.ts      # Phase 2.1 deterministic attack path analysis tests
│   ├── blast-radius.test.ts     # Phase 2.2 blast radius & lateral movement tests
│   ├── attack-path-risk.test.ts # Phase 2.3 risk-weighted attack path intelligence tests
│   ├── architecture-analysis.test.ts # Phase 2.4 architecture analysis intelligence tests
│   ├── production-readiness.test.ts # Phase 2.5 production readiness assessment tests
│   ├── testing-intelligence.test.ts # Phase 2.6 testing intelligence & verification coverage tests
│   ├── technical-debt.test.ts   # Phase 2.7 technical debt & engineering risk tracking tests
│   ├── change-analysis.test.ts  # Phase 3.1 continuous engineering & change analysis tests
│   ├── change-ingestion.test.ts # Phase 3.2 repository change ingestion & normalization tests
│   └── manual-qa-workflow.test.ts # Automated 10-step manual QA verification test
│
├── vitest.config.ts             # Root test runner configuration
├── tsconfig.base.json           # Shared strict TypeScript configuration
├── package.json                 # Monorepo workspaces definition
└── implementation_plan.md       # Multi-phase roadmap and delivery milestones
```

---

## Interactive Visual Canvas & Deep Configuration (Phases 1.2 & 1.3)

PathForge features an interactive, high-density modeling canvas where the `@pathforge/core` domain graph remains the single source of truth:

- **Direct Node Manipulation**: Drag components across the grid workspace; coordinates persist directly into the domain model and survive serialization.
- **Palette Drag & Drop**: Drag infrastructure components from the sidebar palette onto the canvas with automatic stable ID and human-readable name generation (`Web Server 2`, `Database 3`).
- **Interactive Connection Handles**: Obvious connection ports on each node. Drag from the green output port to any input port to establish directional infrastructure edges (`InfrastructureEdge`).
- **Permissive Modeling (Chaos UX Principle)**: The editor allows users to intentionally build dangerous connections (e.g., `Internet → Database` or `Internet → Admin`) to learn through experimentation.
- **Deep Node Configuration**: Edit component name, trust zone (`public`, `dmz`, `internal`, `restricted`, `management`), asset criticality (`low`, `medium`, `high`, `critical`), IPv4/CIDR address (with strict `0-255` octet and `/0` to `/32` prefix validation), listening service port/protocol, and tags.
- **Deep Edge Configuration**: Configure protocol (`TCP`, `UDP`, `HTTP`, `HTTPS`, `SSH`, `TLS`, `ICMP`, `ANY`), structured ports (single port, ranges such as `8000-8080`, or wildcard `ANY`), access policy (`allow` / `deny`), encrypted channel toggle (TLS/SSH), and architectural relationship type (`network`, `management`, `trust`, `dependency`).
- **Deterministic Port Reachability**: Edges expose an `allowsPort(targetPort)` evaluator that respects access policies (denied edges block all traffic) and port boundaries for downstream attack engines.
- **Visual Canvas Badges**: Edges display protocol/port pills, red `[DENY]` blocked markers, and green TLS/SSH lock icons. Node cards display IP/CIDR subnets and service port badges.
- **Sensible Deletion**: Select any node or edge and press `Delete` / `Backspace` or click delete in the inspector. Node deletion automatically executes cascading edge removals in the graph.
- **Canvas Navigation**: Pan around the workspace via middle-click or space+drag; zoom smoothly via mouse wheel or floating controls (`+`, `-`, `Reset`); and monitor the topology via the interactive minimap.
- **Revalidation Integration**: Graph modifications flag validation state as outdated with real-time feedback. Click **Validate Topology** to re-evaluate the graph deterministically.

---

## Security Validation Intelligence (Phase 1.4)

PathForge's deterministic validator consumes rich semantic configuration:

- **Configuration-Aware Exposure**: Distinguishes ports, protocols, and access policies. Recognizes standard database listeners (`5432`, `3306`, `27017`, `6379`, `1433`) and administrative listeners (SSH `22`, RDP `3389`).
- **DENY Edge Reachability Filtering**: Configured `DENY` edges represent active defensive packet filters and are **never** treated as reachable exposure paths.
- **Contextual Management Access**: Understands that `Management → Admin :22` is legitimate administrative workflow, while `Internet → Admin :22` represents critical public exposure.
- **Contextual Broad Access**: Differentiates public wildcard ingress targeting sensitive internal tiers (High severity) from internal low-risk interconnects, while exempting `DENY ANY` firewall rules.
- **Transport Security Enforcement**: Analyzes encryption toggles and protocol security across perimeter and database boundaries.
- **Structured Finding Evidence**: Every finding packages structured machine-readable evidence (`sourceNode`, `sourceZone`, `targetNode`, `targetZone`, `targetCriticality`, `protocol`, `ports`, `access`, `encrypted`).

---

## Security Rule Catalog

| Rule ID | Rule Name | Severity | Category | Semantic Security Focus |
| :--- | :--- | :--- | :--- | :--- |
| **PF-001** | Public Database Exposure | `critical` | `exposure` | Flags direct allow ingress from untrusted networks to databases, caches, or standard DB ports (`5432`, `3306`, etc.) |
| **PF-002** | Public Admin Exposure | `high` | `exposure` | Flags administrative consoles or SSH/RDP ports (`22`, `3389`) exposed to untrusted sources, exempting authorized Management zones |
| **PF-003** | Missing Security Boundary | `high` | `network_boundary` | Flags compute workloads or restricted zones directly exposed without perimeter firewall / load balancer inspection |
| **PF-004** | Untrusted → Internal Network | `critical` | `network_boundary` | Flags direct unmediated allow edges bridging public sources into internal subnets or zones |
| **PF-005** | Excessive Trust / Tier Bypass | `medium` | `trust_boundary` | Flags presentation tiers directly querying databases when API tiers exist, or inappropriate `trust` relationships across boundaries |
| **PF-006** | Invalid / Anomalous Topology | `medium` | `topology_anomaly` | Flags circular self-loops, orphaned isolated nodes, and reverse database egress targeting public internet |
| **PF-007** | Overly Broad Access | `high` | `access_control` | Flags wildcard ports or protocols on allow edges reaching sensitive tiers, exempting default-deny filtering rules |
| **PF-008** | Unencrypted Sensitive Communication | `high` | `access_control` | Flags cleartext unencrypted communication channels terminating at databases, restricted zones, or critical assets |
| **PF-009** | Service / Connection Mismatch | `medium` | `topology_anomaly` | Detects unambiguous port or protocol conflicts where edge traffic targets a port different from the listening service definition |

---

## Finding Explanation & Safe Remediation UX (Phase 1.5)

PathForge transforms raw validator findings into deep, actionable security engineering investigations:

- **6-Dimensional Deep Dive**: Every finding provides comprehensive diagnostic intelligence covering:
  1. *What is Wrong & Why It Matters* — Clear risk context.
  2. *Threat Impact & Exploitation Scenario* — Attacker capabilities, lateral movement vectors, and data exfiltration scenarios.
  3. *Recommended Architecture* — Visual contrast of the flawed topology flow against the recommended defense-in-depth pattern.
  4. *Concrete Fix Guidance* — Exact topological and configuration steps required.
  5. *Structured Machine Evidence* — Specific protocols, ports, access policies, encryption states, zones, and criticality involved.
  6. *Safe Remediation Actions* — Deterministic domain actions ready for execution.
- **Locate on Canvas**: Instantly center and zoom to any affected node or edge on the canvas via the "Locate on Canvas" action. Hovering over any finding in the drawer dynamically highlights affected elements on the canvas with an animated target pulse.
- **Architectural Pattern Comparison**: Visual schematics contrasting current insecure communication paths with multi-tier isolation, DMZ reverse proxies, VPN/bastion jump hosts, and least-privilege policies.
- **Safe Deterministic Remediation**: One-click safe graph remediations (`deny-edge`, `remove-edge`, `enable-encryption`, `restrict-port`, `align-port`) backed by `@pathforge/validator/remediation`.
- **Safety Confirmation Modal**: Remediation requires explicit confirmation detailing graph domain impacts and policy changes before modifying authoritative domain models.
- **State Discipline**: Applying a remediation updates the domain model and immediately transitions validation to **STALE** state (`Topology Modified — Validation Stale`). Findings are only considered resolved once the user clicks **Validate Topology**.
- **Resolution Tracking & Feedback**: Revalidation compares prior findings with current findings to compute resolved issues, displaying celebratory resolution notifications (`🎉 1 Finding Resolved! (PF-001)`).
- **Finding Filters & Empty States**: Filter findings by Severity (Critical, High, Medium, Low), Category (Exposure, Boundary, Access Control, Trust Boundary, Topology), or affected Asset, with professional empty states for clean topologies and filtered subsets.

---

## Fix Verification & Before/After Comparison (Phase 1.6)

PathForge enforces the core product principle: **"A fix is not proven until the environment is revalidated."**

- **Immutable Validated Baseline Snapshots**:
  Every completed validation captures an immutable baseline snapshot (`createEnvironmentSnapshot`). The baseline is deep-cloned and frozen (`Object.freeze`), guaranteeing that ongoing workspace edits or live domain mutations never alter the verified baseline.
- **Deterministic Infrastructure Diff Engine**:
  `diffEnvironments` deterministically compares the baseline snapshot with the current environment to identify:
  - Added, removed, and reconfigured nodes (zone, criticality, CIDR, service port/protocol).
  - Added, removed, and reconfigured edges (access policy `allow` ↔ `deny`, unencrypted ↔ encrypted TLS, port restrictions).
  - **Position Independence**: Node layout coordinates $(x, y)$ are purely presentational and explicitly excluded from configuration diffs, generating zero security changes.
- **Fix Verification Engine**:
  `verifyFix` partitions security findings between baseline and current validation:
  - **Resolved Findings** ($\text{Before} - \text{After}$): Verified eliminated issues.
  - **Still Present Findings** ($\text{Before} \cap \text{After}$): Unresolved violations.
  - **New Findings** ($\text{After} - \text{Before}$): Regressions or issues introduced by the fix.
- **Deterministic Resolution Classification**:
  Classifies resolutions into precise engineering actions:
  - `policy-change`: Access policy switched from `ALLOW` to `DENY`.
  - `encryption-change`: Unencrypted transport upgraded to TLS/SSH encryption.
  - `port-restriction`: Wildcard (`ANY`) restricted to specific service port.
  - `edge-removal`: Direct insecure connection severed from graph.
  - `node-reconfiguration`: Zone/criticality hardened to satisfy boundary rules.
  - `topological-isolation`: Path reachability broken via upstream mediation.
- **Regression Detection & Integrity Defense**:
  If a remediation resolves one vulnerability but introduces a new violation (e.g., resolving `PF-001` while exposing `PF-002`), PathForge marks verification status as `requires-attention` (`VERIFICATION REQUIRES ATTENTION`) and keeps the production gate `BLOCKED`.
- **Production Gate & Summary Deltas**:
  Computes metric deltas for Critical, High, Medium, and Low severities and models compliance gate transitions (`BLOCKED` → `PASSED`).
- **Interactive Verification UX**:
  The Findings Drawer features dual-mode header tabs (`ACTIVE FINDINGS` vs `FIX VERIFICATION`) with real-time status badges, summary delta cards, Before vs After flow comparisons, regression alerts, and an infrastructure delta log.

---

## Demo Environment Library & Chaos Lab (Phase 1.7)

PathForge provides a deterministic Scenario Lab and a permissive Chaos engineering environment:

- **Scenario Library**:
  1. **Secure Web Application** (`secure-web-app`): Production-ready reference architecture (`Internet → Firewall → LB → Web → API → Database & Redis`) with defense-in-depth perimeter inspection, proper zone segmentation, and zero critical/high findings (`Production Gate: PASSED`).
  2. **Public Database Exposure** (`public-db-exposure`): Intentional single-flaw anti-pattern (`Internet → Database` over cleartext 5432) designed for practicing the complete `Find → Explain → Fix → Revalidate → Prove` loop.
  3. **Flat / Poorly Segmented Network** (`flat-network`): Inexperienced-engineer anti-pattern where Internet is bridged directly to an internal switch co-locating Web, API, Database, and Admin systems without firewall boundaries or tier segmentation.
  4. **Chaos Lab** (`chaos-lab`): Deliberately compromised experimental sandbox modeling direct database exposure, public SSH admin console, unmediated internal network bridging, and unencrypted wildcard DB access.
- **Permissive Chaos Interaction Principle**:
  PathForge never silently blocks users from creating insecure architecture. Users can freely create `Internet → Database`, `Internet → Admin`, `Web → Database : ANY`, or cross-boundary trust links. Insecure architecture is permitted and analyzed, empowering users to learn through hands-on experimentation.
- **Safe Scenario Reset**:
  Users can reset any active scenario back to its pristine definition at any time. Resetting replaces the domain model, recalculates findings, establishes a fresh baseline snapshot, and completely purges stale cross-scenario verification states.
- **First-Run Canvas Experience**:
  When opened without a loaded environment, the workspace presents an engineering-focused workflow guide (`1. Validate → 2. Fix → 3. Prove`) with direct quick-load triggers, preserving the large interactive grid as the primary surface.

---

## Verification Reports & Engineering Export (Phase 1.8)

PathForge makes verification results portable outside the application, enabling engineers to generate concrete proof that misconfigurations have been resolved:

- **Deterministic Verification Reports (`VerificationReport`)**:
  Assembles domain-level proof models containing metadata, executive summaries, before/after security delta tables, resolved findings with verification proofs, unresolved issues, regression warnings, and the authoritative production gate state (`PASSED` vs `BLOCKED`).
- **Truthful Semantics (Discipline Principle)**:
  PathForge never manufactures a false PASS. When evaluated without a baseline snapshot, reports truthfully indicate `NO BASELINE AVAILABLE` and evaluate current compliance without fictitious before/after deltas. When regressions exist, reports issue prominent warnings and hold the gate `BLOCKED`.
- **4 Comprehensive Export Formats**:
  1. **Markdown (`.md`)**: GitHub-flavored engineering artifact featuring metadata tables, metric deltas, visual flow comparison boxes (`BEFORE: Internet → [ALLOW] → DB` vs `AFTER: Internet → [DENY] → DB`), and audit trails.
  2. **JSON (`.json`)**: Machine-readable schema representation of the verification report for pipeline automation and external audit tooling.
  3. **Printable HTML (Print to PDF)**: Standalone, print-optimized HTML (`@media print`, `@page`) with zero external network dependencies, ready for browser `Print → Save as PDF` with a ₹0 footprint.
  4. **Vector Architecture Diagram (`.svg`)**: Standalone vector graphic preserving critical security semantics: green/blue arrows for allowed traffic, transport encryption `[TLS]` tags, dashed red lines with `[DENY]` markers, zone color headers, and service port pills.
- **Compact Engineering Export UX**:
  Integrated export toolbar in the `VerificationPanel` and a drop-down export menu in `TopNav` provide instant downloads (`.md`, `.json`, `.svg`) and print previews.
- **Accessibility & Keyboard Polish**:
  All modal dialogs (`ScenarioModal`, `ResetScenarioModal`, `RemediationModal`) support `Escape` key dismissal, backdrop click closing, `role="dialog"`, `aria-modal="true"`, and accessible focus outlines.

---

## Attack Path Analysis Foundation (Phase 2.1)

PathForge provides deterministic graph-based attack path analysis answering:
> *"Starting from an attacker-controlled entry point, what sensitive assets can actually be reached through the modeled infrastructure?"*

- **Authoritative Domain Engine (`@pathforge/core/attack-path`)**:
  - **Entry Point Detection**: Discovers untrusted ingress (`zone === 'public'` or component types `internet` / `external_network`).
  - **Sensitive Target Discovery**: Identifies critical crown jewels (`criticality === 'critical'` | `'high'`, `zone === 'restricted'`, or database/cache/admin/vpn systems).
  - **Deterministic Directed BFS**: Explores shortest attack routes strictly over directed `ALLOW` edges, terminating at configured `DENY` barriers and cycle loops.
  - **Trust Boundary Transitions**: Monitors and records every zone transition (e.g., `public` $\to$ `internal` $\to$ `restricted`).
  - **Multi-Hop Traversal Facts**: Every path produces structured `TraversalStepFact` records describing step index, source/target nodes, protocols, ports, access policies, and zone boundary explanations.
  - **Explainable Risk Scoring**: Deterministically categorizes paths as `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` based on target sensitivity, hop depth, and trust boundaries crossed.
- **Dedicated Attack Paths Panel (`AttackPathsPanel`)**:
  - Path inventory cards with risk badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
  - Multi-dimensional filters (Risk level, Entry point origin, Target criticality).
  - Full step-by-step traversal breakdown showing each hop, protocol, and trust boundary crossed.
  - "Why This Path Exists" deterministic facts and "Risk Factors" explanation.
  - "Locate Target" canvas action to instantly center and inspect the exposed crown jewel.
- **Interactive Canvas Highlighting**:
  - Selecting an attack path highlights the entire adversarial flow in crimson: dashed crimson edges (`#f85149`, stroke-width: 2.5) and glowing crimson node borders with `[PATH]` badges.

---

## Blast Radius & Lateral Movement Analysis (Phase 2.2)

PathForge provides deterministic lateral movement analysis answering:
> *"If this asset is compromised, what else can an attacker reach from it?"*

- **Authoritative Domain Engine (`@pathforge/core/blast-radius`)**:
  - **Compromised Origin Definition**: Accepts any modeled infrastructure asset as an assumed post-compromise beachhead.
  - **Directed Lateral Traversal**: Conducts directed BFS strictly over permitted `ALLOW` egress edges; `DENY` barriers block lateral progression completely.
  - **Strict Directionality & Isolation**: Upstream nodes cannot be reached unless reverse edges exist; visual $(x, y)$ coordinates do not alter topology.
  - **Shortest Lateral Depth**: Computes the minimal number of hops required to reach each downstream asset (`lateralDepth`).
  - **Trust Boundary Transitions**: Tracks zone crossings (e.g., `DMZ` $\to$ `Internal` $\to$ `Restricted`), grouping identical transitions to avoid artificial metric inflation.
  - **Deterministic Impact Assessment**: Classifies post-compromise blast radius into `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` based on reachable asset criticality, volume, and boundary crossings.
  - **Structured Explanations**: Produces numbered deterministic explanation facts ("Why this blast radius exists") and concrete lateral risk factors.
- **Dedicated Blast Radius Panel (`BlastRadiusPanel`)**:
  - Interactive compromised asset selector with quick-select triggers.
  - Summary metrics: Reachable Assets, Lateral Depth, Boundary Crossings, Critical Assets at Risk.
  - Impact severity badge (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) with detailed explanation.
  - Granular lateral movement steps table with per-hop protocol, port, and zone rationale.
  - Cross-tool integration: "Analyze Blast Radius" triggers from `InspectorPanel` and `AttackPathsPanel`.
- **Interactive Canvas Visualization**:
  - Compromised origin asset highlighted with pulsating amber ring (`#f0883e`) and `[COMPROMISED]` badge.
  - Downstream reachable assets ringed in purple (`#a371f7`) with depth pills (`LATERAL (+1)`, `LATERAL (+2)`), or crimson if high-value/critical (`CRITICAL (+1)`).
  - Traversed lateral edges styled with purple dashed lines (`strokeDasharray: '4 2'`) and purple arrowheads (`#a371f7`).

---

## Risk-Weighted Attack Paths & Reachability Intelligence (Phase 2.3)

PathForge introduces deterministic risk-weighted prioritization answering:
> *"Which reachable attack paths are actually the most dangerous, why are they dangerous, and what makes one path worse than another?"*

> [!NOTE]
> **Important Engineering Principle**: PathForge risk scores prioritize modeled architectural exposure. They are not probabilities of real-world compromise.

- **Authoritative Risk Intelligence Layer (`@pathforge/core/attack-path/risk.ts`)**:
  - **Decoupled Architecture**: Graph traversal discovers reachable paths via deterministic BFS, while the dedicated risk layer scores and prioritizes them without altering traversal semantics.
  - **Deterministic 0–100 Integer Risk Score**:
    - `75–100`: **CRITICAL** (immediate crown-jewel exposure, public DB access, shallow traversal to restricted assets).
    - `50–74`: **HIGH** (multi-tier deep paths to critical assets, high-criticality targets, multiple boundary crossings).
    - `25–49`: **MEDIUM** (limited exposure, internal targets, medium criticality).
    - `0–24`: **LOW** (isolated or low-value targets).
  - **Observable Risk Factors**: Evaluates entry exposure (Internet vs DMZ vs Internal), target business criticality (`critical`, `high`, `medium`), sensitive asset roles (database, admin, redis), path depth (direct 1-hop vs shallow vs deep), trust boundaries crossed, wildcard ports/ANY protocol, and cleartext sensitive traffic.
  - **Mitigating Architectural Defenses**: Encrypted communication (TLS/SSH), multi-tier intermediate segmentation (firewalls, reverse proxies), and discrete port restrictions reduce the raw risk score.
  - **Dominant Factor Extraction**: Automatically extracts the top contributing factors justifying the path's risk level.
- **Reachability Intelligence & Prioritization**:
  - **Most Dangerous Path**: Deterministically ordered by risk score descending, risk severity descending, target criticality descending, hop count ascending, and stable ID.
  - **Most Exposed Asset**: Identifies the crown jewel reached through the greatest number of distinct attacker entry points.
  - **Entry Point Exposures**: Calculates reachable asset counts, sensitive targets, critical targets, and maximum boundary penetration per entry point.
- **Enhanced Attack Paths UI (`AttackPathsPanel`)**:
  - Header intelligence banner with quick-jump triggers to the **Most Dangerous Path** and **Most Exposed Asset**.
  - Risk cards displaying color-coded risk levels and scores (e.g., `CRITICAL · 92`).
  - Deep **Risk Assessment** inspection card displaying score progress bar, dominant factors, contributing factors with weights, and verified mitigating defensive controls.

---

## Architecture Analysis Intelligence (Phase 2.4)

PathForge introduces deterministic architectural intelligence answering Level 3 security reasoning:
> *"Why is this infrastructure structurally difficult to secure or operate?"*

While Phase 1 validation rules evaluate specific edges and listeners, Phase 2.4 analyzes the systemic structural integrity of the entire topology:

- **Tier Inference Engine (`@pathforge/core/architecture/tiers.ts`)**:
  - Deterministically maps infrastructure components to architectural layers: `edge`, `perimeter`, `application`, `data`, `management`, and `internal`.
  - Cautious classification: unrecognized or custom components receive `tier: 'unknown'` with low confidence without forced artificial labeling.
  - Detects layered architecture patterns, tier bypasses, and direct edge-to-data ingress.
- **Topology & Segmentation Analysis (`@pathforge/core/architecture/topology.ts`)**:
  - Summarizes security zones and cross-zone transition boundaries.
  - Evaluates segmentation quality (`strong`, `moderate`, `weak`, `flat`).
  - Detects flat internal network topologies where disparate compute and data workloads are lumped into unsegmented subnets.
- **Dependency & Structural Fragility (`@pathforge/core/architecture/dependencies.ts`)**:
  - Computes in-degree, out-degree, and total degree connectivity for all nodes.
  - Identifies single points of failure (SPOF) with cautious engineering language: *"Potential single point of failure: only 1 component modeled. If un-replicated in production, failure directly impacts downstream dependencies."*
  - Evaluates dependency concentration rating (`low`, `moderate`, `high`) identifying centralized infrastructure bottlenecks.
- **Architectural Findings Catalog (`ARCH-001` through `ARCH-007`)**:
  - **ARCH-001** (`critical`): Direct Ingress to Data Tier (unmediated ingress bypassing application layer).
  - **ARCH-002** (`high`): Missing Application Tier (perimeter connects directly to data tier).
  - **ARCH-003** (`high`): Flat Internal Network Topology (heterogeneous compute/data co-located without boundaries).
  - **ARCH-004** (`high`): Privileged Management Exposure (administrative planes reachable from untrusted zones).
  - **ARCH-005** (`medium`): High Centralized Dependency Concentration (critical single component handling high fan-in/fan-out).
  - **ARCH-006** (`high`): Potential Single Point of Failure (un-replicated component whose loss severs vital services).
  - **ARCH-007** (`medium`): Weak Perimeter Segmentation (direct ingress to compute without perimeter inspection).
- **Explainable 0–100 Architecture Score**:
  - Rating bands: `EXCELLENT` (90–100), `GOOD` (75–89), `FAIR` (50–74), `POOR` (25–49), `CRITICAL` (0–24).
- **Interactive Architecture UI (`ArchitecturePanel`)**:
  - Health score banner with color-coded rating pill and itemized score deduction list.
  - Structural profile metrics (Segmentation Quality, Tier Separation, SPOF Count, Dependency Concentration).
  - Category filters (`ALL`, `TIER_BYPASS`, `SEGMENTATION`, `DEPENDENCY`, `MANAGEMENT`).
  - Deep finding cards with "Why It Matters", observable graph facts, and actionable recommendations.
  - One-click "Locate" canvas action centering and highlighting affected components.

---

## Production Readiness Assessment (Phase 2.5)

PathForge introduces a deterministic **Production Readiness Assessment** layer, answering Level 4 operational security intelligence:
> *"Is this modeled environment actually ready to operate safely in production?"*

Rather than a generic scorecard, PathForge composes all existing intelligence layers (validation rules, adversarial attack paths, lateral blast radius, tier separation, and structural resilience) into a gate-driven operational readiness evaluation:

- **Authoritative Readiness Domain Engine (`@pathforge/core/production-readiness`)**:
  - **Gate-Driven Status**:
    - `READY`: All production gates satisfied.
    - `READY_WITH_WARNINGS`: Non-blocking resilience or multi-tier internal warnings present.
    - `NOT_READY`: One or more critical production gates are `BLOCKED`.
    - `INSUFFICIENT_EVIDENCE`: Insufficient infrastructure components modeled to evaluate production posture.
  - **Separation of Status & Rating**:
    - Status is strictly gate-driven; score alone cannot override a blocked critical gate (e.g. an environment with an 85+ score remains `NOT_READY` if public database access exists).
    - Qualitative rating is score-driven: `EXCELLENT` (90–100), `GOOD` (75–89), `NEEDS_ATTENTION` (50–74), `POOR` (25–49), `CRITICAL` (0–24).
- **6 Deterministic Production Gates**:
  1. **Gate 1 — Critical Security**: BLOCKS on unresolved critical validation findings, critical attack paths, or direct exposure of crown-jewel assets.
  2. **Gate 2 — High-Risk Exposure**: BLOCKS on untrusted management exposure or shallow high-risk attack paths; WARNS on deep mediated multi-tier reachability.
  3. **Gate 3 — Network Architecture**: BLOCKS on direct edge-to-data ingress (`ARCH-001`) or missing compute tiers (`ARCH-002`); WARNS on flat internal topologies (`ARCH-003`).
  4. **Gate 4 — Resilience & Redundancy**: WARNS on potential single points of failure (`ARCH-006`) or high dependency concentration (`ARCH-005`). Never makes false HA claims.
  5. **Gate 5 — Communication Security**: BLOCKS on cleartext sensitive communication (`PF-008`); verifies TLS/SSH encryption on database pathways.
  6. **Gate 6 — Operational Evidence Sufficiency**: Truthfully classifies runtime operational controls as `LIMITED` evidence, acknowledging that backups, monitoring, and DR cannot be observed from a network topology model.
- **7 Weighted Readiness Categories**:
  - Security Posture (30%)
  - Attack Exposure (20%)
  - Network Architecture (20%)
  - Access Control (10%)
  - Communication Security (10%)
  - Resilience & Fragility (5%)
  - Operational Evidence Coverage (5%)
- **Truthful Engineering Disclosure (10 Evidence Gaps)**:
  - Backups & snapshots, disaster recovery & failover, monitoring telemetry, security alerting, OS patching, secret rotation, IAM/SSO authentication, incident response runbooks, deployment gates, and runtime daemon health are explicitly classified as `UNVERIFIED` evidence gaps, not fabricated failures.
- **Interactive UI (`ProductionReadinessPanel`)**:
  - Header banner with status badge (`PRODUCTION READY` vs `NOT PRODUCTION READY`), readiness score bar, rating pill, gate counters, and executive verdict.
  - Section filters: `ALL`, `GATES`, `CATEGORIES`, `BLOCKING`, `STRENGTHS`, `GAPS`.
  - Detailed Gate cards with compliance status, summaries, reasons, and evidence badges.
  - Category breakdown bars with explainable deductions and observations.
  - Blocking reasons with one-click "Locate Asset" canvas action and actionable remediation steps.
  - Non-blocking resilience warnings with canvas locator.
  - Modeled strengths checklist and operational evidence gap disclosures.
  - Actionable Recommended Next Steps.

---

## Testing Intelligence & Verification Coverage (Phase 2.6)

PathForge adds a deterministic **Testing Intelligence** layer that evaluates the modeled infrastructure and its verification evidence, answering:

> *"How well is this modeled infrastructure protected by verification and test coverage, and where are important security/architecture assumptions currently unverified?"*

> [!NOTE]
> **Scope & Limitations**: Testing Intelligence measures verification evidence represented in PathForge; it is **not** a replacement for application test suites, CI systems, runtime monitoring, or real production validation. It does not connect to external GitHub/CI systems or make assumptions about unmodeled software codebases.

- **Authoritative 20-Property Security Catalog (`@pathforge/core/testing-intelligence`)**:
  - **Network Security**:
    - `public-ingress-control` (Critical): Untrusted ingress constrained to designated perimeter entry points.
    - `database-isolation` (Critical): Databases isolated from public ingress and only accessible from authorized compute tiers.
    - `management-plane-isolation` (High): Administrative bastions and management planes isolated from untrusted ingress.
    - `network-segmentation` (High): Components partitioned into distinct trust zones with boundary enforcement.
    - `deny-boundary-enforcement` (High): Configured DENY packet filtering rules deterministically block unauthorized reachability.
  - **Communication Security**:
    - `sensitive-traffic-encryption` (Critical): Sensitive database and cache communication channels require transport encryption (TLS/SSH).
    - `secure-protocol-enforcement` (High): Communication links operate over secure encrypted protocols rather than cleartext.
  - **Access Control**:
    - `least-privilege-access` (High): Access policies specify discrete port numbers without open wildcard access.
    - `wildcard-access-prevention` (Critical): Ingress links prohibit `ANY:ANY` wildcard port permissions.
    - `administrative-access-restriction` (High): Administrative protocols (SSH 22, RDP 3389) restricted from untrusted ingress.
  - **Attack Resistance**:
    - `critical-asset-reachability` (Critical): Zero direct or critical attack paths reach crown jewel assets.
    - `high-risk-attack-path-prevention` (High): Zero unmediated critical-risk or direct high-risk paths from untrusted ingress to internal assets.
    - `lateral-movement-containment` (High): Trust zone boundaries prevent unrestricted lateral traversal across workloads.
    - `blast-radius-control` (Normal): Compromise blast radius is constrained by zone segmentation.
  - **Architecture Integrity**:
    - `tier-separation` (Critical): Enforces distinct multi-tier separation without direct edge-to-data bridging.
    - `dependency-concentration` (Normal): Workload dependencies avoid excessive architectural fan-in concentration.
    - `single-point-of-failure-detection` (Normal): Detects critical assets operating without redundancy.
    - `perimeter-boundary` (High): Perimeter firewalls or load balancers mediate external untrusted ingress.
  - **Remediation & Regressions**:
    - `finding-resolution-verification` (Critical): Remediated findings are mathematically proven resolved against baseline snapshots.
    - `regression-detection` (High): Topology modifications are continuously verified against baseline to guarantee zero newly introduced regressions.

- **Evidence Model & Sources**:
  - `unit-test`: Directly verified by automated validation rule evaluations.
  - `scenario`: Verified by reference catalog scenarios (e.g. `secure-web-app`, `public-db-exposure`).
  - `fix-verification`: Verified by immutable baseline comparisons and revalidation cycles.
  - `regression-test`: Verified through fix verification regression suites.
  - `model-invariant`: Proven by deterministic graph topology invariants (e.g., zero reachable attack paths, explicit DENY edges).
  - `manual-verification`: Verified via explicit engineer-driven remediation confirmation.

- **Coverage Statuses & Scoring Formulation**:
  - `VERIFIED`: Evidence fully supports the property (full weight: 1.0).
  - `PARTIAL`: Property partially modeled or mediated (half weight: 0.5).
  - `UNVERIFIED`: Property assumption is unverified, violated, or unmodeled (zero weight: 0.0).
  - Importance Weighting: Critical properties = weight 3; High properties = weight 2; Normal properties = weight 1.
  - Score Formula: $\mathrm{round}\left(\frac{\sum (\text{weight} \times \text{earnedFactor})}{\sum \text{weight}} \times 100\right)$.
  - Tiers Computed: `criticalCoverage`, `highCoverage`, `normalCoverage`, and `overallCoverage` (0–100 integer).
  - Qualitative Levels: `EXCELLENT` (90–100), `GOOD` (75–89), `MODERATE` (50–74), `WEAK` (25–49), `INSUFFICIENT` (0–24).
  - Zero Fabricated Coverage: Empty or single-node topologies deterministically return score `0` and level `INSUFFICIENT`.

- **Structured Coverage Gaps**:
  - Gaps automatically generated for unverified or partially verified properties.
  - Severity Mapping: Critical unverified $\to$ `HIGH` gap; High unverified $\to$ `MEDIUM` gap; Normal unverified $\to$ `LOW` gap.
  - Deterministically sorted by severity priority, then property identifier.
  - Contains "Why It Matters", actionable "Recommended Verification Test", and interactive canvas "Locate" button.

- **Deterministic Regression Intelligence**:
  - `healthy`: Baseline active and zero reintroduced findings.
  - `regressions-detected`: Explicit warning listing exact rule IDs of reintroduced flaws.
  - `no-baseline`: Explicitly states no baseline exists rather than fabricating historical data.

- **Interactive UI (`TestingIntelligencePanel`)**:
  - Integrated as **Tab 7: `TESTING (${score}/100)`** in `FindingsDrawer` with `FlaskConical` icon.
  - Engineering verification console styling with level badge and summary sentence.
  - Progress bars for Critical, High, and Overall coverage.
  - Category breakdown cards across all 6 functional categories with scores and counts.
  - Filterable security properties catalog (`ALL`, `VERIFIED`, `PARTIAL`, `UNVERIFIED`).
  - Interactive "Locate Asset" buttons syncing with the canvas highlight ring.
  - Ordered deterministic test recommendations.

---

## Technical Debt & Engineering Risk Tracking (Phase 2.7)

PathForge provides a deterministic **Technical Debt & Engineering Risk Tracking** layer. Rather than simply identifying today's active vulnerabilities, this intelligence layer tracks engineering shortcuts and structural compromises that make the modeled infrastructure harder to secure, operate, evolve, and verify over time.

- **Authoritative Debt Pattern Catalog (`TD-001` through `TD-022`)**:
  - **Security Debt (`TD-001`–`TD-004`)**: Public sensitive asset exposure, unencrypted transport links, excessive trust relationships, broad network access.
  - **Architecture Debt (`TD-005`–`TD-008`)**: Flat internal network topologies, tier bypasses, weak perimeter segmentation, fan-in dependency concentration.
  - **Resilience Debt (`TD-009`–`TD-010`)**: Single points of failure in core infrastructure roles, critical asset bottleneck concentration.
  - **Access-Control Debt (`TD-011`–`TD-013`)**: Wildcard `ANY:ANY` port/protocol allowances, administrative reachability, broad port ranges.
  - **Testing Debt (`TD-014`–`TD-016`)**: Missing verification for critical security properties, missing regression baseline, unverified high-risk properties.
  - **Operational Debt (`TD-017`–`TD-019`)**: Missing operational evidence, unverified recovery/backup controls, unverified telemetry/alerting pipelines.
  - **Complexity Debt (`TD-020`–`TD-022`)**: Extreme connectivity concentration, excessive trust boundaries traversed, dense mesh topology ratios.

- **Deterministic Prioritization & P0–P3 Scoring**:
  - Transparent 0–100 integer score incorporating:
    - Base severity points (`CRITICAL`: 40, `HIGH`: 30, `MEDIUM`: 20, `LOW`: 10)
    - Crown jewel or sensitive asset involvement (+10 to +20)
    - Untrusted ingress reachability context from attack path intelligence (+20)
    - Multi-component architectural scope (+10)
    - Verification gap (+5 to +10)
  - Strict deterministic tiers:
    - `P0`: Critical security or architecture debt with active untrusted reachability (score 80–100).
    - `P1`: High-severity structural debt or unverified critical verification assumptions (score 60–79).
    - `P2`: Medium-severity structural compromises or missing verification (score 35–59).
    - `P3`: Low-severity cleanup, minor complexity, or informational debt (score 0–34).
  - Strict tie-breaking: `priorityScore (desc) → severity (desc) → category (asc) → id (asc)`.

- **Truthful Governance & Boundary Rules**:
  - **₹0 Operating Model & No Monetary Fiction**: Zero fake dollar estimates (`$14,500 remediation cost`) or invented developer-hours. Prioritization is derived entirely from structural graph properties.
  - **Explicit Scope Disclosures**: Runtime operational controls (backups, metrics, alert pipelines) are explicitly classified as `UNVERIFIED` evidence debt rather than pretending to scan external cloud hypervisors.
  - **Revalidation-Verified Resolution**: Debt items are only marked `MITIGATED` when an immutable revalidation comparison snapshot confirms that the underlying flaw has been resolved.

- **Interactive UI (`TechnicalDebtPanel`)**:
  - Integrated as **Tab 8: `DEBT (${activeCount} active)`** in `FindingsDrawer` with `Coins` icon.
  - Health Score (`0–100`) and Rating badge (`LOW_DEBT`: 90–100, `MANAGEABLE`: 75–89, `ELEVATED`: 50–74, `HIGH`: 25–49, `SEVERE`: 0–24).
  - Active, P0, P1, P2, P3, Mitigated, and Unverified metric counters.
  - Priority and status filter toolbars (`ALL`, `P0`, `P1`, `P2`, `P3`, `ACTIVE`, `MITIGATED`, `UNVERIFIED`).
  - Detailed backlog cards showing "Why It Matters (Future Engineering Cost)", transparent priority factors, evidence sources, and "Locate" canvas buttons.
  - Categories & Spread overview card grid.
  - Deterministic step-by-step Resolution Roadmap.

---

## Phase 3.1 — Continuous Engineering & Change Analysis Foundation

PathForge provides a deterministic **Continuous Engineering & Change Analysis** foundation that compares two infrastructure snapshots (`before` and `after`) to answer: *"What changed, and did that change make the modeled environment more or less secure?"*

- **The Continuous Engineering Loop**:
  ```text
  Model → Analyze → Change Infrastructure → Compare Before/After → Detect New Risk → Detect Resolved Risk → Detect Security Regression → Verify Change
  ```

- **Domain Change Model**:
  - `NODE_ADDED`: Added infrastructure asset with initial configuration.
  - `NODE_REMOVED`: Removed asset with all associated relationships.
  - `NODE_CONFIG_CHANGED`: Mutations to zone, criticality, CIDR, or listening services.
  - `EDGE_ADDED`: New relationship or communications link introduced.
  - `EDGE_REMOVED`: Relationship deleted.
  - `EDGE_CONFIG_CHANGED`: Policy updates (`allow` ↔ `deny`), encryption state changes, protocol/port restriction adjustments.

- **Deterministic Security Significance Classification**:
  Every discrete change is categorized with an explicit rationale:
  - `security-increasing`: Hardening change (e.g. converting `allow` to `deny`, enabling encryption, removing public exposures).
  - `security-decreasing`: Weakening change (e.g. converting `deny` to `allow`, disabling encryption, introducing unsegmented untrusted links).
  - `security-neutral`: Layout or naming adjustment with zero security or reachability impact (e.g. renaming, description change, position movement).
  - `security-ambiguous`: Complex topology mutation requiring contextual revalidation (e.g. rewiring intermediate nodes or replacing nodes).

- **Multi-Dimensional Intelligence Deltas**:
  - **Risk Deltas**: Compares validated finding signatures, categorizing risks into `newlyIntroduced`, `resolved`, and `unchanged`.
  - **Regression Detection**: Formally flags `regressionDetected: true` when a change resolves $\ge 1$ existing risks while simultaneously introducing $\ge 1$ new security risks.
  - **Attack Path Deltas**: Evaluates newly added attack paths, eliminated paths, and reachability/risk score changes across attacker entry points.
  - **Architecture Deltas**: Structural shifts in tier bypasses, flat topologies, untrusted data ingress links, management plane exposure, and dependency concentration.
  - **Production Readiness Deltas**: Before vs after readiness scores, rating shifts (`NOT_READY` ↔ `READY`), and newly introduced or resolved readiness blockers/warnings.
  - **Technical Debt Deltas**: Quantitative debt score deltas, net P0/P1 debt change, newly introduced debt items, and resolved debt items.

- **Deterministic Change Impact Scoring**:
  Overall change impact is computed into transparent levels:
  - `CRITICAL`: Introduces critical findings, creates untrusted critical asset attack paths, introduces readiness blockers, or adds P0 technical debt.
  - `HIGH`: Introduces high findings, adds attack paths, introduces architecture regressions, or adds P1 debt.
  - `MEDIUM`: Medium-severity risk or debt changes, or non-critical configuration alterations.
  - `LOW`: Purely hardening or neutral changes with zero new risks.

- **Interactive UI (`ChangeAnalysisPanel`)**:
  - Integrated as **Tab 9: `CHANGES`** in `FindingsDrawer` with `GitCompare` icon.
  - Displays Baseline snapshot status badge (`Baseline Active`, `No Baseline`).
  - Overall change impact level badge (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and summary metrics strip (Changes, New Risks, Fixed, Regressions).
  - Prominent red alert banner upon detected security regressions.
  - Sub-tabs: `CHANGES` (with significance pills, category badges, and canvas locate buttons), `RISK DELTA` (resolved vs introduced findings), `ATTACK PATHS` (path deltas and risk shifts), `INTELLIGENCE DELTA` (readiness and technical debt deltas), and deterministic recommendations.

- **Scope Disclosures & Phase 3 Boundaries**:
  - Operates 100% locally with zero cloud dependencies, zero external database requirements, zero telemetry, and ₹0 operating cost.
  - CI/CD pipelines, GitHub PR comment automation, and persistent history tracking are strictly scheduled for subsequent Phase 3 milestones.

---

## Phase 3.2 — Repository Change Ingestion Foundation

PathForge provides a deterministic local **Repository Change Ingestion Foundation** that parses repository and configuration modifications (unified diffs, structured change sets, or file snapshot comparisons) and normalizes them into structured changes and engineering signals.

- **The Normalization Loop**:
  ```text
  Unified Diff / Source Change → Path Normalization & Secret Masking → File Classification → Engineering Signal Derivation → Phase 3.1 Ingestion Bridge
  ```

- **Supported Unified Diff Subset**:
  - Handles added (`new file mode`), deleted (`deleted file mode`), modified, and renamed (`rename from/to`) files.
  - Multi-file diffs and multi-hunk diffs with accurate added, deleted, and context line counting.
  - Binary file markers (`Binary files ... differ` / `GIT binary patch`).
  - Structured parse diagnostics: Malformed headers and hunks produce deterministic parse warnings/errors without crashing.

- **Deterministic Path Normalization**:
  - Converts all separators to forward slashes, strips bounding quotes, resolves `./`, collapses duplicate slashes `//`.
  - Strips git `a/` and `b/` prefixes while preserving `/dev/null` indicators.
  - Strictly rejects absolute paths (`/etc/passwd`, `C:/repo`) and directory traversals (`../`) to guarantee model portability.

- **Deterministic Engineering File Classification**:
  - `infrastructure`: Dockerfiles, compose files, Kubernetes manifests, Helm charts, Terraform (`*.tf`), Pulumi, CloudFormation, Ansible.
  - `cicd`: GitHub Actions (`.github/workflows/`), GitLab CI, CircleCI, Jenkinsfile.
  - `application`: TypeScript, JavaScript, Python, Go, Rust, Java, C#, etc.
  - `security-config`: `.env.example`, OPA policy (`*.rego`), firewall rules (`iptables`, `pf.conf`), auth policies.
  - `dependencies`: `package.json`, lockfiles (`package-lock.json`, `Cargo.lock`, `yarn.lock`), requirements manifests.
  - `documentation`: Markdown, text, docs directory, project licenses.
  - `tests`: Test/spec files (`*.test.ts`, `*.spec.js`, `test_*.py`).
  - `unknown`: Unrecognized files remain explicitly classified as `unknown` without fabrication or guessing.

- **Engineering Signal Derivation**:
  - Detects operational context: `network-config-modified`, `encryption-modified`, `authentication-modified`, `authorization-modified`, `secret-handling-modified`, `infrastructure-manifest-modified`, `dockerfile-modified`, `cicd-security-step-modified`, `tests-added`, `tests-deleted`, `tests-modified`, `dependency-manifest-modified`, `lockfile-modified`.
  - **Truthful Governance Principle**: Signals represent observed developer modifications and hints, **NEVER** vulnerability findings. Filename changes alone never trigger security findings.

- **Security & Secret Masking**:
  - Automatically identifies and masks private keys, AWS access keys (`AKIA...`), GitHub tokens (`ghp_...`), generic API keys (`sk-...`), JWT tokens, and credentials in key-value assignments.
  - Replaces sensitive strings with fixed redaction tags (`[REDACTED_SECRET]`, `[REDACTED_AWS_KEY]`) across diff hunks, patches, and diagnostic logs.

- **Phase 3.1 Bridge & Truthful Governance**:
  - The ingestion layer strictly separates:
    - **Observed repository change**: What files and lines were modified in the repository.
    - **Proven infrastructure/security impact**: Security impact, attack paths, and architectural posture changes are only proven when correlated with modeled before/after infrastructure topologies.
  - Zero topology fabrication: PathForge never invents nodes or edges from source code diffs alone.

- **Interactive UI (`ChangeAnalysisPanel` · Sub-Tab: `CHANGE SOURCE`)**:
  - Integrated directly into the existing `CHANGES` workflow as `CHANGE SOURCE (DIFF)`.
  - Live unified diff editor/textarea with sample preset buttons for manual QA:
    - `App (QA A)`: Application code change demonstrating zero false security impact.
    - `Infra (QA B)`: Kubernetes network policy change triggering downstream evaluation hints.
    - `CI (QA C)`: CI workflow modification detecting security scan step updates.
    - `Secret (QA D)`: Token-bearing diff demonstrating automated credential masking.
  - Live metric counters, category pill badges, parser diagnostics, signal cards, and truthful governance disclosure.

- **Scope Disclosures & Phase 3 Boundaries**:
  - Operates 100% locally with zero cloud dependencies, zero external database requirements, zero telemetry, and ₹0 operating cost.
  - GitHub OAuth, GitHub API, GitHub webhooks, PR comments, and cloud infrastructure are strictly scheduled for future Phase 3 milestones.

---

## Phase 3.3 — Local Git Repository Change Analysis

PathForge Phase 3.3 integrates directly with local Git repositories, enabling practitioners to deterministically inspect differences between commits, branches, or uncommitted workspace modifications without network dependencies or third-party Git services:

- **Strict Read-Only Guarantee & Whitelist Governance**:
  - Whitelist of permitted inspection subcommands: `rev-parse`, `status`, `branch`, `log`, `diff`, `show`, `ls-files`, `remote`, `version`.
  - Mutating operations (`checkout`, `commit`, `push`, `pull`, `fetch`, `reset`, `stash`, `merge`, `rebase`) are strictly forbidden and blocked before invocation.
  - Dangerous shell injection flags (`--exec`, `--ext-cmd`, `-c`, `--config`, `--upload-pack`, `--receive-pack`) are rejected immediately.
  - Non-shell, array-based process spawning with timeout and buffer limits.

- **Deterministic Repository State Discovery**:
  - Recursively discovers repository root from both root paths and deeply nested subdirectories via `git rev-parse --show-toplevel`.
  - Captures current branch, commit SHA, detached HEAD states, and unborn branch scenarios.
  - Inspects staged, unstaged, and untracked file counts via porcelain status parsing.
  - Sorts untracked files deterministically without leaking remote URLs, auth tokens, or private credentials.

- **5 Deterministic Comparison Modes**:
  1. `working-tree-vs-head`: Committed `HEAD` vs working tree modifications (unstaged changes).
  2. `index-vs-head`: Committed `HEAD` vs staged index (`git diff --cached HEAD`).
  3. `working-state-vs-head`: Committed `HEAD` vs full working state.
  4. `commit-vs-commit`: Base commit SHA/ref vs head commit SHA/ref.
  5. `branch-vs-branch`: Base branch vs head branch.
  - Includes rename detection (`-M`) and deterministic untracked file diff block generation when requested.

- **Revision Validation & Semantic Invariant**:
  - Pure deterministic ref sanitization preventing flag injection, shell metacharacters, and path traversal (`../`).
  - Supports two-dot (`base..head`) and three-dot (`base...head`) revision ranges.
  - Commit timestamps are captured strictly for human inspection and display; they never participate in semantic change hashing or risk delta calculations.

- **Phase 3.2 & 3.1 Reuse Pipeline**:
  - Bridges local Git diff directly into Phase 3.2 ingestion (`ingestRepositoryChanges`) and Phase 3.1 change analysis bridge (`bridgeToChangeAnalysis`).

- **Interactive UI Integration (`ChangeAnalysisPanel` · Sub-Tab: `LOCAL GIT & DIFF`)**:
  - Live source toggle between Local Git repository inspection and raw unified diff.
  - Repository directory target input with "Inspect Git Changes" refresh action.
  - Repository state card: Branch badge, Commit SHA badge, `CLEAN`/`DIRTY` status badge, and staged/unstaged/untracked breakdown.
  - Interactive comparison mode selector buttons and revision input fields.
  - Untracked file inclusion toggle.
  - 6 Quick QA verification presets:
    - `QA A`: Clean Working Tree (`working-tree-vs-head`, 0 changes)
    - `QA B`: Modified Working Tree (Application code edit in `src/api.ts`)
    - `QA C`: Staged Changes (Security-sensitive K8s ingress rule in `k8s/network-policy.yaml`)
    - `QA D`: Commit Range (`v1.0.0..HEAD` historical commit comparison)
    - `QA E`: Dirty + Untracked (Unstaged edits + untracked debug notes)
    - `QA F`: Security Config Change (Secret credential token leak)
  - Source disclosure banner and expandable raw unified Git diff viewer.

---

## Getting Started

### Prerequisites

- Node.js `>= 18.0.0` (developed and tested on `v24.21.0`)
- npm `>= 9.0.0` (developed and tested on `11.19.0`)

### Installation

Clone the repository and install workspace dependencies:

```bash
git clone <repository-url>
cd PathForge
npm install
```

### Running Tests

Execute the full Vitest suite (424 unit & integration tests across 26 test files):

```bash
npm run test
```

### Building the Project

Build all packages (`@pathforge/shared`, `@pathforge/core`, `@pathforge/validator`, and `@pathforge/web`):

```bash
npm run build
```

### Running the Web Workspace

Launch the interactive local web development server:

```bash
npm run dev
```

Open your browser at `http://localhost:3000` to interact with the PathForge workspace, toggle between the Standard Secure environment and the Chaos Lab anti-pattern, inspect nodes, and review deterministic explanatory findings.
