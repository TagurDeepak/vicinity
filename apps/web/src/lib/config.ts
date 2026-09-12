export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000',
  apiBase: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1`,
};
