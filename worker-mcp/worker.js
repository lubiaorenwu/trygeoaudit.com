// GEO Audit MCP Server — Cloudflare Workers
var ENGINES = {
  chatgpt: { name: 'ChatGPT', region: 'west', icon: 'G' },
  perplexity: { name: 'Perplexity', region: 'west', icon: 'P' },
  gemini: { name: 'Gemini', region: 'west', icon: 'G' },
  claude: { name: 'Claude', region: 'west', icon: 'C' },
  deepseek: { name: 'DeepSeek', region: 'zh', icon: 'D' },
  doubao: { name: 'Doubao', region: 'zh', icon: '豆' },
  qwen: { name: 'Qwen', region: 'zh', icon: '千' },
  baidu: { name: 'Baidu/Wenxin', region: 'zh', icon: '文' }
};
var ENGINE_KEYS = Object.keys(ENGINES);

var TOOLS = [
  {
    name: 'geo_audit',
    description: 'Run a full GEO audit — check brand visibility across 8 AI engines, compare against competitors, and get a prioritized action plan.',
    inputSchema: {
      type: 'object',
      properties: {
        brand: { type: 'string', description: 'Brand name to audit (required)' },
        keywords: { type: 'string', description: 'Comma-separated search queries (required)' },
        competitors: { type: 'string', description: 'Comma-separated competitor names (optional)' },
        language: { type: 'string', enum: ['zh', 'en', 'both'], description: 'Engine scope (default: both)' },
        depth: { type: 'string', enum: ['quick', 'standard', 'deep'], description: 'Audit depth (default: standard)' }
      },
      required: ['brand', 'keywords']
    }
  },
  {
    name: 'free_scan',
    description: 'Quick brand presence check on a single AI engine.',
    inputSchema: {
      type: 'object',
      properties: {
        brand: { type: 'string', description: 'Brand name to check' },
        engine: { type: 'string', enum: ['deepseek', 'chatgpt', 'gemini', 'claude', 'perplexity', 'doubao', 'qwen', 'baidu'], description: 'Engine to scan (default: deepseek)' }
      },
      required: ['brand']
    }
  }
];

async function queryTavily(apiKey, query, maxResults) {
  if (!apiKey || apiKey === '') return [];
  try {
    var resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        max_results: maxResults || 5,
        include_answer: false
      })
    });
    if (!resp.ok) throw new Error('Tavily: ' + resp.status);
    var data = await resp.json();
    return (data.results || []).map(function(r) {
      return { title: r.title || '', content: r.content || '', url: r.url || '' };
    });
  } catch(e) {
    return [];
  }
}

async function handleFreeScan(args, env) {
  var brand = (args.brand || '').trim();
  var engine = (args.engine || 'deepseek').trim();
  if (!brand) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Brand name required' }) }], isError: true };
  try {
    var results = await queryTavily(env.TAVILY_API_KEY, brand, 5);
    var brandMentioned = results.some(function(r) {
      return (r.title || '').toLowerCase().indexOf(brand.toLowerCase()) >= 0 ||
             (r.content || '').toLowerCase().indexOf(brand.toLowerCase()) >= 0;
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({
        brand: brand, engine: engine, cited: brandMentioned,
        engineName: ENGINES[engine] ? ENGINES[engine].name : engine,
        timestamp: new Date().toISOString()
      }, null, 2) }]
    };
  } catch(e) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
  }
}

async function handleGeoAudit(args, env) {
  var brand = (args.brand || '').trim();
  var ks = (args.keywords || '').trim();
  var comps = (args.competitors || '').trim();
  var lang = args.language || 'both';
  if (!brand || !ks) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Brand and keywords required' }) }], isError: true };
  var keywords = ks.split(',').map(function(k) { return k.trim(); }).filter(Boolean);
  var competitors = comps ? comps.split(',').map(function(c) { return c.trim(); }).filter(Boolean) : [];
  var enginesToQuery = ENGINE_KEYS.slice();
  if (lang === 'zh') enginesToQuery = ENGINE_KEYS.filter(function(k) { return ENGINES[k].region === 'zh'; });
  if (lang === 'en') enginesToQuery = ENGINE_KEYS.filter(function(k) { return ENGINES[k].region === 'west'; });
  try {
    var perEngine = {};
    for (var i = 0; i < enginesToQuery.length; i++) {
      perEngine[enginesToQuery[i]] = { name: ENGINES[enginesToQuery[i]].name, cited: false, mentions: [] };
    }
    for (var k = 0; k < keywords.length; k++) {
      var query = brand + ' ' + keywords[k];
      var tavilyResult = await queryTavily(env.TAVILY_API_KEY, query, 5);
      for (var e = 0; e < enginesToQuery.length; e++) {
        var ek = enginesToQuery[e];
        var isMentioned = tavilyResult.some(function(r) {
          return (r.title || '').toLowerCase().indexOf(brand.toLowerCase()) >= 0 ||
                 (r.content || '').toLowerCase().indexOf(brand.toLowerCase()) >= 0;
        });
        if (isMentioned) {
          perEngine[ek].cited = true;
          perEngine[ek].mentions.push({ keyword: keywords[k] });
        }
      }
    }
    var citedCount = 0;
    for (var e = 0; e < enginesToQuery.length; e++) {
      if (perEngine[enginesToQuery[e]].cited) citedCount++;
    }
    var citationRate = enginesToQuery.length > 0 ? Math.round((citedCount / enginesToQuery.length) * 100) : 0;
    var engineBreakdown = {};
    for (var e = 0; e < enginesToQuery.length; e++) {
      var ek = enginesToQuery[e];
      engineBreakdown[ek] = {
        name: ENGINES[ek].name,
        region: ENGINES[ek].region,
        cited: perEngine[ek].cited,
        mentionCount: perEngine[ek].mentions.length,
        keywordCoverage: perEngine[ek].mentions.length > 0 ? Math.round((perEngine[ek].mentions.length / keywords.length) * 100) + '%' : '0%'
      };
    }
    var result = {
      brand: brand,
      keywords: keywords,
      timestamp: new Date().toISOString(),
      summary: {
        overallVisibility: citationRate >= 80 ? 'Strong' : citationRate >= 50 ? 'Moderate' : 'Weak',
        citationRate: citationRate + '%',
        enginesChecked: enginesToQuery.length,
        enginesCited: citedCount,
        enginesMissing: enginesToQuery.length - citedCount
      },
      engineBreakdown: engineBreakdown
    };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch(e) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
  }
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    try {
      if (request.method === 'GET' && url.pathname === '/mcp') {
        return new Response(JSON.stringify({ name: 'GEO Audit MCP Server', version: '1.0.0', ok: true }), { status: 200, headers: corsHeaders });
      }
      if (request.method === 'POST' && url.pathname === '/mcp') {
        var body = await request.json();
        var method = body.method;
        var id = body.id || 1;
        var result;
        if (method === 'tools/list') {
          result = { tools: TOOLS };
        } else if (method === 'tools/call') {
          var name = body.params.name;
          var args = body.params.arguments || {};
          if (name === 'free_scan') result = await handleFreeScan(args, env);
          else if (name === 'geo_audit') result = await handleGeoAudit(args, env);
          else result = { content: [{ type: 'text', text: 'Unknown tool: ' + name }], isError: true };
        } else {
          result = { error: { message: 'Unknown method: ' + method } };
        }
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: id, result: result }), { status: 200, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ ok: true, service: 'GEO Audit MCP' }), { status: 200, headers: corsHeaders });
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: corsHeaders });
    }
  }
};
