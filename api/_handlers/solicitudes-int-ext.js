import {
  getSolicitudesIntExtStorage,
  saveSolicitudesIntExtStorage,
  getDriveConfigStorage,
  callAppsScript,
} from '../_lib/storage.js';

const PRODUCTOS_PERMITIDOS_INT_EXT = new Set(['Rosa', 'Clavel', 'Alstroemeria', 'Gypso']);

function esDiaDeshabilitadoEspecialesEmpresaBogota(now = new Date()) {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      weekday: 'short',
    }).format(now);
    return weekday === 'Fri' || weekday === 'Sat' || weekday === 'Sun';
  } catch {
    const day = now.getDay();
    return day === 5 || day === 6 || day === 0;
  }
}

function normalizarHoraEntrega(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return '';
  const hhmm = txt.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmm) {
    return `${String(hhmm[1]).padStart(2, '0')}:${hhmm[2]}`;
  }
  return txt;
}

function inferirSedePorProducto(producto) {
  const p = String(producto || '').trim().toLowerCase();
  if (p === 'alstroemeria') return 'HA';
  if (p === 'clavel') return 'SC';
  if (p.includes('rosa') || p === 'bouquet' || p.includes('gypso')) return 'MG';
  return '';
}

function normalizarIntExt(s) {
  const cantidadNum = Number(s?.cantidad);
  const semanaStr = String(s?.semana || '').match(/(\d+)/)?.[1] || String(s?.semana || '').trim();
  const notificadoVal = String(s?.notificado || s?.estado || 'Registrada').trim();
  const prod = String(s?.producto || '').trim();
  const sede = String(s?.sede || inferirSedePorProducto(prod)).trim().toUpperCase();
  return {
    id: String(s?.id || '').trim(),
    fechaSolicitud: String(s?.fechaSolicitud || s?.fecha || '').trim(),
    codigo: String(s?.codigo || '').trim(),
    nombre: String(s?.nombre || '').trim(),
    sede,
    area: String(s?.area || '').trim(),
    producto: prod,
    cantidad: cantidadNum && !Number.isNaN(cantidadNum) && cantidadNum > 0 ? cantidadNum : 1,
    motivo: String(s?.motivo || '').trim(),
    semana: semanaStr,
    fechaEntrega: String(s?.fechaEntrega || '').trim(),
    horaEntrega: normalizarHoraEntrega(s?.horaEntrega),
    observacion: String(s?.observacion || '').trim(),
    notificado: notificadoVal,
    estado: notificadoVal,
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
    return 'Falta autorizar el envío de correos (MailApp) en Google Apps Script. En Google Sheets abra Extensiones → Apps Script, seleccione la función autorizarEnvioCorreos (o doGet), haga clic en ▶ Ejecutar → Revisar permisos → Permitir, y luego implemente una Nueva versión.';
  }
  return txt;
}

export default async function handler(req, res) {
  try {
    const driveCfg = getDriveConfigStorage();

    if (req.method === 'POST') {
      const body = req.body;

      // Reintento de envío de correo para solicitudes ya registradas (sin duplicar filas)
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
            action: 'notificar_int_ext',
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

      if (esDiaDeshabilitadoEspecialesEmpresaBogota()) {
        return res.status(403).json({
          success: false,
          error:
            'Los ramos se deben solicitar antes del jueves de cada semana para la siguiente. El formulario de Especiales Empresa está deshabilitado los días viernes, sábado y domingo.',
        });
      }

      const itemsInput = Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body)
        ? body
        : [body];

      if (itemsInput.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe seleccionar un producto para registrar en Especiales Empresa.',
        });
      }

      if (itemsInput.length > 1) {
        return res.status(400).json({
          success: false,
          error: 'En Especiales Empresa solo se permite seleccionar un producto por solicitud.',
        });
      }

      const candidatoEstado = String(itemsInput[0]?.notificado || itemsInput[0]?.estado || '').trim();
      const parsedEstado = parsearCorreos(candidatoEstado);
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
        if (
          !item ||
          !item.codigo ||
          !item.nombre ||
          !item.producto ||
          !item.motivo ||
          !item.fechaEntrega ||
          !normalizarHoraEntrega(item.horaEntrega)
        ) {
          return res.status(400).json({
            success: false,
            error: 'Faltan campos obligatorios para registrar en Especiales Empresa.',
          });
        }
        if (!PRODUCTOS_PERMITIDOS_INT_EXT.has(String(item.producto).trim())) {
          return res.status(400).json({
            success: false,
            error:
              'Producto no permitido en Especiales Empresa. Seleccione Rosa, Clavel, Alstroemeria o Gypso.',
          });
        }
      }

      let existentes = getSolicitudesIntExtStorage();
      let sheetsSupported = false;
      let supportsEmailNotification = false;
      let intExtSheetName = '';

      if (driveCfg.webhookUrl) {
        try {
          const sheetData = await callAppsScript(driveCfg.webhookUrl);
          if (sheetData?.supportsIntExt === true || Array.isArray(sheetData?.solicitudesIntExt)) {
            sheetsSupported = true;
            supportsEmailNotification = !!sheetData?.supportsEmailNotification;
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

      const targetSheetIsEspeciales =
        sheetsSupported && intExtSheetName.toLowerCase() === 'especiales empresa';

      const existentesAcumulados = [...existentes];
      const creadas = [];
      let pendingAppsScriptUpdate = false;

      for (const item of itemsInput) {
        const cantidadNum = Math.max(1, Math.floor(Number(item.cantidad) || 1));
        const idFinal = generarIdIntExtUnico(existentesAcumulados, item.id);
        const notificadoFinal = rawCorreo || String(item.notificado || item.estado || 'Registrada').trim();

        const payload = {
          action: 'registrar_int_ext',
          hoja: 'Especiales Empresa',
          id: idFinal,
          fechaSolicitud: String(item.fechaSolicitud || '').trim(),
          codigo: String(item.codigo).trim(),
          nombre: String(item.nombre).trim(),
          sede: inferirSedePorProducto(item.producto) || String(item.sede || '').trim().toUpperCase(),
          producto: String(item.producto).trim(),
          cantidad: cantidadNum,
          motivo: String(item.motivo).trim(),
          semana: String(item.semana || '').match(/(\d+)/)?.[1] || String(item.semana || '').trim(),
          fechaEntrega: String(item.fechaEntrega).trim(),
          horaEntrega: normalizarHoraEntrega(item.horaEntrega),
          observacion: String(item.observacion || '').trim(),
          notificado: notificadoFinal,
          estado: notificadoFinal,
        };

        let syncedToDrive = false;

        if (driveCfg.webhookUrl && targetSheetIsEspeciales) {
          await callAppsScript(driveCfg.webhookUrl, payload);
          syncedToDrive = true;
        } else if (driveCfg.webhookUrl) {
          // Evitamos enviar POST a una versión anterior del Apps Script que recrearía la hoja "Solicitud Extra"
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

      // Enviar una única notificación consolidada al correo corporativo indicado
      let emailNotification = {
        requested: !!rawCorreo,
        sent: false,
        to: rawCorreo,
        error: '',
        needsAppsScriptUpdate: false,
      };

      if (rawCorreo) {
        if (driveCfg.webhookUrl && targetSheetIsEspeciales && supportsEmailNotification) {
          try {
            const mailRes = await callAppsScript(driveCfg.webhookUrl, {
              action: 'notificar_int_ext',
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
              'La versión activa de Google Apps Script aún no incluye el envío de correos (MailApp). Actualice el código desde Administración → Google Drive e implemente una Nueva versión.',
            needsAppsScriptUpdate: true,
          };
        } else {
          emailNotification = {
            requested: true,
            sent: false,
            to: rawCorreo,
            error: 'No hay URL de webhook de Google Apps Script configurada para enviar el correo.',
            needsAppsScriptUpdate: false,
          };
        }
      }

      return res.status(200).json({
        success: true,
        solicitud: creadas[0],
        solicitudes: creadas,
        pendingAppsScriptUpdate,
        sheetsSupported,
        supportsEmailNotification,
        intExtSheetName,
        needsAppsScriptSheetUpdate,
        emailNotification,
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
          const supportsEmailNotification = !!data?.supportsEmailNotification;
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
            supportsEmailNotification,
            intExtSheetName,
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
      supportsEmailNotification: false,
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
