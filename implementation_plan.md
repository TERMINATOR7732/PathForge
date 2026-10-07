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

### Phase 1.6 — Pre-packaged Scenario Lab & Exportable Audit Report *(NEXT RECOMMENDED STEP)*
- [ ] Exportable audit report (Markdown / PDF / JSON summary)
- [ ] Library of archetypal infrastructure topologies:
  - Microservices on Kubernetes with Service Mesh
  - Multi-region Cloud Enterprise VPC
  - Fintech payment gateway with PCI-DSS isolation
  - Vulnerable legacy monolith
- [ ] Scenario loader with problem descriptions and learning objectives

### Phase 1.8 — Testing, Accessibility & Polish
- [ ] End-to-end integration tests for canvas interactions
- [ ] Dark/Light mode calibration
- [ ] Keyboard navigation and accessibility auditing

---

## Phase 2 — Attack Simulation (Deterministic Graph Traversal)

### Phase 2.1 — Attack Entry Point Identification
- Identifying untrusted ingress nodes (`internet`, `external_network`, compromised branch)
- Identifying high-value targets (crown jewels: `database`, `admin`, secret stores)

### Phase 2.2 — Reachability & Path Finding Algorithms
- Deterministic graph search (BFS / Dijkstra / All Paths)
- Port & protocol constraint evaluation along candidate paths
- Firewall & security boundary traversal evaluation

### Phase 2.3 — Attack Path Graph Generation & Visualization
- Visualizing animated packet flows along identified attack paths on the canvas
- Step-by-step traversal breakdown showing each hop and trust boundary crossed

### Phase 2.4 — Lateral Movement & Vulnerability Chaining
- Chaining multi-hop pivot points (e.g., `Internet → Public Web → API Server → Database`)
- Exploitation prerequisites modeling per node type

### Phase 2.5 — Risk Scoring & Blast Radius
- Deterministic severity scoring formula (path length, asset value, boundary absence)
- Blast radius calculation (how many downstream nodes can be reached from a compromised node)

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
