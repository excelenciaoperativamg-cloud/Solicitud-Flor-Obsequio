import {
  getEspecialesPersonalStorage,
  saveEspecialesPersonalStorage,
  saveCartaLocalFile,
  readCartaLocalFile,
  getDriveConfigStorage,
  getMaestroStorage,
  callAppsScript,
} from '../_lib/storage.js';

const CORREO_NOTIFICADO_FIJO_EP = 'angela.garcia@mg-consultores.com';
const ESTADO_INICIAL_EP = 'Pendiente Aprobación';
const ESTADOS_PERMITIDOS_EP = ['Pendiente Aprobación', 'Aprobado', 'No Aprobado'];

const MAX_SOLICITUDES_POR_ANO_EP = 2;

function normalizarTextoComp(raw) {
  return String(raw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarDigitosComp(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function esEstadoPendienteAprobacion(estado) {
  return normalizarTextoComp(estado) === 'PENDIENTE APROBACION';
}

function esEstadoNoAprobado(estado) {
  return normalizarTextoComp(estado) === 'NO APROBADO';
}

function obtenerAnoSolicitudEP(s) {
  const fSol = String(s?.fechaSolicitud || '').trim();
  if (/^\d{4}/.test(fSol)) return fSol.slice(0, 4);
  const fEnt = String(s?.fechaEntrega || '').trim();
  if (/^\d{4}/.test(fEnt)) return fEnt.slice(0, 4);
  if (s?.creadoEn && Number.isFinite(Number(s.creadoEn))) {
    return String(new Date(Number(s.creadoEn)).getFullYear());
  }
  return String(new Date().getFullYear());
}

function claveOcasionSolicitudEP(s) {
  const fSol = String(s?.fechaSolicitud || '').trim();
  const fEnt = String(s?.fechaEntrega || '').trim();
  const mot = normalizarTextoComp(s?.motivo);
  const corr = String(s?.correoConfirmacion || '').trim().toLowerCase();
  const col = normalizarTextoComp(s?.color);
  const compuesto = [fSol, fEnt, mot, corr, col].join('|');
  return compuesto.replace(/\|/g, '') ? compuesto : String(s?.id || Math.random());
}

function esSolicitudDelUsuario(solicitud, usuarioNombre, cedula) {
  const cedSol = normalizarDigitosComp(solicitud?.cedula);
  const cedUser = normalizarDigitosComp(cedula);
  if (cedSol && cedUser && cedSol === cedUser) return true;

  const nomUser = normalizarTextoComp(usuarioNombre);
  if (!nomUser) return false;
  const usuSol = normalizarTextoComp(solicitud?.usuario);
  const nomSol = normalizarTextoComp(solicitud?.nombre);
  return (usuSol && usuSol === nomUser) || (nomSol && nomSol === nomUser);
}

function esCargoAutorizadoEstado(cargoRaw) {
  const cargo = normalizarTextoComp(cargoRaw);
  if (!cargo) return false;
  if (cargo.includes('ANALISTA') && cargo.includes('GESTION') && cargo.includes('HUMANA')) {
    return true;
  }
  if (cargo.includes('ANALISTA') && cargo.includes('GESTION') && cargo.includes('INFORMACION')) {
    return true;
  }
  return cargo === 'ADMINISTRADOR' || cargo.startsWith('ADMINISTRADOR ');
}

function verificarAutorizacionEditorEstado(usuarioCodigo, usuarioCargo) {
  const cod = String(usuarioCodigo || '').trim().toUpperCase();
  if (cod) {
    const maestro = getMaestroStorage();
    if (Array.isArray(maestro) && maestro.length > 0) {
      const encontrado = maestro.find(
        (w) => String(w?.codigo || '').trim().toUpperCase() === cod
      );
      if (encontrado) {
        return esCargoAutorizadoEstado(encontrado.cargo);
      }
    }
  }
  return esCargoAutorizadoEstado(usuarioCargo);
}

function normalizarEspecialPersonal(s) {
  const cantidadNum = Number(s?.cantidad);
  const semanaStr = String(s?.semana || '').match(/(\d+)/)?.[1] || String(s?.semana || '').trim();
  const correoConfirmacionVal = String(s?.correoConfirmacion || '').trim();
  const notificadoVal = String(s?.notificado || '').trim();
  const estadoVal = String(s?.estado || ESTADO_INICIAL_EP).trim() || ESTADO_INICIAL_EP;
  return {
    id: String(s?.id || '').trim(),
    fechaSolicitud: String(s?.fechaSolicitud || s?.fecha || '').trim(),
    usuario: String(s?.usuario || '').trim(),
    cedula: String(s?.cedula || '').trim(),
    nombre: String(s?.nombre || '').trim(),
    sede: String(s?.sede || '').trim(),
    producto: String(s?.producto || '').trim(),
    color: String(s?.color || '').trim(),
    cantidad: cantidadNum && !Number.isNaN(cantidadNum) && cantidadNum > 0 ? cantidadNum : 1,
    motivo: String(s?.motivo || '').trim(),
    semana: semanaStr,
    fechaEntrega: String(s?.fechaEntrega || '').trim(),
    correoConfirmacion: correoConfirmacionVal,
    observacion: String(s?.observacion || '').trim(),
    fotoCarta: String(s?.fotoCarta || '').trim(),
    notificado: notificadoVal || CORREO_NOTIFICADO_FIJO_EP,
    estado: estadoVal,
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
        const correoConfRetry = String(
          itemsRetry[0]?.correoConfirmacion || body?.correoConfirmacion || ''
        ).trim();
        if (!driveCfg.webhookUrl) {
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: false,
              to: CORREO_NOTIFICADO_FIJO_EP,
              error: 'No hay URL de webhook de Google Apps Script configurada.',
            },
          });
        }
        try {
          const mailRes = await callAppsScript(driveCfg.webhookUrl, {
            action: 'notificar_especial_personal',
            correoDestino: CORREO_NOTIFICADO_FIJO_EP,
            correoConfirmacion: correoConfRetry,
            items: itemsRetry,
          });
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: !!mailRes?.emailSent,
              to: mailRes?.to || CORREO_NOTIFICADO_FIJO_EP,
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
              to: CORREO_NOTIFICADO_FIJO_EP,
              error: formatearErrorCorreo(mailErr?.message || mailErr),
            },
          });
        }
      }

      // Actualizar estado (solo Administrador y ANALISTA GESTIÓN HUMANA)
      if (body?.action === 'actualizar_estado') {
        if (!verificarAutorizacionEditorEstado(body?.usuarioCodigo, body?.usuarioCargo)) {
          return res.status(403).json({
            success: false,
            error:
              'Solo administradores y ANALISTA GESTIÓN HUMANA están autorizados para cambiar el estado.',
          });
        }

        const idTarget = String(body?.id || '').trim();
        const nuevoEstado = String(body?.estado || '').trim();
        if (!idTarget || !ESTADOS_PERMITIDOS_EP.includes(nuevoEstado)) {
          return res.status(400).json({
            success: false,
            error: 'Debe indicar un Id válido y un estado permitido (Pendiente Aprobación, Aprobado o No Aprobado).',
          });
        }

        let existentes = getEspecialesPersonalStorage();
        let pendingAppsScriptUpdate = false;
        let emailNotification = null;

        if (driveCfg.webhookUrl) {
          try {
            const sheetData = await callAppsScript(driveCfg.webhookUrl);
            if (sheetData?.supportsEspecialesPersonalEstado === true) {
              const updRes = await callAppsScript(driveCfg.webhookUrl, {
                action: 'actualizar_estado_especial_personal',
                id: idTarget,
                estado: nuevoEstado,
                actualizadoPor: String(body?.usuarioNombre || body?.usuarioCodigo || '').trim(),
                notificarCorreo: !!body?.notificarCorreo,
              });
              if (Array.isArray(updRes?.solicitudesEspecialesPersonal)) {
                existentes = updRes.solicitudesEspecialesPersonal.map((r) =>
                  normalizarEspecialPersonal({ ...r, syncedToDrive: true })
                );
              }
              if (updRes?.emailResult) {
                emailNotification = updRes.emailResult;
              }
            } else {
              pendingAppsScriptUpdate = true;
            }
          } catch (updErr) {
            pendingAppsScriptUpdate = true;
            console.warn('[especiales-personal] aviso actualizando estado en Apps Script:', updErr?.message || updErr);
          }
        }

        let encontradoLocal = false;
        const actualizadas = existentes.map((r) => {
          if (String(r?.id || '').trim().toUpperCase() === idTarget.toUpperCase()) {
            encontradoLocal = true;
            return normalizarEspecialPersonal({ ...r, estado: nuevoEstado });
          }
          return r;
        });

        if (encontradoLocal) {
          saveEspecialesPersonalStorage(actualizadas);
        }

        return res.status(200).json({
          success: true,
          id: idTarget,
          estado: nuevoEstado,
          solicitudes: actualizadas,
          pendingAppsScriptUpdate,
          emailNotification,
        });
      }

      // Enviar correo de respuesta al solicitante según el estado actual (Aprobado / No Aprobado)
      if (body?.action === 'notificar_respuesta') {
        if (!verificarAutorizacionEditorEstado(body?.usuarioCodigo, body?.usuarioCargo)) {
          return res.status(403).json({
            success: false,
            error:
              'Solo administradores y ANALISTA GESTIÓN HUMANA están autorizados para enviar la respuesta de estado.',
          });
        }

        const itemResp = body?.item || {};
        const correoResp = String(itemResp?.correoConfirmacion || '').trim();
        if (!EMAIL_REGEX.test(correoResp)) {
          return res.status(400).json({
            success: false,
            error: 'La solicitud no tiene un Correo de confirmación válido.',
          });
        }

        if (!driveCfg.webhookUrl) {
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: false,
              to: correoResp,
              error: 'No hay URL de webhook de Google Apps Script configurada.',
            },
          });
        }

        try {
          const sheetData = await callAppsScript(driveCfg.webhookUrl);
          if (sheetData?.supportsEspecialesPersonalEstado !== true) {
            return res.status(200).json({
              success: true,
              pendingAppsScriptUpdate: true,
              emailNotification: {
                requested: true,
                sent: false,
                to: correoResp,
                error:
                  'Actualice el código de Google Apps Script desde Administración → Google Drive (Nueva versión) para enviar respuestas desde el sistema.',
              },
            });
          }

          const mailRes = await callAppsScript(driveCfg.webhookUrl, {
            action: 'notificar_respuesta_especial_personal',
            item: itemResp,
          });
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: !!mailRes?.emailSent,
              to: mailRes?.to || correoResp,
              senderEmail: mailRes?.senderEmail || '',
              error: mailRes?.emailSent
                ? ''
                : formatearErrorCorreo(
                    mailRes?.emailError ||
                      mailRes?.message ||
                      'No se pudo enviar el correo de respuesta.'
                  ),
            },
          });
        } catch (errResp) {
          return res.status(200).json({
            success: true,
            emailNotification: {
              requested: true,
              sent: false,
              to: correoResp,
              error: formatearErrorCorreo(errResp?.message || errResp),
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

      const correoConfirmacionRaw = String(
        itemsInput[0]?.correoConfirmacion || body?.correoNotificacion || ''
      ).trim();

      let correoConfirmacionValido = '';
      if (correoConfirmacionRaw) {
        const parsedPersonal = parsearCorreos(correoConfirmacionRaw);
        if (!parsedPersonal.esValido || parsedPersonal.correos.length !== 1) {
          return res.status(400).json({
            success: false,
            error: 'Ingrese un Correo de confirmación válido.',
          });
        }
        correoConfirmacionValido = parsedPersonal.correos[0];
      } else {
        return res.status(400).json({
          success: false,
          error: 'Ingrese un Correo de confirmación para recibir la respuesta de Solicitud.',
        });
      }

      const rawCorreo = CORREO_NOTIFICADO_FIJO_EP;

      for (const item of itemsInput) {
        if (
          !item ||
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

        if (!String(item.color || '').trim()) {
          return res.status(400).json({
            success: false,
            error: 'Especifique el color que requiere.',
          });
        }

        const fechaSolStr = String(item.fechaSolicitud || '').trim();
        const fechaEntStr = String(item.fechaEntrega || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(fechaSolStr) && /^\d{4}-\d{2}-\d{2}$/.test(fechaEntStr)) {
          const [sy, sm, sd] = fechaSolStr.split('-').map(Number);
          const minDate = new Date(sy, sm - 1, sd);
          minDate.setDate(minDate.getDate() + 9);
          const minStr = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(
            2,
            '0'
          )}-${String(minDate.getDate()).padStart(2, '0')}`;
          if (fechaEntStr < minStr) {
            return res.status(400).json({
              success: false,
              error: `La fecha de entrega debe solicitarse con 10 días de anticipación (a partir del ${minStr}).`,
            });
          }
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

      // Bloquear si el solicitante ya tiene una solicitud en estado Pendiente Aprobación
      const primerSolicitante = itemsInput[0];
      const solicitudPendiente = existentes.find(
        (r) =>
          esEstadoPendienteAprobacion(r?.estado) &&
          (esSolicitudDelUsuario(r, primerSolicitante?.usuario, primerSolicitante?.cedula) ||
            esSolicitudDelUsuario(r, primerSolicitante?.nombre, primerSolicitante?.cedula))
      );
      if (solicitudPendiente) {
        return res.status(409).json({
          success: false,
          error: `Ya tiene una solicitud en estado Pendiente Aprobación (${solicitudPendiente.id}). No puede realizar una solicitud adicional hasta que sea aprobada o gestionada.`,
        });
      }

      // Limitar la solicitud por persona máximo 2 veces al año
      const anoObjetivo = obtenerAnoSolicitudEP(primerSolicitante);
      const ocasionesAno = new Set();
      for (const r of existentes) {
        if (esEstadoNoAprobado(r?.estado)) continue;
        if (obtenerAnoSolicitudEP(r) !== anoObjetivo) continue;
        const esMismoUsuario =
          esSolicitudDelUsuario(r, primerSolicitante?.usuario, primerSolicitante?.cedula) ||
          esSolicitudDelUsuario(r, primerSolicitante?.nombre, primerSolicitante?.cedula);
        if (esMismoUsuario) {
          ocasionesAno.add(claveOcasionSolicitudEP(r));
        }
      }
      if (ocasionesAno.size >= MAX_SOLICITUDES_POR_ANO_EP) {
        return res.status(409).json({
          success: false,
          error: `Ha alcanzado el límite máximo de ${MAX_SOLICITUDES_POR_ANO_EP} solicitudes al año (${anoObjetivo}) en Especiales Personal.`,
        });
      }

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
        const notificadoFinal = rawCorreo;
        const estadoFinal = String(item.estado || ESTADO_INICIAL_EP).trim() || ESTADO_INICIAL_EP;

        const payload = {
          action: 'registrar_especial_personal',
          hoja: 'Especiales Personal',
          id: idFinal,
          fechaSolicitud: String(item.fechaSolicitud || '').trim(),
          cedula: String(item.cedula).trim(),
          nombre: String(item.nombre).trim(),
          sede: String(item.sede).trim(),
          producto: String(item.producto).trim(),
          color: String(item.color || '').trim(),
          cantidad: cantidadNum,
          motivo: String(item.motivo).trim(),
          semana: String(item.semana || '').match(/(\d+)/)?.[1] || String(item.semana || '').trim(),
          fechaEntrega: String(item.fechaEntrega).trim(),
          correoConfirmacion: correoConfirmacionValido,
          observacion: String(item.observacion || '').trim(),
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
        requested: true,
        sent: false,
        to: rawCorreo,
        error: '',
        needsAppsScriptUpdate: false,
      };

      if (driveCfg.webhookUrl && targetSheetOk && supportsEmailNotification) {
        try {
          const mailRes = await callAppsScript(driveCfg.webhookUrl, {
            action: 'notificar_especial_personal',
            correoDestino: CORREO_NOTIFICADO_FIJO_EP,
            correoConfirmacion: correoConfirmacionValido,
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
