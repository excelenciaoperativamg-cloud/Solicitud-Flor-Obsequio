import {
  SolicitudFlor,
  SolicitudIntExt,
  EspecialPersonal,
  SolicitudComunidad,
  TrabajadorMaestro,
} from '../types';

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

export interface EmailNotificationResult {
  requested: boolean;
  sent: boolean;
  to: string;
  senderEmail?: string;
  quotaRemaining?: number;
  error?: string;
  needsAppsScriptUpdate?: boolean;
}

export const fetchSolicitudesIntExtApi = async (): Promise<{
  solicitudes: SolicitudIntExt[];
  sheetsSupported: boolean;
  supportsEmailNotification?: boolean;
  source: string;
  intExtSheetName?: string;
  needsAppsScriptSheetUpdate?: boolean;
}> => {
  try {
    const res = await fetch('/api/solicitudes-int-ext');
    if (!res.ok) throw new Error('Error al consultar Especiales Empresa');
    const data = await res.json();
    return {
      solicitudes: data.solicitudes || [],
      sheetsSupported: !!data.sheetsSupported,
      supportsEmailNotification: !!data.supportsEmailNotification,
      source: data.source || 'local',
      intExtSheetName: data.intExtSheetName || '',
      needsAppsScriptSheetUpdate: !!data.needsAppsScriptSheetUpdate,
    };
  } catch (error) {
    console.warn('Error consultando Especiales Empresa:', error);
    return {
      solicitudes: [],
      sheetsSupported: false,
      supportsEmailNotification: false,
      source: 'error',
      intExtSheetName: '',
      needsAppsScriptSheetUpdate: false,
    };
  }
};

export const createSolicitudIntExtApi = async (
  solicitudOrList: SolicitudIntExt | SolicitudIntExt[],
  correoNotificacion?: string
): Promise<{
  solicitud: SolicitudIntExt;
  solicitudes: SolicitudIntExt[];
  pendingAppsScriptUpdate?: boolean;
  supportsEmailNotification?: boolean;
  intExtSheetName?: string;
  needsAppsScriptSheetUpdate?: boolean;
  emailNotification?: EmailNotificationResult;
}> => {
  const payload = Array.isArray(solicitudOrList)
    ? { items: solicitudOrList, correoNotificacion: correoNotificacion || '' }
    : { ...solicitudOrList, correoNotificacion: correoNotificacion || '' };

  const res = await fetch('/api/solicitudes-int-ext', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al guardar en Especiales Empresa');
  }
  const data = await res.json();
  const solicitudes: SolicitudIntExt[] = Array.isArray(data.solicitudes)
    ? data.solicitudes
    : data.solicitud
    ? [data.solicitud]
    : [];
  return {
    solicitud: data.solicitud || solicitudes[0],
    solicitudes,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
    supportsEmailNotification: !!data.supportsEmailNotification,
    intExtSheetName: data.intExtSheetName || '',
    needsAppsScriptSheetUpdate: !!data.needsAppsScriptSheetUpdate,
    emailNotification: data.emailNotification,
  };
};

export const retryEmailIntExtApi = async (
  items: SolicitudIntExt[],
  correoNotificacion: string
): Promise<EmailNotificationResult> => {
  const res = await fetch('/api/solicitudes-int-ext', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'notificar',
      items,
      correoNotificacion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data?.emailNotification) return data.emailNotification;
  return {
    requested: true,
    sent: false,
    to: correoNotificacion,
    error: data?.error || 'No se pudo reintentar el envío de correo.',
  };
};

export const fetchEspecialesPersonalApi = async (): Promise<{
  solicitudes: EspecialPersonal[];
  sheetsSupported: boolean;
  supportsEmailNotification?: boolean;
  source: string;
  especialesPersonalSheetName?: string;
  needsAppsScriptUpdate?: boolean;
}> => {
  try {
    const res = await fetch('/api/especiales-personal');
    if (!res.ok) throw new Error('Error al consultar Especiales Personal');
    const data = await res.json();
    return {
      solicitudes: data.solicitudes || [],
      sheetsSupported: !!data.sheetsSupported,
      supportsEmailNotification: !!data.supportsEmailNotification,
      source: data.source || 'local',
      especialesPersonalSheetName: data.especialesPersonalSheetName || '',
      needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    };
  } catch (error) {
    console.warn('Error consultando Especiales Personal:', error);
    return {
      solicitudes: [],
      sheetsSupported: false,
      supportsEmailNotification: false,
      source: 'error',
      especialesPersonalSheetName: '',
      needsAppsScriptUpdate: true,
    };
  }
};

export const createEspecialesPersonalApi = async (
  solicitudOrList: EspecialPersonal | EspecialPersonal[],
  correoNotificacion?: string,
  fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
): Promise<{
  solicitud: EspecialPersonal;
  solicitudes: EspecialPersonal[];
  pendingAppsScriptUpdate?: boolean;
  supportsEmailNotification?: boolean;
  especialesPersonalSheetName?: string;
  needsAppsScriptUpdate?: boolean;
  fotoCartaDriveError?: string;
  emailNotification?: EmailNotificationResult;
}> => {
  const basePayload = Array.isArray(solicitudOrList)
    ? { items: solicitudOrList, correoNotificacion: correoNotificacion || '' }
    : { ...solicitudOrList, correoNotificacion: correoNotificacion || '' };

  const payload = fotoCarta
    ? {
        ...basePayload,
        fotoCartaBase64: fotoCarta.base64,
        fotoCartaMime: fotoCarta.mimeType,
        fotoCartaNombre: fotoCarta.fileName,
      }
    : basePayload;

  const res = await fetch('/api/especiales-personal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al guardar en Especiales Personal');
  }
  const data = await res.json();
  const solicitudes: EspecialPersonal[] = Array.isArray(data.solicitudes)
    ? data.solicitudes
    : data.solicitud
    ? [data.solicitud]
    : [];
  return {
    solicitud: data.solicitud || solicitudes[0],
    solicitudes,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
    supportsEmailNotification: !!data.supportsEmailNotification,
    especialesPersonalSheetName: data.especialesPersonalSheetName || '',
    needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    fotoCartaDriveError: data.fotoCartaDriveError || '',
    emailNotification: data.emailNotification,
  };
};

export const retryEmailEspecialesPersonalApi = async (
  items: EspecialPersonal[],
  correoNotificacion: string
): Promise<EmailNotificationResult> => {
  const res = await fetch('/api/especiales-personal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'notificar',
      items,
      correoNotificacion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data?.emailNotification) return data.emailNotification;
  return {
    requested: true,
    sent: false,
    to: correoNotificacion,
    error: data?.error || 'No se pudo reintentar el envío de correo.',
  };
};

export const fetchSolicitudComunidadApi = async (): Promise<{
  solicitudes: SolicitudComunidad[];
  sheetsSupported: boolean;
  supportsEmailNotification?: boolean;
  source: string;
  solicitudComunidadSheetName?: string;
  needsAppsScriptUpdate?: boolean;
}> => {
  try {
    const res = await fetch('/api/solicitud-comunidad');
    if (!res.ok) throw new Error('Error al consultar Solicitud Comunidad');
    const data = await res.json();
    return {
      solicitudes: data.solicitudes || [],
      sheetsSupported: !!data.sheetsSupported,
      supportsEmailNotification: !!data.supportsEmailNotification,
      source: data.source || 'local',
      solicitudComunidadSheetName: data.solicitudComunidadSheetName || '',
      needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    };
  } catch (error) {
    console.warn('Error consultando Solicitud Comunidad:', error);
    return {
      solicitudes: [],
      sheetsSupported: false,
      supportsEmailNotification: false,
      source: 'error',
      solicitudComunidadSheetName: '',
      needsAppsScriptUpdate: true,
    };
  }
};

export const createSolicitudComunidadApi = async (
  solicitudOrList: SolicitudComunidad | SolicitudComunidad[],
  correoNotificacion?: string,
  fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
): Promise<{
  solicitud: SolicitudComunidad;
  solicitudes: SolicitudComunidad[];
  pendingAppsScriptUpdate?: boolean;
  supportsEmailNotification?: boolean;
  solicitudComunidadSheetName?: string;
  needsAppsScriptUpdate?: boolean;
  fotoCartaDriveError?: string;
  emailNotification?: EmailNotificationResult;
}> => {
  const basePayload = Array.isArray(solicitudOrList)
    ? { items: solicitudOrList, correoNotificacion: correoNotificacion || '' }
    : { ...solicitudOrList, correoNotificacion: correoNotificacion || '' };

  const payload = fotoCarta
    ? {
        ...basePayload,
        fotoCartaBase64: fotoCarta.base64,
        fotoCartaMime: fotoCarta.mimeType,
        fotoCartaNombre: fotoCarta.fileName,
      }
    : basePayload;

  const res = await fetch('/api/solicitud-comunidad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al guardar en Solicitud Comunidad');
  }
  const data = await res.json();
  const solicitudes: SolicitudComunidad[] = Array.isArray(data.solicitudes)
    ? data.solicitudes
    : data.solicitud
    ? [data.solicitud]
    : [];
  return {
    solicitud: data.solicitud || solicitudes[0],
    solicitudes,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
    supportsEmailNotification: !!data.supportsEmailNotification,
    solicitudComunidadSheetName: data.solicitudComunidadSheetName || '',
    needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    fotoCartaDriveError: data.fotoCartaDriveError || '',
    emailNotification: data.emailNotification,
  };
};

export const retryEmailSolicitudComunidadApi = async (
  items: SolicitudComunidad[],
  correoNotificacion: string
): Promise<EmailNotificationResult> => {
  const res = await fetch('/api/solicitud-comunidad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'notificar',
      items,
      correoNotificacion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data?.emailNotification) return data.emailNotification;
  return {
    requested: true,
    sent: false,
    to: correoNotificacion,
    error: data?.error || 'No se pudo reintentar el envío de correo.',
  };
};

const isValidWorkerClient = (w: any): w is TrabajadorMaestro => {
  if (!w || typeof w !== 'object') return false;
  const codigo = String(w.codigo || '').trim();
  const nombre = String(w.nombre || '').trim();
  if (!codigo || !nombre) return false;
  if (/^(SFO|SIE|SE|SEP|SC)-\d{4}-/i.test(codigo)) return false;
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}/i.test(nombre)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(nombre)) return false;
  return true;
};

export const fetchMaestroApi = async (): Promise<TrabajadorMaestro[]> => {
  try {
    const res = await fetch('/api/maestro');
    if (!res.ok) throw new Error('Error al consultar maestro');
    const data = await res.json();
    return Array.isArray(data.maestro) ? data.maestro.filter(isValidWorkerClient) : [];
  } catch (error) {
    console.warn('Usando respaldo local para maestro:', error);
    const saved = localStorage.getItem('sfo_maestro_v2');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidWorkerClient) : [];
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

export const importMaestroBulkApi = async (workers: TrabajadorMaestro[]): Promise<TrabajadorMaestro[]> => {
  try {
    const res = await fetch('/api/maestro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers }),
    });
    if (!res.ok) throw new Error('Error al importar trabajadores en el servidor');
    const data = await res.json();
    return Array.isArray(data.maestro) ? data.maestro.filter(isValidWorkerClient) : [];
  } catch (error) {
    console.warn('Aviso importando maestro:', error);
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

export const syncMaestroFromDriveApi = async (): Promise<{
  success: boolean;
  count?: number;
  maestro?: TrabajadorMaestro[];
  error?: string;
  invalidMaestroSheet?: boolean;
}> => {
  try {
    const res = await fetch('/api/maestro/sync-from-drive', { method: 'POST' });
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data.maestro)) {
        data.maestro = data.maestro.filter(isValidWorkerClient);
      }
      return data;
    } catch {
      return { success: false, error: text || `Error HTTP ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
