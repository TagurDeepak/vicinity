const rawApi = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const cleanApi = rawApi.replace(/\/+$/, '');
const rawWs = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
const cleanWs = rawWs.replace(/\/+$/, '');

export const config = {
  apiUrl: cleanApi,
  wsUrl: cleanWs,
  apiBase: `${cleanApi}/api/v1`,
};
