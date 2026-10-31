# dachshund Memory 分类模型

研究日期：2026-10-31

本文是基于 [agent-memory-structures.md](agent-memory-structures.md) 的产品建议，
不是现有实现说明。

## 问题

当前 dachshund 主要按：

- 时间；
- 所属 agent；
- 简单的 `kind`；
- 项目字段；

组织 memory。这个模型适合导入和快速搜索，但不足以回答用户真正会问的问题：

- “我在所有 agent 里表达过哪些稳定偏好？”
- “这个项目的规则、决策和外部资料分别是什么？”
- “两个 agent 对同一件事的说法一致吗？”
- “哪些是用户定的规则，哪些只是 agent 自己总结的？”
- “最近一次任务得出的结论，什么时候应该变成长期记忆？”

## 建议：三层模型

### 第一层：Authority

决定这条记录在系统里的权威级别。

| Authority | 含义 | 例子 | 默认行为 |
| --- | --- | --- | --- |
| `instruction` | 用户或团队手写的规则 | `AGENTS.md`、`CLAUDE.md`、Cursor Rule | 可显示为规则；冲突时不能静默合并 |
| `memory` | 长期上下文或 agent 学到的内容 | `MEMORY.md`、`USER.md`、auto memory | 软回忆；可被纠正、过期和归档 |
| `episode` | 某次任务或会话的轨迹和摘要 | session summary、rollout、compaction | 作为证据；默认不直接注入 |

Reference 和 Artifact 不单列为 authority。一个 reference 可以是 memory，也可以是
episode 里的引用；关键看它是被长期保存，还是只存在于一次会话。

### 第二层：Kind

只保留四种长期记忆语义：

| Kind | 回答的问题 | 典型内容 |
| --- | --- | --- |
| `user` | 我是谁、我怎样工作 | 角色、语言、专业背景、稳定偏好 |
| `feedback` | 以后应该怎样做，或不要再怎样做 | 纠正、确认的方法、经验教训 |
| `project` | 这个项目现在是什么状态 | 目标、范围、决策、约束、截止日期 |
| `reference` | 如果需要更多信息，去哪里找 | URL、文件、issue tracker、dashboard、外部系统 |

选择这四类的原因：

1. Claude Code、WorkBuddy、ZCode 已经使用相同或几乎相同的类型；
2. 能覆盖现有 `profile`、`preference`、`project`、`lesson`、`fact`；
3. 数量足够少，用户不需要学习复杂的第二大脑方法；
4. 适合在 UI 中做稳定的一级分类；
5. 仍然可以通过 tags 承载 `design`、`typescript`、`release` 等主题。

### 第三层：Scope

| Scope | 含义 |
| --- | --- |
| `global` | 跨项目、跨 agent 的个人资料或偏好 |
| `project` | 绑定到一个 git repo 或明确项目 |
| `path` | 只对目录/文件类型生效，常见于 Rules |
| `session` | 只对某次会话、任务或分支有效 |

`scope` 必须独立于 `kind`。例如：

- “用中文回复”是 `user + global`；
- “这个 repo 使用 pnpm”是 `project + project`；
- “所有 migration 先写测试”是 `feedback + project` 或 `instruction + project`；
- “这个 bug 的排查过程”是 `episode + session`。

## 建议的数据结构

在不破坏现有 Markdown 的前提下，逐步增加字段：

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
    ref: feedback_decisions
  - agent: codex
    path: ~/.codex/memories/MEMORY.md
    ref: task-group/product
created: 2026-10-31T10:00:00.000Z
updated: 2026-10-31T10:00:00.000Z
status: active
```

字段含义：

- `authority`：instruction / memory / episode；
- `kind`：user / feedback / project / reference；
- `scope`：global / project / path / session；
- `confidence`：declared / inferred / imported；
- `sources`：保留 agent、原路径和 section/ref；
- `status`：active / archived / superseded。

`confidence` 不是模型置信度。它表示证据来源：

- `declared`：用户或 agent 明确写入；
- `inferred`：dachshund 根据标题、路径或内容推断；
- `imported`：原样导入但尚未分类。

## 现有 kind 的迁移

| 当前 kind | 建议映射 | 备注 |
| --- | --- | --- |
| `profile` | `kind=user`, `authority=memory` | 用户或 agent 身份资料 |
| `preference` | 通常 `kind=user` | 如果是纠错或禁止项，改为 `feedback` |
| `project` | `kind=project`, `authority=memory` | 保留 project 字段 |
| `lesson` | `kind=feedback`, `authority=memory` | 经验教训优先作为可复用行为 |
| `fact` | `kind=reference` 或按内容重新分类 | 不要继续扩充无类型事实 |
| `rule` | `authority=instruction` | `kind` 按作用域选 user/project |

迁移原则：

1. 先保存原 kind 到 `legacy_kind`，避免信息丢失；
2. 新 importer 只输出新模型；
3. 旧文件在下次编辑或显式迁移时转换；
4. 不根据关键词做大规模自动重写，先做可见的候选分类。

## 产品界面建议

### 主分类

默认导航不应只有 agent 和时间。建议出现以下稳定分类：

1. **How I work**：user + feedback；
2. **Projects**：project；
3. **Rules**：instruction；
4. **References**：reference；
5. **Recent episodes**：session/episode。

其中 “How I work” 是最有差异化的跨 agent 视图：它把 Claude 的用户偏好、
Codex 的工作流总结、Hermes 的 USER.md、Trae 的 user profile 放在同一个语义空间里。

### Agent 的位置

agent 不再是一级分类，而是：

- 卡片上的来源叠加图标；
- 详情里的 provenance；
- 顶部的可选过滤器；
- 冲突时的来源证据。

时间仍然重要，但用于：

- “最近变化”；
- “最近新增的反馈”；
- “过期的项目决策”；
- episode timeline。

时间不应作为唯一主组织方式。

### 跨 agent 合并规则

推荐分阶段：

1. **Exact duplicates**：相同 authority + kind + scope 下继续现有 hash 合并；
2. **Near duplicates**：先聚类并展示“可能重复”，不自动覆盖；
3. **Conflicts**：同一条规则有不同文本时并列展示，标记冲突；
4. **Promotion**：episode 中的候选 feedback/user memory 必须经过用户确认；
5. **Consolidation**：跨 agent 合并成一个 canonical memory 时，保留全部 sources。

绝不能把：

- instruction 和 auto memory 自动合并；
- 两个作用域不同的规则自动合并；
- 两个 agent 的冲突规则静默选一个；
- 一次性 session 内容自动升级成长期记忆。

## 建议的 UI 分类树

```text
Memory
├── How I work
│   ├── Identity & background
│   ├── Preferences
│   └── Feedback & lessons
├── Projects
│   ├── Active
│   ├── Decisions
│   └── Constraints
├── Rules
│   ├── Global
│   ├── Project
│   └── Path-specific
├── References
│   ├── People & teams
│   ├── Tools & systems
│   └── Documents & links
└── Episodes
    ├── Recent sessions
    ├── Outcomes
    └── Candidate memories
```

这不是唯一答案，但它能把“不同 agent 的同类记忆放在一起看”，同时保留足够的
来源和权威信息。

## 分阶段落地

### Phase 1：只做可见分类

- 在 frontmatter 增加 `authority`、`scope`、`confidence`；
- 统一新导入的 `kind`；
- UI 增加分类筛选；
- agent 过滤保留。

### Phase 2：建立候选关系

- 用标题、tag、project 和文本相似度找 near duplicate；
- 展示 “same topic from N agents”；
- 不自动重写原记忆。

### Phase 3：可控合并

- 支持把多个来源合并为一个 canonical memory；
- 显示冲突；
- 支持 superseded / expiry；
- 把 episode candidate 提升为长期 memory。

### Phase 4：真正形成 dachshund 分类

- 根据用户确认行为学习分类；
- 但仍保持本地、确定性、可解释；
- 不要求 LLM 才能完成基础分类。

## 必须验证的问题

1. 用户是否真的会按四类浏览，还是更常搜索？
2. “How I work” 是否比按 agent 更有价值？
3. 用户能否理解 instruction 与 memory 的区别？
4. 项目身份用 git root、cwd 还是用户命名更稳定？
5. 冲突规则应该怎样呈现，才不会像系统在替用户做决定？
6. episode 的保留期限和摘要策略是什么？
7. 当 agent 更新自己的 memory 文件时，dachshund 如何标记 superseded？

这些问题应在实现前用小规模原型和真实 library 验证，而不是一次性重构所有
importer。
