/**
 * Cliente do backend de otimização (VROOM + OSRM). Formato VROOM:
 * https://github.com/VROOM-Project/vroom/blob/master/docs/API.md
 * O backend NÃO recebe endereço nem dados do destinatário: apenas coordenadas.
 */
export type Coord = [lng: number, lat: number]; // VROOM usa [lon, lat]

export interface VroomVehicle {
  id: number;
  profile?: string; // "car" por padrão
  start?: Coord;
  end?: Coord;
  /** Segundos desde 00:00 locais ou epoch, conforme usado nas janelas de tempo. */
  time_window?: [number, number];
}

export interface VroomJob {
  id: number; // use o id da parada
  location: Coord;
  service?: number; // segundos parados na entrega
  time_windows?: [number, number][];
}

export interface VroomRequest {
  vehicles: VroomVehicle[];
  jobs: VroomJob[];
  options?: { g?: boolean };
}

export interface VroomStep {
  type: 'start' | 'job' | 'end';
  id?: number;
  location?: Coord;
  arrival: number;
  duration: number;
  distance?: number;
}

export interface VroomRoute {
  vehicle: number;
  steps: VroomStep[];
  duration: number;
  distance?: number;
}

export interface VroomResponse {
  code: number;
  error?: string;
  summary: { cost: number; unassigned: number; duration: number; distance?: number };
  unassigned: { id: number; location?: Coord }[];
  routes: VroomRoute[];
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function optimize(request: VroomRequest, signal?: AbortSignal): Promise<VroomResponse> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL não configurada (veja app/.env.example).');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Falha na otimização (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as VroomResponse;
  if (data.code !== 0) {
    throw new Error(data.error ?? `Erro do otimizador (code ${data.code}).`);
  }
  return data;
}
