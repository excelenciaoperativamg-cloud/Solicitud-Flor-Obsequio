import {
  getDriveConfigStorage,
  saveMaestroStorage,
  callAppsScript,
  sanitizeMaestroWorkers,
} from '../_lib/storage.js';

export default async function handler(req, res) {
  try {
    const driveCfg = getDriveConfigStorage();
    if (!driveCfg.webhookUrl) {
      return res.status(400).json({ success: false, error: 'No hay URL de Webhook configurada' });
    }
    const data = await callAppsScript(driveCfg.webhookUrl);
    if (Array.isArray(data.workers) && data.workers.length > 0) {
      const validos = sanitizeMaestroWorkers(data.workers);
      if (validos.length > 0) {
        saveMaestroStorage(validos);
        return res.status(200).json({ success: true, count: validos.length, maestro: validos });
      }
      return res.status(200).json({
        success: false,
        invalidMaestroSheet: true,
        error:
          'Apps Script está leyendo una hoja de solicitudes (ej. Especiales Empresa) en lugar de la pestaña "Maestro". Actualice Codigo.gs y cree una "Nueva versión".',
      });
    }
    return res.status(200).json({ success: false, error: data.message || 'No se pudieron extraer trabajadores de la hoja' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Error al sincronizar desde Drive' });
  }
}
