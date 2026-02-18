export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParam = req.query?.path;
  let endpoint = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');

  // Fallback robusto: en algunos entornos `req.query.path` llega vacío
  // aunque la URL sea /api/igdb/games.
  if (!endpoint) {
    const rawUrl = typeof req.url === 'string' ? req.url : '';
    const withoutQuery = rawUrl.split('?')[0] || '';
    const marker = '/api/igdb/';
    const markerIndex = withoutQuery.indexOf(marker);
    if (markerIndex >= 0) {
      endpoint = withoutQuery.slice(markerIndex + marker.length).replace(/^\/+|\/+$/g, '');
    }
  }

  if (!endpoint) {
    res.status(400).json({ error: 'Missing IGDB endpoint path' });
    return;
  }

  // Debug para inspeccionar cómo entra la ruta en Vercel/local.
  console.log('[IGDB proxy] incoming', {
    method: req.method,
    url: req.url,
    queryPath: req.query?.path,
    resolvedEndpoint: endpoint,
  });

  const clientId = process.env.IGDB_CLIENT_ID || process.env.EXPO_PUBLIC_IGDB_CLIENT_ID;
  const accessToken = process.env.IGDB_ACCESS_TOKEN || process.env.EXPO_PUBLIC_IGDB_ACCESS_TOKEN;

  if (!clientId || !accessToken) {
    res.status(500).json({ error: 'IGDB credentials not configured in Vercel env vars' });
    return;
  }

  try {
    const igdbResponse = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      },
      body: typeof req.body === 'string' ? req.body : '',
    });

    const raw = await igdbResponse.text();
    console.log('[IGDB proxy] upstream', {
      endpoint,
      status: igdbResponse.status,
      contentType: igdbResponse.headers.get('content-type'),
    });
    res.status(igdbResponse.status);
    res.setHeader('Content-Type', igdbResponse.headers.get('content-type') || 'application/json');
    res.send(raw);
  } catch (error) {
    res.status(502).json({
      error: 'IGDB proxy request failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
