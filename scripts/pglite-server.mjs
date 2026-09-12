// Zero-install local Postgres for development.
// Runs an in-process PGlite database and exposes it on the standard Postgres
// wire protocol at 127.0.0.1:5432 so Prisma (and the API) connect normally.
//
// Data is persisted to ./.pglite so it survives restarts.
// Start with: npm run dev:db
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const HOST = '127.0.0.1';
const PORT = 5432;

const db = await PGlite.create('./.pglite');
const server = new PGLiteSocketServer({ db, host: HOST, port: PORT });

server.addEventListener('listening', () => {
  console.log(`PGlite listening on postgres://${HOST}:${PORT} (persisted to ./.pglite)`);
});
server.addEventListener('error', (event) => {
  console.error('PGlite socket error:', event.detail ?? event);
});

await server.start();

const shutdown = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
