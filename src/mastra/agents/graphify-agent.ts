import { existsSync } from 'node:fs';

import { Agent } from '@mastra/core/agent';
import { LocalFilesystem, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';
import { MCPClient } from '@mastra/mcp';

// Absolute path via env. Mastra dev runs the app worker with cwd=src/mastra/public,
// and graphify-mcp (a child process) inherits it, so a relative path resolves wrong.
// See https://github.com/mastra-ai/mastra/issues/11081
const GRAPH_PATH = process.env.GRAPHIFY_GRAPH_PATH;
if (!GRAPH_PATH) {
  throw new Error(
    'GRAPHIFY_GRAPH_PATH is not set. Add it to .env with the absolute path to graphs/merged.json ' +
      '(Mastra dev cwd is src/mastra/public, so relative paths break).',
  );
}

// Deny-once per process: nudge the agent to query the graph before reading raw files.
const deniedOnce = new Set<string>();
const READ_OR_SEARCH = new Set<string>([
  String(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE),
  String(WORKSPACE_TOOLS.FILESYSTEM.GREP),
  String(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES),
]);

const workspace = new Workspace({
  id: 'graphify-workspace',
  name: 'Graphify Workspace',
  filesystem: new LocalFilesystem({ basePath: process.cwd() }),
  tools: {
    hooks: {
      beforeToolCall: ({ workspaceToolName }) => {
        if (!READ_OR_SEARCH.has(String(workspaceToolName))) return;
        if (!existsSync(GRAPH_PATH)) return;
        if (!deniedOnce.has('session')) {
          deniedOnce.add('session');
          return {
            proceed: false as const,
            output: {
              denied: true,
              message:
                'graphify strict mode: a merged knowledge graph (graphs/merged.json, 5 repos) is available. ' +
                'Call graphify_query_graph FIRST to orient, then re-issue this read — it will be allowed. ' +
                'This block fires at most once per session.',
            },
          };
        }
        return;
      },
    },
  },
});

// MCP client: spawn graphify-mcp over stdio, serving the merged graph.
// graphify-mcp must be on PATH (~/.local/bin via `uv tool install graphifyy[mcp]`).
const graphifyMcp = new MCPClient({
  id: 'graphify',
  servers: {
    graphify: {
      command: 'graphify-mcp',
      args: [GRAPH_PATH]
    },
  },
});

// listToolsWithErrors: if graphify-mcp fails to connect, mastra still boots and we log the error.
const { tools: graphifyTools, errors: mcpErrors } = await graphifyMcp.listToolsWithErrors();
if (mcpErrors && mcpErrors.graphify) {
  console.error('[graphify MCP] failed to connect:', mcpErrors.graphify);
}

export const graphifyAgent = new Agent({
  id: 'graphify-agent',
  name: 'Graphify Agent',
  description:
    'A code-exploration agent that orients via a graphify knowledge graph (5 repos merged) before reading raw source files.',
  instructions: `A graphify knowledge graph is available via the graphify_* MCP tools. graphs/merged.json merges 5 repos: yos-web, yos-web-ai, yph-customer-web, yph-dingtalkgroup-web, yph-comments-web.

When exploring code, use graphify_query_graph / graphify_shortest_path / graphify_get_node / graphify_get_neighbors FIRST to orient yourself, BEFORE reading raw source files. Only read raw files to modify/debug specific lines.

Each graph node carries a source file path, so you can tell which repo a result comes from.
`,
  model: 'newapi/deepseek-v4-pro',
  memory: new Memory({
    options: {
      generateTitle: true,
      observationalMemory: {
        model: 'newapi/deepseek-v4-flash',
      },
    },
  }),
  workspace,
  tools: graphifyTools,
});
