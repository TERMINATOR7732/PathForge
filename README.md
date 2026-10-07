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
├── tests/                       # Automated test suite (Vitest — 70 tests passing)
│   ├── node.test.ts             # Node domain lifecycle & mutations
│   ├── edge.test.ts             # Edge domain lifecycle & metadata
│   ├── graph.test.ts            # Graph traversals, degrees, cascading deletions
│   ├── environment.test.ts      # Environment delegation, creation helpers & JSON serialization
│   ├── rules.test.ts            # PF-001 through PF-007 deterministic evaluation
│   ├── demo-environment.test.ts # Verification of standard baseline JSON
│   ├── chaos-loop.test.ts       # Full Build-Break-Defend-Fix lifecycle test
│   ├── editor-integration.test.ts # Phase 1.2 interactive canvas & domain sync tests
│   ├── deep-configuration.test.ts # Phase 1.3 node & edge deep config, CIDR/port validation, QA A-F
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

## Security Rule Catalog (Initial Foundation)

| Rule ID | Rule Name | Severity | Category | Focus |
| :--- | :--- | :--- | :--- | :--- |
| **PF-001** | Public Database Exposure | `critical` | `exposure` | Flags direct ingress from Internet to Database or Redis cache |
| **PF-002** | Public Admin Exposure | `high` | `exposure` | Flags administrative consoles exposed to untrusted external networks |
| **PF-003** | Missing Security Boundary | `high` | `network_boundary` | Flags compute nodes lacking perimeter firewall / WAF / load balancer |
| **PF-004** | Untrusted → Internal Network | `critical` | `network_boundary` | Flags direct bridging of untrusted networks into private internal subnets |
| **PF-005** | Excessive Trust / Tier Bypass | `medium` | `trust_boundary` | Flags multi-tier bypasses (e.g. presentation directly querying data store) |
| **PF-006** | Invalid / Anomalous Topology | `medium` | `topology_anomaly` | Flags circular self-loops, orphaned components, and unexpected database egress |
| **PF-007** | Overly Broad Access | `high` | `access_control` | Flags wildcard ports (`*`), wildcard protocols, or cleartext ingress |

---

## Finding Explanatory Architecture

Every security violation detected in PathForge answers six explicit questions:

1. **What is wrong?** — Concise diagnostic title and description of the specific node/edge anomaly.
2. **Why is it wrong?** — The architectural and security rationale behind the rule.
3. **Why does it matter?** — The risk context for the infrastructure operator.
4. **What could happen?** — The concrete threat scenario and adversarial exploitation path.
5. **What would a better design look like?** — Architectural reference pattern for defense-in-depth.
6. **What should the user change?** — Exact actionable remediation steps on the graph.

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

Execute the full Vitest suite (70 unit & integration tests):

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
