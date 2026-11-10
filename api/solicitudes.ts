import { getSolicitudesStorage, saveSolicitudesStorage, getDriveConfigStorage } from './_lib/storage';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'POST') {
      const nueva = req.body;
      if (!nueva || !nueva.codigo || !nueva.nombre) {
        return res.status(400).json({ success: false, error: 'Faltan datos obligatorios' });
      }

      const solicitudes = getSolicitudesStorage();
      const filtradas = solicitudes.filter((s: any) => s.id !== nueva.id);

      // Intentar envío automático al Webhook de Drive
      const driveCfg = getDriveConfigStorage();
      let driveSynced = false;

      if (driveCfg.webhookUrl && driveCfg.syncEnabled) {
        try {
          const fetchRes = await fetch(driveCfg.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nueva),
            redirect: 'follow',
          });
          const resText = await fetchRes.text().catch(() => '');
          if (fetchRes.ok || resText.includes('success')) {
            driveSynced = true;
          }
        } catch (driveErr) {
          console.warn('Aviso: no se pudo enviar a Webhook de Drive:', driveErr);
        }
      }

      const finalNueva = {
        ...nueva,
        syncedToDrive: driveSynced,
        guardadoEnServidor: true,
      };

      filtradas.unshift(finalNueva);
      saveSolicitudesStorage(filtradas);

      return res.status(200).json({ success: true, solicitud: finalNueva });
    }

    // GET
    const data = getSolicitudesStorage();
    return res.status(200).json({ success: true, solicitudes: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error en solicitudes' });
  }
}
