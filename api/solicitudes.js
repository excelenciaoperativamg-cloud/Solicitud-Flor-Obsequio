import { getSolicitudesStorage, saveSolicitudesStorage, getDriveConfigStorage, callAppsScript } from './_lib/storage.js';

function soloSemana(valor) {
  const m = String(valor || '').match(/(\d+)/);
  return m ? m[1] : String(valor || '');
}

function soloSede(valor) {
  return String(valor || '').replace(/^sede\s+/i, '').trim();
}

function soloProducto(valor) {
  return String(valor || '')
    .replace(/^ramo de\s+/i, '')
    .replace(/\s*\(\d+\s+unidad(?:es)?\)\s*$/i, '')
    .trim();
}

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
        semana: soloSemana(nueva.semana),
        codigo: nueva.codigo,
        nombre: nueva.nombre,
        cargo: nueva.cargo || '',
        cantidad: nueva.cantidad || 1,
        producto: soloProducto(nueva.producto),
        sede: soloSede(nueva.sede),
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
