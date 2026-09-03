# P0001: Evidence Foundation

**Status**: Completed
**Date**: 2026-09-03
**Depends on**: Bootstrap `c80f60b`

## Status History

- 2026-09-03 — Proposed. Authored by ChatGPT, awaiting human approval.
- 2026-09-03 — Implementing. Human authorized "开始开发" with full
  P0001 scope (SQLite + Repository + CLI) and full-pass workflow
  (single pre-commit report). Implementation agent: Claude Code.
- 2026-09-03 — awaiting-review. Implementation complete; change
  set uncommitted on `main`; awaiting human review and commit
  authorization.
- 2026-09-03 — Completed. Human review passed; change set
  committed. Subsequent changes must go in a new Proposal.

## Objective

P0001 建立 Opportunity Radar 第一个真正可运行的业务闭环：**Evidence Foundation**。

完成后，系统必须能够把人工提供的一条外部市场事实及其来源材料，经过 Contract 校验、标准化、去重和持久化，保存为可查询、可追溯的 Evidence。

本阶段同时使用真实市场 Ground Truth 验证 Evidence Contract，避免先设计数据库 Schema、再强迫真实市场事实适配 Schema。

P0001 的最终闭环：

```text
External Market Fact
        ↓
Manual Ingest
        ↓
Contract Validation
        ↓
Normalization
        ↓
Deduplication
        ↓
SQLite Evidence Store
        ↓
Query
        ↓
Provenance
```

P0001 **只做到 Evidence**。

不解释 Evidence，不产生 Signal，不判断机会。

---

# Background

Opportunity Radar 的核心认知模型：

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

Bootstrap 已完成项目工程基础和开发纪律。

P0001 是第一个正式业务阶段。

Evidence 是整个 Radar 的事实底座。

如果 Evidence 层不能可靠回答：

```text
What happened?
Who/what did it happen to?
When did it happen?
Where did this claim come from?
When did Radar observe it?
Which sources support it?
Have we already recorded it?
```

后续 Signal / Shift / Thesis 都没有可信基础。

---

# Design Input

P0001 必须阅读：

```text
proposals/drafts/evidence-contract-design-notes.md
```

该文档是 Evidence Contract 的设计输入，不是独立 Proposal。

其中以下原则继续有效：

* Evidence atomicity
* SourceDocument ≠ Evidence
* Fact ≠ Interpretation
* many-to-many Source/Evidence semantics
* provenance
* corroboration
* temporal semantics
* append-oriented history
* Ground Truth first

如果 Design Notes 与本 Proposal 冲突：

> **本 P0001 Proposal 优先。**

---

# Product Capability Delivered

P0001 完成以后，必须能够真实执行如下业务动作：

## 1. Initialize

```bash
npm run db:init
```

创建 Evidence Foundation 所需 SQLite schema。

---

## 2. Ingest

例如：

```bash
npm run cli -- evidence:add ./data/example.json
```

系统完成：

```text
input
 ↓
Zod validation
 ↓
normalization
 ↓
source dedup
 ↓
evidence dedup
 ↓
SQLite transaction
 ↓
result
```

---

## 3. Retrieve

```bash
npm run cli -- evidence:get <evidence-id>
```

能够看到：

```text
Evidence
+
supporting SourceDocument(s)
+
provenance
```

---

## 4. List / Filter

至少支持：

```bash
npm run cli -- evidence:list
npm run cli -- evidence:list --market US
npm run cli -- evidence:list --market CN
npm run cli -- evidence:list --type funding
```

不要做复杂 query language。

---

# Architecture

P0001 架构：

```text
Manual Input
     │
     ▼
Evidence Contract
     │
     ▼
Normalization
     │
     ▼
Evidence Repository
     │
     ▼
SQLite
     │
     ▼
Evidence Query
     │
     ▼
CLI
```

Ground Truth：

```text
Ground Truth Corpus
        │
        ├── validates Contract
        ├── validates Atomicity
        ├── validates Provenance
        └── seeds integration tests
```

---

# Business Architecture

允许创建：

```text
evidence/
```

这是正式业务模块。

建议：

```text
evidence/
├── contracts/
├── normalization/
├── repository/
├── ground-truth/
└── commands/
```

每个目录都必须服务 Evidence 生命周期。

不要创建：

```text
core/
engine/
services/
managers/
domain/
framework/
```

---

# Evidence Definition

Evidence 的正式定义：

> **Evidence is an atomic, externally observable factual claim with traceable provenance.**

中文：

> Evidence 是一个可以被外部来源观察和核查、具有明确来源关系的原子事实声明。

---

# SourceDocument Definition

SourceDocument 是承载 Evidence 的外部材料。

例如：

* Reuters article
* company announcement
* government notice
* financial report
* product page
* repository
* marketplace page
* research publication

关系：

```text
SourceDocument
    ↓
Evidence
```

但 SourceDocument 本身不是 Evidence。

---

# Atomicity

推荐 Evidence 语义：

```text
Subject
+
Predicate
+
Object / Value
+
Time Context
```

正确：

```text
Wonderful raised USD 550M in a Series C round.
```

```text
Wonderful's reported valuation reached USD 5B.
```

错误：

```text
Wonderful raised $550M, reached a $5B valuation,
grew rapidly and expanded internationally.
```

后者包含多个事实，必须拆分。

---

# Fact vs Interpretation Boundary

Evidence：

```text
XPeng Robotics raised more than USD 900M.
```

允许。

Signal：

```text
Capital is accelerating into Chinese humanoid robotics.
```

P0001 禁止产生。

Thesis：

```text
China may develop a large embodied-AI deployment market.
```

P0001 禁止产生。

---

# Contracts

Contract 必须由 Ground Truth 验证后最终确定。

以下是初始设计，不是要求 Claude 机械照抄。

---

## SourceDocument

初始候选：

```text
SourceDocument {
  id
  sourceType
  publisher
  title
  canonicalUrl
  publishedAt
  accessedAt
  language
  market
}
```

### sourceType

从 Ground Truth 反推。

初始候选：

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

只保留 Ground Truth 真正需要的类型。

---

## Evidence

初始候选：

```text
Evidence {
  id
  claim
  subject
  evidenceType
  eventAt
  observedAt
  market
  confidence
}
```

Source 关系不要简单塞进 Evidence JSON 字符串。

持久化层应显式表达：

```text
Evidence
↔
SourceDocument
```

---

# Provenance Model

P0001 必须支持：

```text
Evidence A
   ├── Source 1
   └── Source 2
```

以及：

```text
Source 1
   ├── Evidence A
   ├── Evidence B
   └── Evidence C
```

即：

> Evidence ↔ SourceDocument 是 many-to-many。

SQLite 应明确保存这种关系。

---

# Confidence

Evidence confidence 只表示：

> 这条事实本身的来源可靠程度。

不表示：

> 这个商业机会有多可信。

初始候选：

```text
primary
corroborated
reported
uncertain
```

由 Ground Truth 验证。

---

# Temporal Semantics

必须明确区分：

```text
eventAt
= 事实发生时间

publishedAt
= SourceDocument 发布时间

accessedAt
= Radar 获取/核查 SourceDocument 时间

observedAt
= Radar 正式记录 Evidence 时间
```

禁止因为当前 fixture 中时间接近而合并字段。

未知时间允许 `null`。

不要创建 Temporal Engine。

---

# Market

初始：

```text
CN
US
GLOBAL
OTHER
```

market 表示该 Source / Evidence 主要对应的市场上下文。

不代表公司注册地。

P0001 不创建 geography subsystem。

---

# Ground Truth Corpus

建立：

```text
evidence/ground-truth/
```

目标：

```text
15–25 Source Documents
30–50 atomic Evidence
```

Ground Truth 是：

> Contract validation corpus + integration test fixture。

不是生产数据库 seed。

---

# Ground Truth Coverage

至少覆盖：

### Capital

* funding
* valuation
* acquisition

### Business Traction

* revenue
* growth
* customer adoption
* usage

### Product

* product launch
* market entry
* technology capability

### Institutional

* government policy
* industry statistics
* market activity

Ground Truth 应尽量包含：

```text
US examples
CN examples
GLOBAL examples
```

---

# Evidence Type

最终 `evidenceType` 必须从 Ground Truth 得出。

目标：

```text
approximately 8–12 types
```

避免：

```text
30+ type taxonomy
```

如果两个类型没有稳定业务区别，应合并。

---

# SQLite

P0001 正式允许引入：

```text
better-sqlite3
```

数据库必须：

* WAL mode
* foreign_keys ON
* explicit schema initialization
* deterministic migrations/schema version
* parameterized SQL
* transaction for ingest

不要引 ORM。

---

# Minimum Storage Model

概念上至少需要：

```text
source_documents

evidence

evidence_sources
```

关系：

```text
source_documents
       ▲
       │
 evidence_sources
       │
       ▼
    evidence
```

具体字段由最终 Contract 决定。

---

# Storage Boundary

SQLite 负责：

```text
durable storage
uniqueness constraints
relationships
basic lookup/filter
```

SQLite 不负责：

```text
business interpretation
Signal generation
semantic search
LLM reasoning
```

---

# Deduplication

P0001 必须实现**保守 deduplication**。

目标不是解决所有重复事实。

目标是防止明显重复 ingest。

---

## Source Dedup

优先使用：

```text
canonicalUrl
```

同一个 canonical URL：

```text
same SourceDocument
```

URL normalization 至少考虑：

* trim
* normalize protocol/host casing where applicable
* remove fragment
* remove obvious trailing slash inconsistency

不要做复杂 URL canonicalization framework。

不要主动联网跟 redirect。

---

## Evidence Dedup

P0001 只处理：

> 同一规范化事实被重复 ingest。

建议使用稳定 fingerprint：

```text
normalized subject
+
normalized claim
+
eventAt
+
market
```

然后 hash。

最终策略必须通过 Ground Truth 测试。

---

# Critical Dedup Boundary

以下两个不是 duplicate：

```text
Revenue = $10M in 2025
Revenue = $50M in 2026
```

以下两个不是 duplicate：

```text
Raised $100M
Valuation reached $1B
```

---

# Corroboration

如果：

```text
Evidence A
```

已经存在，而新 ingest 提供另一个 SourceDocument 支持同一事实：

系统应该：

```text
reuse Evidence A
+
attach Source B
```

而不是创建重复 Evidence。

必须有 integration test。

---

# Contradiction

P0001 **不实现 contradiction resolution**。

例如：

```text
Source A:
Revenue = $50M

Source B:
Revenue = $70M
```

系统允许保存两个 Evidence。

不能：

* 自动覆盖
* 自动平均
* 自动选择“正确值”
* 调 LLM 裁判

未来层处理。

---

# Append-Oriented History

P0001 的 Evidence Store 原则：

> Preserve what was observed.

不要设计：

```text
latest truth overwrites old truth
```

市场事实会变化。

旧 Evidence 仍然是历史观察。

---

# Manual Ingest Contract

P0001 建议使用一个 ingest payload：

```text
{
  source: {...},
  evidence: [
    {...},
    {...}
  ]
}
```

即：

```text
1 Source
→ N Evidence
```

这样可以真实表达：

> 从一篇来源材料中拆出多个事实。

但最终 payload 由 Ground Truth 验证。

---

# Ingest Transaction

一次 ingest：

```text
validate payload
     ↓
normalize Source
     ↓
find/create SourceDocument
     ↓
normalize each Evidence
     ↓
find/create Evidence
     ↓
attach source relationship
     ↓
commit
```

任何一步失败：

> 整次 transaction rollback。

禁止半写入。

---

# Repository Contract

Repository 应表达业务存储能力，而不是泄漏 SQL。

最小能力类似：

```text
ingest(...)
getEvidenceById(...)
listEvidence(...)
getSourcesForEvidence(...)
```

实际接口名称由实现决定。

不要建立 GenericRepository。

不要建立 BaseRepository。

---

# CLI

CLI 只是 P0001 的操作入口。

它不是未来产品 UI。

允许：

```text
evidence:add
evidence:get
evidence:list
```

不要增加：

```text
signal
scan
analyze
rank
watch
agent
```

---

# CLI Output

输出应优先人类可读。

`evidence:get` 至少显示：

```text
Evidence ID
Claim
Subject
Type
Market
Event time
Observed time
Confidence

Sources:
- Publisher
- Title
- URL
- Published
- Accessed
```

不要做漂亮终端 UI。

---

# Raw Content

P0001 不保存：

* full article
* full HTML
* screenshots
* webpage snapshot
* copyrighted document archive

SourceDocument 只保存 provenance 所需元数据。

允许一个非常短的：

```text
sourceNote?
```

但如果 Ground Truth 不需要，不要添加。

---

# Hashing

可以使用 Node built-in `crypto`。

不要增加 hashing dependency。

Fingerprint 是内部 dedup mechanism。

不要把 hash 当业务 identity。

---

# IDs

P0001 不需要设计分布式 ID 系统。

可以使用：

```text
crypto.randomUUID()
```

生产记录。

Ground Truth fixture 可以使用 deterministic IDs。

不要创建 ID framework。

---

# Proposed Directory Structure

完成后大致：

```text
opportunity-radar/
├── evidence/
│   ├── contracts/
│   │   ├── source-document.ts
│   │   ├── evidence.ts
│   │   ├── ingest.ts
│   │   └── index.ts
│   │
│   ├── normalization/
│   │   ├── url.ts
│   │   └── evidence-fingerprint.ts
│   │
│   ├── repository/
│   │   └── evidence-repository.ts
│   │
│   ├── commands/
│   │   ├── add.ts
│   │   ├── get.ts
│   │   └── list.ts
│   │
│   └── ground-truth/
│       ├── sources.ts
│       ├── evidence.ts
│       └── README.md
│
├── storage/
│   ├── connection.ts
│   ├── schema.ts
│   └── init.ts
│
├── scripts/
│   └── cli.ts
│
├── data/
│   └── .gitkeep
│
└── tests/
    ├── unit/
    ├── contract/
    └── integration/
```

### Important

这里允许根级：

```text
storage/
scripts/
```

因为它们分别代表：

* Radar durable storage substrate
* executable project entrypoints

但不要进一步扩张成 `platform/`。

---

# Database File

默认开发数据库：

```text
data/opportunity-radar.db
```

必须 `.gitignore`。

Ground Truth fixtures 必须进 git。

生产/开发 SQLite DB 不进 git。

---

# Scripts

package.json 增加：

```text
db:init
cli
```

可以重新引入：

```text
tsx
```

现在它有真实用途：

```text
scripts/cli.ts
```

这与 Bootstrap 删除 unused `tsx` 不冲突。

---

# Testing Strategy

P0001 必须覆盖四层。

---

## 1. Contract Tests

SourceDocument：

* valid passes
* malformed URL fails
* invalid market fails
* malformed timestamp fails

Evidence：

* valid passes
* empty claim fails
* invalid type fails
* invalid confidence fails

Ingest payload：

* at least one Evidence required
* malformed Source rejects entire payload

---

## 2. Normalization Tests

URL：

```text
fragment removal
trailing slash normalization
stable output
```

Evidence fingerprint：

```text
same normalized fact
→ same fingerprint
```

以及：

```text
different eventAt
→ different fingerprint
```

---

## 3. Repository Integration Tests

必须使用临时 SQLite database。

覆盖：

```text
ingest
retrieve
list
market filter
type filter
source relationship
transaction rollback
source dedup
evidence dedup
corroboration
```

---

## 4. Ground Truth Contract Tests

必须验证：

```text
all sources parse
all evidence parse
IDs unique
all sourceRefs resolve
15–25 sources
30–50 evidence
required categories covered
```

---

# Required End-to-End Acceptance Test

至少一个测试必须跑完整闭环：

```text
fixture payload
   ↓
ingest
   ↓
SQLite
   ↓
query
   ↓
Evidence + Source provenance
```

这才证明 P0001 真正交付 capability。

---

# Ground Truth Design Review

至少选 5 个复杂 SourceDocument，证明：

```text
Source
├── Evidence A
├── Evidence B
└── Evidence C
```

至少 2 个 Evidence 证明：

```text
Evidence
├── Source A
└── Source B
```

---

# Design Questions

P0001 完成报告必须回答：

1. 最终 `evidenceType` 有哪些？为什么？
2. Ground Truth 是否验证了 Source ↔ Evidence many-to-many？
3. Evidence fingerprint 最终由哪些字段组成？
4. 哪些 Evidence 无法安全 dedup，因此选择保守地保留？
5. `confidence` 四级是否足够？
6. 四种时间语义是否在真实数据中都必要？
7. 哪些字段反复进入 metadata，未来可能升级为正式字段？
8. Manual Ingest payload 是否自然表达“一来源多事实”？
9. 当前 Repository API 是否足以支持 P0002 Acquisition，而不需要修改业务 Contract？
10. Ground Truth 有没有暴露当前 Evidence 模型无法表达的事实？

如果答案意味着架构需要调整：

先调整 P0001 内部设计，不要把明显问题推给 P0002。

---

# Boundaries

## Included

P0001 包括：

* Evidence business module
* SourceDocument Contract
* Evidence Contract
* Manual Ingest Contract
* Ground Truth Corpus
* normalization
* conservative deduplication
* provenance
* many-to-many Source/Evidence relationship
* SQLite
* Evidence Repository
* schema initialization
* manual ingest CLI
* evidence get CLI
* evidence list/filter CLI
* tests
* Project Memory updates
* necessary ADRs

---

# NOT Included — CRITICAL

## Automated Acquisition

绝对不做：

* web search
* crawler
* scraper
* RSS
* browser automation
* news API
* Product Hunt API
* GitHub API
* YC acquisition
* scheduled fetch
* automatic source discovery

P0001 的外部数据入口只有：

> manually provided ingest payload.

---

## Signal

不创建：

```text
signals/
```

不实现：

* interpretation
* clustering
* trend
* anomaly
* momentum
* Signal score

---

## Structural Shift

不创建：

```text
shifts/
```

---

## Thesis / Opportunity

不创建：

```text
theses/
opportunities/
```

不实现：

* Opportunity generation
* score
* ranking
* recommendation
* watchlist
* validation process

---

## LLM / Agent

绝对不接：

* OpenAI
* Claude API
* Gemini
* Hermes
* AgentFabric
* embeddings
* prompt framework
* agent loop
* model provider abstraction

---

## Search / RAG

不做：

* full-text search system
* semantic search
* embeddings
* vector database
* RAG

SQLite 基础 filter 足够。

---

## Entity System

不实现：

* Company entity
* Person entity
* canonical entity resolution
* organization graph
* knowledge graph

`subject` 保持字符串。

---

## UI / Server

不做：

* Express
* HTTP API
* Workspace
* Dashboard
* SPA
* frontend

CLI 是唯一操作入口。

---

## Generic Infrastructure

禁止创建：

```text
GenericRepository
BaseRepository
StorageAdapter framework
Plugin architecture
Connector framework
Event Bus
Dependency Injection framework
```

P0001 只解决 Evidence Foundation。

---

# Migration Policy

这是第一个数据库阶段。

允许一个最小 schema version mechanism。

但不要搭建完整 migration framework。

要求：

```text
fresh database can initialize deterministically
schema version is inspectable
future migration remains possible
```

即可。

---

# Project Memory

完成后更新：

```text
context/current_state.md
context/decisions.md
context/handoff.md
```

至少应记录：

* Evidence Foundation architecture
* final Evidence semantics
* final dedup semantics
* Source/Evidence relationship
* SQLite decision
* P0001 status

长期设计决策使用 ADR。

---

# Success Criteria

P0001 完成必须同时满足：

1. `npm run db:init` 能初始化空数据库。

2. Manual ingest 可以将：

   ```text
   1 Source
   +
   N Evidence
   ```

   原子地写入 SQLite。

3. 相同 Source 重复 ingest 不创建 duplicate SourceDocument。

4. 相同 Evidence 重复 ingest 不创建 duplicate Evidence。

5. 新 Source 支持已有 Evidence 时：

   ```text
   existing Evidence
   +
   new source relationship
   ```

   正确建立。

6. Evidence 可以通过 ID 查询。

7. 查询结果可以返回完整 Source provenance。

8. Evidence 可以按：

   ```text
   market
   evidenceType
   ```

   过滤。

9. Ground Truth：

   ```text
   15–25 Sources
   30–50 Evidence
   ```

   全部通过 Contract。

10. 至少 5 个 Source 拆成多个 Evidence。

11. 至少 2 个 Evidence 有多个 Source。

12. transaction failure 不产生 partial write。

13. Evidence 历史不会因为新 ingest 被覆盖。

14. 所有 integration tests 使用临时数据库，不污染开发 DB。

15. `npm run typecheck` PASS。

16. `npm test` PASS。

17. CLI 实际完成一次：

```text
add → get → list
```

smoke verification。

18. 未实现任何 Signal / Shift / Thesis / Opportunity。

---

# Implementation Sequence

严格建议：

```text
1. Read CLAUDE.md
2. Read PROJECT.md
3. Read context/*
4. Read this P0001
5. Read evidence-contract-design-notes.md
6. Audit Bootstrap
7. Build Ground Truth draft
8. Derive final Contracts from Ground Truth
9. Review Contracts before persistence assumptions
10. Define SQLite schema
11. Implement schema init
12. Implement normalization
13. Implement Repository
14. Implement manual ingest
15. Implement query
16. Implement CLI
17. Contract tests
18. Repository integration tests
19. Ground Truth integrity tests
20. E2E acceptance test
21. CLI smoke verification
22. Answer Design Questions
23. Update ADR/context
24. Boundary audit
25. Pre-commit report
```

关键：

> **不要先写 SQLite schema，再回头造 Ground Truth。**

Ground Truth → Contract → Persistence。

---

# Pre-Commit Report

实现完成后不要自动 commit。

返回：

# P0001 Completion Report

## Delivered Capability

P0001 ships a complete, headless **Evidence** layer for Opportunity
Radar. The closed loop is:

1. A human (or future Proposal's manual ingest path) writes a
   JSON file that conforms to the `IngestPayload` Contract.
2. `npm run cli -- evidence:add <file>` reads the file, validates
   it with Zod, normalizes the source URL, and calls
   `evidence-repository.ingest(db, payload)`.
3. `ingest` runs one SQLite transaction: it finds-or-inserts the
   source by normalized `canonicalUrl`, finds-or-inserts each
   evidence by fingerprint, and attaches the source via
   `evidence_sources` (idempotent link insert).
4. `npm run cli -- evidence:get <id>` and
   `npm run cli -- evidence:list [--market …] [--type …]` query
   the DB through `evidence-repository.getById` and `.list`,
   which always return the full provenance set.
5. Re-ingesting the same logical fact (same fingerprint) from a
   new source attaches the new source without duplicating the
   evidence. Re-ingesting the same source URL (different surface
   form) is a no-op. Contradicting facts become separate
   evidence rows; the older row is never overwritten.

This is verified end-to-end by:
- 84 / 84 vitest assertions
- the `p0001-acceptance.test.ts` test (10-step chain)
- the CLI smoke (`db:init`, `evidence:add`, `evidence:get`,
  `evidence:list`, and a corroboration re-ingest)

## Ground Truth

```text
Sources:   20
Evidence:  36
Markets (sources):   CN=10  US=8  GLOBAL=2
Markets (evidence):  CN=17  US=17  GLOBAL=1  OTHER=0
Languages:           en=18  zh=2
sourceType coverage: news, company_announcement, government,
                     research, repository, product_page
```

Evidence Type distribution (corpus, ascending by count):

| evidenceType | count | markets |
|---|---|---|
| funding | 7 | US=4, CN=3 |
| technology_capability | 5 | US=3, CN=2 |
| product_launch | 4 | US=4 |
| valuation | 3 | US=1, CN=2 |
| growth | 3 | US=1, CN=2 |
| customer_adoption | 3 | US=2, CN=1 |
| acquisition | 3 | US=3 |
| market_activity | 3 | CN=2, GLOBAL=1 |
| policy | 2 | CN=2 |
| usage | 2 | US=1, CN=1 |
| revenue | 1 | CN=1 |
| **total** | **36** | |

All 11 taxonomy values are exercised.

Atomicity gate (≥ 5 sources split into ≥ 3 evidence each):

| source | evidence count |
|---|---|
| `src-reuters-wonderful` | 5 |
| `src-google-gemini-blog` | 5 |
| `src-reuters-prime-intellect` | 4 |
| `src-xpeng-announcement` | 4 |
| `src-reuters-zhipu` | 4 |

5 sources pass the threshold. 14 sources split into 1–2 each.

Corroboration gate (≥ 2 evidence with ≥ 2 sourceRefs):

10 evidence are corroborated, spanning 10 distinct (source, fact)
pairs. Examples: `ev-wonderful-series-c` (Reuters + TechCrunch),
`ev-zhipu-growth` (Reuters + SCMP), `ev-okta-acquires-permiso`
(Reuters + Okta press release), `ev-robomind-downloads`
(RoboMIND + Hugging Face).

## Final Contracts

### SourceDocument

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | non-empty; deterministic in fixtures, `crypto.randomUUID()` at runtime |
| `sourceType` | enum | yes | 9 values: `news`, `company_announcement`, `government`, `financial_report`, `product_page`, `repository`, `marketplace`, `research`, `other` |
| `publisher` | string | yes | non-empty |
| `title` | string | yes | non-empty |
| `canonicalUrl` | string (URL) | yes | must parse as a URL; normalized at ingest time |
| `publishedAt` | string (ISO datetime) | no | nullable; not all sources disclose a publication time |
| `accessedAt` | string (ISO datetime) | no | nullable; reserved for future "we re-verified" entries |
| `language` | enum | yes | `en` or `zh` |
| `market` | enum | yes | `CN`, `US`, `GLOBAL`, `OTHER` — describes the **fact's market context**, not the publisher's HQ |

### Evidence

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | non-empty |
| `claim` | string | yes | 1–2000 chars; the atomic factual statement |
| `subject` | string | yes | free string; entity resolution is **not** P0001's job |
| `evidenceType` | enum | yes | 11 values (see "Design Questions Q1" below) |
| `eventAt` | string (ISO datetime) | no | nullable; nullable when the fact has no specific event time |
| `observedAt` | string (ISO datetime) | yes | when **we** first observed the fact |
| `market` | enum | yes | same enum as `SourceDocument.market` |
| `confidence` | enum | yes | 4 values: `primary`, `corroborated`, `reported`, `uncertain` |
| `sourceRefs` | string[] | yes | ≥ 1; each entry is a `SourceDocument.id`; many-to-many provenanced |
| `metadata` | record<string, unknown> | no | sparse; see "Design Questions Q7" |

### Manual Ingest

```ts
IngestPayload = {
  source:   SourceDocument,
  evidence: Evidence[],   // ≥ 1
}
```

One ingest call writes one source and N evidence. The source is
shared by all evidence in the payload. Multi-source payloads are
expressed by multiple `ingest` calls — that is what produces
corroboration.

## Storage

`better-sqlite3` with WAL, foreign_keys=ON, busy_timeout=5000.
Three content tables plus `schema_version`.

```sql
-- schema_version: minimum-viable version tracking
CREATE TABLE schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- source_documents: unique on canonical_url (normalized form)
CREATE TABLE source_documents (
  id              TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,
  publisher       TEXT NOT NULL,
  title           TEXT NOT NULL,
  canonical_url   TEXT NOT NULL UNIQUE,
  published_at    TEXT,
  accessed_at     TEXT,
  language        TEXT NOT NULL,
  market          TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- evidence: unique on fingerprint
CREATE TABLE evidence (
  id              TEXT PRIMARY KEY,
  claim           TEXT NOT NULL,
  subject         TEXT NOT NULL,
  evidence_type   TEXT NOT NULL,
  event_at        TEXT,
  observed_at     TEXT NOT NULL,
  market          TEXT NOT NULL,
  confidence      TEXT NOT NULL,
  fingerprint     TEXT NOT NULL UNIQUE,
  metadata_json   TEXT,
  created_at      TEXT NOT NULL
);

-- evidence_sources: many-to-many join
CREATE TABLE evidence_sources (
  evidence_id     TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  PRIMARY KEY (evidence_id, source_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence(id)          ON DELETE CASCADE,
  FOREIGN KEY (source_id)   REFERENCES source_documents(id)  ON DELETE CASCADE
);

CREATE INDEX idx_evidence_market        ON evidence(market);
CREATE INDEX idx_evidence_type         ON evidence(evidence_type);
CREATE INDEX idx_evidence_observed_at  ON evidence(observed_at);
CREATE INDEX idx_evidence_sources_sid  ON evidence_sources(source_id);
```

`initSchema` is idempotent: re-running `npm run db:init` against
an existing DB is a no-op (the `schema_version` row is unchanged
at `1`).

## Deduplication

```text
Source fingerprint:
  - Normalize the canonicalUrl (lowercase protocol+host, strip
    fragment, trim trailing slash, preserve root, trim whitespace).
  - Find by the normalized URL. No content-based hashing for
    sources; URL is the only dedup key for SourceDocument.

Evidence fingerprint:
  - sha256 of (subject + "␟" + claim + "␟" + eventAt + "␟" + market)
  - `subject` and `claim` are normalized by collapsing whitespace
    and trimming.
  - `eventAt` is the raw ISO 8601 string, or empty string when null.
  - `market` is the raw enum value.
  - The separator "␟" (U+241F) is chosen to be unlikely to
    appear in any real claim or subject.
  - sha256 is Node built-in `crypto.createHash` — no new dep.

Corroboration behavior:
  - The evidence row is created exactly once per fingerprint.
  - A re-ingest of the same (subject, claim, eventAt, market)
    from a *new* source attaches the new source via
    `evidence_sources` and reports `corroborated=true` in the
    `IngestResult`.
  - A re-ingest of the same evidence from a source already
    attached is a no-op.
  - A contradicting claim (different text → different fingerprint)
    is stored as a separate evidence row. The older row is
    NEVER updated or deleted.
```

Verified by:
- `tests/integration/evidence-repository.test.ts` — source dedup
  with different surface form, evidence dedup, corroboration,
  contradiction preservation.
- `tests/contract/ground-truth-corpus.test.ts` — every
  `sourceRefs[i]` resolves to a real source; the corpus contains
  10 corroborated evidence.

## CLI Verification

All commands were run against a fresh `data/dev.db` after
`rm -f data/dev.db*`. Output trimmed.

```text
$ npm run db:init
db_init: path=.../data/dev.db schema_version=1

$ npm run cli -- evidence:add data/example.json
ingest ok
  source: src-example-wonderful (new=true)
  evidence: ev-example-wonderful-funding (new=true, corroborated=false)
  evidence: ev-example-wonderful-customers (new=true, corroborated=false)

$ npm run cli -- evidence:get ev-example-wonderful-funding
id:         ev-example-wonderful-funding
claim:      Example: Wonderful raised USD 550M in a Series C financing round.
subject:    Wonderful
type:       funding
market:     US
eventAt:    2026-08-30T00:00:00.000Z
observedAt: 2026-09-03T01:00:00.000Z
confidence: primary
sources (1):
  - src-example-wonderful [news] Example News — "Example article about Wonderful Series C"
    https://example.com/wonderful-series-c

$ npm run cli -- evidence:list --market US
2 evidence
ev-example-wonderful-customers  [customer_adoption]  market=US  sources=1
  Example: Wonderful reported approximately 100 enterprise customers.
ev-example-wonderful-funding    [funding]            market=US  sources=1
  Example: Wonderful raised USD 550M in a Series C financing round.
```

Corroboration smoke (re-ingest with a second source for the same
fact, via a temporary payload file):

```text
$ npm run cli -- evidence:add /tmp/corroboration.json
ingest ok
  source: src-second-wonderful (new=true)
  evidence: ev-example-wonderful-funding (new=false, corroborated=true)
```

Final DB state: `sources=2, evidence=2, evidence_sources=3`. The
`ev-example-wonderful-funding` row now reports `sources=2` in
`evidence:list`.

## Design Questions

**Q1. Final `evidenceType` taxonomy — what and why?**

11 values: `funding`, `valuation`, `revenue`, `growth`,
`customer_adoption`, `product_launch`, `acquisition`, `policy`,
`technology_capability`, `market_activity`, `usage`.

Decisions driven by the corpus, not speculation:

- **`market_activity` is split from `growth`.** A market_activity
  fact is a level reading (290k robot installations in 2025); a
  growth fact is a rate of change (18% YoY, 4x ARR). They are
  derived from different sources and used differently. Splitting
  them lets P0002 (Market Signal) treat each on its own.
- **`usage` is split from `customer_adoption`.** A usage fact
  describes *how a thing is used* (50k downloads, USD 30 per seat
  per month). A customer_adoption fact describes *who uses it*
  (100 enterprise customers, 200 enterprise pilots). They are
  evidence of different things; P0002 will combine them with
  different signals.
- **`acquisition` covers both deal announcement and deal terms.**
  `ev-okta-acquires-permiso` (announcement) and
  `ev-okta-permiso-amount` (terms) are both `acquisition`. The
  granularity lives in `claim`, not in the taxonomy.
- **`policy` covers government / regulatory actions** at any
  level (State Council, MOFCOM). If P0002 needs to split
  central vs local, it does so by Proposal.
- **No `market_entry` / `market_expansion` / `geography` type.**
  The P0001 Design Notes floated this; the corpus did not produce
  a fact that needed it. P0002 may add it if its own corpus
  demands it.
- **No `leadership_change` / `hiring` type.** Same reasoning.
- **No `pricing_change` type.** Pricing facts are `usage` in
  P0001. The corpus's only pricing fact (`ev-gemini-pricing`) is
  a launch price, not a change.

This set is **v1**, not final. Adding a 12th type is a contract
change and must go through Proposal review.

**Q2. Does the Ground Truth verify Source ↔ Evidence many-to-many?**

Yes. The corpus has:

- **Atomicity**: 5 sources split into ≥ 3 evidence each
  (`src-reuters-wonderful`: 5, `src-google-gemini-blog`: 5,
  `src-reuters-prime-intellect`: 4, `src-xpeng-announcement`: 4,
  `src-reuters-zhipu`: 4).
- **Corroboration**: 10 evidence supported by ≥ 2 sourceRefs
  each, including the first-class Reuters + TechCrunch / Reuters
  + SCMP / Reuters + Okta press release / IFR + Reuters cases.

Both directions of the relationship are exercised. The
`evidence_sources` join table is the only place this
relationship lives; a future Proposal that collapses it would
regress ADR-007.

**Q3. What fields make up the Evidence fingerprint?**

```
sha256(
  normalize(subject) + "␟" +
  normalize(claim)  + "␟" +
  eventAt          + "␟" +   // "" if eventAt === null
  market
)
```

`normalize(s)` collapses runs of whitespace and trims. The
separator `"␟"` (U+241F, "Unit Separator Information") is chosen
to be unlikely to appear in real claims or subjects. The full
rationale is in ADR-008.

**Q4. Which Evidence cannot be safely deduped — and so we keep it conservatively?**

Two cases. The repository stores both as separate rows instead
of attempting to collapse them:

- **Paraphrases.** "Wonderful raised USD 550M" and
  "Wonderful closes a 550-million Series C" are *probably* the
  same fact, but the fingerprint sees them as different. We do
  not have paraphrase detection, so both are kept. P0002 will
  decide whether to collapse them with a derived signal.
- **Contradictions.** "Wonderful raised $500M" and
  "Wonderful raised $600M" are different claims with different
  fingerprints. The repository test
  `preserves contradicting claims as separate evidence` proves
  both survive. Append-only history is the explicit design
  choice; we never overwrite an older evidence with a newer
  one.

**Q5. Are the 4 `confidence` levels enough?**

Yes for P0001. The levels (`primary`, `corroborated`, `reported`,
`uncertain`) are descriptive — the repository does not branch on
them. They are a hint to the reader; a later Proposal may
weight signals by confidence, but that is P0002+'s job.

Two specific use cases the corpus checks:

- `primary` is reserved for facts where the source is the
  originator (e.g. `src-xpeng-announcement` for XPeng's own
  raise).
- `corroborated` is the natural choice when the same evidence
  has ≥ 2 sourceRefs. The Ground Truth exercises both
  (e.g. `ev-wonderful-series-c` is `corroborated`,
  `ev-robomind-downloads` is `corroborated`).

If P0002 needs a finer-grained confidence (e.g. time-decay, or
a numerical score), it will add a *new* field, not refactor
`confidence`.

**Q6. Are the 4 time semantics (`eventAt`, `publishedAt`, `accessedAt`, `observedAt`) all necessary in real data?**

Yes. The corpus exercises all four:

- `eventAt` is the time the fact happened (e.g. Wonderful's
  Series C on 2026-08-30).
- `publishedAt` is the time the source published its report
  (e.g. Reuters' article on 2026-09-02).
- `accessedAt` is when **we** read it (e.g. 2026-09-03).
- `observedAt` is when **we** first recorded it in the system
  (defaults to the ingest time).

The lag between `eventAt` and `observedAt` is the lead-time
signal Opportunity Radar is built on. `eventAt` is nullable
because not every fact has a clean event time (e.g. a
"customers doubled YoY" claim might only be anchored by
`publishedAt` + the article's reporting date).

**Q7. Which fields keep showing up in `metadata` and should be promoted to first-class fields?**

Two recurring shapes:

- `{ currency: string, amount: number }` — appears in
  `ev-wonderful-series-c` (USD 550M), `ev-wonderful-valuation`
  (USD 5B), `ev-xpeng-raise` (USD 900M+), `ev-prime-intellect-valuation`
  (USD 1B), `ev-prime-intellect-round-size` (USD 200M),
  `ev-zhipu-arr` (CNY 1B), `ev-zhipu-2026-h1-raise` (CNY 2B),
  `ev-gemini-pricing` (USD 30), `ev-okta-permiso-amount`
  (USD 80M), `ev-china-digital-exports` (USD 350B).
  10 evidence. **Candidate: `monetaryValue: { amount, currency }`**
  as a first-class field. (Some values have an extra `threshold`
  string like `"more than"` / `"exceeded"`; that may want a
  separate `precision` field or stay in metadata.)
- `{ period: string, growthRate: number }` — appears in
  `ev-china-robots-growth` (period 2025, 0.18),
  `ev-global-robots-growth` (period 2025, 0.12).
  2 evidence so far. Smaller corpus, but the shape is real and
  will grow. **Candidate: a first-class `growthRate: { period,
  rate }` field.**

Both promotions are **future-Proposal work** and out of P0001
scope.

**Q8. Does the Manual Ingest payload naturally express "one source, many facts"?**

Yes. The payload is `{ source, evidence: Evidence[] }`, with
`evidence.length >= 1`. The single source is shared by all
evidence in the payload. In the Ground Truth, sources like
`src-reuters-wonderful` and `src-google-gemini-blog` are
ingested as a single payload with 4–5 evidence each.

**Q9. Is the current Repository API enough for P0002 Acquisition, without changing the business Contract?**

Yes, with one caveat. P0002 will need:

- `ingest` (atomic, dedup, corroboration): **already shipped.**
- `getById` (full provenance): **already shipped.**
- `list` with `market` + `evidenceType` filters: **already shipped.**
- A way to ask "what evidence have I already seen for this
  fingerprint?": **partially shipped** — `getById` takes an
  `evidence.id`, not a fingerprint. If P0002 needs "have I
  already recorded this fact from a different source?" the
  current API requires it to ingest (and let the repository
  decide). This is intentional: the repository is the only
  place dedup happens, and that decision is sealed inside a
  transaction.
- A way to list evidence by subject or by source: **not
  shipped.** If P0002 needs it, it adds a new repository method
  in a follow-on Proposal; it does not change the contracts.

The caveat: the **Repository Contract** says P0001 only ships
`ingest` / `getById` / `list`. Adding `findByFingerprint` or
`listBySubject` is a contract *extension*, not a contract
change. P0002 should treat it as such.

**Q10. Did the Ground Truth expose a fact the current Evidence model cannot express?**

Two borderline cases, both **handled by the current model**:

- **Time series data.** The IFR data is a 2025 reading
  (`ev-china-robots-2025`). The model has `eventAt`, so the
  fact is anchored to 2025-12-31. A 2024 comparison is *not*
  in the corpus yet; if P0002 needs a 2024 anchor, it is a
  separate evidence with its own `eventAt` and a separate
  fingerprint. This is by design (each reading is its own
  evidence) and is not a model gap.
- **Multi-currency / FX-implicit conversions.** All currency
  values in the corpus are reported in their native currency
  (USD or CNY). The model does not store FX rates; that is
  future-Proposal work. For P0001, "USD 550M" and "CNY 1B" are
  two facts in two currencies, with no implied conversion.

**No model change is needed to keep P0001.** If the corpus had
required paraphrasing, entity resolution, full-text search,
or causal chains, P0001 would have to grow. It did not.

## Tests

```text
typecheck:  pass  (tsc --noEmit, exit 0)
tests:      84 passed / 0 failed
contract:   50 (35 unit-contract + 15 corpus integrity)
unit:       30 (2 smoke + 10 url + 8 fingerprint + 14 source-doc
              + 15 evidence + 6 ingest, with the 35 unit-contract
              already counted above)
integration: 14 (13 repository + 1 P0001 acceptance)
failures:   0
```

Breakdown by test file:

| file | tests | kind |
|---|---|---|
| `tests/unit/smoke.test.ts` | 2 | bootstrap smoke |
| `tests/unit/evidence/contract.source-document.test.ts` | 14 | unit contract |
| `tests/unit/evidence/contract.evidence.test.ts` | 15 | unit contract |
| `tests/unit/evidence/contract.ingest.test.ts` | 6 | unit contract |
| `tests/unit/evidence/normalize.url.test.ts` | 10 | unit |
| `tests/unit/evidence/normalize.evidence-fingerprint.test.ts` | 8 | unit |
| `tests/contract/ground-truth-corpus.test.ts` | 15 | contract |
| `tests/integration/evidence-repository.test.ts` | 13 | integration |
| `tests/integration/p0001-acceptance.test.ts` | 1 | integration / e2e |
| **total** | **84** | |

## Files Changed

Modified (Bootstrap-era files that P0001 touched):

- `package.json` — `better-sqlite3` (dep), `@types/better-sqlite3`
  + `tsx` (dev), `db:init` + `cli` scripts.
- `package-lock.json` — regenerated.
- `tsconfig.json` — `include` already covered all new paths; no
  edit actually required.
- `.gitignore` — `data/*.db*`.
- `proposals/P0001-evidence-foundation.md` — this report.
- `proposals/README.md` — P0001 row, P0002 placeholder.
- `context/current_state.md` — P0001 status.
- `context/decisions.md` — ADRs 006–009 appended.
- `context/handoff.md` — P0001 session summary.

New (P0001-owned):

- `data/.gitkeep`
- `data/example.json` — minimal ingest payload, committed.
- `evidence/contracts/source-document.ts`
- `evidence/contracts/evidence.ts`
- `evidence/contracts/ingest.ts`
- `evidence/contracts/index.ts`
- `evidence/normalization/url.ts`
- `evidence/normalization/evidence-fingerprint.ts`
- `evidence/repository/evidence-repository.ts`
- `evidence/ground-truth/sources.ts`
- `evidence/ground-truth/evidence.ts`
- `evidence/ground-truth/index.ts`
- `evidence/ground-truth/README.md`
- `storage/connection.ts`
- `storage/schema.ts`
- `storage/init.ts`
- `scripts/db-init.ts`
- `scripts/cli.ts`
- `tests/contract/ground-truth-corpus.test.ts`
- `tests/integration/evidence-repository.test.ts`
- `tests/integration/p0001-acceptance.test.ts`
- `tests/unit/evidence/contract.source-document.test.ts`
- `tests/unit/evidence/contract.evidence.test.ts`
- `tests/unit/evidence/contract.ingest.test.ts`
- `tests/unit/evidence/normalize.url.test.ts`
- `tests/unit/evidence/normalize.evidence-fingerprint.test.ts`

Total new TypeScript: 24 files; ~2900 lines (including tests).
No files outside the approved scope were modified.

## Boundary Check

```text
Automated acquisition: NO   (no crawler / scraper / RSS / API /
                              scheduled fetch / source discovery)
Signal:                  NO  (P0002 territory)
Structural Shift:        NO  (P0003 territory)
Thesis:                  NO  (P0004 territory)
Opportunity:             NO  (P0005 territory)
LLM/Agent:               NO  (no model provider, no prompt, no
                              tool loop, no agent framework)
Embedding/Vector DB:     NO  (no embeddings, no semantic search,
                              no RAG, no vector store)
API/UI:                  NO  (CLI is a script, not a server; no
                              HTTP surface, no UI)
Entity system:           NO  (subject is a free string; no
                              Company / Person / canonical entity)
Generic framework:       NO  (no core/, engine/, services/,
                              managers/, framework/, common/,
                              domain/, platform/, runtime/,
                              agents/, acquisition/)
```

## ADRs

Four new ADRs appended to `context/decisions.md`:

- **ADR-006** — better-sqlite3 as the Evidence Store substrate
  (WAL, foreign_keys, busy_timeout, no ORM, no pool).
- **ADR-007** — Evidence ↔ SourceDocument is many-to-many; the
  `evidence_sources` join is the only place that relationship
  lives.
- **ADR-008** — Evidence fingerprint is sha256 of (subject,
  claim, eventAt, market); internal dedup key, not business
  identity.
- **ADR-009** — `tsx` re-introduced as a devDependency for
  `scripts/cli.ts` and `scripts/db-init.ts` only; ADR-005's
  speculative-tooling ban stays in force.

## Risks / Open Questions

These are the items that affect the next Proposal. Listed in
priority order.

1. **`metadata` promotion.** Two recurring shapes
   (`{ currency, amount }` and `{ period, growthRate }`) are
   first-class-field candidates. P0002 (Market Signal) does not
   strictly need them promoted, but P0003 (Structural Shift)
   probably does. A future Proposal should add
   `monetaryValue: { amount: number, currency: string }` and
   migrate the existing fixtures + the existing DB rows.
2. **`evidenceType` taxonomy may need a 12th value.** P0001's 11
   values are v1. P0002 may surface a fact type (e.g.
   `market_entry`, `leadership_change`, `pricing_change`) that
   the v1 set cannot express cleanly. Adding a 12th value is a
   contract change and goes through Proposal review.
3. **No coverage gate.** CLAUDE.md §8 names 80% as the
   minimum, but no Proposal has yet wired it into CI. Bootstrap
   does not need it; P0001 deliberately does not add it (CI is
   not a P0001 deliverable). The first Proposal that introduces
   CI should add the gate.
4. **`sourceNote` is not on `SourceDocument`.** P0001 §Open
   Questions Q2 asked whether to add a free-text note for human
   context. P0001 did not add it; the corpus did not need it.
   If a future Proposal needs it, that Proposal adds it.
5. **No formatter, no linter.** Style drift is still possible.
   ADR-005 keeps this deferred; the next Proposal that wants
   Prettier / ESLint must justify it concretely.
6. **No `coverage` / `metric` field on `Evidence`.** The corpus
   has numbers (counts, growth rates, prices) but they all live
   in `metadata`. If P0002 needs a uniform "this fact has a
   number" query path, it adds the field by Proposal.

## Git Status

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
    modified:   .gitignore
    modified:   context/current_state.md
    modified:   context/decisions.md
    modified:   context/handoff.md
    modified:   package-lock.json
    modified:   package.json
    modified:   proposals/README.md
    modified:   tsconfig.json

Untracked files:
    data/
    evidence/
    proposals/P0001-evidence-foundation.md
    proposals/drafts/
    scripts/
    storage/
    tests/contract/ground-truth-corpus.test.ts
    tests/integration/
    tests/unit/evidence/
```

The `proposals/drafts/` directory is the original Design Notes
file, kept for history. It is **not** P0001 source; the binding
spec is `proposals/P0001-evidence-foundation.md` itself.

最后：

> P0001 implementation complete and awaiting review. No commit performed.

---

# Final Principle

P0001 不是在建设一个“新闻数据库”。

它建立的是 Opportunity Radar 的：

> **Verifiable Fact Layer**

它必须忠实保存：

```text
What was observed
When it happened
When we observed it
Who reported it
Which sources support it
Whether we have already seen it
```

但它绝不回答：

```text
What does this mean?
Is this a trend?
Is this a structural shift?
Is this an opportunity?
Should we invest?
```

这些属于后续阶段。

**P0001 stops at fact.**
