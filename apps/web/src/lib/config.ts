function sanitizeUrl(raw?: string, fallback = 'http://localhost:4000'): string {
  if (!raw) return fallback;
  // Extract the first valid http/https URL if markdown syntax or stray brackets exist (e.g. `url](url`)
  const match = raw.match(/https?:\/\/[^\s\]\)\"\'\,]+/);
  if (match) {
    return match[0].replace(/\/+$/, '');
  }
  return raw.trim().replace(/\/+$/, '');
}

const cleanApi = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000');
const cleanWs = sanitizeUrl(process.env.NEXT_PUBLIC_WS_URL, 'http://localhost:4000');

export const config = {
  apiUrl: cleanApi,
  wsUrl: cleanWs,
  apiBase: `${cleanApi}/api/v1`,
};
