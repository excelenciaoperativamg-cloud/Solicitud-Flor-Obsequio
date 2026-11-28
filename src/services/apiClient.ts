import {
  SolicitudFlor,
  SolicitudIntExt,
  EspecialPersonal,
  SolicitudComunidad,
  IngresoSeleccion,
  ObsequioVisitante,
  TrabajadorMaestro,
  FormularioPermisoKey,
  PermisosFormulariosMap,
} from '../types';
import {
  DEFAULT_PERMISOS_FORMULARIOS,
  clonarPermisosFormularios,
} from '../utils/roles';

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
  correoNotificacion?: string,
  fotoCarta?: { base64: string; mimeType: string; fileName: string } | null,
  usuarioInfo?: { codigo?: string; cargo?: string }
): Promise<{
  solicitud: SolicitudIntExt;
  solicitudes: SolicitudIntExt[];
  pendingAppsScriptUpdate?: boolean;
  supportsEmailNotification?: boolean;
  intExtSheetName?: string;
  needsAppsScriptSheetUpdate?: boolean;
  fotoCartaDriveError?: string;
  emailNotification?: EmailNotificationResult;
}> => {
  const basePayload = Array.isArray(solicitudOrList)
    ? {
        items: solicitudOrList,
        correoNotificacion: correoNotificacion || '',
        usuarioCodigo: usuarioInfo?.codigo || '',
        usuarioCargo: usuarioInfo?.cargo || '',
      }
    : {
        ...solicitudOrList,
        correoNotificacion: correoNotificacion || '',
        usuarioCodigo: usuarioInfo?.codigo || '',
        usuarioCargo: usuarioInfo?.cargo || '',
      };

  const payload = fotoCarta
    ? {
        ...basePayload,
        fotoCartaBase64: fotoCarta.base64,
        fotoCartaMime: fotoCarta.mimeType,
        fotoCartaNombre: fotoCarta.fileName,
      }
    : basePayload;

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
    fotoCartaDriveError: data.fotoCartaDriveError || '',
    emailNotification: data.emailNotification,
  };
};

export const retryEmailIntExtApi = async (
  items: SolicitudIntExt[],
  correoNotificacion: string,
  fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
): Promise<EmailNotificationResult> => {
  const res = await fetch('/api/solicitudes-int-ext', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'notificar',
      items,
      correoNotificacion,
      ...(fotoCarta
        ? {
            fotoCartaBase64: fotoCarta.base64,
            fotoCartaMime: fotoCarta.mimeType,
            fotoCartaNombre: fotoCarta.fileName,
          }
        : {}),
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

export type EstadoEspecialPersonal = 'Pendiente Aprobación' | 'Aprobado' | 'No Aprobado';

export const updateEstadoEspecialPersonalApi = async (params: {
  id: string;
  estado: EstadoEspecialPersonal;
  usuarioCodigo: string;
  usuarioCargo: string;
  usuarioNombre?: string;
}): Promise<{
  success: boolean;
  id: string;
  estado: EstadoEspecialPersonal;
  solicitudes?: EspecialPersonal[];
  pendingAppsScriptUpdate?: boolean;
  error?: string;
}> => {
  const res = await fetch('/api/especiales-personal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'actualizar_estado',
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'No se pudo actualizar el estado de la solicitud.');
  }
  return {
    success: true,
    id: data.id || params.id,
    estado: data.estado || params.estado,
    solicitudes: Array.isArray(data.solicitudes) ? data.solicitudes : undefined,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
  };
};

export const notifyRespuestaEspecialPersonalApi = async (params: {
  item: EspecialPersonal;
  usuarioCodigo: string;
  usuarioCargo: string;
}): Promise<EmailNotificationResult & { pendingAppsScriptUpdate?: boolean }> => {
  const res = await fetch('/api/especiales-personal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'notificar_respuesta',
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      requested: true,
      sent: false,
      to: params.item.correoConfirmacion || '',
      error: data?.error || 'No se pudo enviar la notificación de respuesta.',
    };
  }
  return {
    ...(data?.emailNotification || {
      requested: true,
      sent: false,
      to: params.item.correoConfirmacion || '',
      error: 'No se recibió respuesta del servidor de correo.',
    }),
    pendingAppsScriptUpdate: !!data?.pendingAppsScriptUpdate,
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

export const fetchIngresosSeleccionApi = async (): Promise<{
  solicitudes: IngresoSeleccion[];
  sheetsSupported: boolean;
  supportsEmailNotification?: boolean;
  source: string;
  ingresosSeleccionSheetName?: string;
  needsAppsScriptUpdate?: boolean;
}> => {
  try {
    const res = await fetch('/api/ingresos-seleccion');
    if (!res.ok) throw new Error('Error al consultar Ingresos Personal');
    const data = await res.json();
    return {
      solicitudes: data.solicitudes || [],
      sheetsSupported: !!data.sheetsSupported,
      supportsEmailNotification: !!data.supportsEmailNotification,
      source: data.source || 'local',
      ingresosSeleccionSheetName: data.ingresosSeleccionSheetName || '',
      needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    };
  } catch (error) {
    console.warn('Error consultando Ingresos Personal:', error);
    return {
      solicitudes: [],
      sheetsSupported: false,
      supportsEmailNotification: false,
      source: 'error',
      ingresosSeleccionSheetName: '',
      needsAppsScriptUpdate: true,
    };
  }
};

export const createIngresosSeleccionApi = async (
  solicitudOrList: IngresoSeleccion | IngresoSeleccion[],
  correoNotificacion?: string
): Promise<{
  solicitud: IngresoSeleccion;
  solicitudes: IngresoSeleccion[];
  pendingAppsScriptUpdate?: boolean;
  supportsEmailNotification?: boolean;
  ingresosSeleccionSheetName?: string;
  needsAppsScriptUpdate?: boolean;
  emailNotification?: EmailNotificationResult;
}> => {
  const payload = Array.isArray(solicitudOrList)
    ? { items: solicitudOrList, correoNotificacion: correoNotificacion || '' }
    : { ...solicitudOrList, correoNotificacion: correoNotificacion || '' };

  const res = await fetch('/api/ingresos-seleccion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al guardar en Ingresos Personal');
  }
  const data = await res.json();
  const solicitudes: IngresoSeleccion[] = Array.isArray(data.solicitudes)
    ? data.solicitudes
    : data.solicitud
    ? [data.solicitud]
    : [];
  return {
    solicitud: data.solicitud || solicitudes[0],
    solicitudes,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
    supportsEmailNotification: !!data.supportsEmailNotification,
    ingresosSeleccionSheetName: data.ingresosSeleccionSheetName || '',
    needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    emailNotification: data.emailNotification,
  };
};

export const retryEmailIngresosSeleccionApi = async (
  items: IngresoSeleccion[],
  correoNotificacion: string
): Promise<EmailNotificationResult> => {
  const res = await fetch('/api/ingresos-seleccion', {
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

export const fetchObsequioVisitantesApi = async (): Promise<{
  solicitudes: ObsequioVisitante[];
  sheetsSupported: boolean;
  supportsEmailNotification?: boolean;
  source: string;
  obsequioVisitantesSheetName?: string;
  needsAppsScriptUpdate?: boolean;
}> => {
  try {
    const res = await fetch('/api/obsequio-visitantes');
    if (!res.ok) throw new Error('Error al consultar Obsequio Visitantes');
    const data = await res.json();
    return {
      solicitudes: data.solicitudes || [],
      sheetsSupported: !!data.sheetsSupported,
      supportsEmailNotification: !!data.supportsEmailNotification,
      source: data.source || 'local',
      obsequioVisitantesSheetName: data.obsequioVisitantesSheetName || '',
      needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    };
  } catch (error) {
    console.warn('Error consultando Obsequio Visitantes:', error);
    return {
      solicitudes: [],
      sheetsSupported: false,
      supportsEmailNotification: false,
      source: 'error',
      obsequioVisitantesSheetName: '',
      needsAppsScriptUpdate: true,
    };
  }
};

export const createObsequioVisitantesApi = async (
  solicitudOrList: ObsequioVisitante | ObsequioVisitante[],
  correoNotificacion?: string
): Promise<{
  solicitud: ObsequioVisitante;
  solicitudes: ObsequioVisitante[];
  pendingAppsScriptUpdate?: boolean;
  supportsEmailNotification?: boolean;
  obsequioVisitantesSheetName?: string;
  needsAppsScriptUpdate?: boolean;
  emailNotification?: EmailNotificationResult;
}> => {
  const payload = Array.isArray(solicitudOrList)
    ? { items: solicitudOrList, correoNotificacion: correoNotificacion || '' }
    : { ...solicitudOrList, correoNotificacion: correoNotificacion || '' };

  const res = await fetch('/api/obsequio-visitantes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al guardar en Obsequio Visitantes');
  }
  const data = await res.json();
  const solicitudes: ObsequioVisitante[] = Array.isArray(data.solicitudes)
    ? data.solicitudes
    : data.solicitud
    ? [data.solicitud]
    : [];
  return {
    solicitud: data.solicitud || solicitudes[0],
    solicitudes,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
    supportsEmailNotification: !!data.supportsEmailNotification,
    obsequioVisitantesSheetName: data.obsequioVisitantesSheetName || '',
    needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    emailNotification: data.emailNotification,
  };
};

export const retryEmailObsequioVisitantesApi = async (
  items: ObsequioVisitante[],
  correoNotificacion: string
): Promise<EmailNotificationResult> => {
  const res = await fetch('/api/obsequio-visitantes', {
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
  if (/^(SFO|SIE|SE|SEP|SC|IS|OV)-\d{4}-/i.test(codigo)) return false;
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}/i.test(nombre)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(nombre)) return false;
  return true;
};

const MAESTRO_LOCAL_KEY = 'sfo_maestro_v2';

export function getMaestroLocalCache(): TrabajadorMaestro[] {
  try {
    const saved = localStorage.getItem(MAESTRO_LOCAL_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidWorkerClient) : [];
  } catch {
    return [];
  }
}

function saveMaestroLocalCache(workers: TrabajadorMaestro[]) {
  try {
    const valid = Array.isArray(workers) ? workers.filter(isValidWorkerClient) : [];
    if (valid.length > 0) {
      localStorage.setItem(MAESTRO_LOCAL_KEY, JSON.stringify(valid));
    }
  } catch {}
}

export const fetchMaestroConEstadoApi = async (): Promise<{
  maestro: TrabajadorMaestro[];
  source: 'sheets' | 'cache' | 'local';
}> => {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch(`/api/maestro?_ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Error HTTP ${res.status} al consultar maestro`);
      const data = await res.json();
      const valid = Array.isArray(data.maestro) ? data.maestro.filter(isValidWorkerClient) : [];
      const source: 'sheets' | 'cache' | 'local' =
        data.source === 'sheets' ? 'sheets' : 'cache';

      if (valid.length > 0) {
        saveMaestroLocalCache(valid);
        if (source === 'sheets' || intento === 1) {
          return { maestro: valid, source };
        }
        // Si vino de cache del servidor en el primer intento, esperar brevemente y reintentar una vez contra Sheets
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
    } catch (error) {
      if (intento === 0) {
        await new Promise((r) => setTimeout(r, 450));
        continue;
      }
      console.warn('Usando respaldo local para maestro:', error);
    }
  }

  return { maestro: getMaestroLocalCache(), source: 'local' };
};

export const fetchMaestroApi = async (): Promise<TrabajadorMaestro[]> => {
  const res = await fetchMaestroConEstadoApi();
  return res.maestro;
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
    const valid = Array.isArray(data.maestro) ? data.maestro.filter(isValidWorkerClient) : [];
    saveMaestroLocalCache(valid);
    return valid;
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
    const valid = Array.isArray(data.maestro) ? data.maestro.filter(isValidWorkerClient) : [];
    saveMaestroLocalCache(valid);
    return valid;
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
        saveMaestroLocalCache(data.maestro);
      }
      return data;
    } catch {
      return { success: false, error: text || `Error HTTP ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

const PERMISOS_LOCAL_KEY = 'sfo_permisos_formularios_v1';

export function getPermisosLocalCache(): PermisosFormulariosMap {
  try {
    const raw = localStorage.getItem(PERMISOS_LOCAL_KEY);
    if (!raw) return clonarPermisosFormularios(DEFAULT_PERMISOS_FORMULARIOS);
    const parsed = JSON.parse(raw);
    return clonarPermisosFormularios(parsed);
  } catch {
    return clonarPermisosFormularios(DEFAULT_PERMISOS_FORMULARIOS);
  }
}

function savePermisosLocalCache(permisos: PermisosFormulariosMap) {
  try {
    localStorage.setItem(PERMISOS_LOCAL_KEY, JSON.stringify(permisos));
  } catch {}
}

export const fetchPermisosFormulariosApi = async (): Promise<{
  permisos: PermisosFormulariosMap;
  source: string;
  sheetsSupported: boolean;
  needsAppsScriptUpdate: boolean;
}> => {
  try {
    const res = await fetch(`/api/permisos?_ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al consultar permisos de formularios');
    const data = await res.json();
    const permisos = clonarPermisosFormularios(data.permisos);
    savePermisosLocalCache(permisos);
    return {
      permisos,
      source: data.source || 'local',
      sheetsSupported: !!data.sheetsSupported,
      needsAppsScriptUpdate: !!data.needsAppsScriptUpdate,
    };
  } catch (error) {
    console.warn('Usando respaldo local para permisos de formularios:', error);
    return {
      permisos: getPermisosLocalCache(),
      source: 'local',
      sheetsSupported: false,
      needsAppsScriptUpdate: true,
    };
  }
};

export const savePermisosFormulariosApi = async (params: {
  permisos: PermisosFormulariosMap;
  usuarioCodigo: string;
  usuarioCargo: string;
  usuarioNombre?: string;
}): Promise<{
  success: boolean;
  permisos: PermisosFormulariosMap;
  syncedToDrive: boolean;
  pendingAppsScriptUpdate: boolean;
}> => {
  const res = await fetch('/api/permisos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'No se pudieron guardar los permisos.');
  }
  const permisos = clonarPermisosFormularios(data.permisos);
  savePermisosLocalCache(permisos);
  return {
    success: true,
    permisos,
    syncedToDrive: !!data.syncedToDrive,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
  };
};

export const restoreDefaultPermisosApi = async (params: {
  formKey?: FormularioPermisoKey;
  usuarioCodigo: string;
  usuarioCargo: string;
  usuarioNombre?: string;
}): Promise<{
  success: boolean;
  permisos: PermisosFormulariosMap;
  syncedToDrive: boolean;
  pendingAppsScriptUpdate: boolean;
}> => {
  const res = await fetch('/api/permisos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'restaurar_defecto',
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'No se pudieron restaurar los permisos por defecto.');
  }
  const permisos = clonarPermisosFormularios(data.permisos);
  savePermisosLocalCache(permisos);
  return {
    success: true,
    permisos,
    syncedToDrive: !!data.syncedToDrive,
    pendingAppsScriptUpdate: !!data.pendingAppsScriptUpdate,
  };
};

