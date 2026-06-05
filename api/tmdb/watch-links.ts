import {
  buildTMDBWatchUrl,
  extractProviderLinksFromWatchHtml,
  type WatchMediaType,
  type WatchProviderInput,
} from '../../src/services/tmdb-watch-links';

type ParsedRequestBody = {
  mediaType?: WatchMediaType;
  mediaId?: number | string;
  locale?: string;
  providers?: WatchProviderInput[];
};

const DEBUG_WATCH_LINKS =
  process.env.EXPO_PUBLIC_DEBUG_WATCH_LINKS === 'true' ||
  process.env.DEBUG_WATCH_LINKS === 'true' ||
  process.env.NODE_ENV !== 'production';

function logWatchLinks(step: string, payload?: unknown) {
  if (!DEBUG_WATCH_LINKS) return;
  if (typeof payload === 'undefined') {
    console.log(`[watch-links-api] ${step}`);
    return;
  }
  console.log(`[watch-links-api] ${step}`, payload);
}

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

  const body = parseBody(req.body);
  const mediaType = parseMediaType(body.mediaType);
  const mediaId = Number(body.mediaId);
  const locale = typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : 'ES';
  const providers = parseProviders(body.providers);
  logWatchLinks('request:incoming', {
    method: req.method,
    mediaType,
    mediaId,
    locale,
    providerCount: providers.length,
    providers: providers.map((provider) => `${provider.provider_id}:${provider.provider_name}`),
  });

  if (!mediaType || !Number.isFinite(mediaId) || mediaId <= 0) {
    logWatchLinks('request:invalid-params', { mediaType, mediaId });
    res.status(400).json({ error: 'Invalid mediaType or mediaId' });
    return;
  }

  if (providers.length === 0) {
    logWatchLinks('request:no-providers');
    res.status(200).json({ links: {} });
    return;
  }

  try {
    const watchUrl = buildTMDBWatchUrl(mediaType, mediaId, locale);
    logWatchLinks('tmdb:fetch:start', { watchUrl });
    const upstream = await fetch(watchUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    logWatchLinks('tmdb:fetch:status', {
      ok: upstream.ok,
      status: upstream.status,
      statusText: upstream.statusText,
      watchUrl,
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Unable to fetch TMDB watch page' });
      return;
    }

    const html = await upstream.text();
    logWatchLinks('tmdb:fetch:html', {
      length: html.length,
      hasJustWatch: /click\.justwatch\.com/i.test(html),
    });
    const links = extractProviderLinksFromWatchHtml(html, providers);
    const resolvedProviderIds = new Set(Object.keys(links).map((id) => Number(id)));
    const missingProviders = providers
      .filter((provider) => !resolvedProviderIds.has(provider.provider_id))
      .map((provider) => `${provider.provider_id}:${provider.provider_name}`);
    logWatchLinks('tmdb:parse:result', {
      linksFound: Object.keys(links).length,
      providerIds: Object.keys(links),
      missingProviders,
    });
    res.status(200).json({ links });
  } catch (error) {
    logWatchLinks('tmdb:error', {
      message: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({
      error: 'TMDB watch-links proxy failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseBody(rawBody: unknown): ParsedRequestBody {
  if (!rawBody) return {};
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as ParsedRequestBody;
    } catch {
      return {};
    }
  }
  if (typeof rawBody === 'object') {
    return rawBody as ParsedRequestBody;
  }
  return {};
}

function parseMediaType(mediaType: unknown): WatchMediaType | null {
  return mediaType === 'movie' || mediaType === 'tv' ? mediaType : null;
}

function parseProviders(rawProviders: unknown): WatchProviderInput[] {
  if (!Array.isArray(rawProviders)) return [];
  return rawProviders.filter(isValidProvider);
}

function isValidProvider(value: unknown): value is WatchProviderInput {
  if (!value || typeof value !== 'object') return false;
  const provider = value as WatchProviderInput;
  return Number.isFinite(provider.provider_id) && typeof provider.provider_name === 'string';
}
