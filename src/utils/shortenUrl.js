const SPOO_API = "https://spoo.me/api/v1/shorten";
const API_KEY = import.meta.env.VITE_SPOO_API_KEY;
const CACHE_PREFIX = "spoo_cache_";

/**
 * Mempersingkat URL menggunakan Spoo.me API v1 dengan sistem caching.
 * @param {string} longUrl - URL lengkap yang ingin dipersingkat.
 * @param {object} options - Opsi tambahan (opsional).
 * @returns {Promise<string>} URL pendek dari Spoo.me atau URL asli jika gagal.
 */
export async function shortenUrl(longUrl, options = {}) {
  // 1. Check Cache
  const cacheKey = CACHE_PREFIX + btoa(longUrl);
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  try {
    const body = {
      long_url: longUrl,
      ...(options.alias && { alias: options.alias }),
      ...(options.maxClicks && { max_clicks: options.maxClicks }),
      ...(options.expireAfter && { expire_after: options.expireAfter }),
      block_bots: true,
    };

    const response = await fetch(SPOO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(API_KEY && { "Authorization": `Bearer ${API_KEY}` }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || `Spoo.me error: ${response.status}`);
    }

    const data = await response.json();
    
    // 2. Save to Cache
    if (data.short_url) {
      localStorage.setItem(cacheKey, data.short_url);
      return data.short_url;
    }
    
    return longUrl;
  } catch (err) {
    console.error("ShortenUrl Error:", err);
    // Fallback ke URL asli jika terjadi error (rate limit, network, dsb)
    return longUrl;
  }
}
