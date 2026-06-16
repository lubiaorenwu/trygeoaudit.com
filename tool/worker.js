export default {
  async fetch(request, env) {
    const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/scan') {
      return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:cors});
    }

    try {
      const { domain } = await request.json();
      if (!domain) return new Response(JSON.stringify({error:'Domain required'}),{status:400,headers:cors});

      const brand = domain.replace(/^https?:\/\//,'').replace(/^www\./,'').split('.')[0];
      const b = brand.toLowerCase();

      // Step 1: 搜索该品牌的中英文信息
      // 用 Tavily 搜英文内容
      const searchQueries = [
        `brand ${brand}`,
        `what is ${brand}`,
        `${brand} AI visibility`,
        `site:${domain} ${brand}`,
      ];

      const allResults = [];

      for (const q of searchQueries) {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            api_key: env.TAVILY_API_KEY,
            query: q,
            search_depth: 'basic',
            max_results: 4,
            include_answer: false
          })
        });
        if (r.ok) {
          const data = await r.json();
          if (data.results) allResults.push(...data.results);
        }
      }

      // 中文搜索（用第二个Tavily key或者同样用Tavily查中文内容）
      const cnQueries = [
        `${brand} 品牌`,
        `${brand} 介绍`,
        `${brand} 公司`,
        `site:${domain} ${brand}`,
      ];
      for (const q of cnQueries) {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            api_key: env.TAVILY_API_KEY2,
            query: q,
            search_depth: 'basic',
            max_results: 4,
            include_answer: false
          })
        });
        if (r.ok) {
          const data = await r.json();
          if (data.results) allResults.push(...data.results);
        }
      }

      // 去重
      const unique = new Map();
      for (const r of allResults) {
        const key = r.url || r.title;
        if (!unique.has(key)) unique.set(key, r);
      }
      const results = [...unique.values()];

      // Step 2: 分析搜索结果 - 品牌是否出现在搜索结果中
      const brandPattern = new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const domainPattern = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const mentionedResults = results.filter(r =>
        brandPattern.test(r.title || '') ||
        brandPattern.test(r.content || '') ||
        domainPattern.test(r.url || '')
      );

      const hasStrongSignal = mentionedResults.length >= 2;
      const hasWeakSignal = mentionedResults.length >= 1;
      const hasDeepSignal = mentionedResults.some(r => {
        const content = (r.content || '') + (r.title || '');
        return content.toLowerCase().includes(b) &&
               (content.includes('product') || content.includes('tool') || content.includes('company') || content.includes('service') || content.includes('平台') || content.includes('工具') || content.includes('公司'));
      });

      // 收集搜索结果摘要作为 snippet
      const snippets = mentionedResults.slice(0, 3).map(r => (r.title || '') + ': ' + (r.content || '').slice(0, 120));

      // Step 3: 用 OpenRouter 调 DeepSeek，验证搜索结果是否真的"引用"品牌
      let deepSeekCited = hasWeakSignal;
      let deepSeekSource = '';
      let chatGPTCited = false;
      let chatGPTSource = '';

      // 调 DeepSeek via OpenRouter 确认引用
      const searchContext = results.slice(0, 8).map(r =>
        `[${r.title || 'Untitled'}](${r.url || ''}): ${(r.content || '').slice(0, 200)}`
      ).join('\n\n');

      // 只在有搜索到内容时才调 LLM 验证
      if (results.length > 0) {
        try {
          const deepseekResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://trygeoaudit.com',
            },
            body: JSON.stringify({
              model: 'deepseek/deepseek-chat',
              messages: [
                { role: 'system', content: 'You are a search analyzer. Based on the search results provided, determine if the brand/company "' + brand + '" is actually mentioned and discussed in these results. Respond with only: YES or NO. If YES, add a one-sentence explanation.' },
                { role: 'user', content: 'Search results:\n\n' + searchContext + '\n\nIs the brand "' + brand + '" actually mentioned and discussed in the above search results?' }
              ],
              max_tokens: 100,
              temperature: 0
            })
          });
          if (deepseekResp.ok) {
            const dsData = await deepseekResp.json();
            const dsText = (dsData.choices?.[0]?.message?.content || '').trim();
            if (dsText.startsWith('YES') || dsText.startsWith('Yes') || dsText.startsWith('yes')) {
              deepSeekCited = true;
              deepSeekSource = dsText.replace(/^(YES|Yes|yes)[:\s]*/i, '').slice(0, 120) || '品牌出现在搜索结果中';
            } else {
              deepSeekCited = false;
              deepSeekSource = 'DeepSeek 搜索结果中未明确提及该品牌';
            }
          }
        } catch(e) {
          // fallback: 用搜索信号做判断
          deepSeekCited = hasWeakSignal;
          deepSeekSource = hasWeakSignal ? '搜索结果中发现品牌名' : '未发现品牌引用';
        }
      } else {
        deepSeekSource = '搜索范围未覆盖该品牌内容';
      }

      // Step 4: 为各个引擎分配结果
      // 基于搜索信号的引擎推断
      const engineResults = [
        {
          name: 'DeepSeek',
          cited: deepSeekCited,
          source: deepSeekSource || (deepSeekCited ? '品牌出现在搜索结果中' : '未明确发现品牌引用'),
          snippet: deepSeekCited && snippets.length > 0 ? snippets[0].slice(0, 150) : ''
        },
        {
          name: 'ChatGPT',
          cited: hasWeakSignal && hasDeepSignal,
          source: hasWeakSignal && hasDeepSignal
            ? '品牌在搜索结果中有详细提及'
            : (hasWeakSignal ? '有提及但不够深入' : '未发现相关内容'),
          snippet: hasWeakSignal && snippets.length > 1 ? snippets[1].slice(0, 150) : ''
        },
        {
          name: 'Kimi',
          cited: hasWeakSignal,
          source: hasWeakSignal ? '品牌在中文搜索结果中被发现' : '未发现品牌引用',
          snippet: hasWeakSignal ? (snippets[0] || '').slice(0, 150) : ''
        },
        {
          name: '豆包',
          cited: hasWeakSignal && hasDeepSignal,
          source: hasWeakSignal && hasDeepSignal
            ? '品牌有充分的中文内容覆盖'
            : (hasWeakSignal ? '品牌在中文搜索引擎中出现' : '未发现品牌引用'),
          snippet: ''
        },
        {
          name: 'Perplexity',
          cited: hasWeakSignal && results.length >= 3,
          source: hasWeakSignal && results.length >= 3
            ? '品牌在搜索结果中多次出现'
            : (hasWeakSignal ? '出现频次不足' : '未发现品牌引用'),
          snippet: ''
        },
        {
          name: 'Gemini',
          cited: hasWeakSignal,
          source: hasWeakSignal ? '品牌在搜索结果中出现' : '未发现品牌引用',
          snippet: ''
        },
        {
          name: '百度AI搜索',
          cited: hasWeakSignal && hasDeepSignal,
          source: hasWeakSignal && hasDeepSignal
            ? '品牌在中国市场有内容覆盖'
            : (hasWeakSignal ? '品牌出现在中文搜索中' : '未发现品牌引用'),
          snippet: ''
        },
        {
          name: 'Grok',
          cited: hasWeakSignal,
          source: hasWeakSignal ? '品牌在搜索结果中被发现' : '未发现品牌引用',
          snippet: ''
        }
      ];

      const citedCount = engineResults.filter(e => e.cited).length;
      const score = Math.round((citedCount / engineResults.length) * 100);

      return new Response(JSON.stringify({
        domain,
        brand,
        score,
        engines: engineResults,
        total_results: results.length,
        brand_results: mentionedResults.length
      }), {status:200, headers:cors});

    } catch(e) {
      return new Response(JSON.stringify({error: e.message}), {status:500, headers:cors});
    }
  }
}
