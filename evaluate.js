import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import {
  initProject,
  checkAndCompress,
  recoverContext,
  isContextSufficientLocally
} from './dist/core.js';

const AGENT_DIR = '.agent';
const SNAPSHOT_FILE = path.join(AGENT_DIR, 'SNAPSHOT.jsonl');

async function runEvaluation() {
  console.log('=== Starting Auto-Snapshot Evaluation ===\n');

  // 1. Initialize a clean auto-snapshot setup
  if (fs.existsSync(AGENT_DIR)) {
    console.log(`Cleaning up existing ${AGENT_DIR} directory...`);
    fs.rmSync(AGENT_DIR, { recursive: true, force: true });
  }

  console.log('Initializing clean project...');
  initProject('auto-snapshot-eval');

  if (!fs.existsSync(SNAPSHOT_FILE)) {
    throw new Error('Failed to initialize SNAPSHOT.jsonl');
  }

  // 2. Capture over 200 snapshots with varying tags, types, and summaries
  const numSnapshots = 210;
  console.log(`Generating ${numSnapshots} snapshots directly to file to prevent premature compression...`);

  const tagsList = [
    ['auth', 'security'],
    ['database', 'migration'],
    ['ui', 'frontend'],
    ['performance', 'optimization'],
    ['refactor', 'cleanup'],
    ['bugfix', 'critical'],
    ['testing', 'coverage'],
    ['docs', 'readme'],
    ['ci', 'workflow'],
    ['api', 'backend']
  ];

  const types = ['milestone', 'phase_switch', 'handoff', 'periodic', 'decision'];

  const snapshots = [];
  for (let i = 0; i < numSnapshots; i++) {
    const ts = new Date(Date.now() - (numSnapshots - i) * 60000).toISOString();
    const type = types[i % types.length];
    const tags = tagsList[i % tagsList.length];
    const summary = `Milestone summary for task ${i} with specific context information`;
    
    const snapshot = {
      ts,
      type,
      project: 'auto-snapshot-eval',
      summary,
      tags
    };

    if (type === 'decision') {
      snapshot.decision = `Decided to implement architecture pattern version ${i}`;
    }

    if (type === 'handoff') {
      snapshot.state = {
        completed: [`task-${i}-done1`, `task-${i}-done2`],
        in_progress: [`task-${i}-doing`],
        pending: [`task-${i}-todo`],
        blockers: i % 2 === 0 ? [`blocker-${i}`] : [],
        next_action: `Continue on feature branch ${i}`
      };
    }

    snapshots.push(snapshot);
  }

  // Write snapshots directly to SNAPSHOT.jsonl
  const rawContent = snapshots.map(s => JSON.stringify(s)).join('\n') + '\n';
  fs.writeFileSync(SNAPSHOT_FILE, rawContent, 'utf8');

  // Measure size and structure before compression
  const fileStatsBefore = fs.statSync(SNAPSHOT_FILE);
  const sizeBeforeBytes = fileStatsBefore.size;
  const linesBefore = fs.readFileSync(SNAPSHOT_FILE, 'utf8').trim().split('\n');

  // The first 150 lines are the ones that will be compressed
  const first150Lines = linesBefore.slice(0, 150);
  const rawSizeChars = first150Lines.join('\n').length;
  const rawTokens = rawSizeChars / 4;

  console.log(`\n--- Before Compression ---`);
  console.log(`Total snapshots in file: ${linesBefore.length}`);
  console.log(`Total file size: ${sizeBeforeBytes} bytes`);
  console.log(`Size of first 150 snapshots: ${rawSizeChars} characters`);
  console.log(`Estimated tokens of first 150 snapshots (4 chars = 1 token): ${rawTokens.toFixed(2)} tokens`);

  // 3. Measure execution time and memory usage of the compression run
  console.log(`\nTriggering compression run...`);
  const startMemory = process.memoryUsage();
  const startTime = performance.now();

  // Run the compression logic
  checkAndCompress();

  const endTime = performance.now();
  const endMemory = process.memoryUsage();

  const durationMs = endTime - startTime;
  const heapUsedDiff = endMemory.heapUsed - startMemory.heapUsed;

  console.log(`\n--- Compression Performance ---`);
  console.log(`Execution Time: ${durationMs.toFixed(4)} ms`);
  console.log(`Memory Usage:`);
  console.log(`  RSS Change: ${((endMemory.rss - startMemory.rss) / 1024 / 1024).toFixed(4)} MB`);
  console.log(`  Heap Total Change: ${((endMemory.heapTotal - startMemory.heapTotal) / 1024 / 1024).toFixed(4)} MB`);
  console.log(`  Heap Used Change: ${(heapUsedDiff / 1024 / 1024).toFixed(4)} MB`);
  console.log(`  End Heap Used: ${(endMemory.heapUsed / 1024 / 1024).toFixed(4)} MB`);

  // 4. Measure size and structure after compression
  const fileStatsAfter = fs.statSync(SNAPSHOT_FILE);
  const sizeAfterBytes = fileStatsAfter.size;
  const linesAfter = fs.readFileSync(SNAPSHOT_FILE, 'utf8').trim().split('\n');

  // The first line is the compressed archive snapshot
  const archiveSnapshotLine = linesAfter[0];
  const archiveSizeChars = archiveSnapshotLine.length;
  const archiveTokens = archiveSizeChars / 4;

  const tokenSavings = rawTokens - archiveTokens;
  const savingsPercent = (tokenSavings / rawTokens) * 100;

  console.log(`\n--- After Compression ---`);
  console.log(`Total snapshots in file: ${linesAfter.length}`);
  console.log(`Total file size: ${sizeAfterBytes} bytes`);
  console.log(`Archive snapshot size: ${archiveSizeChars} characters`);
  console.log(`Estimated archive snapshot tokens (4 chars = 1 token): ${archiveTokens.toFixed(2)} tokens`);
  console.log(`Estimated token savings: ${tokenSavings.toFixed(2)} tokens (${savingsPercent.toFixed(2)}% saved)`);
  console.log(`Archive snapshot preview:`);
  console.log(archiveSnapshotLine.substring(0, 150) + '...');

  // 5. Exercise keyword fingerprinting lookup
  console.log(`\n=== Testing Keyword Fingerprinting ===`);

  // Read current SNAPSHOT.jsonl lines
  const finalRawLines = fs.readFileSync(SNAPSHOT_FILE, 'utf8').trim().split('\n');
  const allParsed = [];
  for (const line of [...finalRawLines].reverse()) {
    if (line.trim()) {
      allParsed.push(JSON.parse(line));
    }
  }

  // The 10 most recent snapshots
  const recentSnapshots = allParsed.slice(0, 10);
  console.log(`Latest 10 snapshots tags:`);
  recentSnapshots.forEach((s, idx) => {
    console.log(`  [Snapshot ${idx}] Type: ${s.type}, Tags: [${s.tags ? s.tags.join(', ') : ''}]`);
  });

  const overlappingQuery = "How can I integrate the backend API into the system?";
  const nonOverlappingQuery = "Setup Kubernetes deployment for multi-region clustering";

  console.log(`\n[Scenario A: Overlapping Query]`);
  console.log(`Query: "${overlappingQuery}"`);
  
  const t0 = performance.now();
  const adequacyA = isContextSufficientLocally(overlappingQuery, recentSnapshots);
  const t1 = performance.now();
  const durationA = t1 - t0;
  console.log(`isContextSufficientLocally result: ${adequacyA} (Expected: true)`);
  console.log(`Execution time: ${durationA.toFixed(4)} ms`);
  
  console.log(`Running recoverContext for Scenario A:`);
  const recT0 = performance.now();
  recoverContext({ query: overlappingQuery });
  const recT1 = performance.now();
  console.log(`recoverContext execution time: ${(recT1 - recT0).toFixed(4)} ms`);

  console.log(`\n[Scenario B: Non-overlapping Query]`);
  console.log(`Query: "${nonOverlappingQuery}"`);
  
  const t2 = performance.now();
  const adequacyB = isContextSufficientLocally(nonOverlappingQuery, recentSnapshots);
  const t3 = performance.now();
  const durationB = t3 - t2;
  console.log(`isContextSufficientLocally result: ${adequacyB} (Expected: false)`);
  console.log(`Execution time: ${durationB.toFixed(4)} ms`);

  console.log(`Running recoverContext for Scenario B:`);
  const recT2 = performance.now();
  recoverContext({ query: nonOverlappingQuery });
  const recT3 = performance.now();
  console.log(`recoverContext execution time: ${(recT3 - recT2).toFixed(4)} ms`);

  console.log(`\nEvaluation complete!`);
}

runEvaluation().catch(err => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
