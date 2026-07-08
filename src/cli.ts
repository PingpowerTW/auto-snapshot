import { Command } from 'commander';
import { initProject, captureSnapshot, checkAndCompress, recoverContext, SnapshotType, SnapshotState } from './core.js';

const program = new Command();

program
  .name('auto-snapshot')
  .description('Local persistent memory and auto-snapshot tool for AI coding agents')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize .agent directory, PROJECT_CONTEXT.md, and SNAPSHOT.jsonl')
  .option('-n, --name <name>', 'Custom project name')
  .action((options) => {
    initProject(options.name);
  });

program
  .command('capture')
  .description('Capture a new snapshot entry')
  .argument('<type>', 'Snapshot type (milestone, phase_switch, handoff, periodic, decision)')
  .argument('<summary>', 'Short summary of the milestone or state')
  .option('-f, --files <files>', 'Comma-separated list of modified files')
  .option('-t, --tags <tags>', 'Comma-separated list of tags')
  .option('-d, --decision <decision>', 'Key decision detail')
  .option('-s, --skill <skill>', 'Bind this snapshot to a specific agent skill (for cross-skill recall)')
  .option('--completed <items>', 'Comma-separated completed items (for handoff type)')
  .option('--in-progress <items>', 'Comma-separated in-progress items (for handoff type)')
  .option('--pending <items>', 'Comma-separated pending items (for handoff type)')
  .option('--blockers <items>', 'Comma-separated blocker items (for handoff type)')
  .option('--next-action <action>', 'Suggested next action')
  .action((typeStr, summary, options) => {
    const validTypes: SnapshotType[] = ['milestone', 'phase_switch', 'handoff', 'periodic', 'decision'];
    if (!validTypes.includes(typeStr as SnapshotType)) {
      console.error(`Invalid type: ${typeStr}. Must be one of: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    const type = typeStr as SnapshotType;

    const files = options.files ? options.files.split(',').map((f: string) => f.trim()) : undefined;
    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;
    const decision = options.decision;
    const skill = options.skill;

    let state: SnapshotState | undefined = undefined;
    if (
      options.completed ||
      options.inProgress ||
      options.pending ||
      options.blockers ||
      options.nextAction
    ) {
      state = {
        completed: options.completed ? options.completed.split(',').map((s: string) => s.trim()) : [],
        in_progress: options.inProgress ? options.inProgress.split(',').map((s: string) => s.trim()) : [],
        pending: options.pending ? options.pending.split(',').map((s: string) => s.trim()) : [],
        blockers: options.blockers ? options.blockers.split(',').map((s: string) => s.trim()) : [],
        next_action: options.nextAction || '',
      };
    }

    captureSnapshot(type, summary, { files, tags, decision, skill, state });
  });

program
  .command('compress')
  .description('Trigger episodic compression of snapshots manually')
  .action(() => {
    checkAndCompress();
  });

program
  .command('recover')
  .description('Recover project context and display last 10 snapshots')
  .option('-s, --skill <skill>', 'Filter snapshots by a specific agent skill')
  .option('-q, --query <query>', 'A query string for keyword fingerprinting (decides if remote lookup is needed)')
  .action((options) => {
    recoverContext({ skill: options.skill, query: options.query });
  });

program.parse();
