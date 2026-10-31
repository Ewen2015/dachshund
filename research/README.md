# 跨 Agent Memory 研究

研究日期：2026-10-31

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

### 2. 自动记忆正在向四种语义类型收敛

Claude Code、WorkBuddy 和 ZCode 已经明确采用相同的一组核心类型：

| 类型 | 含义 | 例子 |
| --- | --- | --- |
| `user` | 用户身份、角色、专长、稳定偏好 | “我是产品负责人”“用中文回复” |
| `feedback` | 对 agent 的纠正、确认过的方法 | “不要 mock 数据库”“先给方案再改代码” |
| `project` | 项目目标、约束、决策、进行中的工作 | “下周冻结非关键合并” |
| `reference` | 去哪里找项目外信息 | “Issue 在 Linear”“设计源文件在 Figma” |

这是 dachshund 最值得采用的主分类，因为它已经被多个独立产品验证，而且足够小，
不会把用户逼进一套复杂知识管理法。

### 3. 各家机制差异很大

- Codex、Claude Code、Hermes、Trae、WorkBuddy、ZCode 有本地、可检查的长期记忆。
- Gemini CLI 把手写指令和 `save_memory` 事实都追加到 `GEMINI.md`。
- Windsurf 的自动记忆目前主要是 legacy Cascade 能力，workspace 之间有边界。
- Cursor、Copilot、OpenCode 当前更偏 instructions/rules；Cursor Automations 另有
  独立的 `MEMORIES.md`，不能等同于编辑器内的全局长期记忆。
- Pi、DeepSeek Harness 更偏 session/trace；长期记忆需要摘要、显式指令或插件。
- Claude Desktop 和豆包的记忆主要是账号侧服务能力，不是普通本地文件。
- 豆包的普通账号记忆不对 dachshund 暴露；当前本地 importer 只能覆盖可观察到的
  Agent Mode 文件。

### 4. dachshund 当前分类是“够用但不统一”

当前 importer 会产出 `profile`、`rule`、`project`、`lesson`、`fact`、
`preference` 等 kind。它们混用了：

- 来源语义；
- 权威级别；
- 作用域；
- 信息用途。

例如 `rule` 表示高权威指令，`lesson` 更像 feedback，`profile` 和部分
`preference` 又都属于 user。继续让每个 importer 自己起名字，会让后续分类越来越碎。

### 5. 推荐方向

dachshund 不应复制某一个 agent 的目录，而应采用“三层模型”：

1. **Authority**：`instruction` / `memory` / `episode`
2. **Kind**：`user` / `feedback` / `project` / `reference`
3. **Scope**：`global` / `project` / `path` / `session`

agent 只是 `source`，不再是主分类。界面上优先展示“我在所有 agent 里关于工作的
偏好是什么”，再通过 agent 徽标和过滤器回答“这条是谁贡献的”。

详细的 agent 矩阵见
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
- 产品建议写在 taxonomy 文档，具体厂商事实写在 structures 文档。
- 更新时修改研究日期，并在 `sources.md` 记录新增来源。
