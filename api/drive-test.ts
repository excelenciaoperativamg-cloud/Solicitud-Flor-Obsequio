import { getDriveConfigStorage, saveMaestroStorage, callAppsScript } from './_lib/storage';

export default async function handler(req: any, res: any) {
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
    if (data.workers && data.workers.length > 0) {
      saveMaestroStorage(data.workers);
    }
    return res.status(200).json({
      success: true,
      status: 200,
      response: `Conexión exitosa. Hoja: "${data.spreadsheetName || 'Solicitud Flor Obsequio'}". Trabajadores: ${data.totalWorkers || data.workers?.length || 0}.`,
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err.message || 'Error al conectar con Google Sheets',
    });
  }
}
