// Zero-install, no-admin local Postgres for development.
// Runs a REAL PostgreSQL server in userland via embedded-postgres, so Prisma
// and the API connect over the genuine wire protocol.
//
// Data persists in ./.pgdata. Start with: npm run dev:db
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const DATA_DIR = './.pgdata';
const PORT = 5432;

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
});

// initialise() sets up the data directory; only do it the first time.
if (!existsSync(DATA_DIR)) {
  console.log('Initialising Postgres data directory…');
  await pg.initialise();
}

await pg.start();
console.log(`Postgres running on 127.0.0.1:${PORT} (data in ${DATA_DIR})`);

// Ensure a UTF8 app database exists (idempotent). The cluster default locale on
// Windows is WIN1252, so we force UTF8 via template0 to support emoji etc.
const client = pg.getPgClient();
await client.connect();
try {
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    'vicinity',
  ]);
  if (rowCount === 0) {
    await client.query(
      "CREATE DATABASE vicinity WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'",
    );
    console.log('Created UTF8 database "vicinity".');
  } else {
    console.log('Database "vicinity" already exists.');
  }
} finally {
  await client.end();
}

const shutdown = async () => {
  console.log('Stopping Postgres…');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
