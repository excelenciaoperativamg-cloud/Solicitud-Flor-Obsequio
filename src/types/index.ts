export type Sede = 'Sede MG' | 'Sede HA' | 'Sede SC';

export type FlowerType = 'Rosa' | 'Clavel' | 'Alstroemeria';

export type ProductType = 'ramo' | 'bouquet';

export type SolicitudEstado = 'Registrada' | 'Aprobada' | 'Entregada' | 'Cancelada';

export interface SolicitudFlor {
  id: string; // e.g. SFO-2026-001
  fecha: string; // YYYY-MM-DD (fecha de registro)
  semana: string; // e.g. "Semana 46"
  codigo: string; // Código de trabajador
  nombre: string; // Nombre del trabajador
  producto: string; // e.g. "Ramo de Rosa (Rojo) (1 unidad)" o "Bouquet de Rosas (1 unidad)"
  tipoProducto: ProductType; // 'ramo' | 'bouquet'
  florPrincipal: FlowerType; // 'Rosa' | 'Clavel' | 'Alstroemeria'
  opcionFlor?: string; // 'Rojo' | 'Color' | 'Según color disponible'
  sede: Sede; // 'Sede MG' | 'Sede HA' | 'Sede SC' (proveniente del Maestro)
  motivo: string;
  fechaEntrega: string; // YYYY-MM-DD (fecha del viernes de entrega)
  remitente: string;
  estado: SolicitudEstado;
  syncedToDrive?: boolean;
  driveSpreadsheetId?: string;
  driveRowIndex?: number;
  creadoEn: number;
}

export interface TrabajadorMaestro {
  codigo: string;
  nombre: string;
  sede: Sede;
  cargo?: string;
  area?: string;
  activo: boolean;
}

export interface CupoConfig {
  sede: Sede;
  ramosMax: number;
  bouquetsMax?: number; // Para Sede MG es 5
}

export interface ResumenCuposSede {
  sede: Sede;
  fechaViernes: string;
  ramosMax: number;
  ramosUsados: number;
  ramosDisponibles: number;
  bouquetsMax?: number;
  bouquetsUsados?: number;
  bouquetsDisponibles?: number;
}
