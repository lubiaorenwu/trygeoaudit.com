# GEO Audit MCP Server — Cloudflare Workers
# 
# 1. Create a KV namespace:
#    npx wrangler kv:namespace create SUBMISSIONS
#    -> Copy the ID into wrangler.toml
#
# 2. Set your Tavily API key:
#    npx wrangler secret put TAVILY_API_KEY
#    -> Paste your key (currently using tavily2.key)
#
# 3. Deploy:
#    npx wrangler deploy
#    or: npx wrangler publish

# For local dev:
# TAVILY_API_KEY=your_key_here
