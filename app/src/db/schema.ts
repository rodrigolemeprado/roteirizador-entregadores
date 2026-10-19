export type RouteStatus = 'active' | 'finished';
export type StopStatus = 'pending' | 'delivered' | 'absent';

export interface Route {
  id: number;
  created_at: string;
  status: RouteStatus;
  started_at: string | null;
  finished_at: string | null;
}

export interface Stop {
  id: number;
  route_id: number;
  seq: number | null;
  label_number: number;
  raw_text: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: StopStatus;
  barcode: string | null;
  eta: string | null;
  created_at: string;
}

export const SCHEMA_VERSION = 1;

/** Migrações incrementais; índice 0 leva da versão 0 para 1. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
    started_at TEXT,
    finished_at TEXT
  );
  CREATE TABLE stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    seq INTEGER,
    label_number INTEGER NOT NULL,
    raw_text TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','absent')),
    barcode TEXT,
    eta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_stops_route ON stops(route_id, seq);
  CREATE INDEX idx_stops_barcode ON stops(barcode);
  `,
];
