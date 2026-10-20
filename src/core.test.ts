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
    } finally {
      console.log = origLog;
    }
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
