import fs from 'fs';
import path from 'path';

export type SnapshotType = 'milestone' | 'phase_switch' | 'handoff' | 'periodic' | 'decision' | 'compressed_archive';

export interface SnapshotState {
  completed: string[];
  in_progress: string[];
  pending: string[];
  blockers: string[];
  next_action: string;
}

export interface Snapshot {
  ts: string;
  type: SnapshotType;
  project: string;
  summary: string;
  files?: string[];
  decision?: string;
  tags?: string[];
  state?: SnapshotState;
}

const AGENT_DIR = '.agent';
const SNAPSHOT_FILE = path.join(AGENT_DIR, 'SNAPSHOT.jsonl');
const CONTEXT_FILE = path.join(AGENT_DIR, 'PROJECT_CONTEXT.md');

function getProjectName(): string {
  try {
    if (fs.existsSync('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (pkg.name) return pkg.name;
    }
  } catch (e) {
    // Ignore error
  }
  return path.basename(process.cwd());
}

export function initProject(customProjectName?: string): void {
  const projectName = customProjectName || getProjectName();

  if (!fs.existsSync(AGENT_DIR)) {
    fs.mkdirSync(AGENT_DIR, { recursive: true });
    console.log(`Created directory: ${AGENT_DIR}`);
  }

  // Create boilerplate PROJECT_CONTEXT.md if it doesn't exist
  if (!fs.existsSync(CONTEXT_FILE)) {
    const defaultContext = `# 專案上下文

**專案名稱**: ${projectName}
**最後更新**: ${new Date().toISOString()}
**技術棧**: Node.js / TypeScript (Auto-detected)

---

## 🏗️ 目錄結構

\`\`\`
${projectName}/
├── src/         # 原始碼
├── dist/        # 編譯輸出
└── .agent/      # AI 助理快照與記憶
\`\`\`

## 📁 關鍵檔案

| 檔案 | 用途 | 重要程度 |
| ---- | ---- | -------- |
| \`package.json\` | 專案依賴與腳本 | ⭐⭐⭐ |

## ⚠️ 注意事項

- 請勿直接提交 \`.env\` 敏感檔案
- 每次完成重大變更請執行 \`auto-snapshot capture\`
`;
    fs.writeFileSync(CONTEXT_FILE, defaultContext, 'utf8');
    console.log(`Created boilerplate: ${CONTEXT_FILE}`);
  }

  // Create SNAPSHOT.jsonl if it doesn't exist
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    fs.writeFileSync(SNAPSHOT_FILE, '', 'utf8');
    console.log(`Created empty log: ${SNAPSHOT_FILE}`);
  }
}

export function captureSnapshot(
  type: SnapshotType,
  summary: string,
  options: { files?: string[]; tags?: string[]; decision?: string; state?: SnapshotState } = {}
): void {
  // Ensure directory exists
  if (!fs.existsSync(AGENT_DIR)) {
    initProject();
  }

  const projectName = getProjectName();
  const snapshot: Snapshot = {
    ts: new Date().toISOString(),
    type,
    project: projectName,
    summary,
    ...options,
  };

  const line = JSON.stringify(snapshot) + '\n';
  fs.appendFileSync(SNAPSHOT_FILE, line, 'utf8');
  console.log(`[Auto-Snapshot] Captured ${type}: "${summary}"`);

  // Check if we need compression
  checkAndCompress();
}

export function checkAndCompress(): void {
  if (!fs.existsSync(SNAPSHOT_FILE)) return;

  const content = fs.readFileSync(SNAPSHOT_FILE, 'utf8').trim();
  if (!content) return;

  const lines = content.split('\n');
  if (lines.length <= 200) return;

  console.log(`[Auto-Snapshot] Snapshot count (${lines.length}) exceeds limit. Compressing oldest 150 entries...`);
  compressOldest(lines);
}

function compressOldest(lines: string[]): void {
  const oldestLines = lines.slice(0, 150);
  const newestLines = lines.slice(150);

  const parsedOldest: Snapshot[] = [];
  for (const line of oldestLines) {
    try {
      if (line.trim()) {
        parsedOldest.push(JSON.parse(line));
      }
    } catch (e) {
      // Ignore corrupted lines
    }
  }

  // Extract key information
  const dateRangeStart = parsedOldest[0]?.ts ? new Date(parsedOldest[0].ts).toLocaleDateString() : 'Unknown';
  const dateRangeEnd = parsedOldest[parsedOldest.length - 1]?.ts ? new Date(parsedOldest[parsedOldest.length - 1].ts).toLocaleDateString() : 'Unknown';

  const milestones = parsedOldest.filter(s => s.type === 'milestone');
  const decisions = parsedOldest.filter(s => s.type === 'decision' || s.decision);

  const allTags = new Set<string>();
  parsedOldest.forEach(s => {
    if (s.tags) s.tags.forEach(t => allTags.add(t));
  });

  const milestoneSummary = milestones.length > 0 
    ? `完成 ${milestones.length} 個里程碑 (${milestones.slice(0, 5).map(m => m.summary).join(', ')} 等)` 
    : '無里程碑變更';

  const decisionSummary = decisions.length > 0
    ? `做出 ${decisions.length} 項關鍵決策 (${decisions.slice(0, 3).map(d => d.decision || d.summary).join(', ')} 等)`
    : '無重大決策';

  const archiveSummary = `[壓縮歸檔] 期間：${dateRangeStart} ~ ${dateRangeEnd}。工作概述：${milestoneSummary}。${decisionSummary}。`;

  const archiveSnapshot: Snapshot = {
    ts: new Date().toISOString(),
    type: 'compressed_archive',
    project: getProjectName(),
    summary: archiveSummary,
    tags: Array.from(allTags),
  };

  const newLines = [
    JSON.stringify(archiveSnapshot),
    ...newestLines
  ];

  fs.writeFileSync(SNAPSHOT_FILE, newLines.join('\n') + '\n', 'utf8');
  console.log(`[Auto-Snapshot] Compression completed. Retained latest ${newestLines.length + 1} snapshots.`);
}

export function recoverContext(): void {
  if (!fs.existsSync(AGENT_DIR)) {
    console.log('No .agent directory found. Please run init first.');
    return;
  }

  let contextMarkdown = '';
  if (fs.existsSync(CONTEXT_FILE)) {
    contextMarkdown = fs.readFileSync(CONTEXT_FILE, 'utf8');
  } else {
    contextMarkdown = `# 專案上下文\n\n專案名稱: ${getProjectName()}`;
  }

  let recentSnapshotsText = '無近期快照記錄。';
  if (fs.existsSync(SNAPSHOT_FILE)) {
    const lines = fs.readFileSync(SNAPSHOT_FILE, 'utf8').trim().split('\n');
    const validSnapshots: Snapshot[] = [];
    for (const line of lines.reverse()) {
      try {
        if (line.trim()) {
          validSnapshots.push(JSON.parse(line));
        }
      } catch (e) {
        // Ignore
      }
      if (validSnapshots.length >= 10) break;
    }

    if (validSnapshots.length > 0) {
      recentSnapshotsText = validSnapshots
        .reverse()
        .map(s => {
          const time = new Date(s.ts).toLocaleTimeString();
          let detail = `[${s.type}] ${time}: ${s.summary}`;
          if (s.decision) detail += ` (決策: ${s.decision})`;
          if (s.state) {
            detail += `\n  - 已完成: ${s.state.completed.join(', ') || '無'}`;
            detail += `\n  - 進行中: ${s.state.in_progress.join(', ') || '無'}`;
            detail += `\n  - 下步任務: ${s.state.next_action || '無'}`;
          }
          return detail;
        })
        .join('\n\n');
    }
  }

  const output = `=========================================
## 📋 上下文已恢復 (Prompt Context Ready)
=========================================

${contextMarkdown}

---

## 🕒 近期快照歷史 (Last 10 entries)

\`\`\`text
${recentSnapshotsText}
\`\`\`

---
*你可以直接將此上下文複製提供給新對話中的 AI 助理。*
`;
  console.log(output);
}
