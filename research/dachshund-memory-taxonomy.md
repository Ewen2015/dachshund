# dachshund Memory 分类模型

研究更新：2026-11-04

本文记录 dachshund 0.1.x 已经落地的分类模型，以及从第一性原理重新思考后保留、
合并和新增的类型。产品事实以 [docs/MEMORY.md](../docs/MEMORY.md) 和
[`src/shared/memory-taxonomy.ts`](../src/shared/memory-taxonomy.ts) 为准。

## 结论

旧模型把「用户是谁」「怎样工作」「项目」「事实」「历史」放在同一层，导致
`feedback`、`project`、`episode` 既像来源类型又像知识类型，而且把原始事件与长期
知识混在一起。

当前模型把两层问题拆开：

1. **四个知识分类**回答这条内容应当如何被再次使用；
2. **Evidence / Unclassified 辅助层**保留原始证据和暂时无法判断的内容；
3. **scope / authority / status** 作为正交字段，不再塞进 kind。

## 当前知识分类

| 固定顺序 | 分类 | Kinds | 回答的问题 |
| --- | --- | --- | --- |
| 1 | Identity | `profile` | 这个人是谁，有哪些长期稳定的身份与背景？ |
| 2 | Guidance | `preference`, `rule`, `procedure` | 下一次工作应当怎样做？ |
| 3 | Knowledge | `fact`, `reference`, `insight` | 哪些事实、资料和结论值得长期保留？ |
| 4 | Current work | `goal`, `constraint`, `decision` | 当前项目或工作区要达成什么、受什么限制、已经决定了什么？ |

共十个 durable kind。顺序在所有 agent、主页面、agent 页面、Pulse 和菜单栏小窗
中固定一致。

## 辅助层

| 层 | Kinds | 为什么单独存在 |
| --- | --- | --- |
| Evidence | `session_summary`, `task_rollout`, `compaction`, `workspace_log`, `feedback_event` | 这是发生过什么的证据，不等于已经被确认的长期知识 |
| Unclassified | `unclassified` | 导入器无法仅凭来源可靠判断类型，保留原文比伪造 fact 更诚实 |

辅助层只在有数据或用户主动选择时出现，不占四个知识分类的固定位置。MCP 默认召回
不包含 Evidence 和 Unclassified。

## 第一性原理

分类不按 agent 品牌，也不按文件目录，而按「这条 memory 下一次会被用来做什么」：

1. 用来理解用户 -> Identity；
2. 用来约束或指导行为 -> Guidance；
3. 用来提供事实、出处或经验 -> Knowledge；
4. 用来推进当前工作 -> Current work；
5. 只用来说明过去发生过什么 -> Evidence；
6. 目前还不能可靠判断 -> Unclassified。

agent 是来源、徽标和过滤器，不是知识分类。一个 memory 可以来自多个 agent；同一
agent 也可以产生多个知识分类。

## 为什么合并或去掉旧类型

| 旧类型 | 当前处理 | 原因 |
| --- | --- | --- |
| `feedback` | 按内容拆为 `rule`, `preference`, `insight`, `unclassified` | 「feedback」是来源动作，不是知识类型 |
| `lesson` | `insight` | 与可复用结论重复 |
| `workflow` | `procedure` | 更准确地表达可重复步骤 |
| `project` | 按内容拆为 `goal`, `constraint`, `decision`, `reference`, `unclassified` | 项目是 scope，不是一个知识 kind |
| `task`, `task_group`, `project_memory` | 同上 | 任务/项目容器不能说明知识语义 |
| `episode` | 拆为 `session_summary`, `task_rollout`, `compaction`, `workspace_log`, `feedback_event` | 不同证据形态不应被一个泛化名称覆盖 |
| 未知 kind | `unclassified` | 不再默认冒充 `fact` |

## 正交字段

### Scope

`user / project / workspace / path / session`

scope 说明这条内容适用于哪里，不决定知识分类。Codex `cwd`、TRAE 项目、WorkBuddy
workspace 和 Pi session 都可以成为 scope。

### Authority

`user_explicit / project_declared / agent_observed / inferred`

authority 说明来源强度。强指令、项目声明、agent 观察和 dachshund 推断不能只用同一
个 kind 表达。

### Status

`active / superseded / archived / unclassified`

status 管理生命周期。归档记录不会因为下一次导入又自动变为 active。

### Project

`project` 仍是人类可读的项目或 workspace 名称，与 scope 分离。项目标签不能替代
Current work 分类。

## 旧数据迁移

- `episode` -> `session_summary`
- `lesson` -> `insight`
- `workflow` -> `procedure`
- `feedback` / `correction` -> 按正文内容判断
- `project` / `task` / `task_group` / `project_memory` -> 按正文内容判断
- 未知值 -> `unclassified`

这些规则在导入、Markdown 回读和 SQLite 索引中保持一致。

## 界面原则

- 主页面按更新时间倒序排列，不按分类分块；
- 四个知识分类始终显示，Evidence 与 Unclassified 有数据时追加；
- 每张 memory 卡显示 category tag、kind、scope、来源和时间；
- 点击 legend 过滤当前分类；再进入 agent 时保留该分类；
- agent 页左侧显示原生分类，右侧显示固定的 dachshund 分类，允许 many-to-one；
- Pulse 按同一分类体系统计，点击可回到对应 memory 列表；
- Guide 用俯视分类台解释 native signal → kind → category，并同时展示固定分类、
  Evidence / Unclassified 辅助层以及 scope / authority / status 三个正交字段；
- 菜单栏小窗与完整应用使用同一分类、排序和点击行为。

## 不再采用的方案

### Confidence

早期考虑过 `declared / inferred / imported`。当前用 `authority` 与
`status=unclassified` 已经能表达来源强弱和待审核状态，再增加 confidence 会让同一
问题出现多个近似字段。

### 按 agent 分一级类

agent 已经由来源路径和 MCP 身份表达。把它再作为一级分类，会削弱跨 agent 浏览，
也与 dachshund 的核心价值相反。

### 按文件目录自动决定分类

同一目录可以出现规则、事实、项目决策和原始日志。分类优先看原生 kind、section
语义和正文信号，不把目录名当作知识类型。

## 仍待验证

1. Evidence 到 durable knowledge 的人工提升流程；
2. superseded 记录的冲突展示和比较；
3. 近重复聚类的审核体验；
4. 用户自定义分类是否真的必要，还是只应扩展 kind；
5. 跨设备同步时的 scope/authority 合并规则。

## 文档关系

- [docs/MEMORY.md](../docs/MEMORY.md)：已实现分类契约；
- [docs/AGENT_MEMORY_MAPPING.md](../docs/AGENT_MEMORY_MAPPING.md)：14 个 agent 的完整映射矩阵；
- [research/agent-memory-structures.md](agent-memory-structures.md)：各 agent 原生存储结构；
- [research/cross-agent-memory-products.md](cross-agent-memory-products.md)：本地优先产品对比。

修改分类、kind、agent mapping 或展示方式时，必须同步检查 README、中英文官网、
`docs/`、`research/`、demo seed 和截图。
