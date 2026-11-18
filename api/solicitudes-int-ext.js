import {
  getSolicitudesIntExtStorage,
  saveSolicitudesIntExtStorage,
  getDriveConfigStorage,
  callAppsScript,
} from './_lib/storage.js';

function normalizarIntExt(s) {
  const cantidadNum = Number(s?.cantidad);
  const semanaStr = String(s?.semana || '').match(/(\d+)/)?.[1] || String(s?.semana || '').trim();
  return {
    id: String(s?.id || '').trim(),
    fechaSolicitud: String(s?.fechaSolicitud || s?.fecha || '').trim(),
    codigo: String(s?.codigo || '').trim(),
    nombre: String(s?.nombre || '').trim(),
    sede: String(s?.sede || '').trim(),
    area: String(s?.area || '').trim(),
    producto: String(s?.producto || '').trim(),
    cantidad: cantidadNum && !Number.isNaN(cantidadNum) && cantidadNum > 0 ? cantidadNum : 1,
    motivo: String(s?.motivo || '').trim(),
    semana: semanaStr,
    fechaEntrega: String(s?.fechaEntrega || '').trim(),
    observacion: String(s?.observacion || '').trim(),
    estado: String(s?.estado || 'Registrada').trim(),
    syncedToDrive: s?.syncedToDrive !== false,
    creadoEn: s?.creadoEn || Date.now(),
  };
}

function generarIdIntExtUnico(existentes, idSugerido) {
  const usados = new Set(
    existentes.map((s) => String(s?.id || '').trim()).filter(Boolean)
  );
  const sugerido = String(idSugerido || '').trim();
  if (sugerido && !usados.has(sugerido)) {
    return sugerido;
  }
  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const s of existentes) {
    const m = String(s?.id || '').match(/^(?:SIE|SE)-(\d{4})-(\d+)$/i);
    if (m && Number(m[1]) === year) {
      maxNum = Math.max(maxNum, Number(m[2]));
    }
  }
  let nextNum = Math.max(maxNum + 1, existentes.length + 1);
  let candidate = `SIE-${year}-${String(nextNum).padStart(3, '0')}`;
  while (usados.has(candidate)) {
    nextNum += 1;
    candidate = `SIE-${year}-${String(nextNum).padStart(3, '0')}`;
  }
  return candidate;
}

export default async function handler(req, res) {
  try {
    const driveCfg = getDriveConfigStorage();

    if (req.method === 'POST') {
      const body = req.body;
      const itemsInput = Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body)
        ? body
        : [body];

      if (itemsInput.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe enviar al menos un producto para registrar en Especiales Empresa.',
        });
      }

      for (const item of itemsInput) {
        if (
          !item ||
          !item.codigo ||
          !item.nombre ||
          !item.sede ||
          !item.area ||
          !item.producto ||
          !item.motivo ||
          !item.fechaEntrega
        ) {
          return res.status(400).json({
            success: false,
            error: 'Faltan campos obligatorios para registrar en Especiales Empresa.',
          });
        }
      }

      let existentes = getSolicitudesIntExtStorage();
      let sheetsSupported = false;
      let intExtSheetName = '';

      if (driveCfg.webhookUrl) {
        try {
          const sheetData = await callAppsScript(driveCfg.webhookUrl);
          if (sheetData?.supportsIntExt === true || Array.isArray(sheetData?.solicitudesIntExt)) {
            sheetsSupported = true;
            intExtSheetName = String(sheetData?.intExtSheetName || '').trim();
            if (Array.isArray(sheetData.solicitudesIntExt)) {
              const deHoja = sheetData.solicitudesIntExt.map((r) =>
                normalizarIntExt({ ...r, syncedToDrive: true })
              );
              const idsHoja = new Set(deHoja.map((r) => r.id));
              const pendientesLocales = existentes.filter((r) => !idsHoja.has(r.id) && r.syncedToDrive === false);
              existentes = [...pendientesLocales, ...deHoja];
              saveSolicitudesIntExtStorage(existentes);
            }
          }
        } catch (e) {
          console.warn('[solicitudes-int-ext] verificación Apps Script:', e?.message || e);
        }
      }

      const existentesAcumulados = [...existentes];
      const creadas = [];
      let pendingAppsScriptUpdate = false;

      for (const item of itemsInput) {
        const cantidadNum = Math.max(1, Math.floor(Number(item.cantidad) || 1));
        const idFinal = generarIdIntExtUnico(existentesAcumulados, item.id);

        const payload = {
          action: 'registrar_int_ext',
          hoja: 'Especiales Empresa',
          id: idFinal,
          fechaSolicitud: String(item.fechaSolicitud || '').trim(),
          codigo: String(item.codigo).trim(),
          nombre: String(item.nombre).trim(),
          sede: String(item.sede).trim(),
          area: String(item.area).trim(),
          producto: String(item.producto).trim(),
          cantidad: cantidadNum,
          motivo: String(item.motivo).trim(),
          semana: String(item.semana || '').match(/(\d+)/)?.[1] || String(item.semana || '').trim(),
          fechaEntrega: String(item.fechaEntrega).trim(),
          observacion: String(item.observacion || '').trim(),
          estado: String(item.estado || 'Registrada').trim(),
        };

        let syncedToDrive = false;

        if (driveCfg.webhookUrl && sheetsSupported) {
          await callAppsScript(driveCfg.webhookUrl, payload);
          syncedToDrive = true;
        } else if (driveCfg.webhookUrl && !sheetsSupported) {
          // Evitamos enviar POST a una versión anterior del Apps Script que escribiría en la hoja "Solicitudes"
          pendingAppsScriptUpdate = true;
        }

        const finalNueva = normalizarIntExt({
          ...payload,
          syncedToDrive,
          creadoEn: Date.now(),
        });

        creadas.push(finalNueva);
        existentesAcumulados.unshift(finalNueva);
      }

      const idsNuevos = new Set(creadas.map((c) => c.id));
      const actualizadas = [...creadas, ...existentes.filter((s) => !idsNuevos.has(s.id))];
      saveSolicitudesIntExtStorage(actualizadas);

      const needsAppsScriptSheetUpdate =
        sheetsSupported && intExtSheetName.toLowerCase() !== 'especiales empresa';

      return res.status(200).json({
        success: true,
        solicitud: creadas[0],
        solicitudes: creadas,
        pendingAppsScriptUpdate,
        sheetsSupported,
        intExtSheetName: intExtSheetName || (sheetsSupported ? 'Solicitud Extra' : ''),
        needsAppsScriptSheetUpdate,
      });
    }

    // GET
    const locales = getSolicitudesIntExtStorage();
    if (driveCfg.webhookUrl) {
      try {
        const data = await callAppsScript(driveCfg.webhookUrl);
        if (data?.supportsIntExt === true || Array.isArray(data?.solicitudesIntExt)) {
          const intExtSheetName = String(data?.intExtSheetName || '').trim();
          const needsAppsScriptSheetUpdate = intExtSheetName.toLowerCase() !== 'especiales empresa';
          const deHoja = (data.solicitudesIntExt || []).map((r) =>
            normalizarIntExt({ ...r, syncedToDrive: true })
          );
          const idsHoja = new Set(deHoja.map((r) => r.id));
          const pendientes = locales.filter((r) => !idsHoja.has(r.id) && r.syncedToDrive === false);
          const combinadas = [...pendientes, ...deHoja];
          saveSolicitudesIntExtStorage(combinadas);
          return res.status(200).json({
            success: true,
            solicitudes: combinadas,
            source: 'sheets',
            sheetsSupported: true,
            intExtSheetName: intExtSheetName || 'Solicitud Extra',
            needsAppsScriptSheetUpdate,
          });
        }
      } catch (e) {
        console.warn('[solicitudes-int-ext] lectura hoja:', e?.message || e);
      }
    }

    return res.status(200).json({
      success: true,
      solicitudes: locales,
      source: 'local',
      sheetsSupported: false,
      intExtSheetName: '',
      needsAppsScriptSheetUpdate: false,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error en Especiales Empresa',
    });
  }
}
