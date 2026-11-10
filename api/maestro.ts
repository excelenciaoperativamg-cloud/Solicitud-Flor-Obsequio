import { getMaestroStorage, saveMaestroStorage, getDriveConfigStorage, callAppsScript } from './_lib/storage';

async function maestroDesdeHoja(): Promise<any[] | null> {
  const driveCfg = getDriveConfigStorage();
  if (!driveCfg.webhookUrl) return null;
  const data = await callAppsScript(driveCfg.webhookUrl);
  if (data.workers && data.workers.length > 0) {
    saveMaestroStorage(data.workers);
    return data.workers;
  }
  return null;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'POST') {
      const trabajador = req.body;
      if (!trabajador || !trabajador.codigo || !trabajador.nombre) {
        return res.status(400).json({ success: false, error: 'Código y nombre son obligatorios' });
      }

      const maestro = getMaestroStorage();
      const codigoUpper = String(trabajador.codigo).trim().toUpperCase();
      const filtrado = maestro.filter((t: any) => String(t.codigo).trim().toUpperCase() !== codigoUpper);
      filtrado.unshift({ ...trabajador, codigo: codigoUpper, activo: true });
      saveMaestroStorage(filtrado);
      return res.status(200).json({ success: true, maestro: filtrado });
    }

    try {
      const fresco = await maestroDesdeHoja();
      if (fresco) return res.status(200).json({ success: true, maestro: fresco, source: 'sheets' });
    } catch (syncErr: any) {
      console.warn('[maestro] no se pudo leer la hoja:', syncErr?.message || syncErr);
    }

    return res.status(200).json({ success: true, maestro: getMaestroStorage(), source: 'cache' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error en maestro' });
  }
}
