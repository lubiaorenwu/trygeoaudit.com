# GEO Audit — Brand Visibility Across AI Engines

> Does AI know your brand exists? 8 engines. 30 seconds. Actionable report.

## What it does

GEO Audit checks whether 8 major generative AI engines mention your brand when asked relevant questions. It produces a citation matrix, competitor comparison, sentiment audit, and prioritized optimization plan.

### Supported engines

| Chinese | Western |
|---------|---------|
| Doubao (ByteDance) | ChatGPT (OpenAI) |
| DeepSeek | Perplexity |
| Qwen (Alibaba) | Gemini (Google) |
| Wenxin/Baidu | Claude (Anthropic) |

### Key metrics

- **Citation rate**: % of engines that mention your brand
- **Share of voice**: your mentions vs competitors
- **Sentiment**: positive / neutral / negative per engine
- **First-mention rate**: % of queries where your brand appears first
- **Citation depth**: how prominently your brand is featured

## How it works

1. Specify your **brand name** + **industry keywords**
2. Specify **competitors** (optional)
3. Plugin queries all engines via search API
4. Report generated with scores, matrix, and action plan

## Installation

```bash
claude plugin marketplace add trygeoaudit/geo-audit
claude plugin install geo-audit
```

Or browse at `claude.com/plugins`.
