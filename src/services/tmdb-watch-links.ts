export type WatchMediaType = 'movie' | 'tv';

export interface WatchProviderInput {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
}

interface ResolveProviderLinksOptions {
  mediaType: WatchMediaType;
  mediaId: number;
  providers: WatchProviderInput[];
  locale?: string;
}

interface ProviderLinkCandidate {
  destination: string;
  nameCandidates: string[];
  logoCandidates: string[];
  providerIdCandidates: number[];
  source: 'anchor' | 'raw';
}

const WATCH_LINKS_CACHE = new Map<string, Record<number, string>>();
const DEBUG_WATCH_LINKS =
  Boolean((globalThis as any).__DEV__) ||
  process.env.EXPO_PUBLIC_DEBUG_WATCH_LINKS === 'true' ||
  process.env.DEBUG_WATCH_LINKS === 'true';
const WATCH_LINKS_PROXY_ENDPOINT =
  process.env.EXPO_PUBLIC_TMDB_WATCH_LINKS_PROXY_URL || '/api/tmdb/watch-links';

function logWatchLinks(step: string, payload?: unknown) {
  if (!DEBUG_WATCH_LINKS) return;
  if (typeof payload === 'undefined') {
    console.log(`[watch-links] ${step}`);
    return;
  }
  console.log(`[watch-links] ${step}`, payload);
}

export function buildTMDBWatchUrl(mediaType: WatchMediaType, mediaId: number, locale = 'ES'): string {
  return `https://www.themoviedb.org/${mediaType}/${mediaId}/watch?locale=${encodeURIComponent(locale)}`;
}

export async function resolveProviderLinksFromTMDBWatchPage(
  options: ResolveProviderLinksOptions
): Promise<Record<number, string>> {
  const locale = options.locale || 'ES';
  const providers = options.providers || [];
  if (!providers.length) return {};

  const cacheKey = `${options.mediaType}:${options.mediaId}:${locale}`;
  logWatchLinks('resolve:start', {
    mediaType: options.mediaType,
    mediaId: options.mediaId,
    locale,
    providers: providers.map((provider) => `${provider.provider_id}:${provider.provider_name}`),
  });

  const cached = WATCH_LINKS_CACHE.get(cacheKey);
  if (cached && Object.keys(cached).length > 0) {
    logWatchLinks('resolve:cache-hit', {
      cacheKey,
      linksFound: Object.keys(cached).length,
    });
    return cached;
  }

  const proxyLinks = await fetchProviderLinksFromProxy({
    ...options,
    locale,
  });

  if (proxyLinks && Object.keys(proxyLinks).length > 0) {
    logWatchLinks('resolve:proxy-links', {
      linksFound: Object.keys(proxyLinks).length,
      providerIds: Object.keys(proxyLinks),
    });
    WATCH_LINKS_CACHE.set(cacheKey, proxyLinks);
    return proxyLinks;
  }
  logWatchLinks('resolve:proxy-links-empty');

  try {
    const watchUrl = buildTMDBWatchUrl(options.mediaType, options.mediaId, locale);
    logWatchLinks('resolve:direct-fetch:start', { watchUrl });
    const response = await fetch(watchUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    logWatchLinks('resolve:direct-fetch:status', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
    if (!response.ok) return {};
    const html = await response.text();
    logWatchLinks('resolve:direct-fetch:html', {
      length: html.length,
      hasJustWatch: /click\.justwatch\.com/i.test(html),
    });
    const links = extractProviderLinksFromWatchHtml(html, providers);
    logWatchLinks('resolve:direct-fetch:parsed', {
      linksFound: Object.keys(links).length,
      providerIds: Object.keys(links),
    });
    if (Object.keys(links).length > 0) {
      WATCH_LINKS_CACHE.set(cacheKey, links);
    } else {
      logWatchLinks('resolve:direct-fetch:not-cached-empty', { cacheKey });
    }
    return links;
  } catch (error) {
    logWatchLinks('resolve:direct-fetch:error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

export function extractProviderLinksFromWatchHtml(
  html: string,
  providers: WatchProviderInput[]
): Record<number, string> {
  if (!html || !providers.length) return {};
  const candidates = extractProviderLinkCandidates(html);
  if (!candidates.length) return {};
  const sourceCounts = candidates.reduce(
    (acc, candidate) => {
      acc[candidate.source] += 1;
      return acc;
    },
    { anchor: 0, raw: 0 } as Record<'anchor' | 'raw', number>
  );
  logWatchLinks('extract:candidates', {
    candidates: candidates.length,
    providerCount: providers.length,
    sourceCounts,
  });
  const links = assignCandidatesToProviders(candidates, providers);
  const resolvedProviderIds = new Set(Object.keys(links).map((id) => Number(id)));
  const missingProviders = providers
    .filter((provider) => !resolvedProviderIds.has(provider.provider_id))
    .map((provider) => `${provider.provider_id}:${provider.provider_name}`);
  logWatchLinks('extract:result', {
    linksFound: Object.keys(links).length,
    missingProviders,
  });
  return links;
}

async function fetchProviderLinksFromProxy(
  options: ResolveProviderLinksOptions & { locale: string }
): Promise<Record<number, string> | null> {
  const isWebRuntime = typeof window !== 'undefined';
  if (!isWebRuntime) return null;

  try {
    logWatchLinks('proxy:request:start', {
      endpoint: WATCH_LINKS_PROXY_ENDPOINT,
      mediaType: options.mediaType,
      mediaId: options.mediaId,
      locale: options.locale,
      providerCount: options.providers.length,
    });
    const response = await fetch(WATCH_LINKS_PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mediaType: options.mediaType,
        mediaId: options.mediaId,
        locale: options.locale,
        providers: options.providers,
      }),
    });

    logWatchLinks('proxy:request:status', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const links = sanitizeProviderLinks(payload?.links, options.providers);
    logWatchLinks('proxy:request:parsed', {
      linksFound: Object.keys(links).length,
      providerIds: Object.keys(links),
    });
    return links;
  } catch (error) {
    logWatchLinks('proxy:request:error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function sanitizeProviderLinks(
  input: unknown,
  providers: WatchProviderInput[]
): Record<number, string> {
  if (!input || typeof input !== 'object') return {};

  const validProviderIds = new Set(providers.map((provider) => provider.provider_id));
  const links: Record<number, string> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const providerId = Number(key);
    if (!Number.isFinite(providerId) || !validProviderIds.has(providerId)) continue;
    if (typeof value !== 'string' || !isHttpUrl(value)) continue;
    links[providerId] = value;
  }

  return links;
}

function extractProviderLinkCandidates(html: string): ProviderLinkCandidate[] {
  const candidates = [
    ...extractAnchorProviderLinkCandidates(html),
    ...extractRawProviderLinkCandidates(html),
  ];

  if (!candidates.length) return [];

  const mergedByDestination = new Map<string, ProviderLinkCandidate>();
  for (const candidate of candidates) {
    const existing = mergedByDestination.get(candidate.destination);
    if (!existing) {
      mergedByDestination.set(candidate.destination, candidate);
      continue;
    }

    mergedByDestination.set(candidate.destination, {
      destination: candidate.destination,
      source: existing.source === 'anchor' ? 'anchor' : candidate.source,
      nameCandidates: uniq([...existing.nameCandidates, ...candidate.nameCandidates]).filter(Boolean),
      logoCandidates: uniq([...existing.logoCandidates, ...candidate.logoCandidates]).filter(Boolean),
      providerIdCandidates: uniqNumber([
        ...existing.providerIdCandidates,
        ...candidate.providerIdCandidates,
      ]),
    });
  }

  return [...mergedByDestination.values()];
}

function extractAnchorProviderLinkCandidates(html: string): ProviderLinkCandidate[] {
  const candidates: ProviderLinkCandidate[] = [];
  const anchorRegex = /<a\b([^>]*?)href=(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = anchorRegex.exec(html);

  while (match) {
    const href = decodeHtmlEntities(match[3] || '').trim();
    if (!/click\.justwatch\.com/i.test(href)) {
      match = anchorRegex.exec(html);
      continue;
    }

    const destination = extractDestinationFromClickUrl(href);
    if (!destination) {
      match = anchorRegex.exec(html);
      continue;
    }

    const attrs = `${match[1] || ''} ${match[4] || ''}`;
    const inner = match[5] || '';

    const nameCandidates = uniq([
      ...extractAttributeValues(attrs, [
        'title',
        'aria-label',
        'data-original-title',
        'data-provider-name',
        'data-title',
      ]),
      ...extractAttributeValues(inner, [
        'title',
        'aria-label',
        'data-original-title',
        'data-provider-name',
        'data-title',
        'alt',
      ]),
      stripHtmlTags(inner),
    ]).filter(Boolean);

    const logoCandidates = uniq([
      ...extractLogoCandidates(attrs),
      ...extractLogoCandidates(inner),
    ]).filter(Boolean);
    const providerIdCandidates = extractProviderIdsFromContext(`${attrs} ${inner}`);

    candidates.push({
      destination,
      nameCandidates,
      logoCandidates,
      providerIdCandidates,
      source: 'anchor',
    });

    match = anchorRegex.exec(html);
  }

  return candidates;
}

function extractRawProviderLinkCandidates(html: string): ProviderLinkCandidate[] {
  const candidates: ProviderLinkCandidate[] = [];
  const patterns = [
    /https?:\/\/click\.justwatch\.com\/[^\s"'<>\\)]+/gi,
    /https:\\\/\\\/click\.justwatch\.com\\\/[^\s"'<>]+/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(html);
    while (match) {
      const rawUrl = sanitizeRawMatchedUrl(match[0] || '');
      const destination = extractDestinationFromClickUrl(rawUrl);
      if (destination) {
        const context = getContextWindow(html, match.index ?? 0, 460);
        const nameCandidates = uniq([
          ...extractAttributeValues(context, [
            'title',
            'aria-label',
            'data-original-title',
            'data-provider-name',
            'data-title',
            'alt',
          ]),
          ...extractLikelyProviderNameFromContext(context),
        ]).filter(Boolean);
        const logoCandidates = uniq(extractLogoCandidates(context)).filter(Boolean);
        const providerIdCandidates = extractProviderIdsFromContext(context);

        candidates.push({
          destination,
          nameCandidates,
          logoCandidates,
          providerIdCandidates,
          source: 'raw',
        });
      }

      match = pattern.exec(html);
    }
  }

  return candidates;
}

function extractDestinationFromClickUrl(url: string): string | null {
  const href = normalizeWatchUrl(url);
  if (!href) return null;

  try {
    const parsed = new URL(href, 'https://www.themoviedb.org');
    const redirect = parsed.searchParams.get('r');
    if (redirect) {
      const decodedRedirect = decodeRepeated(redirect);
      if (isHttpUrl(decodedRedirect)) return decodedRedirect;
    }
  } catch {
    return null;
  }

  const decodedHref = decodeRepeated(href);
  return isHttpUrl(decodedHref) ? decodedHref : null;
}

function assignCandidatesToProviders(
  candidates: ProviderLinkCandidate[],
  providers: WatchProviderInput[]
): Record<number, string> {
  const links: Record<number, string> = {};
  const providerByLogo = new Map<string, number>();
  const providerIds = new Set(providers.map((provider) => provider.provider_id));

  for (const provider of providers) {
    const logo = extractLogoBasename(provider.logo_path || '');
    if (!logo) continue;
    providerByLogo.set(logo, provider.provider_id);
  }

  for (const candidate of candidates) {
    let providerId: number | null = null;

    for (const numericProviderId of candidate.providerIdCandidates) {
      if (!providerIds.has(numericProviderId) || links[numericProviderId]) continue;
      providerId = numericProviderId;
      break;
    }

    if (providerId === null) {
      for (const logo of candidate.logoCandidates) {
        const matchedProviderId = providerByLogo.get(logo);
        if (!matchedProviderId || links[matchedProviderId]) continue;
        providerId = matchedProviderId;
        break;
      }
    }

    if (providerId === null) {
      let bestMatchProviderId: number | null = null;
      let bestScore = 0;

      for (const provider of providers) {
        if (links[provider.provider_id]) continue;
        const nameScore = getBestNameScore(provider.provider_name, candidate.nameCandidates);
        const domainScore = getDomainScore(provider.provider_name, candidate.destination);
        const combinedScore = Math.max(nameScore, domainScore);
        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestMatchProviderId = provider.provider_id;
        }
      }

      if (bestMatchProviderId !== null && bestScore >= 0.45) {
        providerId = bestMatchProviderId;
      }
    }

    if (providerId !== null) {
      links[providerId] = candidate.destination;
    }
  }

  return links;
}

function getBestNameScore(providerName: string, candidateNames: string[]): number {
  const normalizedProvider = normalizeName(providerName);
  if (!normalizedProvider || !candidateNames.length) return 0;

  let best = 0;
  for (const candidateName of candidateNames) {
    const normalizedCandidate = normalizeName(candidateName);
    if (!normalizedCandidate) continue;
    const score = compareNames(normalizedProvider, normalizedCandidate);
    if (score > best) best = score;
  }
  return best;
}

function compareNames(left: string, right: string): number {
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.92;

  const leftTokens = tokenizeName(left);
  const rightTokens = tokenizeName(right);
  if (!leftTokens.length || !rightTokens.length) return 0;

  let overlap = 0;
  const rightSet = new Set(rightTokens);
  for (const token of leftTokens) {
    if (rightSet.has(token)) overlap += 1;
  }

  return overlap / Math.max(leftTokens.length, rightTokens.length);
}

function tokenizeName(name: string): string[] {
  return name
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractAttributeValues(input: string, attributes: string[]): string[] {
  const pattern = new RegExp(`(?:${attributes.join('|')})\\s*=\\s*(['"])(.*?)\\1`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null = pattern.exec(input);

  while (match) {
    const value = decodeHtmlEntities(match[2] || '').trim();
    if (value) values.push(value);
    match = pattern.exec(input);
  }

  return values;
}

function extractLogoCandidates(input: string): string[] {
  const srcValues = extractAttributeValues(input, [
    'src',
    'data-src',
    'data-original',
    'data-lazy-src',
    'data-image',
  ]);

  return srcValues
    .map((value) => extractLogoBasename(value))
    .filter((value): value is string => Boolean(value));
}

function extractLogoBasename(value: string): string | null {
  const decoded = decodeHtmlEntities(value).trim();
  if (!decoded) return null;

  try {
    const parsed = new URL(decoded, 'https://www.themoviedb.org');
    const path = parsed.pathname || '';
    const filename = path.split('/').filter(Boolean).pop();
    return filename ? filename.toLowerCase() : null;
  } catch {
    const cleaned = decoded.split('?')[0].split('#')[0];
    const filename = cleaned.split('/').filter(Boolean).pop();
    return filename ? filename.toLowerCase() : null;
  }
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeRepeated(value: string): string {
  let output = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(output);
      if (decoded === output) break;
      output = decoded;
    } catch {
      break;
    }
  }
  return output;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqNumber(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function sanitizeRawMatchedUrl(value: string): string {
  return normalizeWatchUrl(value).replace(/[),.;]+$/, '');
}

function normalizeWatchUrl(value: string): string {
  return decodeRepeated(
    decodeHtmlEntities(value)
      .replace(/\\u002F/gi, '/')
      .replace(/\\u003D/gi, '=')
      .replace(/\\u003F/gi, '?')
      .replace(/\\u0026/gi, '&')
      .replace(/\\u0025/gi, '%')
      .replace(/\\\//g, '/')
      .trim()
  );
}

function getContextWindow(input: string, index: number, radius: number): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(input.length, index + radius);
  return input.slice(start, end);
}

function extractLikelyProviderNameFromContext(context: string): string[] {
  const values: string[] = [];
  const patterns = [
    /provider_name["']?\s*[:=]\s*["']([^"']+)["']/gi,
    /provider["']?\s*[:=]\s*["']([^"']+)["']/gi,
    /name["']?\s*[:=]\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(context);
    while (match) {
      const value = decodeHtmlEntities(match[1] || '').trim();
      if (value) values.push(value);
      match = pattern.exec(context);
    }
  }

  return values;
}

function extractProviderIdsFromContext(context: string): number[] {
  const values: number[] = [];
  const patterns = [
    /(?:provider_id|provider-id|providerId|tmdb_provider_id|tmdbProviderId|tmdb-id|tmdbId|provider)["']?\s*[:=]\s*["']?(\d{1,6})["']?/gi,
    /data-(?:provider-id|provider_id|tmdb-id|tmdb_id)\s*=\s*["'](\d{1,6})["']/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(context);
    while (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) values.push(parsed);
      match = pattern.exec(context);
    }
  }

  return uniqNumber(values);
}

function getDomainScore(providerName: string, destinationUrl: string): number {
  const signature = normalizeName(getUrlSignature(destinationUrl));
  if (!signature) return 0;

  const aliases = getProviderAliases(providerName);
  let bestScore = 0;
  for (const alias of aliases) {
    const normalizedAlias = normalizeName(alias);
    if (!normalizedAlias) continue;
    if (signature.includes(normalizedAlias)) return 1;

    const aliasNoSpace = normalizedAlias.replace(/\s+/g, '');
    const signatureNoSpace = signature.replace(/\s+/g, '');
    if (aliasNoSpace && signatureNoSpace.includes(aliasNoSpace)) return 0.92;

    const overlapScore = compareNames(normalizedAlias, signature);
    if (overlapScore > bestScore) bestScore = overlapScore;
  }

  return bestScore;
}

function getUrlSignature(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname} ${parsed.pathname} ${parsed.search}`;
  } catch {
    return url;
  }
}

function getProviderAliases(providerName: string): string[] {
  const normalized = normalizeName(providerName);
  const aliases = new Set<string>([normalized, ...tokenizeName(normalized)]);

  if (normalized.includes('prime')) {
    aliases.add('amazon');
    aliases.add('prime video');
    aliases.add('primevideo');
  }
  if (normalized.includes('disney')) {
    aliases.add('disneyplus');
    aliases.add('disney plus');
  }
  if (normalized.includes('apple')) {
    aliases.add('apple tv');
    aliases.add('tv apple');
  }
  if (normalized.includes('hbo') || normalized.includes('max')) {
    aliases.add('hbomax');
    aliases.add('max');
    aliases.add('hbo');
  }
  if (normalized.includes('netflix')) {
    aliases.add('netflix');
  }
  if (normalized.includes('rakuten')) {
    aliases.add('rakuten');
  }
  if (normalized.includes('filmin')) {
    aliases.add('filmin');
  }
  if (normalized.includes('movistar')) {
    aliases.add('movistar');
  }

  return [...aliases].filter(Boolean);
}
