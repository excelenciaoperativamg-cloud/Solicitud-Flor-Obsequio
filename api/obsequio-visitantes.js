import {
  getObsequioVisitantesStorage,
  saveObsequioVisitantesStorage,
  getDriveConfigStorage,
  callAppsScript,
} from './_lib/storage.js';

const SEDES_VALIDAS = new Set(['MG', 'HA', 'SC']);
const PRODUCTOS_POR_SEDE = {
  MG: new Set(['Rosa (Color)', 'Rosa (Roja)', 'Bouquet']),
  HA: new Set(['Alstroemeria']),
  SC: new Set(['Clavel']),
};
const MOTIVO_FIJO_OV = 'Visitante';

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDateStr(dateString, days) {
  const [y, m, d] = String(dateString || '').split('-').map(Number);
  if (!y || !m || !d) return getTodayStr();
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ry = dt.getFullYear();
  const rm = String(dt.getMonth() + 1).padStart(2, '0');
  const rd = String(dt.getDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

function normalizarObsequioVisitante(s) {
  const cantidadNum = Number(s?.cantidad);
  const semanaStr = String(s?.semana || '').match(/(\d+)/)?.[1] || String(s?.semana || '').trim();
  const notificadoVal = String(s?.notificado || s?.estado || 'Registrada').trim();
  return {
    id: String(s?.id || '').trim(),
    fechaSolicitud: String(s?.fechaSolicitud || s?.fecha || '').trim(),
    codigo: String(s?.codigo || '').trim(),
    nombre: String(s?.nombre || '').trim(),
    sede: String(s?.sede || '').trim(),
    producto: String(s?.producto || '').trim(),
    cantidad: cantidadNum && !Number.isNaN(cantidadNum) && cantidadNum > 0 ? cantidadNum : 1,
    motivo: String(s?.motivo || MOTIVO_FIJO_OV).trim() || MOTIVO_FIJO_OV,
    nombreVisitante: String(s?.nombreVisitante || '').trim(),
    semana: semanaStr,
    fechaEntrega: String(s?.fechaEntrega || '').trim(),
    observacion: String(s?.observacion || '').trim(),
    notificado: notificadoVal,
    estado: notificadoVal,
    syncedToDrive: s?.syncedToDrive !== false,
    creadoEn: s?.creadoEn || Date.now(),
  };
}

function generarIdObsequioVisitanteUnico(existentes, idSugerido) {
  const usados = new Set(existentes.map((s) => String(s?.id || '').trim()).filter(Boolean));
  const sugerido = String(idSugerido || '').trim();
  if (sugerido && !usados.has(sugerido)) {
    return sugerido;
  }
  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const s of existentes) {
    const m = String(s?.id || '').match(/^OV-(\d{4})-(\d+)$/i);
    if (m && Number(m[1]) === year) {
      maxNum = Math.max(maxNum, Number(m[2]));
    }
  }
  let nextNum = Math.max(maxNum + 1, existentes.length + 1);
  let candidate = `OV-${year}-${String(nextNum).padStart(3, '0')}`;
  while (usados.has(candidate)) {
    nextNum += 1;
    candidate = `OV-${year}-${String(nextNum).padStart(3, '0')}`;
  }
  return candidate;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsearCorreos(raw) {
  const partes = String(raw || '')
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const correos = [];
  const vistos = new Set();
  const invalidos = [];

  for (const correo of partes) {
    if (!EMAIL_REGEX.test(correo)) {
      invalidos.push(correo);
      continue;
    }
    const clave = correo.toLowerCase();
    if (!vistos.has(clave)) {
      vistos.add(clave);
      correos.push(correo);
    }
  }

  return {
    correos,
    invalidos,
    normalizado: correos.join(', '),
    esValido: correos.length > 0 && invalidos.length === 0,
  };
}

function formatearErrorCorreo(rawErr) {
  const txt = String(rawErr || '').trim();
  if (
    !txt ||
    /permis|authoriz|autoriz|mailapp|scope|specified permissions|rechazó la operación/i.test(txt)
  ) {
    return 'Falta autorizar el envío de correos (MailApp) en Google Apps Script. En Google Sheets abra Extensiones → Apps Script, seleccione la función autorizarEnvioCorreos, haga clic en ▶ Ejecutar → Revisar permisos → Permitir, y luego implemente una Nueva versión.';
  }
  return txt;
}

export default async function handler(req, res) {
  try {
    const driveCfg = getDriveConfigStorage();

    if (req.method === 'POST') {
      const body = req.body;

      // Reintento de envío de correo
      if (body?.action === 'notificar') {
        const itemsRetry = Array.isArray(body?.items) ? body.items : [];
        const rawRetry = String(
          body?.correoNotificacion || itemsRetry[0]?.notificado || itemsRetry[0]?.estado || ''
        ).trim();
        const parsedRetry = parsearCorreos(rawRetry);
        if (!parsedRetry.esValido) {
          return res.status(400).json({
            success: false,
            error:
              'Uno o más correos electrónicos de notificación no tienen un formato válido (sepárelos por coma).',
          });
        }
        const correoRetry = parsedRetry.normalizado;
        if (!driveCfg.webhookUrl) {
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: false,
              to: correoRetry,
              error: 'No hay URL de webhook de Google Apps Script configurada.',
            },
          });
        }
        try {
          const mailRes = await callAppsScript(driveCfg.webhookUrl, {
            action: 'notificar_obsequio_visitantes',
            correoDestino: correoRetry,
            items: itemsRetry,
          });
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: !!mailRes?.emailSent,
              to: mailRes?.to || correoRetry,
              senderEmail: mailRes?.senderEmail || '',
              quotaRemaining:
                typeof mailRes?.quotaRemaining === 'number' ? mailRes.quotaRemaining : undefined,
              error: mailRes?.emailSent
                ? ''
                : formatearErrorCorreo(
                    mailRes?.emailError ||
                      mailRes?.message ||
                      'No se recibió confirmación del envío de correo desde Apps Script.'
                  ),
            },
          });
        } catch (mailErr) {
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: false,
              to: correoRetry,
              error: formatearErrorCorreo(mailErr?.message || mailErr),
            },
          });
        }
      }

      const itemsInput = Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body)
        ? body
        : [body];

      if (itemsInput.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe seleccionar al menos un producto para registrar en Obsequio Visitantes.',
        });
      }

      const candidatoNotificado = String(
        itemsInput[0]?.notificado || itemsInput[0]?.estado || ''
      ).trim();
      const parsedEstado = parsearCorreos(candidatoNotificado);
      const inputCorreoRaw = String(
        body?.correoNotificacion || (parsedEstado.esValido ? parsedEstado.normalizado : '')
      ).trim();

      let rawCorreo = '';
      if (inputCorreoRaw) {
        const parsedCorreo = parsearCorreos(inputCorreoRaw);
        if (!parsedCorreo.esValido) {
          return res.status(400).json({
            success: false,
            error:
              'Uno o más correos electrónicos de notificación no tienen un formato válido (sepárelos por coma).',
          });
        }
        rawCorreo = parsedCorreo.normalizado;
      }

      for (const item of itemsInput) {
        const sedeItem = String(item?.sede || '').trim().toUpperCase();
        const prodItem = String(item?.producto || '').trim();
        const visitanteItem = String(item?.nombreVisitante || '').trim();
        const fechaSolItem = String(item?.fechaSolicitud || '').trim() || getTodayStr();
        const fechaEntItem = String(item?.fechaEntrega || '').trim();
        if (
          !item ||
          !item.codigo ||
          !item.nombre ||
          !SEDES_VALIDAS.has(sedeItem) ||
          !prodItem ||
          !visitanteItem ||
          !fechaEntItem
        ) {
          return res.status(400).json({
            success: false,
            error: 'Faltan campos obligatorios para registrar en Obsequio Visitantes.',
          });
        }
        const permitidos = PRODUCTOS_POR_SEDE[sedeItem];
        if (!permitidos || !permitidos.has(prodItem)) {
          return res.status(400).json({
            success: false,
            error: `El producto "${prodItem}" no corresponde a la sede ${sedeItem}.`,
          });
        }
        const fechaBase = /^\d{4}-\d{2}-\d{2}$/.test(fechaSolItem) ? fechaSolItem : getTodayStr();
        const fechaMax = addDaysToDateStr(fechaBase, 1);
        if (fechaEntItem < fechaBase || fechaEntItem > fechaMax) {
          return res.status(400).json({
            success: false,
            error: `La Fecha Entrega debe ser máximo con un día de anticipación (entre ${fechaBase} y ${fechaMax}).`,
          });
        }
      }

      let existentes = getObsequioVisitantesStorage();
      let supportsObsequioVisitantes = false;
      let supportsEmailNotification = false;
      let sheetName = '';

      if (driveCfg.webhookUrl) {
        try {
          const sheetData = await callAppsScript(driveCfg.webhookUrl);
          if (
            sheetData?.supportsObsequioVisitantes === true ||
            Array.isArray(sheetData?.solicitudesObsequioVisitantes)
          ) {
            supportsObsequioVisitantes = true;
            supportsEmailNotification = !!sheetData?.supportsEmailNotification;
            sheetName = String(sheetData?.obsequioVisitantesSheetName || '').trim();
            if (Array.isArray(sheetData.solicitudesObsequioVisitantes)) {
              const deHoja = sheetData.solicitudesObsequioVisitantes.map((r) =>
                normalizarObsequioVisitante({ ...r, syncedToDrive: true })
              );
              const idsHoja = new Set(deHoja.map((r) => r.id));
              const pendientesLocales = existentes.filter(
                (r) => !idsHoja.has(r.id) && r.syncedToDrive === false
              );
              existentes = [...pendientesLocales, ...deHoja];
              saveObsequioVisitantesStorage(existentes);
            }
          }
        } catch (e) {
          console.warn('[obsequio-visitantes] verificación Apps Script:', e?.message || e);
        }
      }

      const targetSheetOk =
        supportsObsequioVisitantes &&
        (sheetName.toLowerCase() === 'obsequio visitantes' ||
          sheetName.toLowerCase() === 'obsequio visitante');

      const existentesAcumulados = [...existentes];
      const creadas = [];
      let pendingAppsScriptUpdate = false;

      for (const item of itemsInput) {
        const cantidadNum = Math.max(1, Math.floor(Number(item.cantidad) || 1));
        const idFinal = generarIdObsequioVisitanteUnico(existentesAcumulados, item.id);
        const notificadoFinal =
          rawCorreo || String(item.notificado || item.estado || 'Registrada').trim() || 'Registrada';

        const payload = {
          action: 'registrar_obsequio_visitantes',
          hoja: 'Obsequio Visitantes',
          id: idFinal,
          fechaSolicitud: String(item.fechaSolicitud || '').trim(),
          codigo: String(item.codigo).trim(),
          nombre: String(item.nombre).trim(),
          sede: String(item.sede).trim().toUpperCase(),
          producto: String(item.producto).trim(),
          cantidad: cantidadNum,
          motivo: MOTIVO_FIJO_OV,
          nombreVisitante: String(item.nombreVisitante).trim(),
          semana: String(item.semana || '').match(/(\d+)/)?.[1] || String(item.semana || '').trim(),
          fechaEntrega: String(item.fechaEntrega).trim(),
          observacion: String(item.observacion || '').trim(),
          notificado: notificadoFinal,
          estado: notificadoFinal,
        };

        let syncedToDrive = false;
        if (driveCfg.webhookUrl && targetSheetOk) {
          await callAppsScript(driveCfg.webhookUrl, payload);
          syncedToDrive = true;
        } else if (driveCfg.webhookUrl) {
          pendingAppsScriptUpdate = true;
        }

        const finalNueva = normalizarObsequioVisitante({
          ...payload,
          syncedToDrive,
          creadoEn: Date.now(),
        });

        creadas.push(finalNueva);
        existentesAcumulados.unshift(finalNueva);
      }

      const idsNuevos = new Set(creadas.map((c) => c.id));
      const actualizadas = [...creadas, ...existentes.filter((s) => !idsNuevos.has(s.id))];
      saveObsequioVisitantesStorage(actualizadas);

      const needsAppsScriptUpdate = !targetSheetOk;

      let emailNotification = {
        requested: !!rawCorreo,
        sent: false,
        to: rawCorreo,
        error: '',
        needsAppsScriptUpdate: false,
      };

      if (rawCorreo) {
        if (driveCfg.webhookUrl && targetSheetOk && supportsEmailNotification) {
          try {
            const mailRes = await callAppsScript(driveCfg.webhookUrl, {
              action: 'notificar_obsequio_visitantes',
              correoDestino: rawCorreo,
              items: creadas,
            });
            emailNotification = {
              requested: true,
              sent: !!mailRes?.emailSent,
              to: mailRes?.to || rawCorreo,
              senderEmail: mailRes?.senderEmail || '',
              quotaRemaining:
                typeof mailRes?.quotaRemaining === 'number' ? mailRes.quotaRemaining : undefined,
              error: mailRes?.emailSent
                ? ''
                : formatearErrorCorreo(
                    mailRes?.emailError ||
                      mailRes?.message ||
                      'No se recibió confirmación del envío de correo desde Apps Script.'
                  ),
              needsAppsScriptUpdate: false,
            };
          } catch (mailErr) {
            emailNotification = {
              requested: true,
              sent: false,
              to: rawCorreo,
              error: formatearErrorCorreo(mailErr?.message || mailErr),
              needsAppsScriptUpdate: false,
            };
          }
        } else if (driveCfg.webhookUrl) {
          emailNotification = {
            requested: true,
            sent: false,
            to: rawCorreo,
            error:
              'La versión activa de Google Apps Script aún no incluye la hoja "Obsequio Visitantes". Actualice el código desde Administración → Google Drive e implemente una Nueva versión.',
            needsAppsScriptUpdate: true,
          };
        } else {
          emailNotification = {
            requested: true,
            sent: false,
            to: rawCorreo,
            error: 'No hay URL de webhook de Google Apps Script configurada.',
            needsAppsScriptUpdate: false,
          };
        }
      }

      return res.status(200).json({
        success: true,
        solicitud: creadas[0],
        solicitudes: creadas,
        pendingAppsScriptUpdate,
        sheetsSupported: targetSheetOk,
        supportsEmailNotification,
        obsequioVisitantesSheetName: sheetName,
        needsAppsScriptUpdate,
        emailNotification,
      });
    }

    // GET
    const locales = getObsequioVisitantesStorage();
    if (driveCfg.webhookUrl) {
      try {
        const data = await callAppsScript(driveCfg.webhookUrl);
        if (
          data?.supportsObsequioVisitantes === true ||
          Array.isArray(data?.solicitudesObsequioVisitantes)
        ) {
          const sheetName = String(data?.obsequioVisitantesSheetName || '').trim();
          const sheetOk =
            sheetName.toLowerCase() === 'obsequio visitantes' ||
            sheetName.toLowerCase() === 'obsequio visitante';
          const deHoja = (data.solicitudesObsequioVisitantes || []).map((r) =>
            normalizarObsequioVisitante({ ...r, syncedToDrive: true })
          );
          const idsHoja = new Set(deHoja.map((r) => r.id));
          const pendientes = locales.filter((r) => !idsHoja.has(r.id) && r.syncedToDrive === false);
          const combinadas = [...pendientes, ...deHoja];
          saveObsequioVisitantesStorage(combinadas);
          return res.status(200).json({
            success: true,
            solicitudes: combinadas,
            source: 'sheets',
            sheetsSupported: sheetOk,
            supportsEmailNotification: !!data?.supportsEmailNotification,
            obsequioVisitantesSheetName: sheetName,
            needsAppsScriptUpdate: !sheetOk,
          });
        }
      } catch (e) {
        console.warn('[obsequio-visitantes] lectura hoja:', e?.message || e);
      }
    }

    return res.status(200).json({
      success: true,
      solicitudes: locales,
      source: 'local',
      sheetsSupported: false,
      supportsEmailNotification: false,
      obsequioVisitantesSheetName: '',
      needsAppsScriptUpdate: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error en Obsequio Visitantes',
    });
  }
}
