/* eslint-disable no-console */
const fs = require('fs');
const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.IGDB_PROXY_PORT || 8787);
const HOST = process.env.IGDB_PROXY_HOST || '0.0.0.0';

function loadEnvFile(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    raw.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // no-op
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const clientId = process.env.IGDB_CLIENT_ID || process.env.EXPO_PUBLIC_IGDB_CLIENT_ID || '';
const accessToken = process.env.IGDB_ACCESS_TOKEN || process.env.EXPO_PUBLIC_IGDB_ACCESS_TOKEN || '';

if (!clientId || !accessToken) {
  console.error('[igdb-proxy] Missing IGDB credentials. Set IGDB_CLIENT_ID and IGDB_ACCESS_TOKEN (or EXPO_PUBLIC_*).');
  process.exit(1);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
}

function resolveEndpoint(urlObj) {
  const fromQuery = urlObj.searchParams.get('path') || '';
  if (fromQuery) return fromQuery.replace(/^\/+|\/+$/g, '');

  const prefix = '/api/igdb/';
  if (urlObj.pathname.startsWith(prefix)) {
    return urlObj.pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
  }
  return '';
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const urlObj = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const endpoint = resolveEndpoint(urlObj);

  if (!endpoint) {
    sendJson(res, 400, { error: 'Missing IGDB endpoint path' });
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const body = Buffer.concat(chunks).toString('utf8');
      const upstream = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'text/plain',
        },
        body,
      });

      const raw = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
      res.end(raw);
    } catch (error) {
      sendJson(res, 502, {
        error: 'IGDB proxy request failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[igdb-proxy] running on http://${HOST}:${PORT}/api/igdb`);
});
