# dachshund Memory 分类模型

研究日期：2026-10-31

本文分成两部分：

1. **当前已实现**：dachshund 0.1.x 正在使用的五分类、十一 kind 模型；
2. **研究中的替代模型**：评估过但尚未进入实现的 authority / scope 等维度。

产品事实以 [docs/MEMORY.md](../docs/MEMORY.md) 和
[`src/shared/memory-taxonomy.ts`](../src/shared/memory-taxonomy.ts) 为准。本文中的
“研究提案”不能被理解为已经发布的存储字段或界面行为。

## 当前已实现

### 五个一级分类

| 分类 | UI 名称 | 包含的 kind | 回答的问题 |
| --- | --- | --- | --- |
| `about` | About me / Identity | `profile`, `preference` | 我是谁，我希望 agent 怎样和我合作？ |
| `working` | Ways of working / Working | `rule`, `feedback`, `lesson`, `workflow` | 哪些规则、纠正、经验和流程会影响下一次工作？ |
| `projects` | Projects | `project`, `decision` | 当前项目有哪些目标、约束和已做的决定？ |
| `knowledge` | Facts & references / Facts | `fact`, `reference` | 哪些长期事实和外部资料值得再次找到？ |
| `episodes` | History | `episode` | 过去发生过什么，哪些会话或任务可以作为证据？ |

这十一 kind 是：

```text
profile  preference
rule     feedback  lesson  workflow
project  decision
fact     reference
episode
```

一级分类用于跨 agent 浏览，kind 用于保留更具体的知识类型。页面中的分类
legend 只过滤当前时间线，不改变 memory 的原始分类。

### 与各 agent 原生类型的关系

dachshund 在分类时区分两层语义：

1. **Native model**：原 agent 把这个条目叫什么、放在哪里、为什么保存；
2. **dachshund category + kind**：用于跨 agent 组织的统一分类。

导入后的条目保存统一 kind、来源 agent 和原始路径；每个 agent 的原生结构则在
agent 详情页中解释。dachshund 不会把原生 kind 名称直接当作一级分类。

常见原生类型按以下方式进入当前模型：

| 原生信号 | dachshund 结果 |
| --- | --- |
| `user`, `identity`, `personal` | `profile` → About me |
| `preference`, `preferences` | `preference` → About me |
| `feedback`, `correction` | `feedback` → Ways of working |
| `instruction`, `rule`, `guideline`, `policy` | `rule` → Ways of working |
| `lesson` | `lesson` → Ways of working |
| `workflow` | `workflow` → Ways of working |
| `project`, `task-group`, `project_memory` | `project` → Projects |
| `decision` | `decision` → Projects |
| `fact` | `fact` → Facts & references |
| `reference`, `link`, `doc` | `reference` → Facts & references |
| `session`, `session_memory`, `topic`, `rollout`, `compaction` | `episode` → History |

Claude Code、WorkBuddy 和 ZCode 常用的四类原生 schema
`user / feedback / project / reference` 会按其语义归一化，但不会直接变成
dachshund 的四个一级分类。原因是这四个原生类型混用了身份、行为纠正、项目上下文
和外部资料，同时没有单独表达 `decision`、`workflow`、`lesson` 和 `episode`。

### 分类原则

- **确定性**：分类只依赖原生 kind、文件角色和显式 section，不调用 LLM、不生成
  embedding，也不为了分类上传 memory。
- **保守映射**：未知或空 kind 回退到 `fact`，不丢内容，也不擅自提高权威级别。
- **agent 是来源，不是一级分类**：agent 用于 provenance、过滤和来源徽标；同一个
  memory 可以来自多个 agent。
- **project 是独立字段**：`project` 字段记录作用项目，不等同于 `projects` 分类。
- **History 不是长期事实**：session、topic、compaction 和 rollout 先作为证据保存；
  只有显式写入才会变成 `lesson`、`decision` 或 `fact`。

## 研究中的替代模型

以下模型来自早期调研，用来说明为什么当前实现选择五分类，而不是要求立即迁移。

### Authority

用来源强度区分：

| Authority | 含义 | 例子 |
| --- | --- | --- |
| `instruction` | 用户或团队手写的强约束 | `AGENTS.md`、`CLAUDE.md`、Cursor Rule |
| `memory` | 长期上下文或 agent 总结 | `MEMORY.md`、`USER.md`、auto memory |
| `episode` | 一次任务或会话的轨迹 | session summary、rollout、compaction |

这项研究的价值是提醒 dachshund 不要把强指令和自动总结静默合并。当前实现通过
`rule` / `feedback` 等 kind、来源路径和 native mapping 保留差异，但**没有单独的
`authority` 字段**。

### Scope

用作用域区分：

| Scope | 含义 |
| --- | --- |
| `global` | 跨项目、跨 agent 的个人资料或偏好 |
| `project` | 绑定到一个仓库或明确项目 |
| `path` | 只对目录、文件类型或路径生效 |
| `session` | 只对一次会话、任务或分支有效 |

当前数据模型已有 `project` 字段，但没有通用的 `scope`、`path` 或 `session` 字段。
从来源路径推断作用域是有用的研究方向，但不能把推断结果说成用户明确声明。

### Confidence

早期提案还考虑过 `confidence`：

- `declared`：用户或 agent 明确写入；
- `inferred`：dachshund 根据标题、路径或内容推断；
- `imported`：原样导入但尚未分类。

当前实现没有这个字段。未知 kind 会保留内容并回退到 `fact`，不会伪造推断置信度。

### 研究草图，不是现有格式

下面的 frontmatter 只是候选设计：

```yaml
id: mem_example
title: Prefer explicit product decisions
authority: memory
kind: feedback
scope: global
project: null
tags:
  - product
  - decision-making
confidence: declared
sources:
  - agent: claude-code
    path: ~/.claude/projects/.../memory/feedback_decisions.md
created: 2026-10-31T10:00:00.000Z
updated: 2026-10-31T10:00:00.000Z
```

在采用这些字段前，需要先证明它们能改善真实浏览、冲突处理或 agent 调用体验，
而不是只让 schema 看起来更完整。

## 仍待验证的问题

1. **冲突展示**：不同 agent 对同一条规则给出不同说法时，怎样并列展示来源和差异。
2. **近重复聚类**：相同主题但措辞不同的 memory 是否值得在 UI 中成组展示。
3. **候选提升**：怎样让用户明确把 `episode` 提升为 `lesson`、`decision` 或 `fact`。
4. **authority / scope**：只有在实际查询和冲突处理需要时，才评估是否增加字段。
5. **合并边界**：当前只做完全重复的 echo 合并；语义合并和冲突自动裁决都不应默认发生。

## 文档关系

- [docs/MEMORY.md](../docs/MEMORY.md)：当前分类、归一化规则和 agent mapping 的
  产品说明。
- [agent-memory-structures.md](agent-memory-structures.md)：各 agent 的原生存储结构、
  来源和观察证据。
- [cross-agent-memory-products.md](cross-agent-memory-products.md)：本地优先产品对比
  与 dachshund 的产品边界。

每次修改分类、kind、agent mapping 或界面呈现时，必须同时检查 README、`docs/`、
`research/`、官网中英文页面和截图是否仍然一致。研究提案与已实现行为必须分开标注。
