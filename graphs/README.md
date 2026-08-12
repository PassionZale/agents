# Graphify 知识图谱

本目录存放用 [graphify](https://github.com/Graphify-Labs/graphify) 构建的代码知识图谱。每个子目录对应一个源 repo,产物在该子目录的 `graphify-out/` 下,供 MCP server / CLI 查询。

源 repo 位于 `~/Documents/zhongran/`。下方命令均从项目根(`/Users/zhanglei/Documents/www/agents`)执行。

## 1. 安装 graphify

```bash
uv tool install "graphifyy[mcp]"   # PyPI 包名 graphifyy(双 y),CLI 是 graphify;[mcp] 带 MCP server 依赖
```

纯代码图谱(`--code-only`)走本地 tree-sitter AST,**无需 API key**。要让 graphify 对 docs/PDF/图片做语义提取,需另装 LLM backend extra(如 `[anthropic]` / `[ollama]`)并配置 key。

## 2. 构建图谱

```bash
cd /Users/zhanglei/Documents/www/agents
mkdir -p graphs

REPOS="yos-web yos-web-ai yph-customer-web yph-dingtalkgroup-web yph-comments-web"
for d in $REPOS; do
  graphify extract "/Users/zhanglei/Documents/zhongran/$d" --out "graphs/$d" --code-only
done
```

> `extract --code-only` 只产出 `graph.json` + `manifest.json` + `cache/`,**不含报告和可视化**——需要下一步。

## 3. 生成报告与可视化

`GRAPH_REPORT.md`(god nodes / 循环依赖 / 意外连接)和 `graph.html`(交互可视化)由 `cluster-only` 生成:

```bash
for d in $REPOS; do
  graphify cluster-only "graphs/$d" --no-label
done
```

`--no-label` 跳过 LLM 社区命名,社区名为 `Community N` 占位;god nodes 等节点名不受影响。要语义化社区名,配 LLM backend 后跑 `graphify label graphs/<repo> --backend <b>`。

## 产物结构

```
graphs/
├── <repo>/graphify-out/
│   ├── graph.json          # 图谱数据,供 query / MCP server
│   ├── GRAPH_REPORT.md     # god nodes、社区、意外连接、循环依赖
│   ├── graph.html          # 浏览器交互可视化
│   ├── manifest.json       # 提取清单
│   └── cache/              # 增量缓存
└── <repo>.build.log        # extract 日志
```

## 当前规模

| repo | nodes | edges | communities |
|---|---:|---:|---:|
| yos-web | 3,429 | 11,952 | 178 |
| yph-customer-web | 2,452 | 2,929 | 192 |
| yph-dingtalkgroup-web | 535 | 566 | 63 |
| yph-comments-web | 496 | 606 | 47 |
| yos-web-ai | 456 | 549 | 66 |

## 增量更新

源 repo 代码变更后,增量更新即可(纯 AST,无 API 成本):

```bash
graphify update "graphs/<repo>"     # 只重新提取改动的文件
graphify watch "graphs/<repo>"      # 或监听文件变化自动重建
```

## 查询与 MCP server

```bash
# CLI 查询
graphify query "登录流程" --graph graphs/yos-web/graphify-out/graph.json

# MCP server(stdio 默认,不占端口,由 client 拉起)
graphify-mcp graphs/yos-web/graphify-out/graph.json
# http 模式(占 8080,常驻)
graphify-mcp graphs/yos-web/graphify-out/graph.json --transport http --port 8080
```

停止:http 前台 `Ctrl+C`;后台 `pkill -f graphify-mcp`。stdio 随 client 进程自动退出。

## 接入 mastra(stdio MCP)

`src/mastra/agents/graphify-agent.ts` 通过 `MCPClient`(`@mastra/mcp`)以 stdio 拉起 `graphify-mcp`,加载 `graphs/merged.json`,工具直接注入 agent:

```typescript
import { MCPClient } from '@mastra/mcp';

const graphifyMcp = new MCPClient({
  id: 'graphify',
  servers: {
    graphify: {
      command: 'graphify-mcp',
      args: ['graphs/merged.json'],   // 合并图(5 repo)
    },
  },
});

const agent = new Agent({
  /* id / instructions / model / workspace ... */
  tools: await graphifyMcp.listTools(),
});
```

> 生产中用 `listToolsWithErrors()` 替代 `listTools()`:graphify-mcp 连接失败时 mastra 仍能启动,错误进 `errors` 字段而不抛异常。

graphify-mcp 暴露的 10 个工具(注入后命名空间为 `graphify_*`):
- **图谱查询**:`query_graph`、`shortest_path`、`get_node`、`get_neighbors`、`get_community`、`god_nodes`、`graph_stats`
- **PR 相关**(需源 repo 的 `gh` 上下文,本项目里基本用不上):`list_prs`、`get_pr_impact`、`triage_prs`

agent 还配了 workspace 的 `beforeToolCall` 钩子:首次 read/grep 前拦截一次,提示先用 `graphify_query_graph` 定位。

### 运行

```bash
npm run dev          # mastra dev 启动时由 MCPClient 自动拉起 graphify-mcp(stdio)
```

打开 [Studio](http://localhost:4111) → 选 **Graphify Agent** → 提问(如「yos-web 的登录流程涉及哪些模块?」)。graphify-mcp 随 mastra 进程生灭,无需手动启停,不占端口。

### 注意

- **workspace contained**:agent 的 `LocalFilesystem` basePath 是本项目目录,5 个源 repo 在 `~/Documents/zhongran`(项目外),contained 模式下读不到源文件。靠图谱查询通常够用;要让 agent 能读源 repo,给 workspace 加 `allowedPaths: ['~/Documents/zhongran']`。
- **依赖**:需 `.env` 配 `OPENAI_API_KEY`(模型为 `openai/deepseek-v4-pro`);`graphify-mcp` 需在 PATH(`uv tool install graphifyy[mcp]`)。
