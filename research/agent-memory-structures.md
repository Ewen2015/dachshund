# 不同 Agent 的 Memory 结构

研究日期：2026-10-31

本文回答“每个 agent 到底把什么称为 memory，以及它怎样持久化”。当前分类、
归一化规则和 agent mapping 以 [docs/MEMORY.md](../docs/MEMORY.md) 为准；
研究背景和尚未实现的替代模型见
[dachshund-memory-taxonomy.md](dachshund-memory-taxonomy.md)。

## 快速矩阵

| Agent | 手写指令 / Rules | 自动或主动长期记忆 | Session / Episode | 主要作用域 | dachshund 当前读取 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | `AGENTS.md`、Skills | 本地 memory store，含 summary、merged memory、raw memory | rollouts、raw memories | 用户机器 + 项目内容 | `~/.codex/memories/*`、可读 SQLite | Official + Observed |
| Claude Code | `CLAUDE.md`、`AGENTS.md`、`.claude/rules/` | 每 repo 的 topic memory + `MEMORY.md` 索引 | 会话 transcript | repo / worktree 共享 | repo topic memory、`CLAUDE.md`、rules、全局 memory | Official + Observed |
| Claude Desktop | Project instructions | 本地 Space topic files；账号侧 topic memory 与每个 Project 独立 memory | 聊天与 Project chats | 本地 Space / 账号 | 本地 `MEMORY.md` 索引与 typed topic files；账号侧仍不可导入 | Official + Observed |
| Gemini CLI | 分层 `GEMINI.md` | `save_memory` 追加事实到全局 `GEMINI.md` | session history | global / workspace / JIT path | `GEMINI.md` | Official + Observed |
| Cursor | Project/User/Team Rules、`AGENTS.md` | 普通 Agent 无跨 completion 持久记忆；Automations 有独立 `MEMORIES.md` | chat / agent history | project / path / user | `rules/`、`agents/` Markdown | Official + Observed |
| GitHub Copilot | repo instructions、path instructions、`AGENTS.md`、用户级 instructions | 没有公开的同类 typed durable memory | CLI sessions、Chronicle | repo / path / user | `memories/`、`instructions/` Markdown | Official + Observed |
| Windsurf | global/workspace/system Rules、`AGENTS.md` | 当前 Devin Local 以 Rules 为主；legacy Cascade 的 Memories 需单独看待 | Cascade conversations | workspace | `memories/` Markdown | Official + Observed |
| OpenCode | 项目/全局 `AGENTS.md`、CLAUDE fallback、instructions array | 官方文档未定义 typed auto memory | local sessions | global / project | 全局 `AGENTS.md`、observed memory Markdown | Official + Observed |
| Trae | global/project Rules、`.trae/rules/`、AGENTS/CLAUDE 兼容 | 全局 `user_profile.md`、项目 `project_memory.md` | session memory JSONL、topics | global / project | profile、project memory、topics、session memory | Official + Observed |
| WorkBuddy | `CODEBUDDY.md` / `AGENTS.md` | CodeBuddy CLI 的 Auto Memory：typed memory `user` / `feedback` / `project` / `reference` | sessions | global / workspace | IDENTITY、USER、MEMORY、workspace memory | Official + Observed |
| 豆包 | 自定义智能体设定、技能 | 账号侧概率性记忆 | Agent Mode session memory 文件 | 用户 / 不同智能体隔离 | Agent Mode 可观察到的本地 memory | Official + Observed |
| Hermes | project instructions / config | `MEMORY.md` + `USER.md`，字符上限，冻结注入 | SQLite session history | Hermes home / profile | 两个 memory 文件 | Official + Observed |
| Pi | 项目上下文 | 无独立 typed long-term store | session tree、compaction、branch summary | session / branch | compaction 与 durable cue | Official + Observed |
| ZCode | 全局和 workspace `AGENTS.md` | 项目级 typed memory: `user` / `feedback` / `project` / `reference`，Markdown topic files | SQLite sessions | global / project | 官方 Markdown memory + SQLite 中的 durable user text | Official + Observed |
| DeepSeek Harness | 依赖 plugin / MCP | 核心不提供跨 session durable memory；官方提供 MCP memory 接法 | append-only event log、compaction | session / plugin scope | session log 中的 durable cue | Official + Observed |

## 1. 四类型长期记忆

### Claude Code

Claude Code 明确分开两套机制：

- `CLAUDE.md`：用户编写的指令和规则；
- Auto memory：Claude 根据纠错和偏好自己写的笔记。

Auto memory 在文件 frontmatter 中用 `type` 标记四种类型：

- `user`：角色、专长、工作偏好；
- `feedback`：用户纠正过的事和确认过的方法；
- `project`：代码和 git 无法推导的目标、期限、决策；
- `reference`：issue tracker、dashboard 等外部信息位置。

每个 git repo 拥有一个 auto memory 目录，repo 内 worktree 共享。`MEMORY.md` 是
索引，只加载前 200 行或 25KB；主题文件在需要时读取。这个结构很成熟，说明
“小索引 + 按需 topic file”比把所有记忆塞进一个大文件更可控。

对 dachshund 的含义：可以直接把 Claude 的类型映射到统一四类，不需要重新解释。

### WorkBuddy

WorkBuddy / CodeBuddy 官方 memory 文档定义了 `user`、`feedback`、`project`、
`reference` 四类，并用 Markdown + YAML frontmatter 存储。Typed Memory 默认
启用；Auto Memory 位于 `~/.codebuddy/memories/{project-id}/`，全局记忆位于
`~/.codebuddy/memories/global/`。`MEMORY.md` 是索引，前 200 行会自动加载，
详细内容放在主题文件中。

dachshund 当前观察到的本地结构更混合：

- `IDENTITY.md`：agent 身份；
- `USER.md`：用户画像；
- `memory/*.md`：长期记忆；
- `user-*/USER.md`：其他用户目录；
- workspace 内 `.workbuddy/memory/*.md`：项目工作记忆。

对 dachshund 的含义：WorkBuddy 的类型命名可以成为统一模型的重要交叉验证，但
本地导入仍要兼容 `~/.workbuddy` 下的 `IDENTITY.md` / `USER.md` / workspace
文件。官方文档中的 `~/.codebuddy` 路径属于 CodeBuddy CLI 记忆层，不能直接
等同于 WorkBuddy 桌面应用的目录布局。

### ZCode

ZCode 把 instructions 和 memory 分开：

- `~/.zcode/AGENTS.md`：跨项目用户指令；
- workspace `AGENTS.md`：项目指令；
- Memory：项目级长期记忆，位于
  `~/.zcode/cli/memories/projects/<project>/memory/`，由 `MEMORY.md` 索引和
  若干 topic Markdown 文件组成。

Memory 聚焦 `user`、`feedback`、`project`、`reference` 四类，由 agent 在回合
结束后后台提取，也可通过自然语言“记住 / 忘掉”管理。Memory 默认关闭，需要
ZCode v3.6.4 及以上版本，在“设置 → 常规”按项目开启。

对 dachshund 的含义：ZCode 是“四类 memory + 两级 AGENTS.md”的另一个清晰实现。
dachshund 直接读取正式 memory Markdown，并保留 SQLite 文本扫描作为显式 durable
cue 的兼容路径；不能把 SQLite 说成 ZCode 的正式 memory schema。

## 2. 双文件或双作用域记忆

### Hermes

Hermes 使用两个有字符预算的文件：

- `MEMORY.md`：agent 自己的笔记，环境事实、约定、学到的东西；
- `USER.md`：用户画像、偏好、沟通方式和期望。

两者都位于 `~/.hermes/memories/`，在会话开始时作为冻结快照注入系统提示词。
超过字符上限时写入失败，agent 必须自己整理或删除。它还有独立 SQLite session
history，但不会把完整 session 直接当长期记忆。

对 dachshund 的含义：`MEMORY.md` 与 `USER.md` 不应合成一个没有类型的大文件。
可以稳定映射成 `project/reference` 与 `user`，并将 session history 留在 episode 层。

### Trae

Trae 明确区分：

- 全局记忆：`~/.trae/memory/user_profile.md`，所有项目生效；
- 项目记忆：`~/.trae/memory/projects/{project_path}/project_memory.md`；
- 全局 Rules 与项目 `.trae/rules/`。

官方说明 memory 保存在本地、不跨设备，且不会自动保存一次性指令、模糊偏好或
敏感信息。当前 dachshund 读取 `user_profile.md` 和 `project_memory.md`，也读取
`topics.md` 与 `session_memory_*.jsonl`；后两者属于 episode/topic summary，不应
归为 durable memory。

对 dachshund 的含义：需要同时保留 scope 和 authority。全局 `user_profile.md`
是 user memory；项目规则是 instruction；session memory 是 episode。

### Gemini CLI

Gemini CLI 的 `GEMINI.md` 是分层上下文：

- global：`~/.gemini/GEMINI.md`；
- workspace 与父目录；
- JIT：读取某文件时再加载该目录及祖先的 `GEMINI.md`。

`save_memory` 会把事实追加到全局文件的 `## Gemini Added Memories` section。它没有
像 Claude 那样的 typed memory，手写指令和自动事实共用一个文件。

对 dachshund 的含义：导入时不能只按文件分类，至少要识别 “Added Memories” section
与普通 instruction section，否则会把自动事实误当项目规则。

## 3. 合并式本地记忆

### Codex

Codex 把 instructions 和 memory 明确分开：

- `AGENTS.md`：需要每次遵守的持久项目指导；
- local memories：从以往工作提取出来的软回忆层。

官方说明 local Codex clients 使用独立的本地 memory store。文档列出的典型内容
包括稳定偏好、重复工作流、技术栈、项目约定和已知坑。

dachshund 当前观察到的文件包括：

- `memory_summary.md`：下一次会话先读的汇总视图；
- `MEMORY.md`：长格式合并记忆；
- `raw_memories.md`：合并前提取；
- thread/task-group 段落；
- 可读的 memory SQLite。

这是摘要和长文分层的设计，不强调四种 typed memory。dachshund 导入时需要从标题、
section 和内容推断 user/feedback/project/reference。

### Windsurf

Windsurf 官方把 Memories 与 Rules 分开：

- Memories 由 Cascade 自动生成，并绑定创建时所在 workspace；
- Rules 由用户定义，支持 global、workspace、system；
- `AGENTS.md` 也可作为位置作用域规则。

2026 年文档中的重要变化：`docs.windsurf.com/windsurf/cascade/memories` 现在
会重定向到 Devin Local 的 customizations 页面。新页面把 Rules、Skills、
Plugins、MCP、Hooks 作为当前扩展面；旧的 Memories 属于 legacy Cascade，
不能直接说成 Devin Local 默认会持续生成的新 memory。

对 dachshund 的含义：Windsurf 仍然有可导入的历史 memory，但不能把“Windsurf
一定会持续生成新 memory”写成当前产品事实。

## 4. Instructions-first 产品

### Cursor

Cursor 当前核心模型是 Rules：

- Project Rules：`.cursor/rules/*.mdc`；
- User Rules；
- Team Rules；
- `AGENTS.md` 作为简单的 Markdown 替代。

官方 Rules 文档明确说模型不会在不同 completion 之间保留记忆，Rules 是提示级持久
上下文。Cloud Automations 另有 memory：每个 automation 可有具名条目，默认
`MEMORIES.md`，但它服务的是自动化多次运行，不是编辑器内所有对话的通用长期记忆。

对 dachshund 的含义：目前从 Cursor 导入的主要应是 **instruction**，不是自动记忆。
如果未来支持 Automations memory，应作为单独来源和 scope。

### GitHub Copilot

Copilot 的持久上下文主要来自 instructions：

- `.github/copilot-instructions.md`；
- `.github/instructions/**/*.instructions.md`；
- 用户级 instructions；
- `AGENTS.md` 和其他兼容 instruction 文件。

Copilot CLI 将会话数据保存在本地，并默认同步到 GitHub 账号，可恢复 session、
使用 `/chronicle` 生成站会报告或改进 instruction 的建议。它不是一套公开的
`user/feedback/project/reference` typed memory。

对 dachshund 的含义：把 Copilot 的 instructions 与 CLI session 分开。Session 可
作为 episode 证据，但不应自动上升为持久记忆。

### OpenCode

OpenCode 官方持久上下文以 `AGENTS.md` 为主：

- 项目 `AGENTS.md`；
- 全局 `~/.config/opencode/AGENTS.md`；
- CLAUDE.md fallback；
- `opencode.json` 中的 additional instructions。

官方文档没有定义与 Claude 类似的 typed auto memory。dachshund 目前额外读取
`~/.config/opencode/memory` 和 `~/.local/share/opencode/memory`，这是
**Observed** 兼容层，不宜对外宣称是 OpenCode 官方 memory schema。

## 5. Session-first 产品

### Pi

Pi 的核心持久结构是 session tree：

- 普通 messages；
- 自动或手动 compaction summary；
- `/tree` 切换分支时生成 branch summary；
- 文件操作被累积记录；
- session 默认存储在 `~/.pi/agent/sessions/`。

dachshund 当前只导入：

- `compaction.summary`；
- `branch_summary.summary`；
- 含明确 “remember / 以后默认”等 durable cue 的用户消息。

Pi 另有实验性的 `Pi Durable` 包，用 SQLite 或 Cloudflare Durable Object
保存长运行 agent 的 task/checkpoint/transcript 状态。它解决的是“进程崩溃后
继续运行”，不是“跨 agent 的长期用户记忆”，因此不能把它当作 Pi 的
`MEMORY.md` 等价物。

对 dachshund 的含义：Pi 的 session 是 episode，compaction 是 episode summary，
Pi Durable 是 durable execution；只有明确 durable cue 才适合提升为长期 memory。
这个边界应在 UI 中可见。

### DeepSeek Harness

DeepSeek Harness 的核心 session 是 append-only event log，模型消息从事件投影出来，
上下文满时使用 compaction。官方/项目文档没有把跨 session durable memory 定义成
核心内置能力；长期记忆通常由 plugin 或 MCP 提供。官方文档还给出了 MCP Memory
参考实现：本地 JSONL 实体/关系图，以及 Memorix、Engram 等后端接法。

dachshund 当前从 JSONL session artifacts 读取人类用户且含 durable cue 的消息。
这是一条保守的提取规则，不等同于 DSH 自带 memory。

对 dachshund 的含义：应先归类为 episode，再从 episode 中提取候选 feedback/user
memory；不要让 session 数量直接污染“记忆”数量。

## 6. 账号侧服务记忆

### Claude Desktop

当前 Claude memory 会按聊天内容保存为一组 individual topics，而不是等对话结束后
生成一份摘要。Project 有独立 memory space，也可以选择是否使用账号 memory。
Chat 与云端 Cowork 共享 memory；在本地运行的 Cowork session 不使用这套 memory。
“每 24 小时更新 summary”只属于旧版 legacy memory 体验。

Claude Desktop 4.4212 的本地 Cowork Space memory 位于
`~/Library/Application Support/Claude-3p/local-agent-mode-sessions/<account>/<org>/spaces/<space-id>/memory/`
（legacy profile 使用 `Claude` 目录）。目录结构是：

- `MEMORY.md`：只做索引，每行指向一个 topic file；
- topic file：frontmatter 使用 `name`、`description` 和
  `type: user | feedback | project | reference`，正文保存具体记忆；
- Space 名称来自同级 org 目录的 `spaces.json`；
- 本地账号级 topic 文件位于同级的 `memory/memory/`，本地 agent topic 文件
  位于 `agent/memory/`。

dachshund 导入这些本地 topic files，并把 Space 名称保留为项目标签。
普通 Chat memory 和本地不存在的云端 Project memory 仍属于账号侧能力，当前
不可从本地文件导入；Claude Desktop 通过 MCP 使用 dachshund 的共享记忆。

### 豆包

豆包官方 memory 机制：

- 通过自然语言增加、更新、删除、查询；
- 也可在设置中的记忆模块管理；
- 记忆是概率性提取和召回，不保证完整记录；
- 记忆有上限，超限可能覆盖较早内容；
- 不同用户、不同智能体的记忆完全独立。

普通豆包账号记忆没有对 dachshund 暴露为稳定的本地 schema。当前可导入的是
Agent Mode 相关本地 memory 文件，范围小于“豆包记住了什么”的完整答案。

## 对 dachshund 的产品含义

### 当前实现

1. 使用五分类、十一 kind 表达信息用途，同时保留原生 kind、来源 agent 和路径。
2. `project` 是独立字段；它不等同于 `projects` 分类，也不冒充通用 scope。
3. session、topic、rollout 和 compaction 进入 History，不自动升级为长期事实。
4. 账号侧不可观察的 memory 会明确标为不可导入，不假装是本地文件。
5. agent 是 provenance、过滤器和详情页入口，不是一级分类。
6. 常见旧 kind 通过确定性 alias 归一化；未知 kind 保留内容并回退到 `fact`。

### 仍待研究

1. 单独的 `authority` 能否改善强指令与自动总结之间的冲突处理。
2. 通用 `scope`、`path` 和 `session` 字段是否值得进入实际 frontmatter。
3. 语义近重复和跨 agent 冲突应该怎样展示，而不是自动合并。
4. 一条 History episode 应该怎样经过用户确认，显式提升为 lesson、decision 或 fact。

这些是设计问题，不是当前存储 schema。当前实现以
[`src/shared/memory-taxonomy.ts`](../src/shared/memory-taxonomy.ts) 为准。
