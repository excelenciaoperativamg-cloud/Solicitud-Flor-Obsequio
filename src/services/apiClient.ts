import { SolicitudFlor, TrabajadorMaestro } from '../types';

export interface DriveConfig {
  webhookUrl: string;
  spreadsheetUrl: string;
  syncEnabled: boolean;
  lastUpdated?: string;
}

export const fetchSolicitudesApi = async (): Promise<SolicitudFlor[]> => {
  try {
    const res = await fetch('/api/solicitudes');
    if (!res.ok) throw new Error('Error al consultar solicitudes');
    const data = await res.json();
    return data.solicitudes || [];
  } catch (error) {
    console.warn('Usando respaldo local para solicitudes:', error);
    const saved = localStorage.getItem('sfo_solicitudes_v2');
    return saved ? JSON.parse(saved) : [];
  }
};

export const createSolicitudApi = async (solicitud: SolicitudFlor): Promise<SolicitudFlor> => {
  try {
    const res = await fetch('/api/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitud),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al guardar en el servidor');
    }
    const data = await res.json();
    return data.solicitud;
  } catch (error: any) {
    console.warn('Error en API al registrar solicitud, guardando localmente:', error);
    // Retornar la solicitud con marca local
    return {
      ...solicitud,
      syncedToDrive: false,
    };
  }
};

export const fetchMaestroApi = async (): Promise<TrabajadorMaestro[]> => {
  try {
    const res = await fetch('/api/maestro');
    if (!res.ok) throw new Error('Error al consultar maestro');
    const data = await res.json();
    return data.maestro || [];
  } catch (error) {
    console.warn('Usando respaldo local para maestro:', error);
    const saved = localStorage.getItem('sfo_maestro_v2');
    return saved ? JSON.parse(saved) : [];
  }
};

export const addTrabajadorApi = async (trabajador: TrabajadorMaestro): Promise<TrabajadorMaestro[]> => {
  try {
    const res = await fetch('/api/maestro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trabajador),
    });
    if (!res.ok) throw new Error('Error al registrar trabajador en el servidor');
    const data = await res.json();
    return data.maestro;
  } catch (error) {
    console.warn('Aviso guardando trabajador localmente:', error);
    return [];
  }
};

export const getDriveConfigApi = async (): Promise<DriveConfig> => {
  try {
    const res = await fetch('/api/drive-config');
    if (!res.ok) throw new Error('Error al consultar configuración de Drive');
    const data = await res.json();
    return data.config || { webhookUrl: '', spreadsheetUrl: '', syncEnabled: true };
  } catch {
    return { webhookUrl: '', spreadsheetUrl: '', syncEnabled: true };
  }
};

export const updateDriveConfigApi = async (config: { webhookUrl: string; spreadsheetUrl?: string }): Promise<DriveConfig> => {
  const res = await fetch('/api/drive-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  return data.config;
};

export const testDriveWebhookApi = async (): Promise<{ success: boolean; error?: string; response?: string }> => {
  try {
    const res = await fetch('/api/drive-test', { method: 'POST' });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const syncMaestroFromDriveApi = async (): Promise<{ success: boolean; count?: number; maestro?: TrabajadorMaestro[]; error?: string }> => {
  try {
    const res = await fetch('/api/maestro/sync-from-drive', { method: 'POST' });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
