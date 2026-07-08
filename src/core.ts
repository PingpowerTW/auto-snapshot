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
  /** Cross-skill binding: name of the agent skill this snapshot belongs to */
  skill?: string;
  state?: SnapshotState;
}

/** Extracted knowledge item ready to be written to a hot store (e.g. Supabase). */
export interface RefinedKnowledge {
  topic: string;
  decisions: string[];
  milestones: string[];
  tags: string[];
  dateRange: { start: string; end: string };
  /** Raw JSON suitable for inserting into Supabase knowledge_items */
  supabasePayload: string;
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
  options: { files?: string[]; tags?: string[]; decision?: string; skill?: string; state?: SnapshotState } = {}
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

  // --- Hot Distillation: extract high-value knowledge from cold snapshots ---
  const refined = distillKnowledge(parsedOldest);

  // Output refined knowledge so the caller / AI agent can pipe it to a hot store (e.g. Supabase)
  if (refined.decisions.length > 0 || refined.milestones.length > 0) {
    console.log('\n[Auto-Snapshot] 🔥 Hot Distillation — refined knowledge ready for hot store:');
    console.log('  Paste the following JSON into your Supabase knowledge_items table, or handle it in your agent:');
    console.log(refined.supabasePayload);
    console.log('');
  }

  const archiveSnapshot: Snapshot = {
    ts: new Date().toISOString(),
    type: 'compressed_archive',
    project: getProjectName(),
    summary: refined.topic,
    tags: refined.tags,
  };

  const newLines = [
    JSON.stringify(archiveSnapshot),
    ...newestLines
  ];

  fs.writeFileSync(SNAPSHOT_FILE, newLines.join('\n') + '\n', 'utf8');
  console.log(`[Auto-Snapshot] Compression completed. Retained latest ${newestLines.length + 1} snapshots.`);
}

/**
 * Distills a batch of cold snapshots into a structured knowledge item
 * ready to be written to a hot store (Supabase / any vector DB).
 */
function distillKnowledge(snapshots: Snapshot[]): RefinedKnowledge {
  const dateRangeStart = snapshots[0]?.ts ? new Date(snapshots[0].ts).toLocaleDateString() : 'Unknown';
  const dateRangeEnd = snapshots[snapshots.length - 1]?.ts
    ? new Date(snapshots[snapshots.length - 1].ts).toLocaleDateString()
    : 'Unknown';

  const milestones = snapshots
    .filter(s => s.type === 'milestone')
    .map(s => s.summary);

  const decisions = snapshots
    .filter(s => s.type === 'decision' || !!s.decision)
    .map(s => s.decision || s.summary);

  const allTags = new Set<string>();
  snapshots.forEach(s => {
    if (s.tags) s.tags.forEach(t => allTags.add(t));
  });

  const milestoneSummary = milestones.length > 0
    ? `完成 ${milestones.length} 個里程碑 (${milestones.slice(0, 5).join(', ')} 等)`
    : '無里程碑變更';

  const decisionSummary = decisions.length > 0
    ? `做出 ${decisions.length} 項關鍵決策 (${decisions.slice(0, 3).join(', ')} 等)`
    : '無重大決策';

  const topic = `[壓縮歸檔] 期間：${dateRangeStart} ~ ${dateRangeEnd}。工作概述：${milestoneSummary}。${decisionSummary}。`;

  const supabasePayload = JSON.stringify({
    issue: `期間 ${dateRangeStart}~${dateRangeEnd} 工作摘要`,
    solution: `里程碑：${milestones.join(' | ')} | 決策：${decisions.join(' | ')}`,
    confidence: 0.8,
    tags: Array.from(allTags),
    source: 'auto-snapshot:compression',
    created_at: new Date().toISOString(),
  }, null, 2);

  return {
    topic,
    decisions,
    milestones,
    tags: Array.from(allTags),
    dateRange: { start: dateRangeStart, end: dateRangeEnd },
    supabasePayload,
  };
}

// ---------------------------------------------------------------------------
// Keyword Fingerprinting: extract candidate keywords from a query string
// ---------------------------------------------------------------------------
function extractKeywords(text: string): string[] {
  // Normalise → split on whitespace / CJK boundaries → strip stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'in', 'on', 'at', 'to', 'and', 'or', 'of',
    '的', '了', '是', '在', '我', '你', '他', '她', '它', '有', '這', '那',
  ]);

  return text
    .toLowerCase()
    .split(/[\s,，。、！？\-_/\\]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !stopWords.has(w));
}

/**
 * Compare query keywords against tags from recent snapshots.
 * Returns true if at least one tag overlaps → skip the remote Supabase lookup.
 */
export function isContextSufficientLocally(query: string, recentSnapshots: Snapshot[]): boolean {
  const queryKeywords = new Set(extractKeywords(query));
  if (queryKeywords.size === 0) return false;

  const recentTags = new Set<string>();
  recentSnapshots.forEach(s => {
    if (s.tags) s.tags.forEach(t => recentTags.add(t.toLowerCase()));
  });

  // If any query keyword overlaps with local tags, local memory is sufficient
  for (const kw of queryKeywords) {
    if (recentTags.has(kw)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// recoverContext — supports optional skill filter and keyword fingerprinting
// ---------------------------------------------------------------------------
export function recoverContext(options: { skill?: string; query?: string } = {}): void {
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
  let locallyAdequate = false;

  if (fs.existsSync(SNAPSHOT_FILE)) {
    const rawLines = fs.readFileSync(SNAPSHOT_FILE, 'utf8').trim().split('\n');

    // Parse all snapshots (reverse order = newest first)
    const allParsed: Snapshot[] = [];
    for (const line of [...rawLines].reverse()) {
      try {
        if (line.trim()) allParsed.push(JSON.parse(line));
      } catch {
        // Ignore corrupted lines
      }
    }

    // --- Cross-Skill Binding: filter by skill if requested ---
    const filtered = options.skill
      ? allParsed.filter(s => !s.skill || s.skill === options.skill)
      : allParsed;

    const validSnapshots = filtered.slice(0, 10);

    // --- Keyword Fingerprinting: decide if remote lookup is necessary ---
    if (options.query && validSnapshots.length > 0) {
      locallyAdequate = isContextSufficientLocally(options.query, validSnapshots);
    }

    if (validSnapshots.length > 0) {
      recentSnapshotsText = [...validSnapshots]
        .reverse()
        .map(s => {
          const time = new Date(s.ts).toLocaleTimeString();
          let detail = `[${s.type}${s.skill ? `@${s.skill}` : ''}] ${time}: ${s.summary}`;
          if (s.decision) detail += ` (決策: ${s.decision})`;
          if (s.tags?.length) detail += `\n  🏷️ tags: ${s.tags.join(', ')}`;
          if (s.state) {
            detail += `\n  ✅ 已完成: ${s.state.completed.join(', ') || '無'}`;
            detail += `\n  🔄 進行中: ${s.state.in_progress.join(', ') || '無'}`;
            detail += `\n  ➡️  下步任務: ${s.state.next_action || '無'}`;
          }
          return detail;
        })
        .join('\n\n');
    }
  }

  const fingerprintNote = options.query
    ? locallyAdequate
      ? '✅ 本地記憶覆蓋查詢，無需查詢遠端知識庫。'
      : '⚠️  本地記憶不足，建議查詢遠端 Supabase Memory Engine。'
    : '';

  const skillNote = options.skill ? `\n🔧 **已篩選 Skill**: \`${options.skill}\`` : '';

  const output = `=========================================
## 📋 上下文已恢復 (Prompt Context Ready)
=========================================
${skillNote}
${contextMarkdown}

---

## 🕒 近期快照歷史 (Last 10 entries)

\`\`\`text
${recentSnapshotsText}
\`\`\`

${fingerprintNote}

---
*你可以直接將此上下文複製提供給新對話中的 AI 助理。*
`;
  console.log(output);
}
