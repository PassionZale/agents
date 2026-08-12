# AGENTS.md

## CRITICAL: Load `mastra` skill first

Load the `mastra` skill BEFORE any Mastra work. Never rely on cached knowledge — APIs change between versions.

## Rules

- Register all agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly
- Do not use `npm run build` as a syntax/type checker
- Do not start the local dev server (`npm run dev`) on your own
- Mastra runs the app worker with cwd `src/mastra/public` (dev) / `.mastra/output` (start); relative paths and child-process args (e.g. MCP servers) resolve against that cwd, not the repo root — pass file paths as absolute values via env vars (e.g. `GRAPHIFY_GRAPH_PATH`). See [mastra-ai/mastra#11081](https://github.com/mastra-ai/mastra/issues/11081).

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
