# trygeoaudit.com

GEO (Generative Engine Optimization) — check if AI engines cite your brand.

**Live:** [trygeoaudit.com](https://trygeoaudit.com)  
**Deploy:** GitHub Pages (`lubiaorenwu/trygeoaudit.com`)  
**Repo:** [github.com/lubiaorenwu/trygeoaudit.com](https://github.com/lubiaorenwu/trygeoaudit.com)

---

## What this is

A single-page product site + free scan tool for AI visibility checking.

The core idea: traditional SEO checks are obsolete. AI search engines (ChatGPT, DeepSeek, Gemini, etc.) don't rank pages — they cite sources. If AI doesn't know your brand exists, you're invisible to a growing audience.

## Structure

```
trygeoaudit-redesign/
├─ index.html              Landing page (passport/passage metaphor design)
├─ free-scan/              Free scan page (3 engines, browser-side API calls)
│   └─ index.html
├─ scanner/                Python technical audit tool (local use)
│   ├─ scanner.py          CLI: SSL, robots.txt, Schema.org, Bing index
│   ├─ server.py           Local API server wrapping scanner.py
│   └─ README.md
├─ blog/                   GEO content marketing (8 posts, EN/ZH)
├─ zh/blog/                Chinese blog posts
├─ outreach/               Outreach ammunition list
├─ toolkit/                GEO Optimization Toolkit sales page
├─ huorengan/              活人感 project (separate concern)
├─ about/                  About page
├─ resources/              Resource pages
├─ privacy-policy/         Privacy policy
├─ terms-of-service/       Terms of service
├─ plugins/                Plugin directory
├─ .deprecated/            Old workers & tools (see .deprecated/README.md)
│   ├─ free-scan-worker/   CF Worker (Tavily — misleading)
│   ├─ worker/             CF Worker (Tavily + KV)
│   ├─ worker-mcp/         CF Worker (Tavily via MCP)
│   ├─ tool/               Duplicate scan page
│   └─ geo-audit/          Claude plugin (unpublished)
├─ robots.txt
├─ llms.txt
├─ sitemap.xml
├─ CNAME                   → trygeoaudit.com
└─ README.md               This file
```

## How the free scan works

The `/free-scan/` page runs entirely in the browser:

| Engine | Actually calls | Honest? |
|--------|---------------|---------|
| ChatGPT | OpenRouter (llama-4-maverick) | ❌ Not ChatGPT |
| DeepSeek | DeepSeek API (deepseek-chat) | ✅ Real DeepSeek |
| Gemini | OpenRouter (qwen-2.5-72b) | ❌ Not Gemini |
| Perplexity/Claude/Grok/Copilot/Meta AI | Locked (Pro only) | ✅ Honest about being locked |

**Known issue:** The free scan asks LLMs "do you know this brand?" — this is an LLM hallucination test, not real AI engine citation checking. A real citation check would require querying each AI engine's actual search/index pipeline, which needs a backend.

## Pricing model

- **Free:** 3-engine quick scan (technical audit + LLM knowledge check)
- **Pro ($29/mo):** Weekly auto-scans, 8 engines, competitor comparison, trend tracking
- **Enterprise ($199/mo):** Custom reports, API access, white-label

Sold via [Gumroad](https://gumroad.com/l/qalwgx).

## Deployment

```bash
# Push to main → GitHub Pages auto-deploys
git add -A && git commit -m "..." && git push

# The scanner (local only, not deployed)
cd scanner && python3 server.py 8777
```

## Related projects

- `geo-optimizer-skill/` — Open source GEO Optimizer toolkit (MIT, not ours)
- `/mnt/d/备份/大龙猫/大龙猫工作区/输出/GEO*/` — Content output, marketing materials
