---
name: sentiment-audit
description: Classify sentiment (positive/neutral/negative) of every brand mention across 8 AI engines. Identifies engines where AI output may be damaging brand reputation. Use when monitoring brand health in AI answers, investigating a sudden visibility change, or before launching a campaign to establish a baseline.
argument-hint: "<brand> <keywords>"
---

# /sentiment-audit

Not all mentions are equal. Classify every AI-generated brand reference as positive, neutral, or negative — per engine, per query, and overall.

Flags:
- **Positive citations**: brand recommended, listed first, described favorably
- **Neutral citations**: brand mentioned without evaluation (factual listing)
- **Negative citations**: brand criticized, warned against, or associated with controversy
- **Risk zones**: engines where sentiment is predominantly negative or where competitor sentiment dominates

See `/visibility-check` for the full sentiment analysis workflow integrated into the audit report.
