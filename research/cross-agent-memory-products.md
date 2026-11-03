# 本地跨 Agent Memory 产品调研

研究日期：2026-10-31

本文回答三个问题：

1. 现在有没有“本地、不上云、能跨多个 agent 共享 memory”的产品？
2. 有没有像 Magpie 一样小、驻留 macOS 菜单栏、能自动发现 agent 的 memory 应用？
3. Mem0、Link、Memorix 等产品分别处在什么位置，dachshund 还剩下什么差异化空间？

## 结论先行

**有，而且不是空白赛道。**

截至本调研日期，最接近“memory 版 Magpie”的产品是 **Link + LinkBar**：

- memory 存在本地 Markdown；
- `lnk setup` 会发现机器上安装了哪些 coding agent，并接入 CLI、MCP 和 hooks；
- 有 macOS 菜单栏应用 LinkBar；
- 有 review inbox，agent 提议的长期记忆需要用户确认；
- 不要求云账号，跨设备同步是可选的、用户自己控制的。

但它并不是 dachshund 的完全替代品。Link 的重心是“给 agent 建立一套新的共享 memory
工作流”；dachshund 的重心是“先把你机器上各个 agent 已经写下的 memory 读进同一个
本地库”。这是两个不同但相邻的产品楔子。

若按“自动发现已有 agent memory 文件”这个条件筛选，dachshund 仍然更接近用户当前
提出的需求。Link 会发现 agent 安装，但主要接入自己管理的本地 wiki，并不以导入各
agent 已有的 memory 文件为主。

## 先把“像 Magpie”定义清楚

Magpie 的产品形状不是“一个 memory SDK”，而是以下组合：

| 特征 | Magpie | Memory 版需要对应成什么 |
| --- | --- | --- |
| 常驻入口 | macOS 菜单栏 + 小面板 | memory 的快速搜索、最近变化、待确认项 |
| 自动发现 | 发现已安装 agent | 发现本机 agent、home 目录、配置和已有 memory |
| 一处控制 | 一个 agent 切换模型 | 一个 agent 读取/写入同一份 memory |
| 本地网关 | `127.0.0.1` | 本地 MCP / HTTP，不依赖云账号 |
| 小而非平台 | 单机个人工具 | 不是知识图谱平台、不是团队 SaaS |

因此，“像 Magpie”不等于“有一个菜单栏图标”。真正的关键是：

**打开就能看到本机已有的 agents，而不是要求用户先学习一套新的 memory 产品。**

## 直接相关产品

### Link / LinkBar

[Link](https://github.com/gowtham0992/link) 是当前最接近目标形态的项目。

- 本地 Markdown 是 memory 的可读载体；
- 通过 CLI、MCP、skills 和本地 viewer 提供同一份 memory；
- `lnk setup` 会检测 Claude Code、Codex、Cursor、Windsurf、Zed、Kiro、Gemini CLI
  等已安装 agent；
- 自动捕获和显式“remember”会先进入 review，不直接永久化；
- [LinkBar](https://github.com/gowtham0992/link/tree/main/apps/LinkBar) 是 macOS
  菜单栏应用，展示 review inbox、memory browser、设置和最近会话 receipt；
- 支持用户控制的 git 同步，但本地使用不需要云。

对 dachshund 的启示：

- 菜单栏 + review inbox 是正确的交互方向；
- “先 review，再长期化”比自动吞下所有内容更可信；
- 自动发现 agent 已经存在，不能把“发现”本身当作唯一卖点；
- 真正的差异要落在“导入 agent 已经写好的 memory”和“保留来源证据”。

### Memorix

[Memorix](https://github.com/AVIDS2/memorix) 是覆盖面最接近本次 agent 清单的
local-first 项目之一。

- SQLite 是 canonical store，另有 Markdown knowledge workspace；
- 以 Git 项目为默认作用域；
- 通过 MCP、hooks、CLI、SDK、插件和本地 dashboard 接入；
- README 明确列出 Codex、CodeBuddy、Cursor、Windsurf、Copilot、Gemini CLI、
  OpenCode、Trae、Hermes、Pi、DeepSeek Harness、WorkBuddy；
- 有 review-gated long-term memory、Git Memory、项目记忆和本地控制面；
- 可选多设备 sync，默认不是云产品。

它的缺口不是 agent 覆盖，而是产品重心：Memorix 更像“给 coding agent 装上一层
项目 memory 操作系统”。它要求 agent 按 Memorix 的接口写 memory，而不是把每个
agent 原有的 memory 目录当作首要数据源。它也没有 Magpie 式菜单栏小面板。

### agentmemory

[agentmemory](https://github.com/rohitg00/agentmemory) 是本地 memory server +
viewer 路线。

- 自动 hooks 捕获会话；
- 本地 daemon 绑定回环地址；
- CLI、MCP、REST 和 live viewer；
- keyless 模式可用 BM25，本地 embedding 需要首次下载模型；
- README 明确支持 Codex、Hermes、Pi、DeepSeek Harness 等；
- 有 session replay、knowledge graph、scoped recall 和治理工具。

它更像“本地 memory 后端 + 实时观察台”，不是紧凑的 macOS 菜单栏工具。对 dachshund
的主要竞争点在于自动捕获和 session 回放，而不是现有 memory 文件的统一导入。

### ai-memory

[ai-memory](https://github.com/akitaonrails/ai-memory) 是更重的共享工作流方案。

- 以 git-backed Markdown wiki 为源；
- 支持 macOS、Linux、Windows via WSL2；
- 20 多个 harness 的第一方接入；
- 有 hooks、MCP、handoff、session continuity 和本地 web API；
- [macOS companion](https://github.com/akitaonrails/ai-memory/tree/main/companions/ai-memory-macos)
  是菜单栏控制面，但不是像 dachshund 一样的 memory browser；
- 官方支持列表包含 Codex、ZCode、Pi、Hermes、DeepSeek Harness、CodeBuddy Code；
- 不把 Trae、WorkBuddy 桌面版、豆包列为同等的第一方目标。

如果用户要的是“多个 coding harness 之间连续工作、自动 handoff”，ai-memory 比
dachshund 更完整。代价是安装、服务、hooks 和项目工作流都更重。

### EverOS

[EverOS](https://github.com/EverMind-AI/EverOS) 是 local-first memory runtime。

- Markdown 保存可读内容，SQLite 和 LanceDB 做本地索引；
- 有 user 与 agent 两条 track；
- 提供 Python library、local API 和 MCP server；
- 支持 episode、profile、case、skill 等更丰富的 memory 结构；
- 官方插件涉及 Hermes、DeepSeek Harness、OpenClaw 等。

它更接近 memory infrastructure，而不是“扫描本机已有 agent memory 的桌面小工具”。
对 dachshund 有价值的是其 `episode` 与 `profile/skill` 分层，而不是照搬其运行时。

### projectmem

[projectmem](https://github.com/riponcm/projectmem) 把 memory 放在项目仓库内：

- `.projectmem/events.jsonl` 是 append-only 事件日志；
- `summary.md` 是给 agent 读的压缩上下文；
- `plan.md` 与 event log 分开；
- 无云、无账号、无 telemetry；
- 原生 MCP，已验证 Claude、Cursor、Antigravity、Codex；
- 另有跨项目的 `~/.projectmem/global/`。

它解决的是“一个项目里什么试过、什么失败、为什么改”，不是“我这个人在不同 agent
里有哪些偏好”。这也是 dachshund 应该吸收的一个维度：episode、project decision
和 global user preference 不能混为一类。

### Basic Memory

[Basic Memory](https://github.com/basicmachines-co/basic-memory) 是成熟的
Markdown + knowledge graph + MCP 方案。

- 本地 Markdown 是主数据；
- 有 observations、wikilinks 和知识图谱；
- 通过 MCP 接入 Claude、Codex、Cursor 等；
- 有 Hermes 插件；
- 云同步是可选的商业产品。

它更像是“人和 agent 共用的知识库”，而不是“导入每个 agent 已经形成的个人 memory
并做 provenance 合并”。对于想要第二大脑的人来说它更合适；对于想快速看跨 agent
记忆差异的人来说更重。

### 其他相邻项目

- [Beacon](https://github.com/Asymptote-Labs/agent-beacon)：跨 harness 捕获完整
  session trace，可选本地模式与云端；更偏可回放工作记录，不是菜单栏 memory browser。
- [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service)：SQLite /
  vector / graph / consolidation 的 memory backend，适合作为基础设施采用。
- [Letta](https://github.com/letta-ai/letta)：stateful agent runtime，memory 是
  agent 自身的一部分，不是跨厂商 agent 文件的聚合器。
- [Cognee](https://github.com/topoteretes/cognee)：文档和会话转知识图谱的 memory
  pipeline，工程范围明显大于桌面小工具。

### Mem0

[Mem0](https://github.com/mem0ai/mem0) 需要纠正一个常见说法。

**不是“Mem0 只能上云”。** 它同时提供：

- 开源 Python library；
- self-hosted server；
- managed cloud platform。

但它也不是“Magpie 式 memory 应用”：

- managed cloud 是其零运维主路径；
- self-host 需要数据库、模型和 embedding 配置；
- memory 算法默认需要 LLM；
- 没有以“扫描本机 Codex / WorkBuddy / Trae / 豆包已有 memory 文件”为核心体验；
- 没有 Magpie 式 macOS 菜单栏小面板。

所以准确表述是：**Mem0 是可 self-host 的 memory infrastructure，不是本地
agent-memory 聚合器。**

## 与本项目目标 agent 的适配

下表只记录各项目 README 或官方文档明确展示的接入方式。`MCP` 表示用户可以手动接入
通用 MCP，不代表该产品已经实现了对该 agent 的自动发现或原生 importer。

| 产品 | Codex | WorkBuddy | 豆包 | Trae | Hermes | Pi | ZCode | DeepSeek Harness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Link | 原生 | MCP | - | MCP | MCP | MCP | MCP | MCP |
| Memorix | 原生 | 原生 | - | 原生 | 原生 | 原生 | MCP | 原生 |
| agentmemory | 原生 | MCP | - | MCP | 原生 | 原生 | MCP | 原生 |
| ai-memory | 原生 | CodeBuddy Code hooks | - | - | 原生 | 原生 | 原生 | 原生 |
| EverOS | MCP | MCP | - | MCP | 原生插件 | MCP | MCP | 原生插件 |
| projectmem | 原生 | MCP | - | MCP | MCP | MCP | MCP | MCP |
| Basic Memory | 原生 | MCP | - | MCP | 原生插件 | MCP | MCP | MCP |

豆包被标为 `-`，不是断言未来不能接，而是当前没有看到稳定、公开、可自动配置的
全局 MCP 路径。dachshund 对豆包也仍以 Agent Mode 本地文件导入为主。

## 自动发现能力对比

| 能力 | Link | Memorix | agentmemory | ai-memory | dachshund |
| --- | --- | --- | --- | --- | --- |
| 发现已安装 agent | 是，一次 setup 扫描多个 | 按 agent 安装/诊断 | 按 agent connect | `ai-memory run` 首次自动接线 | 是，启动时扫描 |
| 导入 agent 原有 memory 文件 | 有部分 importer，但主路径是新 wiki | 以 Memorix store 为主 | 以 hook capture 为主 | 以 hook/session 为主 | 核心主路径 |
| macOS 菜单栏 | LinkBar | 无 | 无 | companion | 有 |
| 本地 Markdown 可读 | 是 | 部分 | 由内部 store 主导 | 是，git-backed | 是 |
| 无账号可用 | 是 | 是 | 是 | 是 | 是 |
| review gate | 是 | 是 | 部分治理 | 以 harness 工作流为主 | 目前较弱 |

## 对 dachshund 的判断

### 不应声称自己是第一个

“本地跨 agent memory”已经有多个可信项目。继续使用“第一个”会显得不专业，也很容易
被 Link、ai-memory、Memorix 的例子反驳。

### 可以坚持的窄定位

> 先发现并导入 agent 已经写下的 memory，保留来源，放进一个本地 Markdown 库；
> 用菜单栏快速查看，再通过 MCP 还给所有 agent。

这个定位比“再做一个 memory server”更具体，也更符合 dachshund 现在的代码和数据模型。

### 当前实现中的差异化细节

- **MCP 写入保留调用方**：配置管理的连接会写入 `DACHSHUND_CLIENT_AGENT`，
  因此 Codex 写的 memory 仍显示为 Codex 来源，而不是被抹成通用 “MCP”。
- **完全相同内容合并来源**：导入文件和 MCP 写入共用同一套内容 hash；第二个
  Agent 写入相同内容时，只增加 source，不制造重复笔记。
- **原生 memory 可显式提升**：详情页的 **Share** 会为原记忆增加 dachshund
  共享来源和可读 Markdown 副本，不移动也不改写 Agent 自己的文件。

这些机制改善的是 provenance、复制和跨 Agent 可读性；语义近重复、冲突裁决和
写入审核仍未实现，不能在产品表达里混为一谈。

### 最值得借鉴的产品设计

1. **Link 的 review inbox**：agent 提议的写入先审核，不能直接永久化。
2. **LinkBar 的菜单栏体量**：快捷搜索、最近变化、待确认项，不做成第二个 IDE。
3. **Memorix 的 agent doctor**：显示哪些接入已过期、哪些配置需要修复。
4. **ai-memory 的 session handoff**：把“换一个 agent 继续做”作为明确用户结果。
5. **projectmem 的 episode 分离**：失败尝试、决策和长期偏好不要混成一条记录。

### 最大风险

- 只做“聚合列表”，会被 Link / ai-memory 更完整的工作流覆盖；
- 只做“memory server”，会与 agentmemory、Memorix、EverOS 正面竞争；
- 自动写入但不做 review，会失去用户信任；
- 把所有 agent 的规则和 agent 自动总结的记忆混为一类，会让分类越来越失真。

因此，产品重点不应是继续增加一个 agent 图标，而是维护已经落地的五分类、
十一 kind、原生 memory mapping，以及“导入回声 / MCP 写入 / 显式 Share”三条
共享路径。分类后的 library、按时间的跨 agent 时间线、分类 legend 和 agent
详情页共同构成当前体验；更强的 `authority / scope` 仍是研究提案，不是已发布
schema。当前产品契约见
[docs/MEMORY.md](../docs/MEMORY.md)，研究背景和替代模型见
[dachshund-memory-taxonomy.md](dachshund-memory-taxonomy.md)。

## 来源

- Link: https://github.com/gowtham0992/link
- LinkBar: https://github.com/gowtham0992/link/tree/main/apps/LinkBar
- Memorix: https://github.com/AVIDS2/memorix
- agentmemory: https://github.com/rohitg00/agentmemory
- ai-memory: https://github.com/akitaonrails/ai-memory
- AI Memory macOS companion:
  https://github.com/akitaonrails/ai-memory/tree/main/companions/ai-memory-macos
- EverOS: https://github.com/EverMind-AI/EverOS
- projectmem: https://github.com/riponcm/projectmem
- Basic Memory: https://github.com/basicmachines-co/basic-memory
- Mem0: https://github.com/mem0ai/mem0
- Magpie: https://github.com/yetone/magpie
