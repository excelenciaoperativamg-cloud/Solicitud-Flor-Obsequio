import { getSolicitudesStorage, saveSolicitudesStorage, getDriveConfigStorage, callAppsScript } from './_lib/storage.js';

export default async function handler(req, res) {
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
        cargo: nueva.cargo || '',
        cantidad: nueva.cantidad || 1,
        producto: nueva.producto,
        sede: nueva.sede,
        motivo: nueva.motivo,
        fechaEntrega: nueva.fechaEntrega,
        remitente: nueva.remitente,
        estado: nueva.estado || 'Registrada',
      });
      const finalNueva = { ...nueva, syncedToDrive: true, guardadoEnServidor: true };
      const solicitudes = getSolicitudesStorage().filter((s) => s.id !== nueva.id);
      solicitudes.unshift(finalNueva);
      saveSolicitudesStorage(solicitudes);
      return res.status(200).json({ success: true, solicitud: finalNueva });
    }
    return res.status(200).json({ success: true, solicitudes: getSolicitudesStorage() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Error en solicitudes' });
  }
}
