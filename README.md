<div align="center">

# ⚡ auto-snapshot

**本地持久化 AI 記憶引擎 · Local Persistent Memory Engine for AI Coding Agents**

[![npm](https://img.shields.io/badge/npm-auto--snapshot-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/auto-snapshot)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-9B59B6?style=for-the-badge)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-F97316?style=for-the-badge)](LICENSE)

</div>

---

<div align="center">

**語言切換 / Language Switch**

[🇹🇼 繁體中文（預設）](#-繁體中文) · [🇺🇸 English](#-english)

</div>

---

# 🇹🇼 繁體中文

> **導覽**：[專案總覽](#1-專案總覽與核心價值) · [核心功能](#2-核心功能與能力說明) · [目錄結構](#3-儲存庫目錄結構) · [架構設計](#4-架構設計與核心演算法) · [技術棧](#5-前置需求與技術棧) · [安裝教學](#6-安裝與快速入門) · [進階用法](#7-進階用法與設定範例) · [測試驗證](#8-測試與驗證) · [貢獻指南](#9-貢獻指南) · [授權條款](#10-授權條款)

---

## 1. 專案總覽與核心價值

每次開啟新的 AI 對話，助理便完全失憶。你必須重新介紹專案架構、解釋技術決策背景、描述上次停在哪裡——這是所有 AI 輔助開發工作流中最大的摩擦力來源之一。

**auto-snapshot** 是一款專為 AI 編碼助理（如 Claude Code、Cursor、Windsurf 等）設計的零基礎架構、本地持久化記憶引擎。它透過 Append-Only 的 JSONL 快照日誌，自動追蹤開發里程碑、技術決策、修改過的檔案路徑與完整的任務交接狀態，讓每一次新對話都能在數秒內精確地回到上次工作的斷點。

### 為什麼不用現有的工具？

| 問題 | 現有方案的缺陷 | auto-snapshot 的解法 |
|:-----|:--------------|:--------------------|
| **AI 失憶症** | 每次重開對話都要重新說明背景 | 結構化快照在數秒內恢復完整上下文 |
| **向量資料庫依賴** | ChromaDB、Pinecone 等需要複雜安裝與維護 | 純 JSONL 文字檔，零外部依賴 |
| **RAM 佔用過高** | 語意搜尋模型動輒 500MB+ | 接近零資源消耗 |
| **工具鏈綁定** | 多數方案僅限單一 Agent 或 IDE | MCP 標準介面，相容所有主流 AI 助理 |
| **Context 膨脹** | 快照無限累積導致 Token 爆炸 | 動態情節壓縮演算法自動管理 Token/字元上限，避免超載 |

### 核心設計原則

- **Append-Only 日誌**：快照只增不改，確保歷史完整性，消除競態條件
- **結構化而非自由文字**：每條快照都是強型別的 JSON 物件，機器可讀、可查詢
- **分層記憶架構**：本地 SNAPSHOT.jsonl（短期）→ Supabase（長期跨專案知識）
- **Agent-Agnostic**：透過 MCP 標準協定，不與任何特定 AI 助理耦合

---

## 2. 核心功能與能力說明

### 📸 五種快照類型（Snapshot Taxonomy）

| 類型 | 觸發時機 | 典型用途 |
|:-----|:---------|:--------|
| `milestone` | 完成一個功能或修復一個 Bug | 記錄已完成的工作成果與涉及的檔案 |
| `phase_switch` | 工作重心轉移 | 從 Debug 切換到 UI 實作、從研究切換到開發 |
| `handoff` | 對話即將結束 | 完整的待辦清單、進行中任務、阻塞因素與下步建議 |
| `periodic` | 超過 15 輪對話且無任何快照 | 確保長時間工作不因意外中斷而失憶 |
| `decision` | 做出重大技術選型 | 記錄「為什麼這樣決定」，防止架構知識流失 |

### 🗜️ 情節壓縮（Episodic Compression）

當 `SNAPSHOT.jsonl` 字元數超過 50,000 字元時，會動態執行壓縮循環（目標縮減至 15,000 字元）：

1. **萃取舊紀錄**：提取最舊快照中的里程碑摘要、技術決策、標籤集合。
2. **精煉蒸餾與 Markdown 表格**：生成結構化 Markdown 表格與 JSON Payload。
3. **本地備援快取**：資料預設寫入 `.agent/LOCAL_CACHE.json` 備援，防止斷線。
4. **壓縮歸檔**：生成 1 條 `compressed_archive` 快照。

### 🎯 跨 Skill 記憶綁定（Cross-Skill Binding）

快照可透過 `skill` 欄位綁定到特定的 Agent Skill。恢復時使用 `--skill` 參數過濾，確保 Agent 在啟動特定 Skill 時能立即看到相關的歷史踩坑紀錄與決策。

```bash
# 記錄一條綁定到 firebase-rules Skill 的決策
auto-snapshot capture decision "選用 Firebase Auth 而非自建 JWT" \
  --tags auth,firebase --skill firebase-rules

# 恢復時只看 firebase-rules 相關的記憶
auto-snapshot recover --skill firebase-rules
```

### 🔍 語意模糊指紋比對（Semantic Fingerprinting）

在 `recover` 時傳入 `--query` 參數，系統會將查詢詞與快照進行比對。系統支援**同義詞映射與 Levenshtein 模糊比對**，大幅提升命中率，即時判斷本地記憶是否足夠：

```
✅ 本地記憶覆蓋查詢，無需查詢遠端知識庫。
⚠️  本地記憶不足，建議查詢遠端 Supabase Memory Engine。
```

### 🔌 MCP 伺服器（Model Context Protocol Server）

提供四個標準 MCP 工具，讓 AI 助理能在背景自動管理記憶：

| 工具名稱 | 功能 |
|:---------|:-----|
| `snapshot_init` | 初始化 `.agent/` 目錄與 `PROJECT_CONTEXT.md` |
| `snapshot_capture` | 寫入新快照（支援所有五種類型與全部欄位） |
| `snapshot_recover` | 讀取上下文與快照歷史（支援 skill 過濾與關鍵字指紋） |
| `snapshot_compress` | 手動觸發情節壓縮 |

---

## 3. 儲存庫目錄結構

```
auto-snapshot/
│
├── 📄 README.md                         # 本文件
├── 📄 LICENSE                           # Apache-2.0 授權條款
├── 📄 package.json                      # npm 套件設定與腳本
├── 📄 tsconfig.json                     # TypeScript 編譯設定（ES Modules）
├── 📄 .gitignore
│
├── 📁 src/                              # TypeScript 原始碼
│   ├── core.ts                          # 核心邏輯模組
│   │   ├── initProject()               #   專案初始化
│   │   ├── captureSnapshot()           #   快照寫入（含壓縮觸發）
│   │   ├── checkAndCompress()          #   壓縮條件檢查
│   │   ├── compressOldest()            #   情節壓縮執行器
│   │   ├── distillKnowledge()          #   熱蒸餾：萃取精煉知識
│   │   ├── extractKeywords()           #   關鍵字指紋提取
│   │   ├── isContextSufficientLocally()#   本地記憶充足性判斷
│   │   └── recoverContext()            #   上下文恢復（支援過濾）
│   │
│   ├── cli.ts                           # CLI 命令行介面
│   │   ├── init                        #   初始化指令
│   │   ├── capture <type> <summary>    #   快照擷取指令
│   │   ├── compress                    #   手動壓縮指令
│   │   └── recover                     #   上下文恢復指令
│   │
│   └── mcp.ts                           # MCP 伺服器實作
│       ├── snapshot_init               #   MCP 工具：初始化
│       ├── snapshot_capture            #   MCP 工具：寫入快照
│       ├── snapshot_recover            #   MCP 工具：恢復上下文
│       └── snapshot_compress           #   MCP 工具：觸發壓縮
│
├── 📁 dist/                             # TypeScript 編譯輸出（自動生成）
│   ├── core.js
│   ├── core.d.ts
│   ├── cli.js
│   └── mcp.js
│
└── 📄 [專案目錄]/.agent/               # 各專案的記憶儲存（不含在此 repo 中）
    ├── SNAPSHOT.jsonl                   # Append-Only 快照日誌
    └── PROJECT_CONTEXT.md              # 專案骨架靜態說明文件
```

### `.agent/SNAPSHOT.jsonl` 範例內容

```jsonl
{"ts":"2026-07-08T10:00:00.000Z","type":"milestone","project":"myapp","summary":"完成 OAuth 登入整合，支援 Google 與 GitHub","files":["src/auth.ts","src/hooks/useAuth.ts"],"tags":["auth","oauth"],"skill":"firebase-rules"}
{"ts":"2026-07-08T11:30:00.000Z","type":"decision","project":"myapp","summary":"選用 Firebase Auth","decision":"選用 Firebase Auth 而非自建 JWT，因需快速上線，省去兩週開發","tags":["auth","firebase"],"skill":"firebase-rules"}
{"ts":"2026-07-08T14:00:00.000Z","type":"handoff","project":"myapp","summary":"OAuth 完成，忘記密碼進行中","state":{"completed":["OAuth 整合","登入頁 UI"],"in_progress":["忘記密碼流程，卡在 resetPassword.ts L45"],"pending":["Email 驗證","i18n 錯誤訊息"],"blockers":[],"next_action":"繼續實作 resetPassword 表單驗證邏輯"}}
```

---

## 4. 架構設計與核心演算法

### 資料流架構

```
開發工作進行中
       │
       ├─ Agent 完成功能 ──────────────────────► captureSnapshot(milestone)
       ├─ Agent 切換工作重心 ──────────────────► captureSnapshot(phase_switch)
       ├─ 用戶說「今天先到這」 ──────────────► captureSnapshot(handoff)
       ├─ 記錄技術決策 ─────────────────────► captureSnapshot(decision)
       └─ 超過 15 輪無快照 ──────────────────► captureSnapshot(periodic)
                  │
                  ▼
       ┌──────────────────────┐
       │  .agent/SNAPSHOT.jsonl│  ← Append-Only 快照日誌
       │  (最多 200 條)       │
       └──────────┬───────────┘
                  │
           字元數超過 50,000 觸發
                  │
                  ▼
       ┌──────────────────────────────────┐
       │  Episodic Compression            │
       │  1. 讀取最舊 150 條              │
       │  2. distillKnowledge()           │
       │     → 萃取 milestones/decisions  │
       │     → 生成 Supabase JSON Payload │
       │  3. 生成 compressed_archive 快照 │
       │  4. 保留最新 50 條 + 1 條歸檔   │
       └──────────┬───────────────────────┘
                  │
           高價值知識（可選）
                  │
                  ▼
       ┌──────────────────────┐
       │  Supabase            │  ← 長期跨專案知識熱儲存
       │  knowledge_items     │
       └──────────────────────┘


新對話恢復流程：
       ┌──────────────────────────────────┐
       │  recoverContext(skill?, query?)  │
       │                                  │
       │  Step 1: 讀取 PROJECT_CONTEXT.md │
       │  Step 2: 讀取 SNAPSHOT.jsonl     │
       │          最後 10 條（可 skill 過濾）│
       │  Step 3: Keyword Fingerprinting  │
       │          → 本地足夠？無需遠端查詢 │
       │          → 本地不足？建議查 Supabase│
       └──────────────────────────────────┘
```

### 情節壓縮演算法細節

```
輸入：SNAPSHOT.jsonl（字元數 > 50,000）

Step 1: 分割
  oldest = lines[0 : 150]    ← 待壓縮
  newest = lines[150 : N]    ← 保留

Step 2: distillKnowledge(oldest)
  milestones  = oldest.filter(type == 'milestone').map(s => s.summary)
  decisions   = oldest.filter(type == 'decision' or s.decision != null)
                      .map(s => s.decision or s.summary)
  allTags     = Set(oldest.flatMap(s => s.tags or []))
  dateRange   = { start: oldest[0].ts, end: oldest[-1].ts }

  supabasePayload = {
    issue:      "期間 {dateRange} 工作摘要",
    solution:   "里程碑：{milestones.join(' | ')}
                 決策：{decisions.join(' | ')}",
    confidence: 0.8,
    tags:       allTags,
    source:     "auto-snapshot:compression"
  }

Step 3: 生成 compressed_archive 快照
  archive = {
    ts:      now(),
    type:    "compressed_archive",
    project: projectName,
    summary: "[壓縮歸檔] {dateRange}：{milestoneSummary}。{decisionSummary}。",
    tags:    allTags
  }

Step 4: 寫回
  SNAPSHOT.jsonl = [archive, ...newest]
  輸出 supabasePayload 供 Agent 決定是否寫入 Supabase

結果：N 條 → 51 條（1 歸檔 + 50 最新）
```

### 關鍵字指紋演算法

```typescript
// 停用詞過濾 + 詞彙分割
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'is', '的', '了', ...]);
  return text.toLowerCase()
    .split(/[\s,，。、！？\-_/\\]+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

// 本地記憶充足性判斷
function isContextSufficientLocally(query, recentSnapshots): boolean {
  const queryKeywords = extractKeywords(query);
  const recentTags = recentSnapshots.flatMap(s => s.tags ?? []);
  // 任一查詢關鍵字出現在本地 tags 中 → 本地足夠
  return queryKeywords.some(kw => recentTags.includes(kw));
}
```

---

## 5. 前置需求與技術棧

### 環境需求

| 元件 | 最低版本 | 建議版本 |
|:-----|:--------:|:--------:|
| Node.js | 18.0 | 20 LTS |
| npm | 8.0 | 最新版 |
| TypeScript（開發） | 5.3 | 5.5+ |
| Git | 2.30 | 最新版 |

### 套件依賴

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3"
  }
}
```

### MCP 客戶端相容性

| AI 助理 | 相容性 | 設定方式 |
|:--------|:------:|:---------|
| Claude Code | ✅ | `~/.claude.json` |
| Cursor | ✅ | Settings → MCP |
| Windsurf | ✅ | Settings → MCP |
| VS Code + Copilot | ✅ | `.vscode/mcp.json` |
| 任何 MCP Client | ✅ | stdio transport |

---

## 6. 安裝與快速入門

### 方式一：全域安裝（推薦）

```bash
npm install -g auto-snapshot

# 驗證安裝
auto-snapshot --version
```

### 方式二：使用 npx（免安裝）

```bash
npx auto-snapshot --help
```

### 方式三：從原始碼建置

```bash
# 克隆儲存庫
git clone https://github.com/PingpowerTW/auto-snapshot.git
cd auto-snapshot

# 安裝依賴
npm install

# 編譯 TypeScript
npm run build

# 全域連結（開發模式）
npm link
```

### 快速入門（5 分鐘）

```bash
# 1. 進入你的專案目錄
cd /path/to/your-project

# 2. 初始化 auto-snapshot
auto-snapshot init
# → 建立 .agent/ 目錄
# → 建立 .agent/PROJECT_CONTEXT.md（請手動補充專案描述）
# → 建立空的 .agent/SNAPSHOT.jsonl

# 3. 開始工作後，記錄第一個里程碑
auto-snapshot capture milestone "初始化專案架構，設定 ESLint 與 TypeScript" \
  --files src/index.ts,tsconfig.json \
  --tags setup,typescript

# 4. 今天工作結束前，記錄交接狀態
auto-snapshot capture handoff "完成基礎架構，API 設計進行中" \
  --completed "ESLint 設定,TypeScript 設定" \
  --in-progress "RESTful API 路由設計，停在 routes/users.ts" \
  --pending "資料庫 Schema 設計,單元測試" \
  --next-action "繼續實作 GET /users/:id 端點"

# 5. 明天開新對話時，執行恢復
auto-snapshot recover
```

### 將 .agent/ 加入 .gitignore（建議）

```bash
echo ".agent/" >> .gitignore
```

> 如果你希望團隊共享記憶，可以選擇不忽略此目錄並提交至 Git。

---

## 7. 進階用法與設定範例

### 完整 CLI 參數對照表

#### `capture` 指令

```bash
auto-snapshot capture <type> <summary> [options]

type:
  milestone     已完成的功能或 Bug 修復
  phase_switch  工作重心轉移
  handoff       完整的對話交接狀態
  periodic      定期進度更新
  decision      重大技術決策

options:
  -f, --files <paths>       逗號分隔的相關檔案路徑
  -t, --tags <tags>         逗號分隔的標籤
  -d, --decision <text>     技術決策詳細說明（decision 類型必填）
  -s, --skill <name>        綁定至特定 Agent Skill 名稱

  # 以下僅 handoff 類型使用
  --completed <items>       逗號分隔的已完成事項
  --in-progress <items>     逗號分隔的進行中事項
  --pending <items>         逗號分隔的待辦事項
  --blockers <items>        逗號分隔的阻塞因素
  --next-action <text>      下一步建議動作
```

#### `recover` 指令

```bash
auto-snapshot recover [options]

options:
  -s, --skill <name>     僅顯示綁定到此 Skill 的快照
  -q, --query <text>     執行關鍵字指紋比對，判斷是否需要查詢遠端知識庫
```

### 完整使用情境範例

```bash
# 情境 1：記錄一個 Firebase 相關的架構決策，綁定 Skill
auto-snapshot capture decision \
  "選用 Firebase Auth 而非自建 JWT 系統" \
  --decision "上線時程緊，Firebase 可省去兩週自建維護成本，且符合 GDPR" \
  --tags auth,firebase,architecture \
  --skill firebase-rules

# 情境 2：切換工作重心（從 debug 轉回 feature 開發）
auto-snapshot capture phase_switch \
  "Auth Bug 已修復，切換回 Payment 功能開發" \
  --tags auth,payment

# 情境 3：有查詢情境的上下文恢復（搭配關鍵字指紋）
auto-snapshot recover \
  --skill firebase-rules \
  --query "firebase auth token 過期問題"
# 輸出：✅ 本地記憶覆蓋查詢，無需查詢遠端知識庫。

# 情境 4：無相關本地記憶的恢復
auto-snapshot recover \
  --query "kubernetes deployment rolling update"
# 輸出：⚠️ 本地記憶不足，建議查詢遠端 Supabase Memory Engine。

# 情境 5：手動觸發壓縮（通常自動觸發，無需手動）
auto-snapshot compress
```

### MCP 伺服器設定

#### Claude Code（`~/.claude.json`）

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

#### Cursor（Settings → Features → MCP）

```json
{
  "mcpServers": {
    "auto-snapshot": {
      "command": "npx",
      "args": ["-y", "auto-snapshot"],
      "type": "stdio"
    }
  }
}
```

#### VS Code（`.vscode/mcp.json`）

```json
{
  "servers": {
    "auto-snapshot": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "auto-snapshot"]
    }
  }
}
```

### SNAPSHOT.jsonl 完整 Schema 參考

```typescript
interface Snapshot {
  ts: string;           // ISO 8601 時間戳記
  type: SnapshotType;   // 快照類型（見上方五種）
  project: string;      // 專案名稱（自動從 package.json 讀取）
  summary: string;      // 精煉摘要（建議 ≤ 200 字）
  files?: string[];     // 涉及的檔案路徑（可選）
  decision?: string;    // 關鍵決策細節（可選）
  tags?: string[];      // 標籤（供關鍵字指紋使用）
  skill?: string;       // 跨 Skill 綁定：Agent Skill 名稱（可選）
  state?: {             // 完整工作狀態（僅 handoff 類型）
    completed: string[];
    in_progress: string[];
    pending: string[];
    blockers: string[];
    next_action: string;
  };
}
```

---

## 8. 測試與驗證

### 本地功能驗證

```bash
# 進入任一測試目錄
mkdir test-workspace && cd test-workspace
npm init -y

# 1. 初始化
node /path/to/auto-snapshot/dist/cli.js init

# 2. 寫入測試快照
node /path/to/auto-snapshot/dist/cli.js capture milestone \
  "測試里程碑功能" -t test,verification

# 3. 寫入帶狀態的交接快照
node /path/to/auto-snapshot/dist/cli.js capture handoff \
  "測試交接功能" \
  --completed "初始化" \
  --in-progress "驗證中" \
  --next-action "繼續測試"

# 4. 驗證恢復輸出
node /path/to/auto-snapshot/dist/cli.js recover

# 5. 驗證 skill 過濾
node /path/to/auto-snapshot/dist/cli.js capture milestone \
  "綁定 Skill 的快照" -s my-skill -t bound
node /path/to/auto-snapshot/dist/cli.js recover --skill my-skill

# 6. 驗證關鍵字指紋（應顯示本地足夠）
node /path/to/auto-snapshot/dist/cli.js recover --query "test verification"

# 7. 清理測試目錄
cd .. && rm -rf test-workspace
```

### 編譯驗證

```bash
# 確認 TypeScript 編譯無錯誤
npm run build

# 預期輸出：只有 > tsc，無任何錯誤或警告
```

### 壓縮機制驗證

```bash
# 使用腳本生成 201 條快照以觸發壓縮
node -e "
const { captureSnapshot } = require('./dist/core.js');
for (let i = 0; i < 201; i++) {
  captureSnapshot('periodic', '測試快照 #' + i, { tags: ['test'] });
}
"
# 預期輸出：觸發壓縮，顯示 Hot Distillation Payload，
#            最終 SNAPSHOT.jsonl 只剩 51 條
wc -l .agent/SNAPSHOT.jsonl   # 應輸出 51
```

---

## 9. 貢獻指南

歡迎提交 Pull Request！在開始之前，請閱讀以下準則。

### 開發環境設定

```bash
git clone https://github.com/PingpowerTW/auto-snapshot.git
cd auto-snapshot
npm install
npm run build
npm link   # 全域連結，方便本地測試
```

### 貢獻流程

1. Fork 本儲存庫
2. 建立功能分支：`git checkout -b feat/your-feature-name`
3. 完成修改後確認編譯通過：`npm run build`
4. 提交 Commit（遵守 Conventional Commits 規範）：
   ```bash
   git commit -m "feat(core): add skill binding to compressed_archive"
   ```
5. 推送分支並開啟 Pull Request

### Commit 訊息規範

```
<type>(<scope>): <subject>

type: feat | fix | docs | refactor | test | chore
scope: core | cli | mcp | docs
```

### 歡迎貢獻的方向

- 🌐 **語言適配器**：為其他語言（Python、Rust）實作相同邏輯的 SDK
- 🔗 **知識庫整合**：加入對 Notion、Obsidian、Linear 等工具的同步支援
- 📊 **壓縮策略優化**：改善 `distillKnowledge()` 的摘要品質
- 🧪 **自動化測試**：加入 Vitest 或 Jest 的單元測試套件
- 📖 **文件改善**：擴充使用案例說明

---

## 10. 授權條款

本專案採用 **Apache License 2.0** 授權。

```
Copyright 2025 PingpowerTW & Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

完整授權條款請見 [LICENSE](LICENSE) 檔案。

---

<div align="center">

**如果這個工具幫助了你的開發工作流，歡迎給一個 ⭐ 鼓勵我們！**

[回到頂部](#-auto-snapshot) · [切換至英文](#-english) · [GitHub](https://github.com/PingpowerTW/auto-snapshot)

</div>

---
---

# 🇺🇸 English

> **Navigation**: [Overview](#1-project-overview--value-proposition) · [Features](#2-core-features--capabilities) · [Structure](#3-repository-directory-structure) · [Architecture](#4-architectural-design--core-algorithms) · [Tech Stack](#5-prerequisites--tech-stack) · [Installation](#6-installation--quick-start) · [Advanced Usage](#7-advanced-usage--configuration-examples) · [Testing](#8-testing--validation) · [Contributing](#9-contributing-guidelines) · [License](#10-apache-20-license)

---

## 1. Project Overview & Value Proposition

Every time a new AI chat session opens, the assistant starts with complete amnesia. You must re-introduce the project architecture, re-explain technical decision history, and describe where you stopped last time — this is one of the greatest friction points in any AI-assisted development workflow.

**auto-snapshot** is a zero-infrastructure, local persistent memory engine designed specifically for AI coding agents (Claude Code, Cursor, Windsurf, and more). Through an Append-Only JSONL snapshot log, it automatically tracks development milestones, technical decisions, modified file paths, and complete task handoff states — enabling every new conversation to resume precisely at the last stopping point within seconds.

### Why Not Existing Tools?

| Problem | Existing Solution Shortcomings | auto-snapshot's Approach |
|:--------|:-------------------------------|:------------------------|
| **AI Amnesia** | Must re-explain project context every new session | Structured snapshots restore full context in seconds |
| **Vector DB Dependency** | ChromaDB, Pinecone require complex setup and maintenance | Pure JSONL text file, zero external dependencies |
| **High RAM Usage** | Semantic search models consume 500MB+ of memory | Near-zero resource consumption |
| **Toolchain Lock-in** | Most solutions only work with a single agent or IDE | MCP standard interface — compatible with all major AI assistants |
| **Context Bloat** | Unlimited snapshot accumulation leads to Token explosion | Dynamic episodic compression auto-manages Token/character limits |

### Core Design Principles

- **Append-Only Log**: Snapshots are write-only, never modified — ensuring complete history integrity and eliminating race conditions
- **Structured over Free-Text**: Every snapshot is a strongly-typed JSON object — machine-readable and queryable
- **Tiered Memory Architecture**: Local `SNAPSHOT.jsonl` (short-term) → Supabase (long-term cross-project knowledge)
- **Agent-Agnostic**: Decoupled from any specific AI assistant through the MCP standard protocol

---

## 2. Core Features & Capabilities

### 📸 Five Snapshot Types (Snapshot Taxonomy)

| Type | When Triggered | Typical Use Case |
|:-----|:--------------|:----------------|
| `milestone` | A feature completed or a Bug fixed | Record completed work outcomes and involved files |
| `phase_switch` | A shift in working focus | Switching from debugging to UI implementation |
| `handoff` | A conversation is ending | Complete task list, in-progress items, blockers, and next-step recommendations |
| `periodic` | 15+ turns with no snapshot | Ensure long sessions don't lose state on unexpected interruption |
| `decision` | A major technical choice is made | Record "why we decided this" — prevents architecture knowledge loss |

### 🗜️ Episodic Compression

When `SNAPSHOT.jsonl` exceeds 50,000 characters, it triggers dynamic compression (target size: 15,000 chars):

1. **Extract Oldest Entries**: Collects milestones, decisions, and tags.
2. **Hot Distillation & Markdown Tables**: Generates structural markdown tables and JSON payload.
3. **Local Fallback Cache**: Saves data to `.agent/LOCAL_CACHE.json` for offline backup.
4. **Archive and compact**: Condenses entries into a single `compressed_archive`.

### 🎯 Cross-Skill Binding

Snapshots can be bound to a specific Agent Skill via the `skill` field. When recovering context with `--skill`, only relevant snapshots are returned — ensuring the agent immediately sees prior pitfall records and decisions when activating a particular skill.

```bash
# Record a decision bound to the firebase-rules skill
auto-snapshot capture decision "Use Firebase Auth instead of custom JWT" \
  --tags auth,firebase --skill firebase-rules

# Recover context filtered to firebase-rules only
auto-snapshot recover --skill firebase-rules
```

### 🔍 Semantic Fingerprinting

Pass `--query` during `recover` to compare query terms against snapshots. The system uses **synonym mapping and Levenshtein fuzzy matching** to maximize cache hits, avoiding unnecessary remote queries:

```
✅ Local memory covers the query — no remote lookup needed.
⚠️  Local memory insufficient — recommend querying Supabase Memory Engine.
```

### 🔌 MCP Server (Model Context Protocol)

Exposes four standard MCP tools, enabling AI assistants to autonomously manage memory in the background:

| Tool Name | Function |
|:----------|:---------|
| `snapshot_init` | Initialize the `.agent/` directory and `PROJECT_CONTEXT.md` |
| `snapshot_capture` | Write a new snapshot (supports all five types and all fields) |
| `snapshot_recover` | Read context and snapshot history (supports skill filtering and keyword fingerprinting) |
| `snapshot_compress` | Manually trigger episodic compression |

---

## 3. Repository Directory Structure

```
auto-snapshot/
│
├── 📄 README.md                         # This document
├── 📄 LICENSE                           # Apache-2.0 License
├── 📄 package.json                      # npm package config and scripts
├── 📄 tsconfig.json                     # TypeScript compiler config (ES Modules)
├── 📄 .gitignore
│
├── 📁 src/                              # TypeScript source code
│   ├── core.ts                          # Core logic module
│   │   ├── initProject()               #   Project initialization
│   │   ├── captureSnapshot()           #   Snapshot write (with auto-compression trigger)
│   │   ├── checkAndCompress()          #   Compression condition check
│   │   ├── compressOldest()            #   Episodic compression executor
│   │   ├── distillKnowledge()          #   Hot distillation: extract refined knowledge
│   │   ├── extractKeywords()           #   Keyword fingerprint extraction
│   │   ├── isContextSufficientLocally()#   Local memory sufficiency judgment
│   │   └── recoverContext()            #   Context recovery (with filtering support)
│   │
│   ├── cli.ts                           # CLI command-line interface
│   │   ├── init                        #   Initialization command
│   │   ├── capture <type> <summary>    #   Snapshot capture command
│   │   ├── compress                    #   Manual compression command
│   │   └── recover                     #   Context recovery command
│   │
│   └── mcp.ts                           # MCP server implementation
│       ├── snapshot_init               #   MCP tool: initialize
│       ├── snapshot_capture            #   MCP tool: write snapshot
│       ├── snapshot_recover            #   MCP tool: recover context
│       └── snapshot_compress           #   MCP tool: trigger compression
│
├── 📁 dist/                             # TypeScript compiled output (auto-generated)
│   ├── core.js
│   ├── core.d.ts
│   ├── cli.js
│   └── mcp.js
│
└── 📄 [project-dir]/.agent/            # Per-project memory store (not in this repo)
    ├── SNAPSHOT.jsonl                   # Append-Only snapshot log
    └── PROJECT_CONTEXT.md              # Static project skeleton document
```

---

## 4. Architectural Design & Core Algorithms

### Data Flow Architecture

```
Development Work in Progress
       │
       ├─ Agent completes a feature ──────────────► captureSnapshot(milestone)
       ├─ Agent shifts working focus ──────────────► captureSnapshot(phase_switch)
       ├─ User says "let's stop here" ────────────► captureSnapshot(handoff)
       ├─ Recording a technical decision ──────────► captureSnapshot(decision)
       └─ 15+ turns with no snapshot ──────────────► captureSnapshot(periodic)
                  │
                  ▼
       ┌──────────────────────┐
       │  .agent/SNAPSHOT.jsonl│  ← Append-Only snapshot log
       │  (max 200 entries)   │
       └──────────┬───────────┘
                  │
           Exceeds 200 → triggers
                  │
                  ▼
       ┌──────────────────────────────────┐
       │  Episodic Compression            │
       │  1. Read oldest 150 entries      │
       │  2. distillKnowledge()           │
       │     → Extract milestones/decisions│
       │     → Generate Supabase payload  │
       │  3. Write compressed_archive     │
       │  4. Retain newest 50 + 1 archive │
       └──────────┬───────────────────────┘
                  │
           High-value knowledge (optional)
                  │
                  ▼
       ┌──────────────────────┐
       │  Supabase            │  ← Long-term cross-project hot store
       │  knowledge_items     │
       └──────────────────────┘


New Session Recovery Flow:
       ┌──────────────────────────────────────┐
       │  recoverContext(skill?, query?)       │
       │                                      │
       │  Step 1: Read PROJECT_CONTEXT.md     │
       │  Step 2: Read SNAPSHOT.jsonl         │
       │          Last 10 entries (skill filter)│
       │  Step 3: Keyword Fingerprinting      │
       │          → Local sufficient? Skip remote│
       │          → Local insufficient? Suggest Supabase│
       └──────────────────────────────────────┘
```

### Episodic Compression Algorithm

```
Input: SNAPSHOT.jsonl (Chars > 50,000)

Step 1: Partition
  oldest = lines[0 : 150]    ← to compress
  newest = lines[150 : N]    ← to retain

Step 2: distillKnowledge(oldest)
  milestones  = oldest.filter(type == 'milestone').map(s => s.summary)
  decisions   = oldest.filter(type == 'decision' or s.decision != null)
                      .map(s => s.decision or s.summary)
  allTags     = Set(oldest.flatMap(s => s.tags or []))
  dateRange   = { start: oldest[0].ts, end: oldest[-1].ts }

  supabasePayload = {
    issue:      "Session summary for period {dateRange}",
    solution:   "Milestones: {milestones.join(' | ')}
                 Decisions: {decisions.join(' | ')}",
    confidence: 0.8,
    tags:       allTags,
    source:     "auto-snapshot:compression"
  }

Step 3: Generate compressed_archive snapshot
  archive = {
    ts:      now(),
    type:    "compressed_archive",
    project: projectName,
    summary: "[Compressed Archive] {dateRange}: {milestoneSummary}. {decisionSummary}.",
    tags:    allTags
  }

Step 4: Write back
  SNAPSHOT.jsonl = [archive, ...newest]
  Output supabasePayload for agent to optionally write to Supabase

Result: N entries → 51 entries (1 archive + 50 newest)
```

### Keyword Fingerprint Algorithm

```typescript
// Stop-word filtering + token split
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'is', 'in', 'on', ...]);
  return text.toLowerCase()
    .split(/[\s,，。、！？\-_/\\]+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

// Local memory sufficiency judgment
function isContextSufficientLocally(query, recentSnapshots): boolean {
  const queryKeywords = extractKeywords(query);
  const recentTags = recentSnapshots.flatMap(s => s.tags ?? []);
  // Any query keyword appearing in local tags → local memory sufficient
  return queryKeywords.some(kw => recentTags.includes(kw));
}
```

---

## 5. Prerequisites & Tech Stack

### Environment Requirements

| Component | Minimum | Recommended |
|:----------|:-------:|:-----------:|
| Node.js | 18.0 | 20 LTS |
| npm | 8.0 | Latest |
| TypeScript (dev) | 5.3 | 5.5+ |
| Git | 2.30 | Latest |

### Package Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3"
  }
}
```

### MCP Client Compatibility

| AI Assistant | Compatible | Configuration |
|:-------------|:----------:|:-------------|
| Claude Code | ✅ | `~/.claude.json` |
| Cursor | ✅ | Settings → MCP |
| Windsurf | ✅ | Settings → MCP |
| VS Code + Copilot | ✅ | `.vscode/mcp.json` |
| Any MCP Client | ✅ | stdio transport |

---

## 6. Installation & Quick Start

### Option 1: Global Install (Recommended)

```bash
npm install -g auto-snapshot

# Verify installation
auto-snapshot --version
```

### Option 2: Use npx (No Install Required)

```bash
npx auto-snapshot --help
```

### Option 3: Build from Source

```bash
git clone https://github.com/PingpowerTW/auto-snapshot.git
cd auto-snapshot
npm install
npm run build
npm link   # Global link for local testing
```

### Quick Start (5 Minutes)

```bash
# 1. Navigate to your project directory
cd /path/to/your-project

# 2. Initialize auto-snapshot
auto-snapshot init
# → Creates .agent/ directory
# → Creates .agent/PROJECT_CONTEXT.md (edit this with your project description)
# → Creates empty .agent/SNAPSHOT.jsonl

# 3. After completing work, capture a milestone
auto-snapshot capture milestone "Initialize project architecture, configure ESLint and TypeScript" \
  --files src/index.ts,tsconfig.json \
  --tags setup,typescript

# 4. At session end, capture a complete handoff state
auto-snapshot capture handoff "Base architecture complete, API design in progress" \
  --completed "ESLint setup,TypeScript config" \
  --in-progress "RESTful API route design, stopped at routes/users.ts" \
  --pending "Database schema design,Unit tests" \
  --next-action "Continue implementing GET /users/:id endpoint"

# 5. Tomorrow, in a new session, recover context
auto-snapshot recover
```

### Add .agent/ to .gitignore (Recommended)

```bash
echo ".agent/" >> .gitignore
```

> If you want to share memory across a team, you may choose to commit `.agent/` to Git instead.

---

## 7. Advanced Usage & Configuration Examples

### Full CLI Reference

#### `capture` Command

```bash
auto-snapshot capture <type> <summary> [options]

type:
  milestone     A completed feature or Bug fix
  phase_switch  A shift in working focus
  handoff       Complete session handoff state
  periodic      Periodic progress update
  decision      A major technical decision

options:
  -f, --files <paths>       Comma-separated file paths involved
  -t, --tags <tags>         Comma-separated tags
  -d, --decision <text>     Decision rationale detail (required for decision type)
  -s, --skill <name>        Bind to a specific Agent Skill name

  # The following are only used with the handoff type:
  --completed <items>       Comma-separated completed items
  --in-progress <items>     Comma-separated in-progress items
  --pending <items>         Comma-separated pending items
  --blockers <items>        Comma-separated blockers
  --next-action <text>      Recommended next action
```

#### `recover` Command

```bash
auto-snapshot recover [options]

options:
  -s, --skill <name>     Show only snapshots bound to this skill
  -q, --query <text>     Run keyword fingerprinting to determine if remote lookup is needed
```

### Complete Scenario Examples

```bash
# Scenario 1: Record a Firebase architecture decision bound to a Skill
auto-snapshot capture decision \
  "Use Firebase Auth instead of custom JWT system" \
  --decision "Tight timeline; Firebase saves 2 weeks of build/maintenance, and meets GDPR" \
  --tags auth,firebase,architecture \
  --skill firebase-rules

# Scenario 2: Phase switch (from debugging back to feature development)
auto-snapshot capture phase_switch \
  "Auth Bug resolved, switching back to Payment feature" \
  --tags auth,payment

# Scenario 3: Context recovery with keyword fingerprinting
auto-snapshot recover \
  --skill firebase-rules \
  --query "firebase auth token expiry issue"
# Output: ✅ Local memory covers the query — no remote lookup needed.

# Scenario 4: Recovery with no relevant local memory
auto-snapshot recover \
  --query "kubernetes deployment rolling update strategy"
# Output: ⚠️ Local memory insufficient — recommend querying Supabase Memory Engine.

# Scenario 5: Manual compression (auto-triggers at 200 entries; manual only when needed)
auto-snapshot compress
```

### MCP Server Configuration

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

#### Cursor (Settings → Features → MCP)

```json
{
  "mcpServers": {
    "auto-snapshot": {
      "command": "npx",
      "args": ["-y", "auto-snapshot"],
      "type": "stdio"
    }
  }
}
```

#### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "auto-snapshot": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "auto-snapshot"]
    }
  }
}
```

### Full SNAPSHOT.jsonl Schema Reference

```typescript
interface Snapshot {
  ts: string;           // ISO 8601 timestamp
  type: SnapshotType;   // Snapshot type (one of the five types above)
  project: string;      // Project name (auto-detected from package.json)
  summary: string;      // Concise summary (recommended ≤ 200 characters)
  files?: string[];     // Affected file paths (optional)
  decision?: string;    // Decision rationale detail (optional)
  tags?: string[];      // Tags (used for keyword fingerprinting)
  skill?: string;       // Cross-skill binding: Agent Skill name (optional)
  state?: {             // Complete work state (handoff type only)
    completed: string[];
    in_progress: string[];
    pending: string[];
    blockers: string[];
    next_action: string;
  };
}
```

---

## 8. Testing & Validation

### Local Functional Verification

```bash
# Navigate to a test directory
mkdir test-workspace && cd test-workspace
npm init -y

# 1. Initialize
node /path/to/auto-snapshot/dist/cli.js init

# 2. Write test snapshots
node /path/to/auto-snapshot/dist/cli.js capture milestone \
  "Test milestone functionality" -t test,verification

# 3. Write a handoff snapshot with full state
node /path/to/auto-snapshot/dist/cli.js capture handoff \
  "Test handoff functionality" \
  --completed "Initialization" \
  --in-progress "Verification in progress" \
  --next-action "Continue testing"

# 4. Verify recovery output
node /path/to/auto-snapshot/dist/cli.js recover

# 5. Verify skill filtering
node /path/to/auto-snapshot/dist/cli.js capture milestone \
  "Skill-bound snapshot" -s my-skill -t bound
node /path/to/auto-snapshot/dist/cli.js recover --skill my-skill

# 6. Verify keyword fingerprinting (should show locally sufficient)
node /path/to/auto-snapshot/dist/cli.js recover --query "test verification"

# 7. Clean up
cd .. && rm -rf test-workspace
```

### Compilation Verification

```bash
# Confirm TypeScript compiles without errors
npm run build

# Expected output: only "> tsc" — no errors or warnings
```

### Compression Mechanism Verification

```bash
# Generate 201 snapshots via script to trigger compression
node -e "
const { captureSnapshot } = require('./dist/core.js');
for (let i = 0; i < 201; i++) {
  captureSnapshot('periodic', 'Test snapshot #' + i, { tags: ['test'] });
}
"
# Expected: compression triggers, Hot Distillation Payload is displayed,
#            SNAPSHOT.jsonl ends up with exactly 51 lines
wc -l .agent/SNAPSHOT.jsonl   # Should output 51
```

---

## 9. Contributing Guidelines

Contributions are welcome via Pull Request. Please read the following before starting.

### Development Environment Setup

```bash
git clone https://github.com/PingpowerTW/auto-snapshot.git
cd auto-snapshot
npm install
npm run build
npm link   # Global link for local testing
```

### Contribution Workflow

1. Fork this repository
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Confirm the build passes after changes: `npm run build`
4. Commit following the Conventional Commits specification:
   ```bash
   git commit -m "feat(core): add skill binding to compressed_archive"
   ```
5. Push the branch and open a Pull Request

### Commit Message Format

```
<type>(<scope>): <subject>

type: feat | fix | docs | refactor | test | chore
scope: core | cli | mcp | docs
```

### Contribution Areas Welcome

- 🌐 **Language SDKs**: Implement equivalent logic in Python, Rust, or Go
- 🔗 **Knowledge Store Integrations**: Add sync support for Notion, Obsidian, Linear
- 📊 **Compression Quality**: Improve `distillKnowledge()` summary quality
- 🧪 **Automated Tests**: Add Vitest or Jest unit test suite
- 📖 **Documentation**: Expand use case walkthroughs and examples

---

## 10. Apache 2.0 License

```
Copyright 2025 PingpowerTW & Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

See the [LICENSE](LICENSE) file for the complete license text.

---

<div align="center">

**If auto-snapshot has improved your AI development workflow, a ⭐ would make our day!**

[Back to Top](#-auto-snapshot) · [切換至繁體中文](#-繁體中文) · [GitHub](https://github.com/PingpowerTW/auto-snapshot)

</div>
