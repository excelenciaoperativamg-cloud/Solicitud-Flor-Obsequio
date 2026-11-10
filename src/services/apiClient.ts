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
    if (!data.solicitud?.syncedToDrive) {
      throw new Error('La solicitud no quedó registrada en la hoja Solicitudes.');
    }
    return data.solicitud;
  } catch (error: any) {
    throw error instanceof Error ? error : new Error('Error al guardar la solicitud');
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

export const testDriveWebhookApi = async (webhookUrl?: string): Promise<{ success: boolean; error?: string; response?: string }> => {
  try {
    const res = await fetch('/api/drive-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        error: text.length > 250 ? `Error del servidor HTTP ${res.status}` : text || `Error HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const syncMaestroFromDriveApi = async (): Promise<{ success: boolean; count?: number; maestro?: TrabajadorMaestro[]; error?: string }> => {
  try {
    const res = await fetch('/api/maestro/sync-from-drive', { method: 'POST' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: text || `Error HTTP ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
