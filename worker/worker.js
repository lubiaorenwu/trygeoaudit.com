/**
 * GEO Audit Worker — Real AI Search Engine Citation Checker
 * 
 * Queries actual AI search engines to check if a brand is cited.
 * Deployed to Cloudflare Workers. API keys as secrets.
 */

// ── Engine configurations ──

const ENGINES = {
  deepseek: {
    name: 'DeepSeek',
    emoji: '🔍',
    region: 'cn',
    search: async (brand, domain, env) => {
      if (!env.DEEPSEEK_KEY) return skip('API key not configured');
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Answer concisely.' },
            { role: 'user', content: `Search your knowledge. Tell me about the brand "${brand}" (${domain}). What do they do? Keep it under 100 words.` }
          ],
          max_tokens: 200,
          temperature: 0
        })
      });
      if (!resp.ok) return fail(`API error: ${resp.status}`);
      const data = await resp.json();
      const content = data.choices[0].message.content;
      const cited = checkMention(content, brand);
      return { cited, snippet: content.substring(0, 200) };
    }
  },

  perplexity: {
    name: 'Perplexity',
    emoji: '🌐',
    region: 'west',
    search: async (brand, domain, env) => {
      if (!env.PERPLEXITY_KEY) return skip('API key not configured');
      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.PERPLEXITY_KEY}`
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: 'You are a search assistant. Search the web and report what you find. Be precise and cite sources.' },
            { role: 'user', content: `Search for "${brand}" company or product. What does the web say about it? Keep it under 150 words.` }
          ],
          max_tokens: 300,
          temperature: 0,
          search_domain_filter: null,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month'
        })
      });
      if (!resp.ok) return fail(`API error: ${resp.status}`);
      const data = await resp.json();
      const content = data.choices[0].message.content;
      const cited = checkMention(content, brand);
      return { cited, snippet: content.substring(0, 200) };
    }
  },

  openai_search: {
    name: 'ChatGPT',
    emoji: '🧠',
    region: 'west',
    search: async (brand, domain, env) => {
      if (!env.OPENAI_KEY) return skip('API key not configured');
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-search-preview',
          messages: [
            { role: 'user', content: `Search the web for "${brand}" (${domain}). Is this a real brand/company? What do they do? Keep it under 100 words.` }
          ],
          max_tokens: 200
        })
      });
      if (!resp.ok) {
        // gpt-4o-search-preview may not be available to all keys
        // Fall back to gpt-4o without search
        return skip(`Search model unavailable (${resp.status})`);
      }
      const data = await resp.json();
      const content = data.choices[0].message.content;
      const cited = checkMention(content, brand);
      return { cited, snippet: content.substring(0, 200) };
    }
  }
};

// ── Technical checks (free, no API keys needed) ──

async function checkSSL(domain) {
  // Cloudflare Workers can't do raw TCP/SSL checks
  // Instead, check if HTTPS works
  try {
    const resp = await fetch(`https://${domain}`, { 
      method: 'HEAD', 
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    });
    return { status: 'ok', detail: 'HTTPS works' };
  } catch (e) {
    return { status: 'fail', detail: e.message.substring(0, 80) };
  }
}

async function checkRobots(domain) {
  try {
    const resp = await fetch(`https://${domain}/robots.txt`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) return { status: 'missing' };
    const text = (await resp.text()).toLowerCase();
    const aiBots = ['GPTBot', 'Google-Extended', 'Anthropic-ai', 'CCBot', 'PerplexityBot', 'Claude-Web', 'cohere-ai'];
    const found = aiBots.filter(b => text.includes(b.toLowerCase()));
    return { status: 'ok', aiCrawlers: found, count: found.length };
  } catch (e) {
    return { status: 'fail', detail: e.message.substring(0, 80) };
  }
}

async function checkSchema(domain) {
  try {
    const resp = await fetch(`https://${domain}/`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'GEO-Audit/1.0' }
    });
    const html = await resp.text();
    const schemas = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
    return { 
      status: schemas.length > 0 ? 'ok' : 'missing', 
      schemas: [...new Set(schemas)].slice(0, 10),
      count: schemas.length 
    };
  } catch (e) {
    return { status: 'fail', detail: e.message.substring(0, 80) };
  }
}

async function checkBingIndex(domain) {
  try {
    const host = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const resp = await fetch(`https://www.bing.com/search?q=site:${host}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await resp.text();
    const indexed = !html.includes('No results found') && !html.includes('没有结果');
    const countMatch = html.match(/(\d[\d,]*)\s*results?/i);
    return { 
      status: indexed ? 'ok' : 'fail', 
      indexed,
      detail: indexed ? (countMatch ? `~${countMatch[1]} pages` : 'Found in Bing') : 'Not in Bing index'
    };
  } catch (e) {
    return { status: 'fail', detail: e.message.substring(0, 80) };
  }
}

// ── Helpers ──

function checkMention(text, brand) {
  const b = brand.toLowerCase();
  const t = text.toLowerCase();
  // Brand directly mentioned
  if (t.includes(b)) return true;
  // Domain mentioned
  return false;
}

function fail(detail) {
  return { cited: false, error: detail, snippet: '' };
}

function skip(detail) {
  return { cited: false, skipped: true, detail, snippet: '' };
}

// ── CORS headers ──

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ── Main handler ──

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        version: '2.0',
        engines: Object.keys(ENGINES).filter(k => {
          const envKey = k === 'openai_search' ? 'OPENAI_KEY' : `${k.toUpperCase()}_KEY`;
          return !!env[envKey];
        })
      }), { headers: CORS });
    }

    // Scan endpoint
    if (url.pathname !== '/scan' || request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST /scan required' }), { status: 404, headers: CORS });
    }

    try {
      const { domain, brand } = await request.json();
      const cleanDomain = (domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*/, '');
      const brandName = brand || cleanDomain.split('.')[0];

      if (!cleanDomain) {
        return new Response(JSON.stringify({ error: 'Domain required' }), { status: 400, headers: CORS });
      }

      // Run all checks in parallel
      const [ssl, robots, schema, bing, ...engineResults] = await Promise.all([
        checkSSL(cleanDomain),
        checkRobots(cleanDomain),
        checkSchema(cleanDomain),
        checkBingIndex(cleanDomain),
        ...Object.entries(ENGINES).map(([key, engine]) => 
          engine.search(brandName, cleanDomain, env)
            .then(r => ({ key, ...r }))
            .catch(e => ({ key, cited: false, error: e.message, snippet: '' }))
        )
      ]);

      // Calculate score
      let score = 0;
      if (ssl.status === 'ok') score += 10;
      if (robots.status === 'ok') score += 15;
      if (schema.status === 'ok') score += 15;
      if (bing.status === 'ok') score += 15;
      const activeEngines = engineResults.filter(e => !e.skipped);
      const citedEngines = activeEngines.filter(e => e.cited);
      if (activeEngines.length > 0) {
        score += Math.round((citedEngines.length / activeEngines.length) * 45);
      }

      return new Response(JSON.stringify({
        domain: cleanDomain,
        brand: brandName,
        score,
        checks: { ssl, robots, schema, bing },
        engines: engineResults.map(e => ({
          name: ENGINES[e.key]?.name || e.key,
          emoji: ENGINES[e.key]?.emoji || '',
          region: ENGINES[e.key]?.region || '',
          cited: e.cited || false,
          skipped: e.skipped || false,
          snippet: e.snippet || '',
          error: e.error || null
        }))
      }), { headers: CORS });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }
  }
};
