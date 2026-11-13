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

      const cantidadNum = Math.max(1, Number(nueva.cantidad) || 1);
      const payload = {
        id: nueva.id,
        fecha: nueva.fecha,
        semana: soloSemana(nueva.semana),
        codigo: nueva.codigo,
        nombre: nueva.nombre,
        cargo: nueva.cargo || '',
        cantidad: cantidadNum,
        producto: soloProducto(nueva.producto),
        sede: soloSede(nueva.sede),
        motivo: nueva.motivo || 'Obsequio',
        fechaEntrega: nueva.fechaEntrega || '',
        remitente: nueva.remitente,
        estado: nueva.estado || 'Registrada',
      };

      await callAppsScript(driveCfg.webhookUrl, payload);

      const finalNueva = {
        ...nueva,
        cantidad: cantidadNum,
        motivo: payload.motivo,
        fechaEntrega: payload.fechaEntrega,
        syncedToDrive: true,
        guardadoEnServidor: true,
      };
      const solicitudes = getSolicitudesStorage().filter((s) => s.id !== nueva.id);
      solicitudes.unshift(finalNueva);
      saveSolicitudesStorage(solicitudes);
      return res.status(200).json({ success: true, solicitud: finalNueva });
    }
    const driveCfg = getDriveConfigStorage();
    if (driveCfg.webhookUrl) {
      try {
        const data = await callAppsScript(driveCfg.webhookUrl);
        if (Array.isArray(data.solicitudes)) {
          saveSolicitudesStorage(data.solicitudes);
          return res.status(200).json({ success: true, solicitudes: data.solicitudes, source: 'sheets' });
        }
      } catch (e) {
        console.warn('[solicitudes] lectura hoja:', e?.message || e);
      }
    }
    return res.status(200).json({ success: true, solicitudes: getSolicitudesStorage(), source: 'cache' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Error en solicitudes' });
  }
}
