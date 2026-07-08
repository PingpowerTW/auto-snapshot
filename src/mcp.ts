import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { initProject, captureSnapshot, checkAndCompress, recoverContext, SnapshotType, SnapshotState } from './core.js';
import fs from 'fs';
import path from 'path';

const server = new Server(
  {
    name: 'auto-snapshot-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register list of available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'snapshot_init',
        description: 'Initialize `.agent` directory, default context file, and snapshot log file.',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: {
              type: 'string',
              description: 'Optional custom project name override.',
            },
          },
        },
      },
      {
        name: 'snapshot_capture',
        description: 'Capture a new development or state snapshot to SNAPSHOT.jsonl.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['milestone', 'phase_switch', 'handoff', 'periodic', 'decision'],
              description: 'The type of snapshot to log.',
            },
            summary: {
              type: 'string',
              description: 'A brief description of what was completed or the current status (<= 200 chars).',
            },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of files modified or created.',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords associated with this snapshot.',
            },
            decision: {
              type: 'string',
              description: 'Important architectural or technical decision made.',
            },
            skill: {
              type: 'string',
              description: 'Optional: bind this snapshot to a specific agent skill name for cross-skill recall (e.g. "firebase-rules", "auth").',
            },
            state: {
              type: 'object',
              properties: {
                completed: { type: 'array', items: { type: 'string' } },
                in_progress: { type: 'array', items: { type: 'string' } },
                pending: { type: 'array', items: { type: 'string' } },
                blockers: { type: 'array', items: { type: 'string' } },
                next_action: { type: 'string' },
              },
              description: 'Detailed progress state mapping, primarily used for handoff snapshots.',
            },
          },
          required: ['type', 'summary'],
        },
      },
      {
        name: 'snapshot_recover',
        description: 'Read and display the current PROJECT_CONTEXT.md and the last 10 snapshots. Supports skill filtering and keyword fingerprinting to determine if a remote knowledge-base lookup is needed.',
        inputSchema: {
          type: 'object',
          properties: {
            skill: {
              type: 'string',
              description: 'Optional: filter snapshots to those tagged with this skill name.',
            },
            query: {
              type: 'string',
              description: 'Optional: current user query to run keyword fingerprinting. The tool will indicate whether local memory is sufficient or a remote Supabase lookup is advised.',
            },
          },
        },
      },
      {
        name: 'snapshot_compress',
        description: 'Manually run episodic compression if snapshot count exceeds 200 lines.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'snapshot_init': {
        const projectName = (args as any)?.projectName;
        initProject(projectName);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully initialized auto-snapshot setup.`,
            },
          ],
        };
      }

      case 'snapshot_capture': {
        const type = (args as any).type as SnapshotType;
        const summary = (args as any).summary as string;
        const files = (args as any).files;
        const tags = (args as any).tags;
        const decision = (args as any).decision;
        const skill = (args as any).skill;
        const state = (args as any).state as SnapshotState | undefined;

        captureSnapshot(type, summary, { files, tags, decision, skill, state });
        return {
          content: [
            {
              type: 'text',
              text: `Snapshot logged successfully: [${type}] "${summary}"`,
            },
          ],
        };
      }

      case 'snapshot_recover': {
        const skill = (args as any)?.skill as string | undefined;
        const query = (args as any)?.query as string | undefined;
        // Capture stdout to return it to the tool caller
        const oldLog = console.log;
        let logOutput = '';
        console.log = (...logArgs) => {
          logOutput += logArgs.join(' ') + '\n';
        };

        try {
          recoverContext({ skill, query });
        } finally {
          console.log = oldLog;
        }

        return {
          content: [
            {
              type: 'text',
              text: logOutput,
            },
          ],
        };
      }

      case 'snapshot_compress': {
        checkAndCompress();
        return {
          content: [
            {
              type: 'text',
              text: `Compression checks executed.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing tool: ${error?.message || error}`,
        },
      ],
    };
  }
});

// Start StdIO transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Auto-Snapshot] Stdio server connected and running...');
}

run().catch((error) => {
  console.error('[Auto-Snapshot] Fatal error in MCP server:', error);
  process.exit(1);
});
