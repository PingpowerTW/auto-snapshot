# 🚀 auto-snapshot

> A zero-infrastructure, local persistent memory engine and MCP server designed specifically for AI coding agents.

---

<details open>
<summary><b>🌐 🇺🇸 English (Click to expand/collapse)</b></summary>

`auto-snapshot` helps solve the "amnesia" problem when starting new chat sessions by automatically tracking development milestones, decisions, files touched, and task lists in an append-only, token-efficient JSONL log. It features automated episodic compression to fit long logs into small context windows.

### ✨ Features

- **📂 Zero-Infra Local Storage**: All memory is stored inside your project repository under `.agent/SNAPSHOT.jsonl`.
- **⚡ Automated Episodic Compression**: Automatically groups and compresses oldest entries once the snapshot count exceeds 200, preventing context window bloating.
- **🔄 Hybrid Recovery**: Combines static project structures (`PROJECT_CONTEXT.md`) with dynamic state histories to recreate a prompt-ready context in milliseconds.
- **🔌 Model Context Protocol (MCP) Support**: Exposes standard tools (`snapshot_init`, `snapshot_capture`, `snapshot_recover`, `snapshot_compress`) for seamless AI agent integration.

### 📦 Installation

```bash
npm install -g auto-snapshot
# or run via npx
npx auto-snapshot --help
```

### 🛠️ CLI Usage

#### 1. Initialize a Project
Creates the `.agent` directory, a default `PROJECT_CONTEXT.md`, and an empty `SNAPSHOT.jsonl` log.
```bash
auto-snapshot init
```

#### 2. Capture a Snapshot
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

#### 3. Recover Context
Formats the project context and the last 10 snapshots into a rich prompt.
```bash
auto-snapshot recover
```

#### 4. Run Compression Manually
```bash
auto-snapshot compress
```

### 🔌 MCP Server Configuration

To allow your AI coding assistant (e.g., Claude Code, Cursor) to automatically read and write snapshots, configure it as an MCP server.

#### Claude Code (`~/.claude.json`)
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

#### Cursor Settings
Go to **Settings** -> **Features** -> **MCP** and add a new MCP Server:
- **Name**: `auto-snapshot`
- **Type**: `stdio`
- **Command**: `npx -y auto-snapshot`

</details>

<details>
<summary><b>🌐 🇹🇼 繁體中文 (點擊展開/收合)</b></summary>

`auto-snapshot` 藉由自動追蹤開發里程碑、決策、修改檔案與任務清單，並將其記錄於一個 token 高效的 append-only JSONL 日誌中，完美解決了每次開啟新對話 Session 時 AI 的「失憶症」。它具備自動情節壓縮（Episodic Compression）機制，確保長期日誌能完美適應極小的 Context Window。

### ✨ 特色

- **📂 零依賴本地存儲**：所有記憶皆儲存於專案目錄下的 `.agent/SNAPSHOT.jsonl` 中，隱私安全無虞。
- **⚡ 自動情節壓縮**：當快照數量超過 200 條時，會自動將最舊的 150 條紀錄壓縮為單條歸檔摘要，防止 Context 膨脹。
- **🔄 混合恢復機制**：結合專案靜態架構（`PROJECT_CONTEXT.md`）與動態快照歷程，在毫秒內生成 Prompt 友善的上下文。
- **🔌 MCP 協定支持**：提供標準工具（`snapshot_init`、`snapshot_capture`、`snapshot_recover`、`snapshot_compress`）供 AI 助理直接呼叫。

### 📦 安裝方式

```bash
npm install -g auto-snapshot
# 或直接透過 npx 執行
npx auto-snapshot --help
```

### 🛠️ CLI 常用指令

#### 1. 初始化專案
建立 `.agent` 目錄、預設的 `PROJECT_CONTEXT.md` 與空白的 `SNAPSHOT.jsonl` 日誌。
```bash
auto-snapshot init
```

#### 2. 擷取快照
記錄一個開發里程碑、關鍵決策或狀態切換。
```bash
auto-snapshot capture milestone "完成登入功能 OAuth 整合" --files src/auth.ts,src/app.ts --tags auth,oauth
```

支援的快照類型：
- `milestone`：已完成的功能或 Bug 修復。
- `phase_switch`：工作重心轉移（例如：從 Debug 轉向前端 UI 實作）。
- `handoff`：對話交接狀態（包含完整的待辦與進行中事項）。
- `periodic`：會話期間的自動定期記錄。
- `decision`：重大架構或技術選型決策。

針對 `handoff`（交接）類型，可傳入詳細的工作狀態：
```bash
auto-snapshot capture handoff "OAuth 整合完成，忘記密碼流程待處理" \
  --completed "OAuth 登入" \
  --in-progress "忘記密碼 UI，卡在 resetPassword.ts L45" \
  --pending "Email 驗證功能" \
  --next-action "實作 resetPassword 表單驗證邏輯"
```

#### 3. 恢復上下文
將專案上下文與最後 10 條快照歷史格式化為 Prompt 文字。
```bash
auto-snapshot recover
```

#### 4. 手動執行壓縮
```bash
auto-snapshot compress
```

### 🔌 MCP 伺服器設定

將 `auto-snapshot` 配置為 MCP 伺服器，使你的 AI 助理（如 Claude Code 或 Cursor）能在開發過程中自動讀寫快照。

#### Claude Code (`~/.claude.json`)
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

#### Cursor 設定
前往 **Settings** -> **Features** -> **MCP** 並新增一個 MCP 伺服器：
- **Name**: `auto-snapshot`
- **Type**: `stdio`
- **Command**: `npx -y auto-snapshot`

</details>

---

## 📝 SNAPSHOT.jsonl Schema (通用格式)

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
