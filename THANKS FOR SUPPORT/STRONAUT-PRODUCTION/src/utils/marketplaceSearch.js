import * as cheerio from 'cheerio';

const MARKETPLACE_HOST = 'marketplace.cfx.re';
const DDG_HTML_ENDPOINT = 'https://html.duckduckgo.com/html/';

// Kategori resmi yang ada di marketplace.cfx.re/discover/<slug>
export const CATEGORIES = {
  scripts: 'Scripts',
  maps: 'Maps',
  character: 'Character',
  clothing: 'Clothing',
  vehicles: 'Vehicles',
  misc: 'Misc',
};

export class MarketplaceSearchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MarketplaceSearchError';
  }
}

/**
 * Cari item di Cfx Marketplace lewat DuckDuckGo "site:" search.
 * Ini BUKAN scraping marketplace.cfx.re langsung — cuma memanfaatkan hasil
 * indexing search engine, jadi jauh lebih ringan & stabil dibanding headless browser.
 *
 * @param {string} query - kata kunci pencarian, mis. "esx inventory", "lowrider", "free clothing"
 * @param {string|null} category - salah satu key di CATEGORIES, atau null untuk semua kategori
 * @param {boolean} freeOnly - kalau true, tambahkan kata "free" ke query
 * @returns {Promise<{title:string, url:string, snippet:string}[]>}
 */
export async function searchMarketplace(query, category = null, freeOnly = false) {
  if (!query || !query.trim()) {
    throw new MarketplaceSearchError('Kata kunci pencarian tidak boleh kosong.');
  }

  const sitePath = category ? `${MARKETPLACE_HOST}/discover/${category}` : MARKETPLACE_HOST;
  const parts = [query.trim(), `site:${sitePath}`];
  if (freeOnly) parts.push('free');
  const q = parts.join(' ');

  let res;
  try {
    res = await fetch(`${DDG_HTML_ENDPOINT}?q=${encodeURIComponent(q)}`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html',
      },
    });
  } catch (err) {
    throw new MarketplaceSearchError(`Gagal menghubungi search engine: ${err.message}`);
  }

  if (!res.ok) {
    throw new MarketplaceSearchError(`Search engine mengembalikan status ${res.status}.`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.result').each((_, el) => {
    const anchor = $(el).find('a.result__a').first();
    if (!anchor.length) return;

    const title = anchor.text().trim();
    const rawHref = anchor.attr('href') || '';
    const url = resolveDdgUrl(rawHref);
    const snippet = $(el).find('.result__snippet').first().text().trim();

    if (title && url && url.includes(MARKETPLACE_HOST)) {
      results.push({ title, url, snippet });
    }
  });

  return results.slice(0, 5);
}

// DuckDuckGo HTML membungkus link asli di parameter "uddg" pada redirect URL-nya.
function resolveDdgUrl(href) {
  if (!href) return null;
  try {
    const full = href.startsWith('//') ? `https:${href}` : href;
    const parsed = new URL(full, 'https://duckduckgo.com');
    const real = parsed.searchParams.get('uddg');
    return real ? decodeURIComponent(real) : full;
  } catch {
    return null;
  }
}

/**
 * Bangun link "cari manual" langsung ke marketplace, sudah ter-filter
 * kategori & search query, sebagai fallback/pelengkap hasil search engine.
 */
export function buildDirectSearchUrl(query, category = null) {
  const base = category
    ? `https://marketplace.cfx.re/discover/${category}`
    : 'https://marketplace.cfx.re/discover';
  const url = new URL(base);
  if (query) url.searchParams.set('search', query);
  return url.toString();
}
