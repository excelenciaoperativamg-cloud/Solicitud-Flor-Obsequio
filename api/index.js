import pingHandler from './_handlers/ping.js';
import driveConfigHandler from './_handlers/drive-config.js';
import driveTestHandler from './_handlers/drive-test.js';
import maestroHandler from './_handlers/maestro.js';
import maestroSyncHandler from './_handlers/maestro-sync-from-drive.js';
import solicitudesHandler from './_handlers/solicitudes.js';
import solicitudesIntExtHandler from './_handlers/solicitudes-int-ext.js';
import especialesPersonalHandler from './_handlers/especiales-personal.js';
import solicitudComunidadHandler from './_handlers/solicitud-comunidad.js';
import ingresosSeleccionHandler from './_handlers/ingresos-seleccion.js';
import obsequioVisitantesHandler from './_handlers/obsequio-visitantes.js';
import permisosHandler from './_handlers/permisos.js';

function extraerRutaApi(req) {
  const queryRoute = req.query?.__route;
  if (queryRoute !== undefined) {
    const raw = Array.isArray(queryRoute) ? queryRoute.join('/') : String(queryRoute || '');
    const cleaned = raw.replace(/^\/+|\/+$/g, '');
    if (cleaned && cleaned !== 'index') {
      return cleaned;
    }
  }

  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    let p = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (p === 'api') return '';
    if (p.startsWith('api/')) p = p.slice(4);
    if (p === 'index') return '';
    return p.replace(/^\/+|\/+$/g, '');
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  const route = extraerRutaApi(req);

  if (!route) {
    return res.status(200).json({
      status: 'ok',
      service: 'MG Consultores - Sistema Flor de Obsequio API',
      endpoints: [
        '/api/ping',
        '/api/solicitudes',
        '/api/solicitudes-int-ext',
        '/api/especiales-personal',
        '/api/solicitud-comunidad',
        '/api/ingresos-seleccion',
        '/api/obsequio-visitantes',
        '/api/permisos',
        '/api/maestro',
        '/api/maestro/sync-from-drive',
        '/api/drive-config',
        '/api/drive-test',
      ],
    });
  }

  if (route === 'ping') return pingHandler(req, res);
  if (route === 'drive-config') return driveConfigHandler(req, res);
  if (route === 'drive-test') return driveTestHandler(req, res);
  if (route === 'maestro') return maestroHandler(req, res);
  if (route === 'maestro/sync-from-drive') return maestroSyncHandler(req, res);
  if (route === 'solicitudes') return solicitudesHandler(req, res);
  if (route === 'solicitudes-int-ext') return solicitudesIntExtHandler(req, res);
  if (route === 'ingresos-seleccion') return ingresosSeleccionHandler(req, res);
  if (route === 'obsequio-visitantes') return obsequioVisitantesHandler(req, res);
  if (route === 'permisos') return permisosHandler(req, res);

  if (route === 'especiales-personal') {
    return especialesPersonalHandler(req, res);
  }
  if (route.startsWith('especiales-personal/carta/')) {
    const file = route.slice('especiales-personal/carta/'.length);
    req.params = { ...(req.params || {}), file: decodeURIComponent(file) };
    return especialesPersonalHandler(req, res);
  }

  if (route === 'solicitud-comunidad') {
    return solicitudComunidadHandler(req, res);
  }
  if (route.startsWith('solicitud-comunidad/carta/')) {
    const file = route.slice('solicitud-comunidad/carta/'.length);
    req.params = { ...(req.params || {}), file: decodeURIComponent(file) };
    return solicitudComunidadHandler(req, res);
  }

  return res.status(404).json({
    success: false,
    error: `Ruta API no encontrada: /api/${route}`,
  });
}
