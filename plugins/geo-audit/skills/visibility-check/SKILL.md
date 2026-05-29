---
name: visibility-check
description: Run a full GEO (Generative Engine Optimization) audit — check brand citation rate across 8 AI engines, identify coverage gaps, compare against competitors, and produce a prioritized action plan. Use when assessing a brand's AI visibility, when evaluating whether content is feeding AI answers, or when preparing for a GEO/content strategy initiative.
argument-hint: "<brand name> <keywords> [competitors]"
---

# /visibility-check

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).

Audit a brand's visibility across generative AI engines — the GEO (Generative Engine Optimization) equivalent of a traditional SEO audit.

## Trigger

User runs `/visibility-check` or asks to audit brand AI visibility, check GEO status, run a citation audit, or evaluate AI search presence.

## Inputs

Gather the following from the user. If not provided, ask before proceeding:

1. **Brand name** — the brand, product, company, or person to audit (required)

2. **Keywords or topics** — search queries to test against AI engines. I.e., what users type when looking for this brand or solution. Comma-separated.

3. **Competitors** (optional) — specific competitors to compare against. If not provided, you may attempt to identify likely competitors based on the brand's domain.

4. **Language** — `zh` (Chinese engines only), `en` (Western engines only), or `both` (all 8 engines). Default: `both`.

5. **Audit depth** (optional):
   - `quick` — checks top 3 engines, summary only
   - `standard` — all 8 engines, full citation matrix + competitor comparison
   - `deep` — all 8 engines, full analysis + sentiment breakdown + 12-week action plan

   Default: `standard`.

## Process

### 1. Query Construction

For each engine, construct queries matching the brand name + each keyword. For example, for brand "Surya Bonaly" with keyword "figure skating legend":

- DeepSeek: "Surya Bonaly figure skating legend" (Chinese + English)
- Doubao: "Surya Bonaly 花样滑冰 传奇" (Chinese)
- ChatGPT: "best Surya Bonaly figure skating recommendations" (English)
- Perplexity: "Surya Bonaly figure skating" (English)

Use a search aggregator API (e.g. Tavily) as the primary data source. If no connected tools, explain that the user should connect a search API for live data.

### 2. For Each Engine Response, Extract

- **Mention**: does the response include the brand name? Yes/No
- **Context**: how is the brand mentioned? (recommended, described, compared, listed)
- **Sentiment**: positive, neutral, or negative
- **Position**: where in the response does the brand appear? (first mention, middle, end)
- **Depth**: is the brand a main subject, a supporting reference, or a passing mention?
- **Link**: does the response include a URL/citation for the brand?
- **Competitor mention**: which competitors are also mentioned in the same response?

### 3. Citation Rate Calculation

| Metric | Formula |
|--------|---------|
| Overall citation rate | Engines citing brand / Total engines × 100 |
| Chinese engine rate | Chinese engines citing / 4 × 100 |
| Western engine rate | Western engines citing / 4 × 100 |
| First-mention rate | Queries where brand appears first / Total queries × 100 |
| Average depth score | Mean depth rating across all citations (0-100%) |

### 4. Competitor Comparison

For each competitor, calculate:
- Their citation rate across the same engines
- Their share of voice relative to the target brand
- Engines where competitor is cited but target brand is not (gap zones)
- Engines where target brand is cited but competitor is not (advantage zones)

### 5. Sentiment Analysis

Classify each mention of the brand:
- **Positive**: recommending the brand, praising it, listing as a top option
- **Neutral**: describing or mentioning without evaluation
- **Negative**: criticizing, warning against, or noting controversy

Calculate sentiment score: (%Positive + %Neutral×0.5) — treat negative as a red flag.

### 6. GEO Gap Identification

Identify patterns in where the brand is missing:
- **Engine gaps**: which specific engines have zero citations
- **Query gaps**: which keyword/topic combos produce no brand mentions
- **Context gaps**: scenarios where competitors appear in "top picks" or "recommended" lists but the brand does not
- **Sentiment risk**: engines where sentiment is negative or mixed

### 7. Optimization Recommendations

For each gap, provide:
- **Root cause**: why this gap likely exists
  - No authoritative content on the topic
  - Content not structured for AI extraction (no clear Q&A, no structured data)
  - Low domain authority signals
  - Content stale (not updated in 12+ months)
- **Fix**: specific action to address the gap
  - "Create a topic cluster page for [keyword] with FAQ schema"
  - "Publish a comparison page vs [competitor]"
  - "Update [existing page URL] with structured data and fresh data points"
- **Priority**: high / medium / low
- **Effort**: quick win (1-2 hrs), moderate (half day), strategic (multi-day)
- **Expected impact**: high / medium / low

## Output

### Executive Summary

3-5 sentence overview:
- Overall AI visibility assessment (strong / needs work / critical gaps)
- How the brand compares to competitors
- The single most important action to take this week

### Citation Matrix

| Engine | Cited? | Sentiment | Position | Depth | Competitor A | Competitor B |
|--------|--------|-----------|----------|-------|-------------|-------------|
| DeepSeek | ✓ | Positive | #1 | Deep | ✓ | ✗ |
| Doubao | ✗ | — | — | — | ✓ | ✓ |
| ChatGPT | ✓ | Neutral | #3 | Passing | ✗ | ✗ |
| ... |  |  |  |  |  |  |

### Citation Score Breakdown

| Score | Value |
|------|-------|
| Overall visibility | XX/100 |
| Citation rate | XX% |
| First-mention rate | XX% |
| Citation depth | XX% |
| Sentiment (positive) | XX% |
| Chinese engines | XX/100 |
| Western engines | XX/100 |

### Share of Voice

| Brand | Citation Rate | First-mentions | Engines Led |
|-------|--------------|----------------|-------------|
| Your Brand | XX% | X/8 | X |
| Competitor A | XX% | X/8 | X |
| Competitor B | XX% | X/8 | X |

### Sentiment Breakdown

| Engine | Positive | Neutral | Negative | Notes |
|--------|----------|---------|----------|-------|
| DeepSeek | ✓ | — | — | Recommended as top option |

### Gap Analysis

| Gap Type | Engine | Query | Severity | Root Cause |
|----------|--------|-------|----------|------------|
| Engine gap | Doubao | All queries | High | No Chinese-language content |
| Query gap | ChatGPT | "best [category]" | Medium | No comparison page |
| Competitor gap | Perplexity | "top [category]" | High | Competitor A has press coverage |

### Prioritized Action Plan

**Quick Wins (this week):**
- [Action 1] — expected impact: High, effort: 1 hr
- [Action 2] — expected impact: Medium, effort: 30 min

**Strategic Investments (this quarter):**
- [Action 3] — expected impact: High, effort: 3 days
- [Action 4] — expected impact: Medium, effort: 1 week

## Follow-Up

After presenting the audit, ask:

"Would you like me to:
- Generate content briefs for the top gap keywords?
- Draft FAQ schema markup for your key pages?
- Build a 12-week content calendar based on the gap analysis?
- Set up monthly re-audits to track citation changes?
- Export this report as PDF?"
