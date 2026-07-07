# 🚀 auto-snapshot

> A zero-infrastructure, local persistent memory engine and MCP server designed specifically for AI coding agents (such as Claude Code, Cursor, Windsurf, etc.).

`auto-snapshot` helps solve the "amnesia" problem when starting new chat sessions by automatically tracking development milestones, decisions, files touched, and task lists in an append-only, token-efficient JSONL log. It features automated episodic compression to fit long logs into small context windows.

---

## ✨ Features

- **📂 Zero-Infra Local Storage**: All memory is stored inside your project repository under `.agent/SNAPSHOT.jsonl`.
- **⚡ Automated Episodic Compression**: Automatically groups and compresses oldest entries once the snapshot count exceeds 200, preventing context window bloating.
- **🔄 Hybrid Recovery**: Combines static project structures (`PROJECT_CONTEXT.md`) with dynamic state histories to recreate a prompt-ready context in milliseconds.
- **🔌 Model Context Protocol (MCP) Support**: Exposes standard tools (`snapshot_init`, `snapshot_capture`, `snapshot_recover`, `snapshot_compress`) for seamless AI agent integration.

---

## 📦 Installation

```bash
npm install -g auto-snapshot
# or run via npx
npx auto-snapshot --help
```

---

## 🛠️ CLI Usage

### 1. Initialize a Project
Creates the `.agent` directory, a default `PROJECT_CONTEXT.md`, and an empty `SNAPSHOT.jsonl` log.
```bash
auto-snapshot init
```

### 2. Capture a Snapshot
Log a development milestone, key decision, or a state transition.
```bash
auto-snapshot capture milestone "Implemented OAuth login flow" --files src/auth.ts,src/app.ts --tags auth,oauth
```

Available types:
- `milestone`: A completed feature or bugfix.
- `phase_switch`: A shift in focus (e.g. from debugging to building UI).
- `handoff`: Session end state with complete details.
- `periodic`: Automatic session tick update.
- `decision`: Crucial design/architectural choice.

For `handoff` type, you can pass detailed state details:
```bash
auto-snapshot capture handoff "Completed oauth, forgot password pending" \
  --completed "OAuth login" \
  --in-progress "Forgot password UI, stuck at resetPassword.ts L45" \
  --pending "Email confirmation" \
  --next-action "Implement resetPassword validation"
```

### 3. Recover Context
Formats the project context and the last 10 snapshots into a rich prompt.
```bash
auto-snapshot recover
```

### 4. Run Compression Manually
```bash
auto-snapshot compress
```

---

## 🔌 MCP Server Configuration

To allow your AI coding assistant (e.g., Claude Code, Cursor) to automatically read and write snapshots, configure it as an MCP server.

### Claude Code (`~/.claude.json`)
```json
{
  "mcpServers": {
    "auto-snapshot": {
      "command": "npx",
      "args": ["-y", "auto-snapshot"]
    }
  }
}
```

### Cursor Settings
Go to **Settings** -> **Features** -> **MCP** and add a new MCP Server:
- **Name**: `auto-snapshot`
- **Type**: `stdio`
- **Command**: `npx -y auto-snapshot`

---

## 📝 SNAPSHOT.jsonl Schema

Snapshots are stored in `.agent/SNAPSHOT.jsonl` using a simple, readable single-line JSON format:

```typescript
interface Snapshot {
  ts: string;           // ISO 8601 timestamp
  type: 'milestone' | 'phase_switch' | 'handoff' | 'periodic' | 'decision' | 'compressed_archive';
  project: string;      // Project name
  summary: string;      // Summary (<= 200 chars)
  files?: string[];     // Array of affected files
  decision?: string;    // Crucial decision text
  tags?: string[];      // Associated tags
  state?: {             // State mapping (handoff only)
    completed: string[];
    in_progress: string[];
    pending: string[];
    blockers: string[];
    next_action: string;
  };
}
```

---

## ⚖️ License

Licensed under the [Apache License, Version 2.0](LICENSE).
