import {
  getMaestroStorage,
  saveMaestroStorage,
  getDriveConfigStorage,
  callAppsScript,
  sanitizeMaestroWorkers,
  isValidWorker,
} from './_lib/storage.js';

async function maestroDesdeHoja() {
  const driveCfg = getDriveConfigStorage();
  if (!driveCfg.webhookUrl) return { workers: null, invalidSheet: false };
  const data = await callAppsScript(driveCfg.webhookUrl);
  if (Array.isArray(data.workers) && data.workers.length > 0) {
    const validos = sanitizeMaestroWorkers(data.workers);
    if (validos.length > 0) {
      saveMaestroStorage(validos);
      return { workers: validos, invalidSheet: false };
    }
    return { workers: null, invalidSheet: true };
  }
  return { workers: null, invalidSheet: false };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = req.body;
      const driveCfg = getDriveConfigStorage();

      // Carga masiva desde Excel / CSV / Google Sheets OAuth
      if (body && Array.isArray(body.workers)) {
        const nuevosValidos = sanitizeMaestroWorkers(body.workers);
        if (nuevosValidos.length === 0) {
          return res.status(400).json({ success: false, error: 'No se encontraron trabajadores válidos para importar' });
        }
        const actuales = getMaestroStorage();
        const mapa = new Map();
        for (const t of actuales) {
          mapa.set(String(t.codigo).trim().toUpperCase(), t);
        }
        for (const n of nuevosValidos) {
          mapa.set(String(n.codigo).trim().toUpperCase(), n);
        }
        const combinado = Array.from(mapa.values());
        saveMaestroStorage(combinado);

        let syncedToDrive = false;
        let driveMessage = '';
        if (driveCfg.webhookUrl && !body.skipDrivePush) {
          try {
            const syncRes = await callAppsScript(driveCfg.webhookUrl, {
              action: 'sincronizar_maestro',
              workers: nuevosValidos,
            });
            syncedToDrive = !!syncRes?.syncedMaestro;
            if (Array.isArray(syncRes?.workers) && syncRes.workers.length > 0) {
              const desdeHoja = sanitizeMaestroWorkers(syncRes.workers);
              if (desdeHoja.length > 0) {
                saveMaestroStorage(desdeHoja);
              }
            }
            driveMessage = syncRes?.message || '';
          } catch (syncErr) {
            driveMessage = syncErr?.message || 'No se pudo sincronizar Maestro en Google Drive';
            console.warn('[maestro] error sincronizando bulk con Drive:', driveMessage);
          }
        }

        return res.status(200).json({
          success: true,
          count: nuevosValidos.length,
          maestro: getMaestroStorage(),
          syncedToDrive,
          driveMessage,
        });
      }

      const trabajador = body;
      if (!trabajador || !trabajador.codigo || !trabajador.nombre) {
        return res.status(400).json({ success: false, error: 'Código y nombre son obligatorios' });
      }
      if (!isValidWorker(trabajador)) {
        return res.status(400).json({ success: false, error: 'El registro no tiene un código o nombre de trabajador válido' });
      }
      const maestro = getMaestroStorage();
      const codigoUpper = String(trabajador.codigo).trim().toUpperCase();
      const filtrado = maestro.filter((t) => String(t.codigo).trim().toUpperCase() !== codigoUpper);
      const registroNuevo = {
        ...trabajador,
        codigo: codigoUpper,
        cedula: trabajador.cedula ? String(trabajador.cedula).trim() : '',
        activo: true,
      };
      const limpio = sanitizeMaestroWorkers([registroNuevo, ...filtrado]);
      saveMaestroStorage(limpio);

      let syncedToDrive = false;
      if (driveCfg.webhookUrl) {
        try {
          const syncRes = await callAppsScript(driveCfg.webhookUrl, {
            action: 'agregar_trabajador_maestro',
            worker: registroNuevo,
          });
          syncedToDrive = !!syncRes?.syncedMaestro;
          if (Array.isArray(syncRes?.workers) && syncRes.workers.length > 0) {
            const desdeHoja = sanitizeMaestroWorkers(syncRes.workers);
            if (desdeHoja.length > 0) {
              saveMaestroStorage(desdeHoja);
            }
          }
        } catch (syncErr) {
          console.warn('[maestro] error agregando trabajador en Drive:', syncErr?.message || syncErr);
        }
      }

      return res.status(200).json({ success: true, maestro: getMaestroStorage(), syncedToDrive });
    }

    let invalidSheet = false;
    try {
      const resHoja = await maestroDesdeHoja();
      if (resHoja.workers && resHoja.workers.length > 0) {
        return res.status(200).json({ success: true, maestro: resHoja.workers, source: 'sheets' });
      }
      invalidSheet = resHoja.invalidSheet;
    } catch (syncErr) {
      console.warn('[maestro] no se pudo leer la hoja:', syncErr?.message || syncErr);
    }

    return res.status(200).json({
      success: true,
      maestro: getMaestroStorage(),
      source: 'cache',
      invalidMaestroSheet: invalidSheet,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Error en maestro' });
  }
}
