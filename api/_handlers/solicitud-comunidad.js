import {
  getSolicitudComunidadStorage,
  saveSolicitudComunidadStorage,
  saveCartaLocalFile,
  readCartaLocalFile,
  getDriveConfigStorage,
  callAppsScript,
} from '../_lib/storage.js';

const ESTADO_INICIAL_SC = 'Pendiente Aprobación';

function inferirSedePorProducto(producto) {
  const p = String(producto || '').trim().toLowerCase();
  if (p === 'alstroemeria') return 'HA';
  if (p === 'clavel') return 'SC';
  if (p.includes('rosa') || p === 'bouquet' || p.includes('gypso')) return 'MG';
  return '';
}

function normalizarSolicitudComunidad(s) {
  const cantidadNum = Number(s?.cantidad);
  const semanaStr = String(s?.semana || '').match(/(\d+)/)?.[1] || String(s?.semana || '').trim();
  const correoConfirmacionVal = String(s?.correoConfirmacion || '').trim();
  const notificadoVal = String(s?.notificado || 'Registrada').trim() || 'Registrada';
  const estadoVal = String(s?.estado || ESTADO_INICIAL_SC).trim() || ESTADO_INICIAL_SC;
  const prod = String(s?.producto || '').trim();
  const sede = String(s?.sede || inferirSedePorProducto(prod)).trim().toUpperCase();
  return {
    id: String(s?.id || '').trim(),
    fechaSolicitud: String(s?.fechaSolicitud || s?.fecha || '').trim(),
    usuario: String(s?.usuario || '').trim(),
    entidad: String(s?.entidad || '').trim(),
    motivo: String(s?.motivo || '').trim(),
    lugar: String(s?.lugar || '').trim(),
    sede,
    producto: prod,
    cantidad: cantidadNum && !Number.isNaN(cantidadNum) && cantidadNum > 0 ? cantidadNum : 1,
    semana: semanaStr,
    fechaEntrega: String(s?.fechaEntrega || '').trim(),
    correoConfirmacion: correoConfirmacionVal,
    observacion: String(s?.observacion || '').trim(),
    fotoCarta: String(s?.fotoCarta || '').trim(),
    notificado: notificadoVal,
    estado: estadoVal,
    syncedToDrive: s?.syncedToDrive !== false,
    creadoEn: s?.creadoEn || Date.now(),
  };
}

function generarIdSolicitudComunidadUnico(existentes, idSugerido) {
  const usados = new Set(existentes.map((s) => String(s?.id || '').trim()).filter(Boolean));
  const sugerido = String(idSugerido || '').trim();
  if (sugerido && !usados.has(sugerido)) return sugerido;

  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const s of existentes) {
    const m = String(s?.id || '').match(/^SC-(\d{4})-(\d+)$/i);
    if (m && Number(m[1]) === year) {
      maxNum = Math.max(maxNum, Number(m[2]));
    }
  }
  let nextNum = Math.max(maxNum + 1, existentes.length + 1);
  let candidate = `SC-${year}-${String(nextNum).padStart(3, '0')}`;
  while (usados.has(candidate)) {
    nextNum += 1;
    candidate = `SC-${year}-${String(nextNum).padStart(3, '0')}`;
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
    // Servir carta guardada localmente (/api/solicitud-comunidad/carta/:file o ?carta=...)
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
            action: 'notificar_solicitud_comunidad',
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
          error: 'Debe enviar al menos un producto para registrar en Solicitud Comunidad.',
        });
      }

      const candidatoNotificado = String(itemsInput[0]?.notificado || '').trim();
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

      const correoConfirmacionRaw = String(itemsInput[0]?.correoConfirmacion || '').trim();
      if (!EMAIL_REGEX.test(correoConfirmacionRaw)) {
        return res.status(400).json({
          success: false,
          error: 'Ingrese un Correo de confirmación válido para recibir la respuesta de Solicitud.',
        });
      }

      for (const item of itemsInput) {
        if (
          !item ||
          !item.usuario ||
          !item.entidad ||
          !item.motivo ||
          !item.producto ||
          !item.fechaEntrega
        ) {
          return res.status(400).json({
            success: false,
            error: 'Faltan campos obligatorios para registrar en Solicitud Comunidad.',
          });
        }
        const sedeDerivada =
          inferirSedePorProducto(item.producto) || String(item.sede || '').trim().toUpperCase();
        if (!sedeDerivada) {
          return res.status(400).json({
            success: false,
            error: 'Producto no válido para asignar sede automáticamente en Solicitud Comunidad.',
          });
        }
      }

      const tieneCartaAdjunta =
        String(body?.fotoCartaBase64 || '').trim().length > 0 ||
        String(itemsInput[0]?.fotoCarta || '').trim().length > 0;
      if (!tieneCartaAdjunta) {
        return res.status(400).json({
          success: false,
          error: 'Debe adjuntar la foto o PDF de la carta para registrar en Solicitud Comunidad.',
        });
      }

      let existentes = getSolicitudComunidadStorage();
      let supportsSolicitudComunidad = false;
      let supportsEmailNotification = false;
      let sheetName = '';

      if (driveCfg.webhookUrl) {
        try {
          const sheetData = await callAppsScript(driveCfg.webhookUrl);
          if (
            sheetData?.supportsSolicitudComunidad === true ||
            Array.isArray(sheetData?.solicitudesComunidad)
          ) {
            supportsSolicitudComunidad = true;
            supportsEmailNotification = !!sheetData?.supportsEmailNotification;
            sheetName = String(sheetData?.solicitudComunidadSheetName || '').trim();
            if (Array.isArray(sheetData.solicitudesComunidad)) {
              const deHoja = sheetData.solicitudesComunidad.map((r) =>
                normalizarSolicitudComunidad({ ...r, syncedToDrive: true })
              );
              const idsHoja = new Set(deHoja.map((r) => r.id));
              const pendientesLocales = existentes.filter(
                (r) => !idsHoja.has(r.id) && r.syncedToDrive === false
              );
              existentes = [...pendientesLocales, ...deHoja];
              saveSolicitudComunidadStorage(existentes);
            }
          }
        } catch (e) {
          console.warn('[solicitud-comunidad] verificación Apps Script:', e?.message || e);
        }
      }

      const targetSheetOk =
        supportsSolicitudComunidad && sheetName.toLowerCase() === 'solicitud comunidad';

      // Procesar foto de carta autorizada
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
      const primerIdPreview = generarIdSolicitudComunidadUnico(
        existentesAcumulados,
        itemsInput[0]?.id
      );

      if (cleanB64) {
        const ext = extensionDesdeMime(detectedMime);
        const archivoNombre =
          fotoNombreOrig || `Carta_${primerIdPreview}_${itemsInput[0].entidad}.${ext}`;

        const localSavedName = `${primerIdPreview}_${Date.now()}.${ext}`;
        try {
          const buf = Buffer.from(cleanB64, 'base64');
          saveCartaLocalFile(localSavedName, buf);
        } catch (fileErr) {
          console.warn('[solicitud-comunidad] aviso guardando carta local:', fileErr);
        }

        const localCartaPath = `/api/solicitud-comunidad/carta/${localSavedName}`;
        fotoCartaFinal = localCartaPath;

        if (driveCfg.webhookUrl && targetSheetOk) {
          try {
            const uploadRes = await callAppsScript(driveCfg.webhookUrl, {
              action: 'subir_foto_carta',
              base64: cleanB64,
              mimeType: detectedMime,
              fileName: archivoNombre,
              folderName: 'Cartas Autorizadas - Solicitud Comunidad',
            });
            if (uploadRes?.fileUrl) {
              fotoCartaFinal = String(uploadRes.fileUrl).trim();
            } else if (uploadRes?.driveError) {
              fotoCartaDriveError = String(uploadRes.driveError);
            }
          } catch (driveErr) {
            fotoCartaDriveError = String(driveErr?.message || driveErr);
            console.warn('[solicitud-comunidad] aviso subiendo carta a Drive:', fotoCartaDriveError);
          }
        }
      }

      const creadas = [];
      let pendingAppsScriptUpdate = false;

      for (const item of itemsInput) {
        const cantidadNum = Math.max(1, Math.floor(Number(item.cantidad) || 1));
        const idFinal = generarIdSolicitudComunidadUnico(existentesAcumulados, item.id);
        const notificadoFinal =
          rawCorreo || String(item.notificado || 'Registrada').trim() || 'Registrada';
        const estadoFinal = String(item.estado || ESTADO_INICIAL_SC).trim() || ESTADO_INICIAL_SC;

        const sedeFinal =
          inferirSedePorProducto(item.producto) || String(item.sede || '').trim().toUpperCase();

        const payload = {
          action: 'registrar_solicitud_comunidad',
          hoja: 'Solicitud Comunidad',
          id: idFinal,
          fechaSolicitud: String(item.fechaSolicitud || '').trim(),
          usuario: String(item.usuario).trim(),
          entidad: String(item.entidad).trim(),
          motivo: String(item.motivo).trim(),
          lugar: String(item.lugar || '').trim(),
          sede: sedeFinal,
          producto: String(item.producto).trim(),
          cantidad: cantidadNum,
          semana: String(item.semana || '').match(/(\d+)/)?.[1] || String(item.semana || '').trim(),
          fechaEntrega: String(item.fechaEntrega).trim(),
          correoConfirmacion: String(item.correoConfirmacion || correoConfirmacionRaw).trim(),
          fotoCarta: fotoCartaFinal,
          notificado: notificadoFinal,
          estado: estadoFinal,
        };

        let syncedToDrive = false;
        if (driveCfg.webhookUrl && targetSheetOk) {
          await callAppsScript(driveCfg.webhookUrl, payload);
          syncedToDrive = true;
        } else if (driveCfg.webhookUrl) {
          pendingAppsScriptUpdate = true;
        }

        const finalNueva = normalizarSolicitudComunidad({
          ...payload,
          syncedToDrive,
          creadoEn: Date.now(),
        });

        creadas.push(finalNueva);
        existentesAcumulados.unshift(finalNueva);
      }

      const idsNuevos = new Set(creadas.map((c) => c.id));
      const actualizadas = [...creadas, ...existentes.filter((s) => !idsNuevos.has(s.id))];
      saveSolicitudComunidadStorage(actualizadas);

      const needsAppsScriptUpdate =
        !supportsSolicitudComunidad || sheetName.toLowerCase() !== 'solicitud comunidad';

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
              action: 'notificar_solicitud_comunidad',
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
              'La versión activa de Google Apps Script aún no incluye Solicitud Comunidad. Actualice el código desde Administración → Google Drive e implemente una Nueva versión.',
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
        supportsSolicitudComunidad,
        supportsEmailNotification,
        solicitudComunidadSheetName: sheetName,
        needsAppsScriptUpdate,
        fotoCartaDriveError,
        emailNotification,
      });
    }

    // GET
    const locales = getSolicitudComunidadStorage();
    if (driveCfg.webhookUrl) {
      try {
        const data = await callAppsScript(driveCfg.webhookUrl);
        if (
          data?.supportsSolicitudComunidad === true ||
          Array.isArray(data?.solicitudesComunidad)
        ) {
          const sheetName = String(data?.solicitudComunidadSheetName || '').trim();
          const needsAppsScriptUpdate = sheetName.toLowerCase() !== 'solicitud comunidad';
          const supportsEmailNotification = !!data?.supportsEmailNotification;
          const deHoja = (data.solicitudesComunidad || []).map((r) =>
            normalizarSolicitudComunidad({ ...r, syncedToDrive: true })
          );
          const idsHoja = new Set(deHoja.map((r) => r.id));
          const pendientes = locales.filter((r) => !idsHoja.has(r.id) && r.syncedToDrive === false);
          const combinadas = [...pendientes, ...deHoja];
          saveSolicitudComunidadStorage(combinadas);
          return res.status(200).json({
            success: true,
            solicitudes: combinadas,
            source: 'sheets',
            sheetsSupported: true,
            supportsEmailNotification,
            solicitudComunidadSheetName: sheetName,
            needsAppsScriptUpdate,
          });
        }
      } catch (e) {
        console.warn('[solicitud-comunidad] lectura hoja:', e?.message || e);
      }
    }

    return res.status(200).json({
      success: true,
      solicitudes: locales,
      source: 'local',
      sheetsSupported: false,
      supportsEmailNotification: false,
      solicitudComunidadSheetName: '',
      needsAppsScriptUpdate: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error en Solicitud Comunidad',
    });
  }
}
