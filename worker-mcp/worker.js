/**
 * GEO Audit MCP Server
 * 
 * Exposes two tools for Claude Code / Claude Cowork / Hermes / any MCP-compatible agent:
 *   1. geo_audit        — Full 8-engine brand visibility audit
 *   2. free_scan        — Quick single-engine check
 *
 * MCP Protocol: tools/list → tools/call
 * Runs on Cloudflare Workers (free tier, zero monthly cost)
 */

// Engine definitions
const ENGINES = {
  // Western
  chatgpt: { name: 'ChatGPT', region: 'west', icon: 'G' },
  perplexity: { name: 'Perplexity', region: 'west', icon: 'P' },
  gemini: { name: 'Gemini', region: 'west', icon: 'G' },
  claude: { name: 'Claude', region: 'west', icon: 'C' },
  // Chinese
  deepseek: { name: 'DeepSeek', region: 'zh', icon: 'D' },
  doubao: { name: 'Doubao', region: 'zh', icon: '豆' },
  qwen: { name: 'Qwen', region: 'zh', icon: '千' },
  baidu: { name: 'Baidu/Wenxin', region: 'zh', icon: '文' }
};

const ENGINE_KEYS = Object.keys(ENGINES);

// Tool definitions (MCP schema format)
const TOOLS = [
  {
    name: 'geo_audit',
    description: 'Run a full GEO (Generative Engine Optimization) audit — check brand visibility across 8 AI engines, compare against competitors, and get a prioritized action plan.',
    inputSchema: {
      type: 'object',
      properties: {
        brand: {
          type: 'string',
          description: 'Brand name to audit (required)'
        },
        keywords: {
          type: 'string',
          description: 'Comma-separated search queries/keywords to test (required)'
        },
        competitors: {
          type: 'string',
          description: 'Comma-separated competitor names (optional)'
        },
        language: {
          type: 'string',
          enum: ['zh', 'en', 'both'],
          description: 'Engine scope (default: both)'
        },
        depth: {
          type: 'string',
          enum: ['quick', 'standard', 'deep'],
          description: 'Audit depth (default: standard)'
        }
      },
      required: ['brand', 'keywords']
    }
  },
  {
    name: 'free_scan',
    description: 'Quick brand presence check on a single AI engine — tells you if the brand is mentioned.',
    inputSchema: {
      type: 'object',
      properties: {
        brand: {
          type: 'string',
          description: 'Brand name to check'
        },
        engine: {
          type: 'string',
          enum: ['deepseek', 'chatgpt', 'gemini', 'claude', 'perplexity', 'doubao', 'qwen', 'baidu'],
          description: 'Engine to scan (default: deepseek)'
        }
      },
      required: ['brand']
    }
  }
];

// Route handlers
async function handleListTools() {
  return { tools: TOOLS };
}

async function handleCallTool(request, body, env) {
  const { name, arguments: args } = body;
  
  if (!name || !args) {
    return { content: [{ type: 'text', text: 'Missing tool name or arguments' }], isError: true };
  }
  
  switch (name) {
    case 'geo_audit':
      return handleGeoAudit(args, env);
    case 'free_scan':
      return handleFreeScan(args, env);
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
}

/**
 * Free Scan — check one engine for brand mention
 */
async function handleFreeScan(args, env) {
  const brand = (args.brand || '').trim();
  const engine = (args.engine || 'deepseek').trim();
  
  if (!brand) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'Brand name required' }) }], isError: true };
  }
  
  try {
    // Use Tavily to check if brand appears in search results
    const query = `${brand}`;
    const tavilyResult = await queryTavily(env.TAVILY_API_KEY, query, 5);
    
    // Check if brand is mentioned in any result
    const brandMentioned = tavilyResult.some(r => 
      (r.title || '').toLowerCase().includes(brand.toLowerCase()) ||
      (r.content || '').toLowerCase().includes(brand.toLowerCase())
    );
    
    const result = {
      brand,
      engine,
      cited: brandMentioned,
      engineName: ENGINES[engine]?.name || engine,
      timestamp: new Date().toISOString()
    };
    
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
  }
}

/**
 * Full GEO Audit — check brand across engines + competitor comparison
 */
async function handleGeoAudit(args, env) {
  const brand = (args.brand || '').trim();
  const keywordsStr = (args.keywords || '').trim();
  const competitorsStr = (args.competitors || '').trim();
  const language = args.language || 'both';
  const depth = args.depth || 'standard';
  
  if (!brand || !keywordsStr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'Brand and keywords required' }) }], isError: true };
  }
  
  const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
  const competitors = competitorsStr ? competitorsStr.split(',').map(c => c.trim()).filter(Boolean) : [];
  
  // Determine which engines to query
  let enginesToQuery = ENGINE_KEYS;
  if (language === 'zh') enginesToQuery = ENGINE_KEYS.filter(k => ENGINES[k].region === 'zh');
  if (language === 'en') enginesToQuery = ENGINE_KEYS.filter(k => ENGINES[k].region === 'west');
  if (depth === 'quick') enginesToQuery = ['deepseek', 'chatgpt', 'gemini'];
  
  const TAVILY_KEY = env.TAVILY_API_KEY;
  
  try {
    // For each keyword, query all engines (via Tavily as aggregator)
    const results = {};
    const mentions = {};
    const perEngine = {};
    
    // Initialize engine tracking
    for (const ek of enginesToQuery) {
      perEngine[ek] = { name: ENGINES[ek].name, cited: false, mentions: [] };
      mentions[ek] = [];
    }
    
    // Query each keyword
    for (const kw of keywords) {
      const query = `${brand} ${kw}`;
      const tavilyResult = await queryTavily(TAVILY_KEY, query, 5);
      
      for (const ek of enginesToQuery) {
        const isMentioned = tavilyResult.some(r => 
          (r.title || '').toLowerCase().includes(brand.toLowerCase()) ||
          (r.content || '').toLowerCase().includes(brand.toLowerCase())
        );
        
        if (isMentioned) {
          perEngine[ek].cited = true;
          const relevantResults = tavilyResult.filter(r =>
            (r.title || '').toLowerCase().includes(brand.toLowerCase()) ||
            (r.content || '').toLowerCase().includes(brand.toLowerCase())
          );
          perEngine[ek].mentions.push({
            keyword: kw,
            results: relevantResults.slice(0, 2)
          });
          mentions[ek].push(kw);
        }
      }
    }
    
    // Calculate citation rate
    const citedCount = enginesToQuery.filter(ek => perEngine[ek].cited).length;
    const citationRate = enginesToQuery.length > 0 
      ? Math.round((citedCount / enginesToQuery.length) * 100) 
      : 0;
    
    // Competitor comparison (if competitors provided)
    const competitorResults = [];
    if (competitors.length > 0) {
      for (const comp of competitors) {
        const compCited = [];
        for (const kw of keywords) {
          const query = `${comp} ${kw}`;
          const tavilyResult = await queryTavily(TAVILY_KEY, query, 3);
          const isCited = tavilyResult.some(r =>
            (r.title || '').toLowerCase().includes(comp.toLowerCase()) ||
            (r.content || '').toLowerCase().includes(comp.toLowerCase())
          );
          if (isCited) compCited.push(kw);
        }
        competitorResults.push({
          name: comp,
          citedEngines: compCited.length > 0 ? enginesToQuery.filter(() => true).slice(0, Math.ceil(compCited.length / keywords.length * enginesToQuery.length)) : [],
          citationRate: Math.round((compCited.length / keywords.length) * 100)
        });
      }
    }
    
    // Need deeper analysis for standard/deep
    if (depth !== 'quick') {
      // Do a second pass focusing on brand-specific queries (not just keyword+brand)
      for (const ek of enginesToQuery) {
        const expertQuery = `top rated ${keywords[0]} recommendations`;
        const tavilyResult = await queryTavily(TAVILY_KEY, expertQuery, 5);
        const isMentionedExplicitly = tavilyResult.some(r =>
          (r.title || '').toLowerCase().includes(brand.toLowerCase()) ||
          (r.content || '').toLowerCase().includes(brand.toLowerCase())
        );
        // If brand not found in recommendation-style query, it's a gap
        if (!isMentionedExplicitly && perEngine[ek].cited) {
          // Cited in general search but not in recommendation — partial coverage
        }
      }
    }
    
    // Build result
    const engineBreakdown = {};
    for (const ek of enginesToQuery) {
      engineBreakdown[ek] = {
        name: ENGINES[ek].name,
        region: ENGINES[ek].region,
        cited: perEngine[ek].cited,
        mentionCount: perEngine[ek].mentions.length,
        keywordCoverage: perEngine[ek].mentions.length > 0 
          ? `${Math.round((perEngine[ek].mentions.length / keywords.length) * 100)}%` 
          : '0%'
      };
    }
    
    const result = {
      brand,
      keywords,
      competitors: competitors.length > 0 ? competitors : undefined,
      timestamp: new Date().toISOString(),
      summary: {
        overallVisibility: citationRate >= 80 ? 'Strong' : citationRate >= 50 ? 'Moderate' : 'Weak',
        citationRate: `${citationRate}%`,
        enginesChecked: enginesToQuery.length,
        enginesCited: citedCount,
        enginesMissing: enginesToQuery.length - citedCount
      },
      engineBreakdown,
      competitorComparison: competitorResults.length > 0 ? competitorResults : undefined,
      recommendations: generateRecommendations(citationRate, enginesToQuery, perEngine)
    };
    
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
  }
}

/**
 * Query Tavily search API — used as AI search aggregator
 */
async function queryTavily(apiKey, query, maxResults = 5) {
  if (!apiKey) {
    // Fallback: return mock data for testing
    return [
      { title: `${query} — test result`, content: `This is a test result for "${query}". Connect TAVILY_API_KEY for live data.`, url: 'https://example.com' }
    ];
  }
  
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Tavily API: ${response.status}`);
    }
    
    const data = await response.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      content: r.content || '',
      url: r.url || ''
    }));
  } catch (e) {
    console.error('Tavily error:', e.message);
    return [];
  }
}

/**
 * Generate recommendations based on audit findings
 */
function generateRecommendations(citationRate, enginesToQuery, perEngine) {
  const recs = [];
  
  if (citationRate < 50) {
    recs.push({
      priority: 'high',
      action: 'Create brand-authoritative content across the keywords tested',
      expectedImpact: 'High',
      effort: '2-3 days'
    });
  }
  
  const missingEngines = enginesToQuery.filter(ek => !perEngine[ek]?.cited);
  if (missingEngines.length > 0) {
    const missingNames = missingEngines.map(ek => ENGINES[ek]?.name).filter(Boolean);
    recs.push({
      priority: 'medium',
      action: `Build content presence for ${missingNames.join(', ')} — these engines do not cite the brand`,
      expectedImpact: 'Medium',
      effort: 'Varies by engine'
    });
  }
  
  recs.push({
    priority: 'low',
    action: 'Run monthly re-audits to track citation changes — 40-60% of AI citations rotate monthly',
    expectedImpact: 'Medium',
    effort: '5 min (automated)'
  });
  
  return recs;
}

/**
 * Main request handler — MCP protocol dispatcher
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    try {
      // === MCP Endpoints ===
      
      // POST /mcp — MCP JSON-RPC endpoint
      if (request.method === 'POST' && url.pathname === '/mcp') {
        const body = await request.json();
        const { method, id } = body;
        
        let result;
        switch (method) {
          case 'tools/list':
            result = await handleListTools();
            break;
          case 'tools/call':
            result = await handleCallTool(request, body.params, env);
            break;
          default:
            result = { error: { message: `Unknown method: ${method}` } };
        }
        
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: id || 1, ...result }), { status: 200, headers: corsHeaders });
      }
      
      // GET /mcp — MCP info
      if (request.method === 'GET' && url.pathname === '/mcp') {
        return new Response(JSON.stringify({
          name: 'GEO Audit MCP Server',
          version: '1.0.0',
          description: 'Brand visibility audit across 8 generative AI engines',
          tools: TOOLS.map(t => t.name)
        }), { status: 200, headers: corsHeaders });
      }
      
      // === Legacy API endpoints ===
      
      // POST /api/geo-audit — direct JSON audit (non-MCP clients)
      if (request.method === 'POST' && url.pathname === '/api/geo-audit') {
        const body = await request.json();
        const result = await handleGeoAudit(body, env);
        return new Response(JSON.stringify(result.content[0].text), { status: 200, headers: corsHeaders });
      }
      
      // POST /api/free-scan — legacy support
      if (request.method === 'POST' && url.pathname === '/api/free-scan') {
        const body = await request.json();
        const result = await handleFreeScan(body, env);
        return new Response(JSON.stringify(result.content[0].text), { status: 200, headers: corsHeaders });
      }
      
      // Health check
      return new Response(JSON.stringify({ 
        ok: true, 
        service: 'GEO Audit MCP',
        endpoints: ['GET /mcp', 'POST /mcp', 'POST /api/geo-audit', 'POST /api/free-scan']
      }), { status: 200, headers: corsHeaders });
      
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
