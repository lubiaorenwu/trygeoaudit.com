export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // POST /api/free-scan
    if (request.method === 'POST' && url.pathname === '/api/free-scan') {
      try {
        const data = await request.json();
        const brand = (data.brand || '').trim();
        const email = (data.email || '').trim();

        if (!brand || !email || !email.includes('@')) {
          return new Response(JSON.stringify({ success: false, error: 'Brand and valid email required' }), { status: 400, headers });
        }

        const submission = {
          brand,
          email,
          timestamp: new Date().toISOString(),
          ip: request.headers.get('cf-connecting-ip') || ''
        };

        const key = 'scan:' + Date.now() + ':' + brand.slice(0, 20).replace(/\s/g, '-');
        await env.SUBMISSIONS.put(key, JSON.stringify(submission));

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid request' }), { status: 400, headers });
      }
    }

    // GET /api/submissions
    if (request.method === 'GET' && url.pathname === '/api/submissions') {
      try {
        const list = await env.SUBMISSIONS.list({ prefix: 'scan:', limit: 20 });
        const items = [];
        for (const k of list.keys) {
          const val = await env.SUBMISSIONS.get(k.name);
          if (val) items.push(JSON.parse(val));
        }
        return new Response(JSON.stringify(items), { status: 200, headers });
      } catch (e) {
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    // Health check
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }
};
