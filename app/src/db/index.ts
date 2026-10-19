import * as SQLite from 'expo-sqlite';

import { MIGRATIONS, type Route, type Stop } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** Abre (uma vez) o banco local e aplica migrações. Dados nunca saem do aparelho. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('roteirizador.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function getOrCreateActiveRoute(): Promise<Route> {
  const db = await getDb();
  const existing = await db.getFirstAsync<Route>(
    "SELECT * FROM routes WHERE status = 'active' ORDER BY id DESC LIMIT 1",
  );
  if (existing) return existing;
  const res = await db.runAsync("INSERT INTO routes (status) VALUES ('active')");
  const created = await db.getFirstAsync<Route>('SELECT * FROM routes WHERE id = ?', res.lastInsertRowId);
  return created!;
}

export async function listStops(routeId: number): Promise<Stop[]> {
  const db = await getDb();
  return db.getAllAsync<Stop>(
    // Pendentes primeiro, na ordem otimizada; entregues/ausentes no fim.
    "SELECT * FROM stops WHERE route_id = ? ORDER BY (status <> 'pending'), COALESCE(seq, 1000000), label_number",
    routeId,
  );
}

export async function addStop(
  routeId: number,
  input: { raw_text?: string; address?: string; lat?: number; lng?: number; barcode?: string },
): Promise<number> {
  const db = await getDb();
  const next = await db.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(MAX(label_number), 0) + 1 AS n FROM stops WHERE route_id = ?',
    routeId,
  );
  const res = await db.runAsync(
    'INSERT INTO stops (route_id, label_number, raw_text, address, lat, lng, barcode) VALUES (?, ?, ?, ?, ?, ?, ?)',
    routeId,
    next?.n ?? 1,
    input.raw_text ?? null,
    input.address ?? null,
    input.lat ?? null,
    input.lng ?? null,
    input.barcode ?? null,
  );
  return res.lastInsertRowId;
}

export async function setStopStatus(stopId: number, status: Stop['status']) {
  const db = await getDb();
  await db.runAsync('UPDATE stops SET status = ? WHERE id = ?', status, stopId);
}

export async function finishRoute(routeId: number) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE routes SET status = 'finished', finished_at = datetime('now') WHERE id = ?",
    routeId,
  );
  await purgeFinishedRoutes();
}

/**
 * LGPD: apaga as paradas (dados do destinatário) de todas as rotas finalizadas.
 * Mantém apenas a linha em `routes` (sem dado pessoal). Chamar ao finalizar a
 * rota e também na abertura do app (caso o app tenha sido fechado antes).
 */
export async function purgeFinishedRoutes(): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    "DELETE FROM stops WHERE route_id IN (SELECT id FROM routes WHERE status = 'finished')",
  );
  return res.changes;
}

/**
 * Grava a ordem (seq) e a previsão (eta, "HH:MM") das paradas numa única transação.
 * `items` já vem na ordem de visita.
 */
export async function applyOptimization(routeId: number, items: { stopId: number; eta: string }[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Limpa a ordem anterior das pendentes (inclui as que ficaram fora da rota).
    await db.runAsync("UPDATE stops SET seq = NULL, eta = NULL WHERE route_id = ? AND status = 'pending'", routeId);
    for (let i = 0; i < items.length; i++) {
      await db.runAsync('UPDATE stops SET seq = ?, eta = ? WHERE id = ?', i + 1, items[i].eta, items[i].stopId);
    }
  });
}
