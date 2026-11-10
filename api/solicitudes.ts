import { getSolicitudesStorage, saveSolicitudesStorage, getDriveConfigStorage, callAppsScript } from './_lib/storage';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'POST') {
      const nueva = req.body;
      if (!nueva || !nueva.codigo || !nueva.nombre) {
        return res.status(400).json({ success: false, error: 'Faltan datos obligatorios' });
      }

      const driveCfg = getDriveConfigStorage();
      if (!driveCfg.webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'No hay webhook de Google Sheets. Abra Conexión con Drive y guarde la URL /exec.',
        });
      }

      await callAppsScript(driveCfg.webhookUrl, {
        id: nueva.id,
        fecha: nueva.fecha,
        semana: nueva.semana,
        codigo: nueva.codigo,
        nombre: nueva.nombre,
        producto: nueva.producto,
        sede: nueva.sede,
        motivo: nueva.motivo,
        fechaEntrega: nueva.fechaEntrega,
        remitente: nueva.remitente,
        estado: nueva.estado || 'Registrada',
      });

      const finalNueva = { ...nueva, syncedToDrive: true, guardadoEnServidor: true };
      const solicitudes = getSolicitudesStorage().filter((s: any) => s.id !== nueva.id);
      solicitudes.unshift(finalNueva);
      saveSolicitudesStorage(solicitudes);

      return res.status(200).json({ success: true, solicitud: finalNueva });
    }

    const data = getSolicitudesStorage();
    return res.status(200).json({ success: true, solicitudes: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error en solicitudes' });
  }
}
