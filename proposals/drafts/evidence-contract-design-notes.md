# Evidence Contract & Ground Truth Corpus — Design Notes

**Status**: Design Notes
**Date**: 2026-09-03
**Superseded as Proposal by**: P0001 Evidence Foundation

> This document is retained as design input for P0001.
> It is NOT an executable Proposal and MUST NOT be implemented independently.

## Objective

P0001 的目标是定义 Opportunity Radar 中最基础、最稳定的业务对象：**Evidence**。

本阶段不从数据库 Schema 出发，而是从真实市场事实出发，用一组人工整理的 Ground Truth Evidence 验证 Evidence 的语义边界、字段契约、原子性、来源关系和 provenance 模型。

完成 P0001 后，系统应明确回答：

> 什么是一条 Evidence，什么不是 Evidence；一篇来源材料如何拆成多个事实；同一个事实被多个来源报道时如何表达；后续 Signal 如何可靠地回溯到 Evidence。

本阶段只建立 **Evidence Contract + Ground Truth Corpus**。

不进行自动采集，不建立数据库，不做 Signal，不接 LLM。

---

## Background

Opportunity Radar 的核心认知链为：

```text
Five Analytical Objects

Evidence
  ↓
Market Signal
  ↓
Structural Shift
  ↓
Opportunity Thesis
  ↓
Opportunity

Validation Process
acts on Opportunities / Theses over time
```

其中 Evidence 是整个系统的事实基础。

如果 Evidence 设计错误，后续所有 Market Signal、Structural Shift 和 Opportunity 都会建立在不稳定的数据语义之上。

### 已发现的风险

最初很容易把 Evidence 理解成：

```text
一篇新闻
=
一条 Evidence
```

这是错误的。

例如一篇报道可能同时包含：

```text
Company A raised $100M
Company A is valued at $1B
Company A has 200 enterprise customers
Revenue grew 4x YoY
Company A expanded into Europe
```

这不是一条 Evidence。

这是：

```text
1 Source Document
        ↓
5 Evidence Facts
```

反过来，同一个事实：

```text
Company A raised $100M
```

可能同时出现在：

```text
company press release
Reuters
TechCrunch
investor announcement
```

这也不是四条完全独立的市场事实。

它更接近：

```text
1 factual claim
+
multiple supporting sources
```

因此 P0001 必须先解决：

* Evidence 的原子性
* Source 与 Evidence 的区别
* Claim 与 Document 的区别
* 多来源佐证
* 时间语义
* 地域语义
* Provenance
* Evidence 生命周期边界

而不是先创建 `evidence` SQL table。

---

# Architecture Position

P0001 只实现以下位置：

```text
External World

    ↓ manually curated

Source Material
    ↓

Evidence Contract
    ↓

Ground Truth Corpus
```

未来架构才会继续：

```text
Source Material
    ↓
Acquisition
    ↓
Evidence
    ↓
Market Signal
    ↓
Structural Shift
    ↓
Opportunity Thesis
    ↓
Opportunity
```

### P0001 不实现 Acquisition

本阶段的 Ground Truth Corpus 是：

> 人工整理的设计验证数据。

它不是生产 acquisition pipeline。

---

# Core Design Principle

## Evidence is an atomic factual claim

Evidence 的核心定义：

> **Evidence is an atomic, externally observable factual claim with traceable provenance.**

中文：

> Evidence 是一个可以被外部来源观察、核查，并具有可追溯来源的原子事实声明。

例如：

```text
“Wonderful completed a $550M Series C financing.”
```

这是 Evidence。

而：

```text
“Wonderful is a strong opportunity.”
```

不是 Evidence。

这是判断。

---

# Semantic Boundary

必须严格区分以下概念。

## Source Document

来源材料。

例如：

* Reuters article
* company press release
* government notice
* GitHub repository
* Product Hunt page
* financial report
* job listing
* official product page

Source Document 是：

> 承载 Evidence 的外部材料。

不是 Evidence 本身。

---

## Evidence

从 Source Document 中提取出的原子事实。

例如：

```text
Source:
Reuters article

Evidence 1:
XPeng Robotics raised more than $900M.

Evidence 2:
Post-money valuation exceeded $6.3B.

Evidence 3:
The financing was announced on 2026-08-25.
```

---

## Interpretation

例如：

```text
Capital is accelerating into Chinese humanoid robotics.
```

不是 Evidence。

这是未来 Market Signal。

---

## Hypothesis

例如：

```text
China may develop a large embodied-AI deployment services market.
```

不是 Evidence。

这是未来 Opportunity Thesis。

---

# Evidence Atomicity

这是 P0001 最重要的设计问题之一。

## Rule

一条 Evidence 应尽量表达：

> 一个主体，在一个时间背景下，发生了一个可核查事实。

推荐结构：

```text
Subject
+
Predicate
+
Object / Value
+
Time Context
```

例如：

```text
Wonderful
raised
USD 550M Series C
in September 2026
```

---

## Correct

```text
Wonderful raised $550M in a Series C round.
```

```text
Wonderful's reported valuation reached $5B.
```

```text
Wonderful had approximately 100 enterprise customers.
```

---

## Incorrect

不要创建：

```text
Wonderful raised $550M, reached a $5B valuation,
grew rapidly, has 100 customers, and is expanding globally.
```

原因：

这是多个事实粘在一个对象里。

后续：

* confidence
* corroboration
* contradiction
* time evolution
* Signal attribution

都会失真。

---

# Source vs Evidence Model

P0001 必须采用：

```text
Source
   ↓
Evidence
```

而不是：

```text
Evidence == Source
```

建议最小关系：

```text
SourceDocument
    ├── Evidence A
    ├── Evidence B
    └── Evidence C
```

同时允许：

```text
Evidence A
    ├── Source 1
    ├── Source 2
    └── Source 3
```

即：

> Source 与 Evidence 是 many-to-many conceptual relationship。

但 P0001 不需要数据库 join table。

只需要在 Contract 中正确表达这种语义。

---

# Proposed Contract

本阶段可以建立 TypeScript + Zod Contract。

目录建议：

```text
evidence/
├── contracts/
│   ├── source-document.ts
│   ├── evidence.ts
│   └── index.ts
└── ground-truth/
```

这是 Bootstrap 后第一次允许创建正式业务目录：

```text
evidence/
```

因为 P0001 已经正式批准 Evidence 作为业务能力。

---

# SourceDocument Contract

建议字段：

```text
SourceDocument {
  id
  sourceType
  publisher
  title
  url
  publishedAt
  accessedAt
  language
  market
}
```

## id

系统内部稳定标识。

当前 Ground Truth 可以使用 deterministic fixture ID。

不要设计数据库 ID 策略。

---

## sourceType

必须是业务上有意义的有限枚举。

建议初始支持：

```text
news
company_announcement
government
financial_report
product_page
repository
marketplace
research
other
```

不要为未来所有可能来源设计巨大 taxonomy。

Ground Truth 没出现的类型不要提前加。

---

## publisher

来源发布主体。

例如：

```text
Reuters
TechCrunch
XPeng
北京市政府
GitHub
Product Hunt
```

---

## title

原来源标题。

如果 Source 天然没有标题，可使用人工稳定描述。

不要把 summary 当 title。

---

## url

原始来源 URL。

Ground Truth 必须保存。

---

## publishedAt

来源首次公开发布时间。

允许：

```text
ISO timestamp
or null
```

如果来源无法确定发布时间：

不要猜。

---

## accessedAt

Opportunity Radar 获取 / 核查该来源的时间。

必须与 `publishedAt` 分开。

---

## language

初始至少：

```text
en
zh
```

不要做复杂 locale 系统。

---

## market

来源主要对应市场。

初始建议：

```text
CN
US
GLOBAL
OTHER
```

注意：

`market` 是来源 / 事件上下文，不等于公司注册国。

---

# Evidence Contract

建议字段：

```text
Evidence {
  id
  claim
  subject
  evidenceType
  eventAt
  observedAt
  market
  sourceRefs
  confidence
  metadata
}
```

---

## id

稳定 Evidence 标识。

Ground Truth 使用人工 fixture ID。

不要实现 production ID generator。

---

## claim

人类可读、事实性的原子声明。

例如：

```text
"Wonderful raised USD 550 million in a Series C financing round."
```

要求：

* factual
* concise
* atomic
* no recommendation
* no interpretation
* no speculative language

---

## subject

该事实的主要对象。

例如：

```text
Wonderful
XPeng Robotics
China humanoid robotics industry
Google Gemini Enterprise
```

P0001 只保存字符串。

不要创建 Company Entity System。

不要做 entity resolution。

---

## evidenceType

这是非常重要的字段。

必须从 Ground Truth 反推，而不是随意创造 taxonomy。

根据当前真实扫描，初始可以验证以下类型是否足够：

```text
funding
valuation
revenue
growth
customer_adoption
product_launch
market_entry
policy
investment
usage
pricing
partnership
acquisition
technology_capability
market_activity
```

但：

**Claude Code 不得机械照抄完整列表。**

必须先整理 Ground Truth，然后判断：

* 哪些类型真实出现
* 哪些可以合并
* 哪些实际上属于 interpretation 而不是 Evidence

最终类型数量应保持小。

建议 P0001 目标：

> approximately 8–12 Evidence Types

不是越多越好。

---

## eventAt

事实实际发生的时间。

例如：

融资完成日期。

产品发布日。

政策发布日期。

允许：

```text
timestamp
date
null
```

Contract 层建议统一成 ISO datetime string nullable。

具体精度问题先记录在 metadata 或 fixture。

不要做 Temporal Engine。

---

## observedAt

Opportunity Radar 确认该事实的时间。

这是系统时间。

必须和：

```text
eventAt
publishedAt
accessedAt
```

区分。

四种时间语义：

```text
eventAt
= 事情什么时候发生

publishedAt
= 来源什么时候发布

accessedAt
= 我们什么时候访问来源

observedAt
= Radar 什么时候正式记录这条 Evidence
```

这四者未来 Continuous Radar 会非常重要。

---

## market

该 Evidence 主要对应：

```text
CN
US
GLOBAL
OTHER
```

例如：

美国公司融资：

```text
US
```

中国政策：

```text
CN
```

全球 GitHub adoption：

```text
GLOBAL
```

不要创建复杂 geography model。

---

## sourceRefs

Evidence 必须至少引用一个 SourceDocument。

例如：

```text
sourceRefs: ["src-reuters-wonderful-20260902"]
```

同一 Evidence 可以多个来源：

```text
sourceRefs: [
  "src-company-announcement",
  "src-reuters"
]
```

这表达 corroboration。

---

# Confidence

P0001 可以保留极简 Evidence confidence。

建议不是自由浮点数。

初始：

```text
primary
corroborated
reported
uncertain
```

语义：

### primary

直接来自第一方 / 官方来源。

例如：

* company announcement
* government document
* official financial report

### corroborated

有多个相互独立来源支持。

### reported

来自可信 secondary source，但 Ground Truth 当前只有单一来源。

### uncertain

来源明确存在限定词、估算、传闻或无法完全验证。

---

注意：

这不是：

> “我们认为这个机会有多大把握。”

它只表示：

> Evidence 本身的事实可靠程度。

---

# Metadata

允许：

```text
metadata: Record<string, unknown>
```

但必须非常克制。

metadata 只用于 Ground Truth 中少数尚未稳定为正式 Contract 的事实属性。

例如：

```text
currency
amount
unit
round
```

不要把所有东西都扔进 metadata。

如果一个字段反复在 Ground Truth 中出现，应报告并考虑提升为 Contract。

---

# Raw Content Rule

P0001 不保存整篇网页全文。

Ground Truth SourceDocument 可以保留：

```text
title
url
publisher
date
```

以及必要时很短的：

```text
sourceNote
```

但：

* 不复制完整新闻
* 不保存全文 HTML
* 不构建网页 snapshot
* 不做 copyright archive
* 不做 document store

未来 Acquisition Proposal 再决定原始内容保留策略。

---

# Ground Truth Corpus

P0001 必须建立一套人工 Ground Truth Corpus。

目的：

> 用真实市场 Evidence 压测 Contract。

建议目录：

```text
evidence/ground-truth/
├── sources.ts
├── evidence.ts
└── README.md
```

或者：

```text
evidence/ground-truth/
├── sources.json
├── evidence.json
└── README.md
```

推荐 TypeScript fixtures，因为：

* 可以直接通过 Zod parse
* 类型检查直接覆盖
* 当前没有生产数据存储需求

---

# Corpus Size

目标：

```text
15–25 Source Documents
30–50 Evidence Facts
```

不要做成大数据集。

重点是：

> 语义覆盖，而不是数量。

---

# Required Ground Truth Coverage

至少覆盖以下真实 Evidence 模式。

## 1. Funding / Valuation

例如：

Wonderful
XPeng Robotics
Prime Intellect

用于验证：

```text
funding
valuation
eventAt
multiple claims from one source
```

---

## 2. Revenue / Growth

例如：

Wonderful revenue run-rate growth
Zhipu AI revenue growth

用于验证：

```text
revenue
growth
reported metrics
currency / period metadata
```

---

## 3. Customer Adoption

例如：

enterprise customer count
industry deployment

用于验证：

```text
customer_adoption
usage
```

---

## 4. Product / Market Entry

例如：

Google industry-specific Gemini Enterprise
agent infrastructure startups

用于验证：

```text
product_launch
market_entry
```

---

## 5. Acquisition

例如：

Okta / Permiso

用于验证：

```text
acquisition
reported transaction value
```

---

## 6. Government / Policy

中国数字出口、 embodied intelligence training/data policy 等。

用于验证：

```text
policy
CN source
government publisher
```

---

## 7. Market Activity

例如：

China industrial robot purchases growth
supporting integration revenue growth

用于验证：

```text
market_activity
statistics
industry-level subject
```

---

## 8. Technology / Dataset / Usage

例如：

RoboMIND downloads
PaXini dataset/data factory

用于验证：

```text
usage
technology_capability
dataset-related evidence
```

---

# Ground Truth Source Quality

Ground Truth 优先级：

```text
Primary source
>
Reuters / established reporting
>
specialist reputable publication
>
other secondary source
```

不要为了凑数量使用低质量 SEO 内容。

---

# Important: No Web Acquisition Implementation

Claude Code 可以使用当前 Proposal 中已提供的事实建立 fixture。

如果需要核对公开事实，可以人工浏览 / 查阅来源。

但：

**禁止写任何自动 acquisition code。**

不能出现：

```text
fetch(url)
crawler
scraper
RSS parser
GitHub API client
web search adapter
```

Ground Truth 是 fixture，不是 ingestion pipeline。

---

# Deduplication Semantics

P0001 不实现 deduplication engine。

但必须通过 Ground Truth 定义以下语义。

## Same source duplicated

同一 URL 重复出现：

```text
same SourceDocument
```

---

## Multiple publishers reporting same claim

不是 duplicate Source。

应该表达：

```text
one Evidence
→ multiple sourceRefs
```

如果它们确实在陈述同一个事实。

---

## Similar but different claims

例如：

```text
Company raised $100M.
Company reached $1B valuation.
```

必须是两个 Evidence。

---

## Same metric at different times

例如：

```text
Revenue was $10M in 2025.
Revenue was $50M in 2026.
```

是两条 Evidence。

不能更新覆盖。

---

# Contradiction Semantics

P0001 不实现 contradiction engine。

但 Ground Truth README 必须明确：

如果未来两个来源分别说：

```text
Revenue = $50M
Revenue = $70M
```

系统不应该覆盖旧 Evidence。

应该允许：

```text
Evidence A
Evidence B
```

同时存在。

未来 Signal / Validation 层处理冲突。

Evidence Store 的职责是：

> preserve what was reported, with provenance.

而不是提前裁判市场真相。

---

# Proposed Directory Structure

P0001 完成后允许出现：

```text
opportunity-radar/
├── evidence/
│   ├── contracts/
│   │   ├── source-document.ts
│   │   ├── evidence.ts
│   │   └── index.ts
│   └── ground-truth/
│       ├── sources.ts
│       ├── evidence.ts
│       └── README.md
│
├── tests/
│   ├── unit/
│   │   └── evidence-contract.test.ts
│   └── contract/
│       └── ground-truth-corpus.test.ts
│
├── context/
├── proposals/
└── shared/
```

不要增加其他业务目录。

---

# Validation Strategy

P0001 的代码量应该很小。

真正价值在 Contract 和 fixture。

必须验证：

## Contract Validation

测试：

* valid SourceDocument passes
* invalid URL fails
* invalid market fails
* malformed datetime fails
* valid Evidence passes
* Evidence without source fails
* empty claim fails
* unknown evidence type fails

---

## Corpus Validation

整个 Ground Truth Corpus 必须：

```text
every SourceDocument parses
every Evidence parses
every sourceRef resolves
every Evidence has >=1 Source
IDs are unique
```

---

## Atomicity Review

至少人工挑选 5 个复杂 SourceDocument。

README 中记录：

```text
Source X
→ Evidence A
→ Evidence B
→ Evidence C
```

证明：

> 一个 document 能正确拆成多个 Evidence。

---

## Corroboration Review

至少建立 2 个 Evidence：

```text
Evidence
→ Source A
→ Source B
```

证明多来源不是重复 Evidence。

---

# Design Questions P0001 Must Resolve

P0001 实施过程中 Claude Code 应通过 Ground Truth 给出结论，而不是拍脑袋。

至少回答：

1. `evidenceType` 初始 enum 最终有哪些？
2. `eventAt = null` 是否足够处理未知事件时间？
3. `subject` 目前是否保持 string？
4. `market` 四值是否覆盖当前 Ground Truth？
5. `confidence` 四级是否足够？
6. 哪些字段反复出现在 metadata，值得未来升为正式字段？
7. Source/Evidence many-to-many 模型是否被 Ground Truth 验证？
8. 是否存在 Evidence 无法自然表达，需要修改 Contract？

这些结论写入 P0001 Completion Report。

涉及长期架构选择的，写 ADR。

---

# Boundaries

## Included

P0001 只包括：

* 创建 `evidence/` 业务目录
* SourceDocument Zod Contract
* Evidence Zod Contract
* TypeScript inferred types
* 小规模 Ground Truth Sources
* 小规模 Ground Truth Evidence
* Contract tests
* Corpus integrity tests
* Atomicity examples
* Corroboration examples
* Context Memory 更新
* 必要 ADR

---

# NOT Included — CRITICAL

## Acquisition

绝对不做：

* web crawler
* scraper
* RSS
* browser automation
* Google/Bing search
* GitHub API
* Product Hunt API
* YC scanner
* scheduled acquisition
* source discovery

---

## Storage

绝对不做：

* SQLite
* database schema
* repository class
* persistence
* filesystem evidence store
* migrations
* cache
* vector DB

Ground Truth fixture 不等于生产存储。

---

## Signal

不创建：

```text
signals/
```

不实现：

* Market Signal
* clustering
* interpretation
* trend detection
* anomaly detection

---

## Structural Shift

不创建：

```text
shifts/
```

---

## Opportunity Thesis

不创建：

```text
theses/
```

---

## Opportunity

不创建：

```text
opportunities/
```

不实现：

* scoring
* ranking
* cards
* watchlist
* validation engine

---

## AI / Agent

不做：

* LLM call
* prompt
* agent
* Hermes
* AgentFabric
* OpenAI
* Claude API
* model abstraction
* embeddings

---

## API / UI

不做：

* Express
* API
* CLI product interface
* Workspace
* Dashboard
* Frontend

---

## Entity System

不要实现：

* Company entity
* Person entity
* Organization graph
* canonical entity resolution
* knowledge graph

`subject` 当前保持简单字符串。

---

## Taxonomy Platform

不要做通用 taxonomy system。

`evidenceType` 只服务当前 Ground Truth。

---

# File Standards

继续遵守 Bootstrap `CLAUDE.md`：

* exported functions explicit return types
* no `any`
* Zod at external/data boundaries
* immutable patterns
* max ~800 lines/file
* max ~50 lines/function
* no production `console.log`
* no unrelated refactor

---

# Context Memory Update

完成 P0001 后必须更新：

```text
context/current_state.md
context/decisions.md
context/handoff.md
```

如果 Evidence Contract 形成新的长期设计决策：

添加 ADR。

不要修改 Bootstrap 历史 ADR 的含义。

---

# Success Criteria

P0001 只有满足以下条件才算完成。

1. **Evidence 有明确、可执行的业务定义**

   ```text
   Evidence = atomic factual claim with traceable provenance
   ```

2. 至少存在：

   ```text
   15–25 Source Documents
   30–50 Evidence Facts
   ```

3. Ground Truth 同时覆盖：

   * funding
   * valuation
   * revenue/growth
   * customer adoption
   * product/market entry
   * acquisition
   * government/policy
   * industry statistics/activity
   * technology/dataset/usage

4. 至少 5 个 SourceDocument 被拆成多个 atomic Evidence。

5. 至少 2 条 Evidence 拥有两个或以上 `sourceRefs`。

6. 所有 Ground Truth 数据都通过 Zod Contract。

7. 所有 `sourceRefs` 均能解析到真实 fixture SourceDocument。

8. 不存在 duplicate ID。

9. `npm run typecheck` 通过。

10. `npm test` 全部通过。

11. 没有引入：

    ```text
    database
    acquisition
    LLM
    agent
    API
    UI
    Signal
    Structural Shift
    Thesis
    Opportunity
    ```

12. Completion Report 能明确回答本 Proposal 中的 8 个 Design Questions。

---

# Implementation Sequence

建议严格按以下顺序执行：

```text
1. Read CLAUDE.md
2. Read PROJECT.md
3. Read context/*
4. Read P0001
5. Review existing Bootstrap baseline
6. Draft Ground Truth source list
7. Manually decompose sources into atomic factual claims
8. Derive minimal SourceDocument Contract
9. Derive minimal Evidence Contract
10. Derive minimal evidenceType taxonomy
11. Encode fixtures
12. Add contract validation tests
13. Add corpus integrity tests
14. Review atomicity
15. Review corroboration
16. Answer Design Questions
17. Update ADR/context
18. Run typecheck + tests
19. Boundary audit
20. Present pre-commit report
```

不要从第 8 步开始。

**先看 Ground Truth，再定 Contract。**

---

# Pre-Commit Report

完成后先不要 commit。

请返回：

# P0001 Completion Report

## Ground Truth

* Source Documents count
* Evidence count
* CN / US / Global distribution
* Evidence Type distribution

## Final Contracts

### SourceDocument

列出最终字段。

### Evidence

列出最终字段。

### Evidence Types

列出最终 enum，并说明为什么保留这些类型。

## Atomicity Findings

给出至少 3 个：

```text
Source
→ Evidence A
→ Evidence B
→ Evidence C
```

示例。

## Corroboration Findings

给出至少 2 个：

```text
Evidence
→ Source A
→ Source B
```

示例。

## Design Questions

逐项回答本 Proposal 的 8 个问题。

## Files Changed

列出所有新增/修改文件。

## Tests

```text
typecheck:
tests:
new tests:
failures:
```

## Boundary Check

明确：

```text
Acquisition implemented: NO
Database introduced: NO
Signal implemented: NO
Structural Shift implemented: NO
Thesis implemented: NO
Opportunity implemented: NO
LLM/Agent introduced: NO
API/UI introduced: NO
```

## Proposed ADRs

列出本阶段新增 ADR。

## Risks / Open Questions

只列真正需要下一阶段设计决定的问题。

## Git Status

列出 working tree。

最后写：

> P0001 implementation complete and awaiting review. No commit performed.

---

# Final Instruction

P0001 的成功标准不是：

> “我们有了一个 Evidence Schema。”

而是：

> **我们已经用真实市场事实证明，这个 Evidence Contract 足以承载 Opportunity Radar 后续推理。**

如果 Ground Truth 与最初字段设计冲突：

**修改 Contract。**

不要为了保住最初 Schema 去扭曲真实市场事实。

Reality wins over schema.
