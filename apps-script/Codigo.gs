// ==============================================================
// CONECTOR OFICIAL: MG CONSULTORES - FLOR DE OBSEQUIO
// Hoja vinculada: Solicitud Flor Obsequio
// ==============================================================
var SPREADSHEET_ID = "1ecAKLTKJ-qrIWMGI5Rk1SpxhlTpfY6k5Gkyl4b5efzA";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function indiceColumna(headers, pistas) {
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").toUpperCase();
    for (var n = 0; n < pistas.length; n++) {
      if (h.indexOf(pistas[n]) !== -1) return c;
    }
  }
  return -1;
}

/** Busca la mejor columna: prioriza coincidencia más específica (más larga). */
function indiceColumnaEstricto(headers, pistas) {
  var mejor = -1;
  var mejorLen = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").toUpperCase().replace(/\s+/g, " ").trim();
    for (var n = 0; n < pistas.length; n++) {
      var p = String(pistas[n]).toUpperCase();
      if (h === p || h.indexOf(p) !== -1) {
        if (p.length > mejorLen) {
          mejor = c;
          mejorLen = p.length;
        }
      }
    }
  }
  return mejor;
}

function cargoDeFila(headers, row) {
  var i = indiceColumna(headers, ["CARGO"]);
  if (i >= 0 && row[i]) return String(row[i]).trim();
  return "";
}

function normSede(raw) {
  var t = String(raw || "").toUpperCase();
  if (t.indexOf("HA") !== -1) return "Sede HA";
  if (t.indexOf("SC") !== -1) return "Sede SC";
  return "Sede MG";
}

function leerTrabajadores(ss) {
  var sheets = ss.getSheets();
  var sheetMaestro = ss.getSheetByName("Maestro");
  if (!sheetMaestro) {
    for (var i = 0; i < sheets.length; i++) {
      if (String(sheets[i].getName() || "").toLowerCase().trim() === "maestro") {
        sheetMaestro = sheets[i];
        break;
      }
    }
  }
  if (!sheetMaestro) {
    for (var j = 0; j < sheets.length; j++) {
      var sName = String(sheets[j].getName() || "");
      var sLow = sName.toLowerCase().trim();
      if (
        sLow === "solicitudes" ||
        sLow.indexOf("solicitud") === 0 ||
        sLow.indexOf("especial") === 0
      ) {
        continue;
      }
      var lastCol = Math.min(sheets[j].getLastColumn() || 1, 10);
      var firstRow = sheets[j].getRange(1, 1, 1, lastCol).getValues()[0] || [];
      var joined = firstRow.join(" ").toUpperCase();
      if (
        joined.indexOf("NOMBRE") !== -1 &&
        (joined.indexOf("CÓDIGO") !== -1 || joined.indexOf("CODIGO") !== -1 || joined.indexOf("ID RH") !== -1)
      ) {
        sheetMaestro = sheets[j];
        break;
      }
    }
  }
  if (!sheetMaestro) return [];

  var data = sheetMaestro.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var headers = data[0] || [];
  var idxCodigo = indiceColumnaEstricto(headers, ["CÓDIGO", "CODIGO", "ID RH"]);
  if (idxCodigo < 0) idxCodigo = 0;
  var idxNombre = indiceColumnaEstricto(headers, ["NOMBRE"]);
  if (idxNombre < 0) idxNombre = 1;
  var idxSede = indiceColumnaEstricto(headers, ["SEDE"]);
  if (idxSede < 0) idxSede = 2;
  var idxCargo = indiceColumnaEstricto(headers, ["CARGO", "FUNCIÓN", "FUNCION"]);
  if (idxCargo < 0) idxCargo = 3;
  var idxEstado = indiceColumnaEstricto(headers, ["ESTADO"]);

  var workers = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var rawCod = row[idxCodigo];
    var rawNom = row[idxNombre];
    if (!rawCod || !rawNom) continue;
    if (rawNom instanceof Date) continue;

    var codigo = String(rawCod).trim();
    var nombre = String(rawNom).trim();
    if (!codigo || !nombre) continue;
    if (/^(SFO|SIE|SE)-\d{4}-/i.test(codigo)) continue;

    var activo = true;
    if (idxEstado >= 0 && row[idxEstado]) {
      activo = String(row[idxEstado]).trim().toLowerCase() !== "inactivo";
    }

    workers.push({
      codigo: codigo,
      nombre: nombre,
      sede: normSede(row[idxSede]),
      cargo: idxCargo >= 0 && row[idxCargo] ? String(row[idxCargo]).trim() : "",
      activo: activo
    });
  }
  return workers;
}

function leerSolicitudes(ss) {
  var sheet = ss.getSheetByName("Solicitudes");
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    function cel(pistas) {
      var i = indiceColumnaEstricto(headers, pistas);
      return i >= 0 ? row[i] : "";
    }
    var id = String(cel(["ID"]) || row[0] || "").trim();
    if (!id) continue;
    var producto = String(cel(["PRODUCTO"]) || "");
    var fechaEntrega = cel(["FECHA ENTREGA", "ENTREGA"]);
    if (fechaEntrega instanceof Date) {
      fechaEntrega = Utilities.formatDate(fechaEntrega, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var fecha = cel(["FECHA"]);
    // Evitar tomar "Fecha Entrega" como fecha de registro: si el header exacto es FECHA
    var idxFecha = -1;
    for (var c = 0; c < headers.length; c++) {
      var hh = String(headers[c] || "").toUpperCase().replace(/\s+/g, " ").trim();
      if (hh === "FECHA") { idxFecha = c; break; }
    }
    if (idxFecha >= 0) fecha = row[idxFecha];
    if (fecha instanceof Date) {
      fecha = Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var cantidadRaw = cel(["CANTIDAD"]);
    var cantidadNum = Number(cantidadRaw);
    if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;
    var florPrincipal = "Rosa";
    var prodLow = producto.toLowerCase();
    if (prodLow.indexOf("clavel") !== -1) florPrincipal = "Clavel";
    else if (prodLow.indexOf("alstroemeria") !== -1) florPrincipal = "Alstroemeria";
    out.push({
      id: id,
      fecha: String(fecha || ""),
      semana: String(cel(["SEMANA"]) || ""),
      codigo: String(cel(["CÓDIGO", "CODIGO"]) || ""),
      nombre: String(cel(["NOMBRE"]) || ""),
      cargo: String(cel(["CARGO"]) || ""),
      cantidad: cantidadNum,
      producto: producto,
      tipoProducto: prodLow.indexOf("bouquet") !== -1 ? "bouquet" : "ramo",
      florPrincipal: florPrincipal,
      sede: normSede(cel(["SEDE"])),
      motivo: String(cel(["MOTIVO"]) || ""),
      fechaEntrega: String(fechaEntrega || ""),
      remitente: String(cel(["REMITENTE"]) || ""),
      estado: String(cel(["ESTADO"]) || "Registrada"),
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function buscarHojaPorNombre(ss, nombres) {
  for (var i = 0; i < nombres.length; i++) {
    var exact = ss.getSheetByName(nombres[i]);
    if (exact) return exact;
  }
  var sheets = ss.getSheets();
  for (var j = 0; j < nombres.length; j++) {
    var target = String(nombres[j]).toLowerCase().trim();
    for (var s = 0; s < sheets.length; s++) {
      if (String(sheets[s].getName() || "").toLowerCase().trim() === target) {
        return sheets[s];
      }
    }
  }
  return null;
}

function leerSolicitudesIntExt(ss) {
  var sheet = buscarHojaPorNombre(ss, ["Especiales Empresa"]);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    function cel(pistas) {
      var i = indiceColumnaEstricto(headers, pistas);
      return i >= 0 ? row[i] : "";
    }
    var id = String(cel(["ID"]) || row[0] || "").trim();
    if (!id) continue;
    var fechaSolicitud = cel(["FECHA SOLICITUD", "FECHA DE SOLICITUD", "FECHA"]);
    if (fechaSolicitud instanceof Date) {
      fechaSolicitud = Utilities.formatDate(fechaSolicitud, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var fechaEntrega = cel(["FECHA ENTREGA", "FECHA DE ENTREGA", "ENTREGA"]);
    if (fechaEntrega instanceof Date) {
      fechaEntrega = Utilities.formatDate(fechaEntrega, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var cantidadRaw = cel(["CANTIDAD"]);
    var cantidadNum = Number(cantidadRaw);
    if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;
    var notificadoVal = String(cel(["NOTIFICADO", "ESTADO"]) || "Registrada");
    out.push({
      id: id,
      fechaSolicitud: String(fechaSolicitud || ""),
      codigo: String(cel(["CÓDIGO", "CODIGO"]) || ""),
      nombre: String(cel(["NOMBRE"]) || ""),
      sede: String(cel(["SEDE"]) || ""),
      area: String(cel(["ÁREA", "AREA"]) || ""),
      producto: String(cel(["PRODUCTO"]) || ""),
      cantidad: cantidadNum,
      motivo: String(cel(["MOTIVO"]) || ""),
      semana: String(cel(["SEMANA"]) || ""),
      fechaEntrega: String(fechaEntrega || ""),
      observacion: String(cel(["OBSERVACIÓN", "OBSERVACION", "OBSERVACIONES"]) || ""),
      notificado: notificadoVal,
      estado: notificadoVal,
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Envía un correo corporativo HTML con toda la información de la solicitud Especiales Empresa.
 */
function enviarCorreoNotificacionIntExt(ss, correoDestino, items) {
  var email = String(correoDestino || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { emailSent: false, emailError: "Correo corporativo de destino inválido." };
  }

  var lista = (items && items.length) ? items : [];
  if (lista.length === 0) {
    return { emailSent: false, emailError: "No hay datos de solicitud para notificar." };
  }

  var primera = lista[0];
  var ids = [];
  var totalRamos = 0;
  var filasHtml = "";
  var filasTexto = "";

  for (var i = 0; i < lista.length; i++) {
    var it = lista[i];
    var cant = Number(it.cantidad) || 1;
    totalRamos += cant;
    ids.push(String(it.id || ""));
    var bgFila = (i % 2 === 0) ? "#ffffff" : "#f8fafc";

    filasHtml +=
      "<tr style=\"background-color:" + bgFila + ";\">" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#0a2958;white-space:nowrap;\">" + escapeHtml(it.id) + "</td>" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;\">" + escapeHtml(it.producto) + "</td>" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#0a2958;text-align:right;white-space:nowrap;\">" + cant + " ramos</td>" +
      "</tr>";

    filasTexto += "  - " + String(it.id || "") + " | " + String(it.producto || "") + ": " + cant + " ramos\n";
  }

  var idsTexto = ids.join(", ");
  var semanaTexto = primera.semana ? ("Semana " + primera.semana) : "—";
  var obsTexto = String(primera.observacion || "").trim();
  var notificadoTexto = String(primera.notificado || primera.estado || email).trim();

  var asunto = "Flor de Obsequio - Especiales Empresa: " + idsTexto + " (" + String(primera.motivo || "Solicitud") + ")";

  var textBody =
    "FLOR DE OBSEQUIO - ESPECIALES EMPRESA\n" +
    "NOTIFICACIÓN DE NUEVA SOLICITUD\n" +
    "==================================================\n" +
    "Id(s): " + idsTexto + "\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\n" +
    "Registrado por: " + String(primera.nombre || "") + " (" + String(primera.codigo || "") + ")\n" +
    "Sede: " + String(primera.sede || "") + "\n" +
    "Área: " + String(primera.area || "") + "\n" +
    "Motivo: " + String(primera.motivo || "") + "\n" +
    "Semana: " + semanaTexto + "\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\n" +
    "Notificado a: " + notificadoTexto + "\n" +
    "Observación: " + (obsTexto || "Sin observaciones adicionales.") + "\n\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\n" +
    filasTexto + "\n" +
    "Registro almacenado en Google Sheets (hoja Especiales Empresa).\n";

  var htmlBody =
    "<!DOCTYPE html>" +
    "<html lang=\"es\">" +
    "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head>" +
    "<body style=\"margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;\">" +
      "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color:#f1f5f9;padding:24px 12px;\">" +
        "<tr><td align=\"center\">" +
          "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:620px;background-color:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;\">" +
            "<tr><td style=\"height:5px;background-color:#E60000;font-size:0;line-height:0;\">&nbsp;</td></tr>" +
            "<tr><td style=\"background-color:#0a2958;padding:24px 28px;color:#ffffff;\">" +
              "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">" +
                "<tr>" +
                  "<td style=\"vertical-align:top;\">" +
                    "<div style=\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\">SISTEMA FLOR DE OBSEQUIO &bull; ESPECIALES EMPRESA</div>" +
                    "<div style=\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\">Nueva Solicitud Registrada</div>" +
                    "<div style=\"font-size:13px;color:#cbd5e1;margin-top:4px;\">Notificación automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\"right\" style=\"vertical-align:top;padding-left:12px;\">" +
                    "<div style=\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\">FO</div>" +
                  "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\"background-color:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 28px;\">" +
              "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">" +
                "<tr>" +
                  "<td width=\"38%\" style=\"vertical-align:top;padding-right:8px;\">" +
                    "<div style=\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;\">Id(s) de Registro</div>" +
                    "<div style=\"font-family:'Courier New',monospace;font-size:13px;font-weight:800;color:#0a2958;margin-top:3px;word-break:break-word;\">" + escapeHtml(idsTexto) + "</div>" +
                  "</td>" +
                  "<td width=\"31%\" style=\"vertical-align:top;padding:0 8px;border-left:1px solid #e2e8f0;\">" +
                    "<div style=\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;\">Semana Programada</div>" +
                    "<div style=\"font-size:14px;font-weight:800;color:#E60000;margin-top:3px;\">" + escapeHtml(semanaTexto) + "</div>" +
                  "</td>" +
                  "<td width=\"31%\" style=\"vertical-align:top;padding-left:12px;border-left:1px solid #e2e8f0;\">" +
                    "<div style=\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;\">Total Solicitado</div>" +
                    "<div style=\"font-family:'Courier New',monospace;font-size:14px;font-weight:800;color:#0a2958;margin-top:3px;\">" + totalRamos + " ramos</div>" +
                  "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\"padding:24px 28px 8px 28px;\">" +
              "<div style=\"font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#0a2958;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:12px;\">Información General de la Solicitud</div>" +
              "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"font-size:13px;\">" +
                "<tr>" +
                  "<td width=\"40%\" style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Fecha de Solicitud</td>" +
                  "<td width=\"60%\" style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.fechaSolicitud || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Fecha de Entrega</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.fechaEntrega || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Solicitado / Registrado por</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.nombre || "") + " (" + escapeHtml(primera.codigo || "") + ")</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Sede / Área</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.sede || "") + " &middot; " + escapeHtml(primera.area || "") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Motivo</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;\">Notificado</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#047857;text-align:right;\">" + escapeHtml(notificadoTexto) + "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\"padding:18px 28px 8px 28px;\">" +
              "<div style=\"font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#0a2958;margin-bottom:10px;\">Detalle de Productos Solicitados</div>" +
              "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;border-collapse:collapse;\">" +
                "<thead>" +
                  "<tr style=\"background-color:#0a2958;color:#ffffff;\">" +
                    "<th align=\"left\" style=\"padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;\">Id</th>" +
                    "<th align=\"left\" style=\"padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;\">Producto</th>" +
                    "<th align=\"right\" style=\"padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;\">Cantidad</th>" +
                  "</tr>" +
                "</thead>" +
                "<tbody>" + filasHtml + "</tbody>" +
                "<tfoot>" +
                  "<tr style=\"background-color:#f1f5f9;\">" +
                    "<td colspan=\"2\" style=\"padding:10px 12px;font-size:12px;font-weight:800;color:#0a2958;\">Total general (" + lista.length + (lista.length === 1 ? " producto" : " productos") + ")</td>" +
                    "<td style=\"padding:10px 12px;font-family:'Courier New',monospace;font-size:13px;font-weight:800;color:#E60000;text-align:right;\">" + totalRamos + " ramos</td>" +
                  "</tr>" +
                "</tfoot>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\"padding:16px 28px 20px 28px;\">" +
              "<div style=\"background-color:#f8fafc;border-left:4px solid #0a2958;border-radius:6px;padding:12px 14px;\">" +
                "<div style=\"font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-bottom:4px;\">Observación</div>" +
                "<div style=\"font-size:13px;line-height:1.5;color:" + (obsTexto ? "#1e293b" : "#64748b") + ";font-style:" + (obsTexto ? "normal" : "italic") + ";\">" +
                  escapeHtml(obsTexto || "Sin observaciones adicionales.") +
                "</div>" +
              "</div>" +
            "</td></tr>" +

            "<tr><td style=\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11px;color:#64748b;\">" +
              "<strong>Sistema Flor de Obsequio</strong> &bull; Registro guardado en hoja Especiales Empresa &bull; Notificación automática." +
            "</td></tr>" +
          "</table>" +
        "</td></tr>" +
      "</table>" +
    "</body>" +
    "</html>";

  var senderEmail = "";
  try {
    senderEmail = Session.getEffectiveUser().getEmail() || "";
  } catch (ue) {}

  try {
    MailApp.sendEmail({
      to: email,
      subject: asunto,
      body: textBody,
      htmlBody: htmlBody,
      name: "Notificaciones Flor de Obsequio"
    });
    var quotaRemaining = null;
    try { quotaRemaining = MailApp.getRemainingDailyQuota(); } catch (qe) {}
    return { emailSent: true, to: email, senderEmail: senderEmail, quotaRemaining: quotaRemaining };
  } catch (mailErr) {
    return { emailSent: false, to: email, senderEmail: senderEmail, emailError: String(mailErr) };
  }
}

/**
 * Ejecute esta función una vez desde el editor de Apps Script (▶ Ejecutar)
 * para otorgar permisos de envío de correos (MailApp) sin enviar mensajes.
 */
function autorizarEnvioCorreos() {
  var cuota = MailApp.getRemainingDailyQuota();
  Logger.log("Permiso MailApp autorizado. Cuota diaria restante: " + cuota);
  return {
    status: "success",
    message: "Permisos de envío de correo autorizados. Cuota diaria restante: " + cuota
  };
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return responder({ status: "error", message: "No se pudo abrir la hoja" });
    var workers = leerTrabajadores(ss);
    var solicitudes = leerSolicitudes(ss);
    var solicitudesIntExt = leerSolicitudesIntExt(ss);
    var hojaIntExt = buscarHojaPorNombre(ss, ["Especiales Empresa"]);
    return responder({
      status: "success",
      message: "Conexión exitosa",
      spreadsheetName: ss.getName(),
      totalWorkers: workers.length,
      workers: workers,
      solicitudes: solicitudes,
      solicitudesIntExt: solicitudesIntExt,
      supportsIntExt: true,
      supportsEmailNotification: true,
      intExtSheetName: hojaIntExt ? hojaIntExt.getName() : "Especiales Empresa"
    });
  } catch (err) {
    return responder({ status: "error", message: String(err) });
  }
}

/**
 * Escribe una fila alineada al orden real de la hoja:
 * Id | Fecha | Semana | Código | Nombre | Cargo | Sede | Producto | Cantidad | Motivo | Fecha Entrega | Remitente | Estado
 */
function escribirSolicitud(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha", "Semana", "Código", "Nombre", "Cargo", "Sede",
    "Producto", "Cantidad", "Motivo", "Fecha Entrega", "Remitente", "Estado"
  ];
  if (!headers.length || !headers[0]) {
    headers = headersDefault;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  }

  var cantidadNum = Number(data.cantidad);
  if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;

  // Valores por tipo de columna (pistas de mayor a menor especificidad)
  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\s+/g, " ").trim();
    if (h === "ID" || h === "ID.") return data.id || ("SFO-" + new Date().getTime());
    if (h === "FECHA ENTREGA" || (h.indexOf("ENTREGA") !== -1 && h.indexOf("FECHA") !== -1)) {
      return data.fechaEntrega || "";
    }
    if (h === "FECHA") return data.fecha || "";
    if (h.indexOf("SEMANA") !== -1) return data.semana || "";
    if (h.indexOf("CÓDIGO") !== -1 || h.indexOf("CODIGO") !== -1) return data.codigo || "";
    if (h.indexOf("NOMBRE") !== -1) return data.nombre || "";
    if (h.indexOf("CARGO") !== -1) return data.cargo || "";
    if (h.indexOf("SEDE") !== -1) return data.sede || "";
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
    if (h.indexOf("CANTIDAD") !== -1) return cantidadNum;
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "Obsequio";
    if (h.indexOf("REMITENTE") !== -1) return data.remitente || "";
    if (h.indexOf("ESTADO") !== -1) return data.estado || "Registrada";
    return "";
  }

  var fila = [];
  for (var c = 0; c < headers.length; c++) {
    fila.push(valorParaHeader(headers[c]));
  }
  sheet.appendRow(fila);
}

/**
 * Escribe una fila en la hoja Especiales Empresa:
 * Id | Fecha Solicitud | Código | Nombre | Sede | Area | Producto | Cantidad | Motivo | Semana | Fecha Entrega | Observación | Notificado
 */
function escribirSolicitudIntExt(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Código", "Nombre", "Sede", "Area",
    "Producto", "Cantidad", "Motivo", "Semana", "Fecha Entrega", "Observación", "Notificado"
  ];
  if (!headers.length || !headers[0]) {
    headers = headersDefault;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  }

  var cantidadNum = Number(data.cantidad);
  if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;

  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\s+/g, " ").trim();
    if (h === "ID" || h === "ID.") return data.id || ("SIE-" + new Date().getTime());
    if (h.indexOf("ENTREGA") !== -1) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CÓDIGO") !== -1 || h.indexOf("CODIGO") !== -1) return data.codigo || "";
    if (h.indexOf("NOMBRE") !== -1) return data.nombre || "";
    if (h.indexOf("SEDE") !== -1) return data.sede || "";
    if (h.indexOf("ÁREA") !== -1 || h.indexOf("AREA") !== -1) return data.area || "";
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
    if (h.indexOf("CANTIDAD") !== -1) return cantidadNum;
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "";
    if (h.indexOf("SEMANA") !== -1) return data.semana || "";
    if (h.indexOf("OBSERVACI") !== -1) return data.observacion || "";
    if (h.indexOf("NOTIFICAD") !== -1 || h.indexOf("ESTADO") !== -1) return data.notificado || data.estado || "Registrada";
    return "";
  }

  var fila = [];
  for (var c = 0; c < headers.length; c++) {
    fila.push(valorParaHeader(headers[c]));
  }
  sheet.appendRow(fila);
}

function doPost(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return responder({ status: "error", message: "No se pudo abrir la hoja" });
    var raw = e && e.postData ? e.postData.contents : "";
    var data = {};
    try { data = JSON.parse(raw); } catch (pe) { data = (e && e.parameter) ? e.parameter : {}; }

    if (data.action === "ping" || data.action === "listar") {
      var workers = leerTrabajadores(ss);
      var hojaIntExtPing = buscarHojaPorNombre(ss, ["Especiales Empresa"]);
      return responder({
        status: "success",
        message: data.action === "ping" ? "Ping recibido" : "Listado",
        spreadsheetName: ss.getName(),
        totalWorkers: workers.length,
        workers: workers,
        solicitudes: leerSolicitudes(ss),
        solicitudesIntExt: leerSolicitudesIntExt(ss),
        supportsIntExt: true,
        supportsEmailNotification: true,
        intExtSheetName: hojaIntExtPing ? hojaIntExtPing.getName() : "Especiales Empresa"
      });
    }

    if (data.action === "notificar_int_ext") {
      var itemsCorreo = (data.items && data.items.length) ? data.items : [data];
      var destinoCorreo = data.correoDestino || data.correo || (itemsCorreo[0] ? (itemsCorreo[0].notificado || itemsCorreo[0].estado) : "");
      var resMail = enviarCorreoNotificacionIntExt(ss, destinoCorreo, itemsCorreo);
      return responder({
        status: "success",
        emailSent: !!resMail.emailSent,
        to: resMail.to || destinoCorreo || "",
        senderEmail: resMail.senderEmail || "",
        quotaRemaining: resMail.quotaRemaining,
        emailError: resMail.emailError || "",
        message: resMail.emailError || (resMail.emailSent ? "Correo enviado" : ""),
        supportsEmailNotification: true
      });
    }

    if (data.action === "registrar_int_ext" || data.hoja === "Especiales Empresa") {
      var sheetIntExt = buscarHojaPorNombre(ss, ["Especiales Empresa"]) || ss.insertSheet("Especiales Empresa");
      escribirSolicitudIntExt(sheetIntExt, data);
      return responder({
        status: "success",
        message: "Solicitud registrada en " + sheetIntExt.getName(),
        id: data.id,
        solicitudesIntExt: leerSolicitudesIntExt(ss),
        supportsIntExt: true,
        supportsEmailNotification: true,
        intExtSheetName: sheetIntExt.getName()
      });
    }

    var sheet = ss.getSheetByName("Solicitudes");
    if (!sheet) sheet = ss.insertSheet("Solicitudes");
    escribirSolicitud(sheet, data);
    return responder({
      status: "success",
      message: "Solicitud registrada en Solicitudes",
      id: data.id,
      cantidad: Number(data.cantidad) || 1,
      fechaEntrega: data.fechaEntrega || "",
      solicitudes: leerSolicitudes(ss)
    });
  } catch (err) {
    return responder({ status: "error", message: String(err) });
  }
}
