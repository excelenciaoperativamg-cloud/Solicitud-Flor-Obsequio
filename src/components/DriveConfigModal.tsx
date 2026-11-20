import React, { useState } from 'react';
import { Cloud, CheckCircle2, Copy, ExternalLink, ShieldCheck, RefreshCw, AlertTriangle, HelpCircle, Check, ArrowRight } from 'lucide-react';
import { DriveConfig } from '../services/apiClient';

interface DriveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DriveConfig;
  onGuardarConfig: (webhookUrl: string, spreadsheetUrl: string) => Promise<void>;
  onProbarConexion: (targetUrl?: string) => Promise<{ success: boolean; error?: string; response?: string }>;
}

export const DriveConfigModal: React.FC<DriveConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onGuardarConfig,
  onProbarConexion,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || '');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(
    config.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGI5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit'
  );
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [probando, setProbando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<{ success: boolean; mensaje: string } | null>(null);

  if (!isOpen) return null;

  // Código optimizado específicamente para el archivo oficial "Solicitud Flor Obsequio" (ID: 1ecAKLTKJ-qrIWMGI5Rk1SpxhlTpfY6k5Gkyl4b5efzA)
  const codigoAppsScript = `// ==============================================================
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
    var h = String(headers[c] || "").toUpperCase().replace(/\\s+/g, " ").trim();
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
    if (/^(SFO|SIE|SE)-\\d{4}-/i.test(codigo)) continue;

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
    var idxFecha = -1;
    for (var c = 0; c < headers.length; c++) {
      var hh = String(headers[c] || "").toUpperCase().replace(/\\s+/g, " ").trim();
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
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
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
      "<tr style=\\"background-color:" + bgFila + ";\\">" +
        "<td style=\\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#0a2958;white-space:nowrap;\\">" + escapeHtml(it.id) + "</td>" +
        "<td style=\\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;\\">" + escapeHtml(it.producto) + "</td>" +
        "<td style=\\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#0a2958;text-align:right;white-space:nowrap;\\">" + cant + " ramos</td>" +
      "</tr>";

    filasTexto += "  - " + String(it.id || "") + " | " + String(it.producto || "") + ": " + cant + " ramos\\n";
  }

  var idsTexto = ids.join(", ");
  var semanaTexto = primera.semana ? ("Semana " + primera.semana) : "—";
  var obsTexto = String(primera.observacion || "").trim();
  var notificadoTexto = String(primera.notificado || primera.estado || email).trim();

  var asunto = "Flor de Obsequio - Especiales Empresa: " + idsTexto + " (" + String(primera.motivo || "Solicitud") + ")";

  var textBody =
    "FLOR DE OBSEQUIO - ESPECIALES EMPRESA\\n" +
    "NOTIFICACIÓN DE NUEVA SOLICITUD\\n" +
    "==================================================\\n" +
    "Id(s): " + idsTexto + "\\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\\n" +
    "Registrado por: " + String(primera.nombre || "") + " (" + String(primera.codigo || "") + ")\\n" +
    "Sede: " + String(primera.sede || "") + "\\n" +
    "Área: " + String(primera.area || "") + "\\n" +
    "Motivo: " + String(primera.motivo || "") + "\\n" +
    "Semana: " + semanaTexto + "\\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\\n" +
    "Notificado a: " + notificadoTexto + "\\n" +
    "Observación: " + (obsTexto || "Sin observaciones adicionales.") + "\\n\\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\\n" +
    filasTexto + "\\n" +
    "Registro almacenado en Google Sheets (hoja Especiales Empresa).\\n";

  var htmlBody =
    "<!DOCTYPE html>" +
    "<html lang=\\"es\\">" +
    "<head><meta charset=\\"UTF-8\\"><meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1.0\\"></head>" +
    "<body style=\\"margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;\\">" +
      "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\" style=\\"background-color:#f1f5f9;padding:24px 12px;\\">" +
        "<tr><td align=\\"center\\">" +
          "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\" style=\\"max-width:620px;background-color:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;\\">" +
            "<tr><td style=\\"height:5px;background-color:#E60000;font-size:0;line-height:0;\\">&nbsp;</td></tr>" +
            "<tr><td style=\\"background-color:#0a2958;padding:24px 28px;color:#ffffff;\\">" +
              "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\">" +
                "<tr>" +
                  "<td style=\\"vertical-align:top;\\">" +
                    "<div style=\\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\\">SISTEMA FLOR DE OBSEQUIO &bull; ESPECIALES EMPRESA</div>" +
                    "<div style=\\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\\">Nueva Solicitud Registrada</div>" +
                    "<div style=\\"font-size:13px;color:#cbd5e1;margin-top:4px;\\">Notificación automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\\"right\\" style=\\"vertical-align:top;padding-left:12px;\\">" +
                    "<div style=\\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\\">FO</div>" +
                  "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\\"background-color:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 28px;\\">" +
              "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\">" +
                "<tr>" +
                  "<td width=\\"38%\\" style=\\"vertical-align:top;padding-right:8px;\\">" +
                    "<div style=\\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;\\">Id(s) de Registro</div>" +
                    "<div style=\\"font-family:'Courier New',monospace;font-size:13px;font-weight:800;color:#0a2958;margin-top:3px;word-break:break-word;\\">" + escapeHtml(idsTexto) + "</div>" +
                  "</td>" +
                  "<td width=\\"31%\\" style=\\"vertical-align:top;padding:0 8px;border-left:1px solid #e2e8f0;\\">" +
                    "<div style=\\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;\\">Semana Programada</div>" +
                    "<div style=\\"font-size:14px;font-weight:800;color:#E60000;margin-top:3px;\\">" + escapeHtml(semanaTexto) + "</div>" +
                  "</td>" +
                  "<td width=\\"31%\\" style=\\"vertical-align:top;padding-left:12px;border-left:1px solid #e2e8f0;\\">" +
                    "<div style=\\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;\\">Total Solicitado</div>" +
                    "<div style=\\"font-family:'Courier New',monospace;font-size:14px;font-weight:800;color:#0a2958;margin-top:3px;\\">" + totalRamos + " ramos</div>" +
                  "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\\"padding:24px 28px 8px 28px;\\">" +
              "<div style=\\"font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#0a2958;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:12px;\\">Información General de la Solicitud</div>" +
              "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\" style=\\"font-size:13px;\\">" +
                "<tr>" +
                  "<td width=\\"40%\\" style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Fecha de Solicitud</td>" +
                  "<td width=\\"60%\\" style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.fechaSolicitud || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Fecha de Entrega</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.fechaEntrega || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Solicitado / Registrado por</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.nombre || "") + " (" + escapeHtml(primera.codigo || "") + ")</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Sede / Área</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.sede || "") + " &middot; " + escapeHtml(primera.area || "") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Motivo</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;\\">Notificado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#047857;text-align:right;\\">" + escapeHtml(notificadoTexto) + "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\\"padding:18px 28px 8px 28px;\\">" +
              "<div style=\\"font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#0a2958;margin-bottom:10px;\\">Detalle de Productos Solicitados</div>" +
              "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\" style=\\"border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;border-collapse:collapse;\\">" +
                "<thead>" +
                  "<tr style=\\"background-color:#0a2958;color:#ffffff;\\">" +
                    "<th align=\\"left\\" style=\\"padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;\\">Id</th>" +
                    "<th align=\\"left\\" style=\\"padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;\\">Producto</th>" +
                    "<th align=\\"right\\" style=\\"padding:9px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;\\">Cantidad</th>" +
                  "</tr>" +
                "</thead>" +
                "<tbody>" + filasHtml + "</tbody>" +
                "<tfoot>" +
                  "<tr style=\\"background-color:#f1f5f9;\\">" +
                    "<td colspan=\\"2\\" style=\\"padding:10px 12px;font-size:12px;font-weight:800;color:#0a2958;\\">Total general (" + lista.length + (lista.length === 1 ? " producto" : " productos") + ")</td>" +
                    "<td style=\\"padding:10px 12px;font-family:'Courier New',monospace;font-size:13px;font-weight:800;color:#E60000;text-align:right;\\">" + totalRamos + " ramos</td>" +
                  "</tr>" +
                "</tfoot>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\\"padding:16px 28px 20px 28px;\\">" +
              "<div style=\\"background-color:#f8fafc;border-left:4px solid #0a2958;border-radius:6px;padding:12px 14px;\\">" +
                "<div style=\\"font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-bottom:4px;\\">Observación</div>" +
                "<div style=\\"font-size:13px;line-height:1.5;color:" + (obsTexto ? "#1e293b" : "#64748b") + ";font-style:" + (obsTexto ? "normal" : "italic") + ";\\">" +
                  escapeHtml(obsTexto || "Sin observaciones adicionales.") +
                "</div>" +
              "</div>" +
            "</td></tr>" +

            "<tr><td style=\\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11px;color:#64748b;\\">" +
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

  // Coincidencia exacta para ID y FECHA evita que "CANTIDAD" coincida con "ID"
  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\\s+/g, " ").trim();
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
    var h = String(headerRaw || "").toUpperCase().replace(/\\s+/g, " ").trim();
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
`;

  const copiarCodigo = () => {
    navigator.clipboard.writeText(codigoAppsScript);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 2500);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardarConfig(webhookUrl, spreadsheetUrl);
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  const handleTest = async () => {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      await onGuardarConfig(webhookUrl, spreadsheetUrl);
      const res = await onProbarConexion(webhookUrl);
      if (res.success) {
        setResultadoPrueba({
          success: true,
          mensaje: res.response || '¡Conexión automática exitosa! Google Drive respondió y se sincronizó correctamente.',
        });
      } else {
        setResultadoPrueba({
          success: false,
          mensaje: res.error || 'No se recibió respuesta exitosa de Apps Script.',
        });
      }
    } catch (err: any) {
      setResultadoPrueba({ success: false, mensaje: err.message || 'Error al conectar' });
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0a2958] text-white flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0a2958]">
                Conexión Automática con su Hoja de Google Drive
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                "Solicitud Flor Obsequio" • Sin pedir correo ni contraseñas a los trabajadores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* ALERTA: PASO CLAVE QUE FALTABA */}
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs mb-4 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-amber-950">
              ¿Por qué no sincronizaba al pegar el script?
            </h4>
            <p className="mt-1 leading-relaxed text-amber-900">
              En Google Apps Script, después de pegar o modificar el código, es <strong>obligatorio crear una "Nueva versión"</strong> al implementar. Si solo se pega el código, la URL continúa ejecutando la versión vieja.
            </p>
          </div>
        </div>

        {/* PASOS DE 1 MINUTO PARA SOLUCIONARLO */}
        <div className="bg-[#0a2958]/5 rounded-xl p-4 border border-[#0a2958]/20 space-y-2 mb-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[#0a2958] flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#E60000]" />
              Siga estos 3 pasos rápidos en su hoja:
            </span>
            <button
              type="button"
              onClick={copiarCodigo}
              className="text-xs font-bold px-3 py-1 bg-[#0a2958] hover:bg-[#0d346e] text-white rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiadoCodigo ? '¡Código Copiado!' : '1. Copiar Código Actualizado'}</span>
            </button>
          </div>

          <ol className="list-decimal list-inside space-y-1.5 text-slate-700 text-[11px] leading-relaxed pt-1">
            <li>
              En su hoja <strong>Solicitud Flor Obsequio</strong>, abra <strong>Extensiones &gt; Apps Script</strong>.
            </li>
            <li>
              Pegue este nuevo código (que ya tiene el ID exacto de su archivo y lee su columna <code>ID RH</code>). Haga clic en el disquete <strong>Guardar (💾)</strong>.
            </li>
            <li>
              <strong>Autorizar correos (obligatorio una sola vez):</strong> En la barra superior de Apps Script seleccione la función <code>autorizarEnvioCorreos</code>, haga clic en <strong>▶ Ejecutar</strong> y acepte <strong>Revisar permisos &gt; Configuración avanzada &gt; Permitir</strong>.
            </li>
            <li>
              Arriba a la derecha, haga clic en <strong>Implementar &gt; Administrar implementaciones &gt; Editar (✏️)</strong>.
            </li>
            <li>
              En el desplegable <strong>Versión</strong>, elija <strong className="text-[#0a2958]">Nueva versión</strong>, verifique que <em>Quién tiene acceso</em> diga <strong className="text-emerald-700">Cualquier persona</strong> y haga clic en <strong>Implementar</strong>.
            </li>
          </ol>
        </div>

        <form onSubmit={handleGuardar} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              URL del Webhook de Apps Script (/exec)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-mono text-slate-800 font-medium"
            />
          </div>

          {/* Resultado de Prueba */}
          {resultadoPrueba && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                resultadoPrueba.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                  : 'bg-rose-50 border-rose-200 text-rose-800 font-semibold'
              }`}
            >
              {resultadoPrueba.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#E60000] shrink-0" />
              )}
              <span>{resultadoPrueba.mensaje}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={probando || !webhookUrl}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${probando ? 'animate-spin' : ''}`} />
              <span>{probando ? 'Verificando...' : 'Probar Conexión con Google Drive'}</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer text-xs"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-5 py-2.5 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white font-bold cursor-pointer text-xs shadow-xs"
              >
                {guardando ? 'Guardando...' : 'Guardar y Activar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
