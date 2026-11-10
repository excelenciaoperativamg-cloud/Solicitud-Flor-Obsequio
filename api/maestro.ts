import { getMaestroStorage, saveMaestroStorage, getDriveConfigStorage } from './_lib/storage';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'POST') {
      const trabajador = req.body;
      if (!trabajador || !trabajador.codigo || !trabajador.nombre) {
        return res.status(400).json({ success: false, error: 'Código y nombre son obligatorios' });
      }

      const maestro = getMaestroStorage();
      const codigoUpper = trabajador.codigo.trim().toUpperCase();

      const filtrado = maestro.filter((t: any) => t.codigo.trim().toUpperCase() !== codigoUpper);
      filtrado.unshift({
        ...trabajador,
        codigo: codigoUpper,
        activo: true,
      });
      saveMaestroStorage(filtrado);

      // Sincronizar en Webhook si está disponible
      const driveCfg = getDriveConfigStorage();
      if (driveCfg.webhookUrl) {
        try {
          await fetch(driveCfg.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'addWorker', worker: trabajador }),
            redirect: 'follow',
          });
        } catch (wErr) {
          console.warn('Aviso sincronizando trabajador al Webhook:', wErr);
        }
      }

      return res.status(200).json({ success: true, maestro: filtrado });
    }

    // GET
    const data = getMaestroStorage();
    return res.status(200).json({ success: true, maestro: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error en maestro' });
  }
}
