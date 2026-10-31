import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SWA_BOUNDED_REPLAY_LIMIT,
  normalizeEngramText,
  isContextSufficientLocally,
  initProject,
  captureSnapshot,
  recoverContext,
  type Snapshot,
} from './core.js';

// npm cmd-shim 僅在 bin 有 shebang 時才經 node 執行；缺失會讓 Windows CLI 靜默 no-op（exit 0、不寫快照）
test('every package.json bin starts with node shebang (npm cmd-shim contract)', () => {
  const pkgUrl = new URL('../package.json', import.meta.url);
  const { bin } = JSON.parse(fs.readFileSync(pkgUrl, 'utf8'));
  for (const rel of typeof bin === 'string' ? [bin] : Object.values<string>(bin)) {
    assert.ok(fs.readFileSync(new URL(rel, pkgUrl), 'utf8').startsWith('#!/usr/bin/env node'), rel);
  }
});

test('normalizeEngramText normalizes NFKC fullwidth, strips NFD accents, lowercases, and collapses whitespace', () => {
  assert.equal(normalizeEngramText('  Ｃafé\t\n  ＲÉSUMÉ  '), 'cafe resume');
  assert.equal(normalizeEngramText('DeepSeek-V4.1  Flash'), 'deepseek-v4.1 flash');
});

test('isContextSufficientLocally matches Engram 3-grams, CJK 2-grams, synonyms, and rejects unrelated queries', () => {
  const snapshots: Snapshot[] = [
    {
      ts: new Date().toISOString(),
      type: 'milestone',
      project: 'demo',
      summary: '實裝記憶熱蒸餾與資料庫索引調校',
      tags: ['perf', 'authentication'],
    },
  ];

  // CJK 2-gram match inside 4-char CJK compound ("記憶熱蒸餾" -> contains "蒸餾", "熱蒸")
  assert.equal(isContextSufficientLocally('如何處理蒸餾問題', snapshots), true);
  // General 3-gram / substring match ("authentication" vs "authentic")
  assert.equal(isContextSufficientLocally('authentic token', snapshots), true);
  // Synonym match ('performance' -> 'perf')
  assert.equal(isContextSufficientLocally('performance', snapshots), true);
  // True negative on unrelated query
  assert.equal(isContextSufficientLocally('kubernetes helm chart', snapshots), false);
});

test('recoverContext enforces SWA_BOUNDED_REPLAY_LIMIT (7) by default and clamps --keep in [1, 50]', () => {
  assert.equal(SWA_BOUNDED_REPLAY_LIMIT, 7);
  const origCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-snapshot-test-'));

  try {
    process.chdir(tmpDir);
    initProject('swa-test');
    for (let i = 1; i <= 10; i++) {
      captureSnapshot('milestone', `step-${i}-marker`, { tags: [`tag${i}`] });
    }

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
    try {
      // Default keep = 7 -> keeps step-4..step-10, drops step-1..step-3
      recoverContext({ query: 'step-10-marker' });
      const defaultOut = logs.join('\n');
      assert.equal(defaultOut.includes('step-10-marker'), true);
      assert.equal(defaultOut.includes('step-4-marker'), true);
      assert.equal(defaultOut.includes('step-3-marker'), false);
      assert.equal(defaultOut.includes('✅ 本地記憶覆蓋查詢'), true);

      // Explicit keep = 2 -> keeps only step-9 and step-10
      logs.length = 0;
      recoverContext({ keep: 2 });
      const keep2Out = logs.join('\n');
      assert.equal(keep2Out.includes('step-10-marker'), true);
      assert.equal(keep2Out.includes('step-9-marker'), true);
      assert.equal(keep2Out.includes('step-8-marker'), false);

      // Querying older snapshot (step-2-marker) recalls it while preserving newest step-10-marker in chronological order
      logs.length = 0;
      recoverContext({ query: 'step-2-marker tag2' });
      const cragOut = logs.join('\n');
      const idx2 = cragOut.indexOf('step-2-marker');
      const idx10 = cragOut.indexOf('step-10-marker');
      assert.ok(idx2 !== -1, 'older matching snapshot step-2-marker should be recalled');
      assert.ok(idx10 !== -1, 'latest snapshot step-10-marker must not be dropped');
      assert.ok(idx2 < idx10, 'chronological order (older before newer) must be preserved');
      assert.equal(cragOut.includes('step-4-marker'), false, 'must evict oldest window entry to respect keep=7 bound');
      assert.equal(cragOut.includes('step-5-marker'), true, 'must keep remaining 6 newest entries');

      // Legacy schema fallback: timestamp + title instead of ts + summary must not render Invalid Date: undefined
      fs.appendFileSync(
        path.join('.agent', 'SNAPSHOT.jsonl'),
        JSON.stringify({ type: 'decision', title: 'legacy-title-marker', decision: 'legacy-dec', timestamp: '2026-10-10T19:00:00Z' }) + '\n',
        'utf8'
      );
      logs.length = 0;
      recoverContext({ keep: 3 });
      const legacyOut = logs.join('\n');
      assert.equal(legacyOut.includes('legacy-title-marker'), true);
      assert.equal(legacyOut.includes('Invalid Date'), false);
      assert.equal(legacyOut.includes('undefined'), false);

      // Workspace Path Pinning (DeepSeek-TUI compaction.rs): older snapshot referencing an existing workspace file
      // receives a +1 tie-breaker boost over window entries with equal keyword hits; non-existent file does not
      const nonExistentSnap = JSON.stringify({
        ts: '2026-09-30T00:00:00Z',
        type: 'milestone',
        project: 'swa-test',
        summary: 'shared-kw missing-file entry',
        files: ['ghost-does-not-exist.ts'],
      });
      fs.writeFileSync('pinned-anchor.ts', 'export const x = 1;\n', 'utf8');
      const pinnedSnap = JSON.stringify({
        ts: '2026-10-01T00:00:00Z',
        type: 'milestone',
        project: 'swa-test',
        summary: 'shared-kw older pinned entry',
        files: ['pinned-anchor.ts'],
      });
      const existingLines = fs.readFileSync(path.join('.agent', 'SNAPSHOT.jsonl'), 'utf8');
      fs.writeFileSync(path.join('.agent', 'SNAPSHOT.jsonl'), nonExistentSnap + '\n' + pinnedSnap + '\n' + existingLines, 'utf8');
      captureSnapshot('milestone', 'shared-kw recent unpinned entry');
      logs.length = 0;
      recoverContext({ query: 'shared-kw', keep: 3 });
      const pinnedOut = logs.join('\n');
      assert.equal(pinnedOut.includes('shared-kw older pinned entry'), true, 'existing workspace file path must boost older snapshot recall');
      assert.equal(pinnedOut.includes('shared-kw missing-file entry'), false, 'non-existent file path must not receive tie-breaker boost');
    } finally {
      console.log = origLog;
    }
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
