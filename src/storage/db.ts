import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";
import type { RawJob } from "../types.js";

/**
 * Camada de persistência: guarda o ID de toda vaga já vista, pra você
 * nunca receber a mesma vaga duas vezes no Telegram.
 *
 * Usa o SQLite NATIVO do Node (node:sqlite, Node 22.5+) — sem dependência
 * nativa pra compilar, o que deixa o deploy na VPS bem mais tranquilo.
 */

// Garante que a pasta do banco existe.
const dir = dirname(config.dbPath);
if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(config.dbPath);
// WAL em disco local; DELETE quando o banco está num file share de rede (Azure
// Files), pois WAL não funciona sobre SMB. Controlado por SQLITE_JOURNAL_MODE.
db.exec(`PRAGMA journal_mode = ${config.sqliteJournalMode}`);

db.exec(`
  CREATE TABLE IF NOT EXISTS seen_jobs (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    company     TEXT,
    location    TEXT,
    url         TEXT,
    notified    INTEGER DEFAULT 0,
    first_seen  TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const stmtExists = db.prepare("SELECT 1 FROM seen_jobs WHERE id = ?");
const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO seen_jobs (id, title, company, location, url, notified)
  VALUES (@id, @title, @company, @location, @url, 1)
`);
const stmtCount = db.prepare("SELECT COUNT(*) AS n FROM seen_jobs");

/** Já vimos essa vaga antes? */
export function hasSeen(id: string): boolean {
  return stmtExists.get(id) !== undefined;
}

/** Marca a vaga como vista + notificada. */
export function markNotified(job: RawJob): void {
  stmtInsert.run({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
  });
}

/** Total de vagas já registradas (só pra estatística/log). */
export function totalSeen(): number {
  const row = stmtCount.get() as { n: number };
  return row.n;
}

export function closeDb(): void {
  db.close();
}
