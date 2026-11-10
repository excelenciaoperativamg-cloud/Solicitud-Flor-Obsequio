import { getDriveConfigStorage, saveMaestroStorage, callAppsScript } from '../_lib/storage';

export default async function handler(req: any, res: any) {
  try {
    const driveCfg = getDriveConfigStorage();
    if (!driveCfg.webhookUrl) {
      return res.status(400).json({ success: false, error: 'No hay URL de Webhook configurada' });
    }

    const data = await callAppsScript(driveCfg.webhookUrl);
    if (data.workers && data.workers.length > 0) {
      saveMaestroStorage(data.workers);
      return res.status(200).json({ success: true, count: data.workers.length, maestro: data.workers });
    }

    return res.status(200).json({
      success: false,
      error: data.message || 'No se pudieron extraer trabajadores de la hoja',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error al sincronizar desde Drive' });
  }
}
