import {
  getEspecialesPersonalStorage,
  saveEspecialesPersonalStorage,
  saveCartaLocalFile,
  readCartaLocalFile,
  getDriveConfigStorage,
  callAppsScript,
} from './_lib/storage.js';

function normalizarEspecialPersonal(s) {
  const cantidadNum = Number(s?.cantidad);
  const semanaStr = String(s?.semana || '').match(/(\d+)/)?.[1] || String(s?.semana || '').trim();
  const notificadoVal = String(s?.notificado || s?.estado || 'Registrada').trim();
  return {
    id: String(s?.id || '').trim(),
    fechaSolicitud: String(s?.fechaSolicitud || s?.fecha || '').trim(),
    usuario: String(s?.usuario || '').trim(),
    cedula: String(s?.cedula || '').trim(),
    nombre: String(s?.nombre || '').trim(),
    sede: String(s?.sede || '').trim(),
    producto: String(s?.producto || '').trim(),
    cantidad: cantidadNum && !Number.isNaN(cantidadNum) && cantidadNum > 0 ? cantidadNum : 1,
    motivo: String(s?.motivo || '').trim(),
    semana: semanaStr,
    fechaEntrega: String(s?.fechaEntrega || '').trim(),
    observacion: String(s?.observacion || '').trim(),
    fotoCarta: String(s?.fotoCarta || '').trim(),
    notificado: notificadoVal,
    estado: notificadoVal,
    syncedToDrive: s?.syncedToDrive !== false,
    creadoEn: s?.creadoEn || Date.now(),
  };
}

function generarIdEspecialPersonalUnico(existentes, idSugerido) {
  const usados = new Set(existentes.map((s) => String(s?.id || '').trim()).filter(Boolean));
  const sugerido = String(idSugerido || '').trim();
  if (sugerido && !usados.has(sugerido)) return sugerido;

  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const s of existentes) {
    const m = String(s?.id || '').match(/^SEP-(\d{4})-(\d+)$/i);
    if (m && Number(m[1]) === year) {
      maxNum = Math.max(maxNum, Number(m[2]));
    }
  }
  let nextNum = Math.max(maxNum + 1, existentes.length + 1);
  let candidate = `SEP-${year}-${String(nextNum).padStart(3, '0')}`;
  while (usados.has(candidate)) {
    nextNum += 1;
    candidate = `SEP-${year}-${String(nextNum).padStart(3, '0')}`;
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
    return 'Falta autorizar los permisos en Google Apps Script. En Google Sheets abra Extensiones → Apps Script, seleccione la función autorizarEnvioCorreos, haga clic en ▶ Ejecutar → Revisar permisos → Permitir, y luego implemente una Nueva versión.';
  }
  return txt;
}

function mimeDesdeNombre(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

function extensionDesdeMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('pdf')) return 'pdf';
  return 'jpg';
}

export default async function handler(req, res) {
  try {
    // Servir carta guardada localmente (/api/especiales-personal/carta/:file o ?carta=...)
    const cartaParam = req.params?.file || req.query?.carta;
    if (req.method === 'GET' && cartaParam) {
      const buf = readCartaLocalFile(cartaParam);
      if (!buf) {
        return res.status(404).json({ success: false, error: 'Carta no encontrada' });
      }
      res.setHeader('Content-Type', mimeDesdeNombre(cartaParam));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(buf);
    }

    const driveCfg = getDriveConfigStorage();

    if (req.method === 'POST') {
      const body = req.body;

      // Reintento de correo sin duplicar filas en Sheets
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
            action: 'notificar_especial_personal',
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
          error: 'Debe enviar al menos un producto para registrar en Especiales Personal.',
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
          !item.usuario ||
          !item.cedula ||
          !item.nombre ||
          !item.sede ||
          !item.producto ||
          !item.motivo ||
          !item.fechaEntrega
        ) {
          return res.status(400).json({
            success: false,
            error: 'Faltan campos obligatorios para registrar en Especiales Personal.',
          });
        }
      }

      let existentes = getEspecialesPersonalStorage();
      let supportsEspecialesPersonal = false;
      let supportsEmailNotification = false;
      let sheetName = '';

      if (driveCfg.webhookUrl) {
        try {
          const sheetData = await callAppsScript(driveCfg.webhookUrl);
          if (
            sheetData?.supportsEspecialesPersonal === true ||
            Array.isArray(sheetData?.solicitudesEspecialesPersonal)
          ) {
            supportsEspecialesPersonal = true;
            supportsEmailNotification = !!sheetData?.supportsEmailNotification;
            sheetName = String(sheetData?.especialesPersonalSheetName || '').trim();
            if (Array.isArray(sheetData.solicitudesEspecialesPersonal)) {
              const deHoja = sheetData.solicitudesEspecialesPersonal.map((r) =>
                normalizarEspecialPersonal({ ...r, syncedToDrive: true })
              );
              const idsHoja = new Set(deHoja.map((r) => r.id));
              const pendientesLocales = existentes.filter(
                (r) => !idsHoja.has(r.id) && r.syncedToDrive === false
              );
              existentes = [...pendientesLocales, ...deHoja];
              saveEspecialesPersonalStorage(existentes);
            }
          }
        } catch (e) {
          console.warn('[especiales-personal] verificación Apps Script:', e?.message || e);
        }
      }

      const targetSheetOk =
        supportsEspecialesPersonal && sheetName.toLowerCase() === 'especiales personal';

      // Procesar foto de carta autorizada (una sola subida para todos los ítems de la solicitud)
      let fotoCartaFinal = String(itemsInput[0]?.fotoCarta || '').trim();
      let fotoCartaDriveError = '';
      const rawDataUrlOrB64 = String(body?.fotoCartaBase64 || '').trim();
      const fotoMime = String(body?.fotoCartaMime || 'image/jpeg').trim();
      const fotoNombreOrig = String(body?.fotoCartaNombre || '').trim();

      let cleanB64 = '';
      let detectedMime = fotoMime;
      if (rawDataUrlOrB64) {
        const dataUrlMatch = rawDataUrlOrB64.match(/^data:([^;]+);base64,(.+)$/s);
        if (dataUrlMatch) {
          detectedMime = dataUrlMatch[1];
          cleanB64 = dataUrlMatch[2];
        } else {
          cleanB64 = rawDataUrlOrB64;
        }
      }

      const existentesAcumulados = [...existentes];
      const primerIdPreview = generarIdEspecialPersonalUnico(
        existentesAcumulados,
        itemsInput[0]?.id
      );

      if (cleanB64) {
        const ext = extensionDesdeMime(detectedMime);
        const archivoNombre =
          fotoNombreOrig || `Carta_${primerIdPreview}_${itemsInput[0].cedula}.${ext}`;

        // Guardar respaldo local para previsualización
        const localSavedName = `${primerIdPreview}_${Date.now()}.${ext}`;
        try {
          const buf = Buffer.from(cleanB64, 'base64');
          saveCartaLocalFile(localSavedName, buf);
        } catch (fileErr) {
          console.warn('[especiales-personal] aviso guardando carta local:', fileErr);
        }

        const localCartaPath = `/api/especiales-personal/carta/${localSavedName}`;
        fotoCartaFinal = localCartaPath;

        // Intentar subir a Google Drive vía Apps Script para obtener enlace oficial
        if (driveCfg.webhookUrl && targetSheetOk) {
          try {
            const uploadRes = await callAppsScript(driveCfg.webhookUrl, {
              action: 'subir_foto_carta',
              base64: cleanB64,
              mimeType: detectedMime,
              fileName: archivoNombre,
            });
            if (uploadRes?.fileUrl) {
              fotoCartaFinal = String(uploadRes.fileUrl).trim();
            } else if (uploadRes?.driveError) {
              fotoCartaDriveError = String(uploadRes.driveError);
            }
          } catch (driveErr) {
            fotoCartaDriveError = String(driveErr?.message || driveErr);
            console.warn('[especiales-personal] aviso subiendo carta a Drive:', fotoCartaDriveError);
          }
        }
      }

      const creadas = [];
      let pendingAppsScriptUpdate = false;

      for (const item of itemsInput) {
        const cantidadNum = Math.max(1, Math.floor(Number(item.cantidad) || 1));
        const idFinal = generarIdEspecialPersonalUnico(existentesAcumulados, item.id);
        const notificadoFinal =
          rawCorreo || String(item.notificado || item.estado || 'Registrada').trim();

        const payload = {
          action: 'registrar_especial_personal',
          hoja: 'Especiales Personal',
          id: idFinal,
          fechaSolicitud: String(item.fechaSolicitud || '').trim(),
          usuario: String(item.usuario).trim(),
          cedula: String(item.cedula).trim(),
          nombre: String(item.nombre).trim(),
          sede: String(item.sede).trim(),
          producto: String(item.producto).trim(),
          cantidad: cantidadNum,
          motivo: String(item.motivo).trim(),
          semana: String(item.semana || '').match(/(\d+)/)?.[1] || String(item.semana || '').trim(),
          fechaEntrega: String(item.fechaEntrega).trim(),
          observacion: String(item.observacion || '').trim(),
          fotoCarta: fotoCartaFinal,
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

        const finalNueva = normalizarEspecialPersonal({
          ...payload,
          syncedToDrive,
          creadoEn: Date.now(),
        });

        creadas.push(finalNueva);
        existentesAcumulados.unshift(finalNueva);
      }

      const idsNuevos = new Set(creadas.map((c) => c.id));
      const actualizadas = [...creadas, ...existentes.filter((s) => !idsNuevos.has(s.id))];
      saveEspecialesPersonalStorage(actualizadas);

      const needsAppsScriptUpdate =
        !supportsEspecialesPersonal || sheetName.toLowerCase() !== 'especiales personal';

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
              action: 'notificar_especial_personal',
              correoDestino: rawCorreo,
              items: creadas,
              fotoCartaBase64: cleanB64 && cleanB64.length < 2500000 ? cleanB64 : '',
              fotoCartaMime: detectedMime,
              fotoCartaNombre: fotoNombreOrig || `Carta_${primerIdPreview}.jpg`,
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
              'La versión activa de Google Apps Script aún no incluye Especiales Personal. Actualice el código desde Administración → Google Drive e implemente una Nueva versión.',
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
        supportsEspecialesPersonal,
        supportsEmailNotification,
        especialesPersonalSheetName: sheetName,
        needsAppsScriptUpdate,
        fotoCartaDriveError,
        emailNotification,
      });
    }

    // GET
    const locales = getEspecialesPersonalStorage();
    if (driveCfg.webhookUrl) {
      try {
        const data = await callAppsScript(driveCfg.webhookUrl);
        if (
          data?.supportsEspecialesPersonal === true ||
          Array.isArray(data?.solicitudesEspecialesPersonal)
        ) {
          const sheetName = String(data?.especialesPersonalSheetName || '').trim();
          const needsAppsScriptUpdate = sheetName.toLowerCase() !== 'especiales personal';
          const supportsEmailNotification = !!data?.supportsEmailNotification;
          const deHoja = (data.solicitudesEspecialesPersonal || []).map((r) =>
            normalizarEspecialPersonal({ ...r, syncedToDrive: true })
          );
          const idsHoja = new Set(deHoja.map((r) => r.id));
          const pendientes = locales.filter((r) => !idsHoja.has(r.id) && r.syncedToDrive === false);
          const combinadas = [...pendientes, ...deHoja];
          saveEspecialesPersonalStorage(combinadas);
          return res.status(200).json({
            success: true,
            solicitudes: combinadas,
            source: 'sheets',
            sheetsSupported: true,
            supportsEmailNotification,
            especialesPersonalSheetName: sheetName,
            needsAppsScriptUpdate,
          });
        }
      } catch (e) {
        console.warn('[especiales-personal] lectura hoja:', e?.message || e);
      }
    }

    return res.status(200).json({
      success: true,
      solicitudes: locales,
      source: 'local',
      sheetsSupported: false,
      supportsEmailNotification: false,
      especialesPersonalSheetName: '',
      needsAppsScriptUpdate: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error en Especiales Personal',
    });
  }
}
