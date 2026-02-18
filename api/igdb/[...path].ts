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
  const endpoint = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');
  if (!endpoint) {
    res.status(400).json({ error: 'Missing IGDB endpoint path' });
    return;
  }

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

