export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // POST /api/free-scan → handle form submission
    if (request.method === 'POST' && url.pathname === '/api/free-scan') {
      try {
        const data = await request.json();
        const brand = (data.brand || '').trim();
        const email = (data.email || '').trim();

        if (!brand || !email || !email.includes('@')) {
          return Response.json({ success: false, error: 'Brand and valid email required' }, { status: 400 });
        }

        const submission = {
          brand,
          email,
          timestamp: new Date().toISOString(),
          ip: request.headers.get('cf-connecting-ip') || ''
        };

        // Store in KV with timestamp key
        const key = `scan:${Date.now()}:${brand.slice(0, 20).replace(/\s/g, '-')}`;
        await env.SUBMISSIONS.put(key, JSON.stringify(submission));

        return Response.json({ success: true });
      } catch (e) {
        return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
      }
    }

    // GET /api/submissions → list recent (for polling)
    if (request.method === 'GET' && url.pathname === '/api/submissions') {
      const list = await env.SUBMISSIONS.list({ prefix: 'scan:', limit: 20 });
      const items = [];
      for (const k of list.keys) {
        const val = await env.SUBMISSIONS.get(k.name);
        if (val) items.push(JSON.parse(val));
      }
      return Response.json(items);
    }

    // Everything else → pass through to GitHub Pages
    return fetch(request);
  }
};
