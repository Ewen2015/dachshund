# 跨 Agent Memory 研究

研究日期：2026-11-03

这个目录存放会持续更新、带有来源和日期判断的调研材料。`docs/` 继续承载
dachshund 稳定的产品、架构和实现文档；`research/` 用来回答问题、比较产品、
验证假设，并为后续产品决策提供证据。

## 研究问题

1. 不同 agent 所说的 memory 是不是同一种东西？
2. 哪些 memory 由用户手写，哪些由 agent 自动生成？
3. 哪些 memory 是长期记忆，哪些只是一次会话的上下文或轨迹？
4. dachshund 如何在“时间”和“所属 agent”之外，建立更有用的跨 agent 分类？
5. 不同实现应该怎样映射到一套稳定的本地 Markdown 数据模型？

## 结论先行

### 1. Memory 至少分成四层

不同产品把它们混在一个入口里，但它们的产品语义并不相同：

| 层 | 是什么 | 典型载体 | 是否应被当作“规则” | 生命周期 |
| --- | --- | --- | --- | --- |
| Instructions / Rules | 用户或团队手写的行为约束 | `AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`.cursor/rules` | 是 | 版本化、长期 |
| Durable memory | agent 或用户主动沉淀的长期上下文 | `MEMORY.md`、`USER.md`、memory topic files | 否，通常是软上下文 | 长期，需要维护 |
| Episode | 会话、任务、rollout、摘要、checkpoint | JSONL、SQLite session、rollout summary | 否,只是证据 | 可保留、压缩或过期 |
| Reference / Artifact | 外部资料的指针或产物 | URL、文件路径、issue、dashboard、导出物 | 否 | 跟随外部对象 |

如果把四层混成一个 `memory` 列表，界面会“全”，但分类会失真。尤其不能把
`AGENTS.md` 的强规则和 agent 自动总结的偏好在 UI 里显示成同一种对象。

### 2. 多个 agent 的原生记忆正在向四种语义类型收敛

Claude Code、WorkBuddy 和 ZCode 已经明确采用相同的一组核心类型：

| 类型 | 含义 | 例子 |
| --- | --- | --- |
| `user` | 用户身份、角色、专长、稳定偏好 | “我是产品负责人”“用中文回复” |
| `feedback` | 对 agent 的纠正、确认过的方法 | “不要 mock 数据库”“先给方案再改代码” |
| `project` | 项目目标、约束、决策、进行中的工作 | “下周冻结非关键合并” |
| `reference` | 去哪里找项目外信息 | “Issue 在 Linear”“设计源文件在 Figma” |

这组类型是重要的导入证据，但不是 dachshund 的最终一级分类。它们混用了身份、
行为纠正、项目上下文和外部资料，也没有单独表达决策、经验、流程和历史。
dachshund 不把四种原生类型直接照搬为一级分类，而是先归一化，再放入自己的
跨 agent 分类；来源 agent 和路径仍然保留。

### 3. 各家机制差异很大

- Codex、Claude Code、Hermes、Trae、WorkBuddy、ZCode 有本地、可检查的长期记忆。
- Gemini CLI 把手写指令和 `save_memory` 事实都追加到 `GEMINI.md`。
- Windsurf 的自动记忆目前主要是 legacy Cascade 能力，workspace 之间有边界。
- Cursor、Copilot、OpenCode 当前更偏 instructions/rules；Cursor Automations 另有
  独立的 `MEMORIES.md`，不能等同于编辑器内的全局长期记忆。
- Pi、DeepSeek Harness 更偏 session/trace；dachshund 只把明确 durable cue、
  compaction summary 和全局指令提升出来，长期共享记忆仍需 MCP 或插件。
- Claude Desktop 的 Cowork Space memory 是本地 Markdown；普通 Chat memory 和
  豆包普通账号记忆仍然主要是账号侧服务能力。
- 豆包的普通账号记忆不对 dachshund 暴露；当前本地 importer 只能覆盖可观察到的
  Agent Mode 文件。

### 4. dachshund 当前分类已经落地为四个知识分类、十个 kind

| 分类 | kind |
| --- | --- |
| Identity | `profile` |
| Guidance | `preference`, `rule`, `procedure` |
| Knowledge | `fact`, `reference`, `insight` |
| Current work | `goal`, `constraint`, `decision` |

另有 Evidence 辅助层（`session_summary`, `task_rollout`, `compaction`,
`workspace_log`, `feedback_event`）和 Unclassified（`unclassified`）。它们有数据
时出现在浏览与 Pulse 中，但不属于四个 durable 知识分类。

这比直接复制四个原生类型多两层价值：

- 能区分“用户是谁”“agent 应该怎样工作”“长期知识”和“当前工作”；
- 能区分当前目标/约束/决定与历史证据，不再把 `project` 或 `episode` 当作知识类型。

agent 现在是来源、徽标和过滤器，不是一级分类。主页面按时间排列并显示分类 tag，
点击 legend 可以查看某个分类的全部 memory；agent 详情页再解释原生结构到
dachshund 分类的映射；应用内 Guide 再用俯视分类台解释 native signal → kind →
category，以及 Evidence / Unclassified 与三个正交字段的位置。

实现定义见
[`src/shared/memory-taxonomy.ts`](../src/shared/memory-taxonomy.ts)，产品说明见
[docs/MEMORY.md](../docs/MEMORY.md)。

### 5. 已落地的正交字段

当前数据模型已经包含：

- `scope`: `user / project / workspace / path / session`；
- `authority`: `user_explicit / project_declared / agent_observed / inferred`；
- `status`: `active / superseded / archived / unclassified`；
- `project` 作为人类可读项目标签，与 scope 分离。

早期 `confidence` 提案没有进入实现，因为 authority 与 Unclassified 已覆盖当前需要。
完全重复的来源会合并为多来源条目，语义近重复和冲突仍不自动裁决。

### 6. 跨 Agent 共享已落地为三条路径

- **导入回声**：不同 Agent 的原生文件如果内容完全一致，合并成一条 memory，
  每个 Agent 仍保留独立来源。
- **MCP 写入**：托管连接通过 `DACHSHUND_CLIENT_AGENT` 传递调用方身份。写入
  memory 时保留真实 Agent，不做成匿名的 “MCP memory”；另一个 Agent 写入完全
  相同内容时只追加来源。
- **显式 Share**：对于仍由某个 Agent 自己维护的 memory，详情页可以增加一份
  dachshund 管理的共享来源。原文件不改，共享副本进入本地 Markdown 记忆库。

这三条路径只处理来源与副本，不等同于语义去重：措辞不同但含义接近的两条
memory 仍会并存，冲突裁决仍属于研究阶段。

各 agent 的原生结构与来源见
[agent-memory-structures.md](agent-memory-structures.md)，分类模型和产品建议见
[dachshund-memory-taxonomy.md](dachshund-memory-taxonomy.md)，本地跨 agent
产品对比见
[cross-agent-memory-products.md](cross-agent-memory-products.md)，来源清单见
[sources.md](sources.md)。

## 证据等级

本目录统一使用以下标记：

- **Official**：厂商官方文档或官方仓库明确说明。
- **Observed**：dachshund importer 已实际适配的本地路径或格式，但厂商未必公开
  完整 schema。
- **Inferred**：根据多个产品结构归纳出的分类建议，不是厂商承诺。

对外结论优先引用 **Official**。涉及 WorkBuddy、豆包、Pi、ZCode、DeepSeek
Harness 等仍在快速变化或文档不完整的产品时，会明确标注 **Observed** 或
**Inferred**，避免把逆向观察说成官方标准。

## 维护规则

- 每次补充 agent，都先找官方文档，再读 dachshund importer。
- 官方没有公开格式时，只描述 dachshund 观察到的文件，不推断未经验证的内部数据库。
- 记忆类型和存储位置必须分开记录；同一个文件可能同时包含指令和记忆。
- 当前已实现行为必须与 `src/shared/memory-taxonomy.ts` 和 `docs/MEMORY.md` 一致；
  研究提案必须明确标注“尚未实现”。
- 具体厂商事实写在 structures 文档，分类结论写在 taxonomy 文档。
- 每次修改分类或 agent mapping，都同步检查 README、`docs/`、`research/`、官网
  中英文页面和截图。
- 更新时修改研究日期，并在 `sources.md` 记录新增来源。
