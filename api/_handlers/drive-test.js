import {
  getDriveConfigStorage,
  saveMaestroStorage,
  callAppsScript,
  sanitizeMaestroWorkers,
} from '../_lib/storage.js';

export default async function handler(req, res) {
  try {
    const driveCfg = getDriveConfigStorage();
    const targetUrl = (req.body?.webhookUrl || driveCfg.webhookUrl || '').trim();
    if (!targetUrl) {
      return res.status(200).json({
        success: false,
        error: 'No hay URL de Webhook configurada. Ingrese la URL de Apps Script terminada en /exec.',
      });
    }
    const data = await callAppsScript(targetUrl);
    const validos = sanitizeMaestroWorkers(data.workers || []);
    if (validos.length > 0) {
      saveMaestroStorage(validos);
      return res.status(200).json({
        success: true,
        status: 200,
        response: `Conexión exitosa. Hoja: "${data.spreadsheetName || 'Solicitud Flor Obsequio'}". Trabajadores válidos en Maestro: ${validos.length}.`,
      });
    }

    if (Array.isArray(data.workers) && data.workers.length > 0) {
      return res.status(200).json({
        success: false,
        error:
          'Se conectó con Google Drive, pero Apps Script leyó registros de otra pestaña (ej. Especiales Empresa) en lugar de "Maestro". Copie el código actualizado arriba y publíquelo como "Nueva versión".',
      });
    }

    return res.status(200).json({
      success: true,
      status: 200,
      response: `Conexión exitosa. Hoja: "${data.spreadsheetName || 'Solicitud Flor Obsequio'}". Trabajadores: 0.`,
    });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message || 'Error al conectar con Google Sheets' });
  }
}
