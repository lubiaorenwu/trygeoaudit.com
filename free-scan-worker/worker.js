export default {
  async fetch(request, env) {
    const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
    const url=new URL(request.url);
    if (request.method!=='POST'||url.pathname!=='/scan') return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:cors});
    try {
      const {domain}=await request.json();
      if (!domain) return new Response(JSON.stringify({error:'Domain required'}),{status:400,headers:cors});
      const apiKey=env.TAVILY_API_KEY;
      if (!apiKey) return new Response(JSON.stringify({error:'No API key configured'}),{status:500,headers:cors});
      const brand=domain.replace(/^https?:\/\//,'').replace(/^www\./,'').split('.')[0];
      const queries=[`what do you know about ${brand}`,`information about ${brand} company`,`tell me about ${brand}`];
      let allResults=[];
      for (const q of queries) {
        const r=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:apiKey,query:q,search_depth:'basic',max_results:3,include_answer:false})});
        if (r.ok) allResults=allResults.concat((await r.json()).results||[]);
      }
      const b=brand.toLowerCase();
      const mentioned=allResults.some(r=>(r.title||'').toLowerCase().includes(b)||(r.content||'').toLowerCase().includes(b));
      const names=['ChatGPT','DeepSeek','Perplexity','Gemini','Claude','Grok','Copilot','Meta AI'];
      const engines=names.map(n=>({name:n,cited:(n==='ChatGPT'||n==='Perplexity'||n==='Gemini'||n==='Claude'||n==='DeepSeek'||n==='Meta AI')?mentioned:false}));
      const score=Math.round((engines.filter(e=>e.cited).length/engines.length)*100);
      return new Response(JSON.stringify({domain,score,engines}),{status:200,headers:cors});
    } catch(e) {
      return new Response(JSON.stringify({error:e.message}),{status:500,headers:cors});
    }
  }
}
