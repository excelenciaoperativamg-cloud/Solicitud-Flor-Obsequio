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

/** Busca primero por nombre exacto de encabezado y luego por pistas. */
function indiceColumnaExactoOPista(headers, exactos, pistas) {
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").toUpperCase().replace(/\\s+/g, " ").trim();
    for (var e = 0; e < exactos.length; e++) {
      if (h === String(exactos[e]).toUpperCase()) return c;
    }
  }
  return pistas && pistas.length ? indiceColumnaEstricto(headers, pistas) : -1;
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

function buscarHojaMaestro(ss) {
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
        sLow.indexOf("especial") === 0 ||
        sLow.indexOf("permiso") === 0
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
  return sheetMaestro;
}

function asegurarColumnaCedulaMaestro(sheetMaestro) {
  if (!sheetMaestro) return;
  try {
    var lastRow = sheetMaestro.getLastRow();
    var lastCol = sheetMaestro.getLastColumn();
    if (lastRow === 0 || lastCol === 0) {
      var headersInit = ["Código", "Cédula", "Nombre", "Sede", "Cargo", "Estado"];
      sheetMaestro.getRange(1, 1, 1, headersInit.length).setValues([headersInit]);
      sheetMaestro.getRange(1, 1, 1, headersInit.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
      return;
    }
    var headers = sheetMaestro.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    var idxCedula = indiceColumnaExactoOPista(
      headers,
      ["CÉDULA", "CEDULA", "CC", "DOCUMENTO"],
      ["CÉDULA", "CEDULA", "DOCUMENTO", "IDENTIFICACIÓN", "IDENTIFICACION"]
    );
    if (idxCedula < 0) {
      var colDestino = lastCol + 1;
      var headerCell = sheetMaestro.getRange(1, colDestino);
      headerCell.setValue("Cédula");
      headerCell.setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
    }
  } catch (e) {}
}

function leerTrabajadores(ss) {
  var sheetMaestro = buscarHojaMaestro(ss);
  if (!sheetMaestro) return [];

  asegurarColumnaCedulaMaestro(sheetMaestro);

  var data = sheetMaestro.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var headers = data[0] || [];
  var idxCodigo = indiceColumnaEstricto(headers, ["CÓDIGO", "CODIGO", "ID RH"]);
  if (idxCodigo < 0) idxCodigo = 0;
  var idxCedula = indiceColumnaExactoOPista(
    headers,
    ["CÉDULA", "CEDULA", "CC", "DOCUMENTO"],
    ["CÉDULA", "CEDULA", "DOCUMENTO", "IDENTIFICACIÓN", "IDENTIFICACION"]
  );
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
    if (/^(SFO|SIE|SE|SEP|SC|IS|OV)-\\d{4}-/i.test(codigo)) continue;

    var cedula = "";
    if (idxCedula >= 0 && row[idxCedula] !== undefined && row[idxCedula] !== null) {
      cedula = String(row[idxCedula]).trim();
    }

    var activo = true;
    if (idxEstado >= 0 && row[idxEstado]) {
      activo = String(row[idxEstado]).trim().toLowerCase() !== "inactivo";
    }

    workers.push({
      codigo: codigo,
      cedula: cedula,
      nombre: nombre,
      sede: normSede(row[idxSede]),
      cargo: idxCargo >= 0 && row[idxCargo] ? String(row[idxCargo]).trim() : "",
      activo: activo
    });
  }
  return workers;
}

function sincronizarMaestroHoja(ss, workersList) {
  var lista = (workersList && workersList.length) ? workersList : [];
  var sheetMaestro = buscarHojaMaestro(ss) || ss.insertSheet("Maestro");
  asegurarColumnaCedulaMaestro(sheetMaestro);

  var data = sheetMaestro.getDataRange().getValues();
  var headers = (data && data.length > 0) ? data[0] : ["Código", "Cédula", "Nombre", "Sede", "Cargo", "Estado"];
  var idxCodigo = indiceColumnaEstricto(headers, ["CÓDIGO", "CODIGO", "ID RH"]);
  if (idxCodigo < 0) idxCodigo = 0;
  var idxCedula = indiceColumnaExactoOPista(
    headers,
    ["CÉDULA", "CEDULA", "CC", "DOCUMENTO"],
    ["CÉDULA", "CEDULA", "DOCUMENTO", "IDENTIFICACIÓN", "IDENTIFICACION"]
  );
  var idxNombre = indiceColumnaEstricto(headers, ["NOMBRE"]);
  if (idxNombre < 0) idxNombre = 1;
  var idxSede = indiceColumnaEstricto(headers, ["SEDE"]);
  if (idxSede < 0) idxSede = 2;
  var idxCargo = indiceColumnaEstricto(headers, ["CARGO", "FUNCIÓN", "FUNCION"]);
  if (idxCargo < 0) idxCargo = 3;
  var idxEstado = indiceColumnaEstricto(headers, ["ESTADO"]);

  var rowByCode = {};
  for (var r = 1; r < data.length; r++) {
    var cVal = String(data[r][idxCodigo] || "").trim().toUpperCase();
    if (cVal) rowByCode[cVal] = r + 1;
  }

  for (var i = 0; i < lista.length; i++) {
    var w = lista[i];
    if (!w) continue;
    var cod = String(w.codigo || "").trim().toUpperCase();
    var nom = String(w.nombre || "").trim();
    if (!cod || !nom) continue;
    if (/^(SFO|SIE|SE|SEP|SC|IS|OV)-\\d{4}-/i.test(cod)) continue;

    var ced = w.cedula !== undefined && w.cedula !== null ? String(w.cedula).trim() : "";
    var sed = normSede(w.sede);
    var car = String(w.cargo || "Operario").trim();
    var est = w.activo === false ? "Inactivo" : "Activo";

    var existingRow = rowByCode[cod];
    if (existingRow) {
      if (idxNombre >= 0) sheetMaestro.getRange(existingRow, idxNombre + 1).setValue(nom);
      if (idxSede >= 0) sheetMaestro.getRange(existingRow, idxSede + 1).setValue(sed);
      if (idxCargo >= 0 && car) sheetMaestro.getRange(existingRow, idxCargo + 1).setValue(car);
      if (idxEstado >= 0) sheetMaestro.getRange(existingRow, idxEstado + 1).setValue(est);
      if (idxCedula >= 0 && ced) sheetMaestro.getRange(existingRow, idxCedula + 1).setValue(ced);
    } else {
      var newRow = [];
      for (var col = 0; col < headers.length; col++) {
        if (col === idxCodigo) newRow.push(cod);
        else if (col === idxCedula) newRow.push(ced);
        else if (col === idxNombre) newRow.push(nom);
        else if (col === idxSede) newRow.push(sed);
        else if (col === idxCargo) newRow.push(car);
        else if (col === idxEstado) newRow.push(est);
        else newRow.push("");
      }
      sheetMaestro.appendRow(newRow);
      rowByCode[cod] = sheetMaestro.getLastRow();
    }
  }

  SpreadsheetApp.flush();
  return leerTrabajadores(ss);
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
    else if (prodLow.indexOf("gypso") !== -1) florPrincipal = "Gypso";
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
    var horaEntrega = cel(["HORA ENTREGA", "HORA DE ENTREGA", "HORA"]);
    if (horaEntrega instanceof Date) {
      horaEntrega = Utilities.formatDate(horaEntrega, Session.getScriptTimeZone(), "HH:mm");
    }
    var cantidadRaw = cel(["CANTIDAD"]);
    var cantidadNum = Number(cantidadRaw);
    if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;
    var notificadoVal = String(cel(["NOTIFICADO", "ESTADO"]) || "Registrada");
    var prodVal = String(cel(["PRODUCTO"]) || "").trim();
    var sedeVal = String(cel(["SEDE"]) || "").trim();
    if (!sedeVal && prodVal) {
      var prodLow = prodVal.toLowerCase();
      if (prodLow.indexOf("alstroemeria") !== -1) sedeVal = "HA";
      else if (prodLow.indexOf("clavel") !== -1) sedeVal = "SC";
      else if (prodLow.indexOf("rosa") !== -1 || prodLow.indexOf("bouquet") !== -1 || prodLow.indexOf("gypso") !== -1) sedeVal = "MG";
    }
    out.push({
      id: id,
      fechaSolicitud: String(fechaSolicitud || ""),
      codigo: String(cel(["CÓDIGO", "CODIGO"]) || ""),
      nombre: String(cel(["NOMBRE"]) || ""),
      sede: sedeVal,
      area: String(cel(["ÁREA", "AREA"]) || ""),
      producto: prodVal,
      cantidad: cantidadNum,
      motivo: String(cel(["MOTIVO"]) || ""),
      semana: String(cel(["SEMANA"]) || ""),
      fechaEntrega: String(fechaEntrega || ""),
      horaEntrega: String(horaEntrega || ""),
      observacion: String(cel(["OBSERVACIÓN", "OBSERVACION", "OBSERVACIONES"]) || ""),
      fotoCarta: String(cel(["FOTO CARTA", "CARTA", "FOTO"]) || ""),
      notificado: notificadoVal,
      estado: notificadoVal,
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function leerEspecialesPersonal(ss) {
  var sheet = buscarHojaPorNombre(ss, ["Especiales Personal"]);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    function cel(exactos, pistas) {
      var i = indiceColumnaExactoOPista(headers, exactos, pistas || []);
      return i >= 0 ? row[i] : "";
    }
    var id = String(cel(["ID", "ID."], []) || row[0] || "").trim();
    if (!id) continue;
    var fechaSolicitud = cel(["FECHA SOLICITUD", "FECHA DE SOLICITUD", "FECHA"], ["FECHA SOLICITUD"]);
    if (fechaSolicitud instanceof Date) {
      fechaSolicitud = Utilities.formatDate(fechaSolicitud, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var fechaEntrega = cel(["FECHA ENTREGA", "FECHA DE ENTREGA", "ENTREGA"], ["FECHA ENTREGA", "ENTREGA"]);
    if (fechaEntrega instanceof Date) {
      fechaEntrega = Utilities.formatDate(fechaEntrega, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var cantidadRaw = cel(["CANTIDAD"], ["CANTIDAD"]);
    var cantidadNum = Number(cantidadRaw);
    if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;
    var estadoVal = String(cel(["ESTADO"], ["ESTADO"]) || "Pendiente Aprobación").trim();
    var correoConfVal = String(cel(["CORREO DE CONFIRMACIÓN", "CORREO DE CONFIRMACION", "CORREO CONFIRMACION"], ["CORREO", "CONFIRMACI"]) || "").trim();
    var notificadoVal = String(cel(["NOTIFICADO"], ["NOTIFICADO"]) || "angela.garcia@mg-consultores.com").trim();
    out.push({
      id: id,
      fechaSolicitud: String(fechaSolicitud || ""),
      cedula: String(cel(["CÉDULA", "CEDULA", "CC", "DOCUMENTO"], ["CÉDULA", "CEDULA", "DOCUMENTO"]) || ""),
      nombre: String(cel(["NOMBRE"], ["NOMBRE"]) || ""),
      sede: String(cel(["SEDE"], ["SEDE"]) || ""),
      producto: String(cel(["PRODUCTO"], ["PRODUCTO"]) || ""),
      color: String(cel(["COLOR"], ["COLOR"]) || "").trim(),
      cantidad: cantidadNum,
      motivo: String(cel(["MOTIVO"], ["MOTIVO"]) || ""),
      semana: String(cel(["SEMANA"], ["SEMANA"]) || ""),
      fechaEntrega: String(fechaEntrega || ""),
      correoConfirmacion: correoConfVal,
      observacion: String(cel(["OBSERVACIÓN", "OBSERVACION", "OBSERVACIONES"], ["OBSERVACI"]) || ""),
      fotoCarta: String(cel(["FOTO CARTA", "CARTA"], ["FOTO CARTA", "CARTA", "FOTO"]) || ""),
      notificado: notificadoVal,
      estado: estadoVal,
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function leerSolicitudesComunidad(ss) {
  var sheet = buscarHojaPorNombre(ss, ["Solicitud Comunidad"]);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    function cel(exactos, pistas) {
      var i = indiceColumnaExactoOPista(headers, exactos, pistas || []);
      return i >= 0 ? row[i] : "";
    }
    var id = String(cel(["ID", "ID."], []) || row[0] || "").trim();
    if (!id) continue;
    var fechaSolicitud = cel(["FECHA SOLICITUD", "FECHA DE SOLICITUD", "FECHA"], ["FECHA SOLICITUD"]);
    if (fechaSolicitud instanceof Date) {
      fechaSolicitud = Utilities.formatDate(fechaSolicitud, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var fechaEntrega = cel(["FECHA ENTREGA", "FECHA DE ENTREGA", "ENTREGA"], ["FECHA ENTREGA", "ENTREGA"]);
    if (fechaEntrega instanceof Date) {
      fechaEntrega = Utilities.formatDate(fechaEntrega, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var cantidadRaw = cel(["CANTIDAD"], ["CANTIDAD"]);
    var cantidadNum = Number(cantidadRaw);
    if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;
    var correoConfVal = String(cel(["CORREO DE CONFIRMACIÓN", "CORREO DE CONFIRMACION", "CORREO CONFIRMACION"], ["CORREO", "CONFIRMACI"]) || "").trim();
    var estadoVal = String(cel(["ESTADO"], ["ESTADO"]) || "Pendiente Aprobación").trim();
    var notificadoVal = String(cel(["NOTIFICADO"], ["NOTIFICADO"]) || "Registrada").trim();
    out.push({
      id: id,
      fechaSolicitud: String(fechaSolicitud || ""),
      usuario: String(cel(["USUARIO"], ["USUARIO"]) || ""),
      entidad: String(cel(["ENTIDAD"], ["ENTIDAD"]) || ""),
      motivo: String(cel(["MOTIVO"], ["MOTIVO"]) || ""),
      lugar: String(cel(["LUGAR"], ["LUGAR"]) || ""),
      sede: String(cel(["SEDE"], ["SEDE"]) || ""),
      producto: String(cel(["PRODUCTO"], ["PRODUCTO"]) || ""),
      cantidad: cantidadNum,
      semana: String(cel(["SEMANA"], ["SEMANA"]) || ""),
      fechaEntrega: String(fechaEntrega || ""),
      correoConfirmacion: correoConfVal,
      fotoCarta: String(cel(["FOTO CARTA", "CARTA"], ["FOTO CARTA", "CARTA", "FOTO"]) || ""),
      notificado: notificadoVal,
      estado: estadoVal,
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function obtenerHojaIngresosPersonal(ss, crear) {
  var sheet = buscarHojaPorNombre(ss, ["Ingresos Personal"]);
  if (sheet) return sheet;
  var legacy = buscarHojaPorNombre(ss, ["Ingresos Selección", "Ingresos Seleccion"]);
  if (legacy) {
    try { legacy.setName("Ingresos Personal"); } catch (e) {}
    return legacy;
  }
  if (crear) return ss.insertSheet("Ingresos Personal");
  return null;
}

function leerIngresosSeleccion(ss) {
  var sheet = obtenerHojaIngresosPersonal(ss, false);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    function cel(exactos, pistas) {
      var i = indiceColumnaExactoOPista(headers, exactos, pistas || []);
      return i >= 0 ? row[i] : "";
    }
    var id = String(cel(["ID", "ID."], []) || row[0] || "").trim();
    if (!id) continue;
    var fechaSolicitud = cel(["FECHA SOLICITUD", "FECHA DE SOLICITUD", "FECHA"], ["FECHA SOLICITUD"]);
    if (fechaSolicitud instanceof Date) {
      fechaSolicitud = Utilities.formatDate(fechaSolicitud, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var fechaEntrega = cel(["FECHA ENTREGA", "FECHA DE ENTREGA", "ENTREGA"], ["FECHA ENTREGA", "ENTREGA"]);
    if (fechaEntrega instanceof Date) {
      fechaEntrega = Utilities.formatDate(fechaEntrega, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var horaEntrega = cel(["HORA ENTREGA", "HORA DE ENTREGA", "HORA"], ["HORA"]);
    if (horaEntrega instanceof Date) {
      horaEntrega = Utilities.formatDate(horaEntrega, Session.getScriptTimeZone(), "HH:mm");
    }
    var cantidadRaw = cel(["CANTIDAD"], ["CANTIDAD"]);
    var cantidadNum = Number(cantidadRaw);
    if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;
    var notificadoVal = String(cel(["NOTIFICADO", "ESTADO"], ["NOTIFICAD", "ESTADO"]) || "Registrada").trim();
    out.push({
      id: id,
      fechaSolicitud: String(fechaSolicitud || ""),
      codigo: String(cel(["CÓDIGO", "CODIGO", "ID RH"], ["CÓDIGO", "CODIGO"]) || ""),
      nombre: String(cel(["NOMBRE"], ["NOMBRE"]) || ""),
      sede: String(cel(["SEDE"], ["SEDE"]) || ""),
      producto: String(cel(["PRODUCTO"], ["PRODUCTO"]) || ""),
      cantidad: cantidadNum,
      motivo: String(cel(["MOTIVO"], ["MOTIVO"]) || "Ingresos"),
      semana: String(cel(["SEMANA"], ["SEMANA"]) || ""),
      fechaEntrega: String(fechaEntrega || ""),
      horaEntrega: String(horaEntrega || ""),
      observacion: String(cel(["OBSERVACIÓN", "OBSERVACION", "OBSERVACIONES"], ["OBSERVACI"]) || ""),
      notificado: notificadoVal,
      estado: notificadoVal,
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function leerObsequioVisitantes(ss) {
  var sheet = buscarHojaPorNombre(ss, ["Obsequio Visitantes", "Obsequio Visitante"]);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    function cel(exactos, pistas) {
      var i = indiceColumnaExactoOPista(headers, exactos, pistas || []);
      return i >= 0 ? row[i] : "";
    }
    var id = String(cel(["ID", "ID."], []) || row[0] || "").trim();
    if (!id) continue;
    var fechaSolicitud = cel(["FECHA SOLICITUD", "FECHA DE SOLICITUD", "FECHA"], ["FECHA SOLICITUD"]);
    if (fechaSolicitud instanceof Date) {
      fechaSolicitud = Utilities.formatDate(fechaSolicitud, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var fechaEntrega = cel(["FECHA ENTREGA", "FECHA DE ENTREGA", "ENTREGA"], ["FECHA ENTREGA", "ENTREGA"]);
    if (fechaEntrega instanceof Date) {
      fechaEntrega = Utilities.formatDate(fechaEntrega, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var cantidadRaw = cel(["CANTIDAD"], ["CANTIDAD"]);
    var cantidadNum = Number(cantidadRaw);
    if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;
    var notificadoVal = String(cel(["NOTIFICADO", "ESTADO"], ["NOTIFICAD", "ESTADO"]) || "Registrada").trim();
    out.push({
      id: id,
      fechaSolicitud: String(fechaSolicitud || ""),
      codigo: String(cel(["CÓDIGO", "CODIGO", "ID RH"], ["CÓDIGO", "CODIGO"]) || ""),
      nombre: String(cel(["NOMBRE"], []) || ""),
      sede: String(cel(["SEDE"], ["SEDE"]) || ""),
      producto: String(cel(["PRODUCTO"], ["PRODUCTO"]) || ""),
      cantidad: cantidadNum,
      motivo: String(cel(["MOTIVO"], ["MOTIVO"]) || "Visitante"),
      nombreVisitante: String(cel(["NOMBRE VISITANTE", "VISITANTE"], ["NOMBRE VISITANTE", "VISITANTE"]) || ""),
      empresa: String(cel(["EMPRESA", "EMPRESA VISITANTE"], ["EMPRESA"]) || ""),
      semana: String(cel(["SEMANA"], ["SEMANA"]) || ""),
      fechaEntrega: String(fechaEntrega || ""),
      observacion: String(cel(["OBSERVACIÓN", "OBSERVACION", "OBSERVACIONES"], ["OBSERVACI"]) || ""),
      notificado: notificadoVal,
      estado: notificadoVal,
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function subirFotoCartaDrive(ss, base64Data, mimeType, fileName, folderNameCustom) {
  if (!base64Data) return { status: "success", fileUrl: "" };
  try {
    var parentFolder = DriveApp.getRootFolder();
    try {
      var ssFile = DriveApp.getFileById(ss.getId());
      var parents = ssFile.getParents();
      if (parents.hasNext()) {
        parentFolder = parents.next();
      }
    } catch (pe) {}

    var folderName = folderNameCustom || "Cartas Autorizadas - Especiales Personal";
    var targetFolder = null;
    var folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = parentFolder.createFolder(folderName);
    }

    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(
      bytes,
      mimeType || "image/jpeg",
      fileName || ("Carta_" + new Date().getTime() + ".jpg")
    );
    var file = targetFolder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (se) {}

    return {
      status: "success",
      fileUrl: file.getUrl(),
      fileId: file.getId()
    };
  } catch (err) {
    return {
      status: "success",
      fileUrl: "",
      driveError: String(err)
    };
  }
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

var MG_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAHwAAABMBAMAAABdSs4gAAAALVBMVEX+/v7839/6zs/3ra/1jZDybXDwXWHvTVLtPUHsMDX2nqDrHCLzfYD5vsDqFhv7BYRRAAAFq0lEQVRYw9VX7U+bVRQ/9yltY92SluEmIzFlbCGTZCkTXYC4tEO2MZOljKzYEQmbDFbwQ7fRQl1iMDL1Bj84KPR59mhSR5aJfNl4sT7WD5j4xfjFvwGGM9E/wvv2vLW1Lf3mSdrc557zO+fc83JfAEyq74hMYzk1nbjUDIUkdV29heVMJnHttBdK0aGIomoKJ22q3Q5+nKLTmPxUJXmuBPotlbExF1OVAQvvaErXy5V/6S8Aoz5FVmykThlOnlC5VkGyomYCdvh3GhfACleDKV7wXhEwzuNyyzb7hzVsM02/ZPUu49WpFGbhY2pg04J2MC4u8F9WwjRqImhYNiVk4v91E76q6E5RKSbHPnPExTWDpWP5f84IjUfj3tpjR+e+gQP2CWwOb+vwTlOpqtLMmhQYMoF5wsgbGuScnjRjSl2+dvpYS8egqgdIWVbYYshP++zS24Q3bi4kzOEu8SkrE2I9R6OWVXLK9Qhjx4VCRdkwfGemRKKYQ1EuIuvxzH1r8BpUPi9nuLGUcOdra5Hfs+SP0LaF1yom1SxLuqhn/qVTnWb1fcFWopO8SpQ4/XDKvBwe2st4VdQoS6m9R13CpUX60ajxyIftcI9mZvmTgv4S03+yUESwRjNltwDwm5EQ5Y8C1hpmfS96Wuo6n7L1ACO3Ebt0EUvLJHqsOxJqCRXKOHinEEMPilg9PqhIMd4IWA1Wli1B3Xrs/DXB3aKNl2tCg1PUU7o2uEfU3UJt8IOith/UBteLa7ZGON8feWfUBCfeY2XEnHnHTtnyzvPQmXDpb03La8YvHy8P56eNCXfQBsbmb6Q8HBdaL9jLK8B5zZsuOqzHBa4A1zfBWdO6hmW+58uVrRO4jG1lc9Duu1oeHuU+mkUracJ3cVyVh7/LQ/eTZe36Scu8t0SlFHWyE0JeslhXGWnVRB4aRaDNXKwQ6upaWUnxNZSHu1jkFDVQxInhKkLnEZEqlprkay8PR6JE1outc0Z5OMscLrXZTXLF5SMPbaLqs0V6q1k7vzgQFRtF1uX/CIqNWJXhEjt9rJq8Uyf5UV5weDdUVTYArwrraqgAzS9OleDi5kEq17zbwAm93SvCadfw1s7ol3jpgiIaHleKPDmojM1FSzzyeX0tj7HeL9VYhyFsuJonemizyYr+aohXhDs1sTXwOznGpm12Y664eg627LHiVilrocpokOYNFDYuuOxFcqMKNM0ytj1lRCyqRLOXkI4xXwTalSrRAi+bhkkCltqrRpMXYkw1nwH0Rqjf3Ksk9GZK1ZeQz4wG9gVmCeiK0IdEJnOzp3nfYO4C8jX79uf1/4OOsUWhKsOCjFGSfKShNb/kpQ+gfL9NzDVSePNuzQQJYIYaO5PJApATrG5PUh9djpMz8eHx5zZhd7zPazf744Uw2cPyBIhyF8lwPgxHNl074CEzQ35oZ47pzrlHVr3iA7GBZx2IPvdYnA0JpRagM/1ymEnQk9yjfuoYGLrr2XPchlHXFSWJYlvem098qTSK+UHao4Jtb+wQF5ijywmIzDUFAfkA0ffM2feH6//6fqvpnPMrWHb1x3rdi53hyeSRO2uvLxLDv9PXV5QZGqLDpVXfYrppGxy73HoC3L9swFhT2DkLCdfIKrT5Hc+i0N3cNrpL2NLHASoXJZocZAj3Gzvimy/FkUSYnxP+HHJe34Bxh+yMw30XCV2nF60PwupMMjtMgg4nw2T3n57P0jVsE+vOL9o3Pf9Q63A5CAPvQWOIwKGp45njZ9dIH5wKeJ4OQncAeeueEsypYLMzfbUvTjJ6NuuDnKSh5zCcuEcW7noR3T05hYkj43WxQy+mt9zxtUjD1nDwFji3oqHBMEhjOZR5LQwHdobrkz+gHIzCKJoAz8xEC1H9JOmXYv3oBvS67sD50K91wcNJuPgR9AK6MIdIZaHpEIy2kgx8cIYOP/wXnOThU4KdLesAAAAASUVORK5CYII=";

function parsearCorreosDestino(raw) {
  var partes = String(raw || "").split(/[,;]+/);
  var validos = [];
  var vistos = {};
  var invalidos = [];
  for (var i = 0; i < partes.length; i++) {
    var c = String(partes[i] || "").trim();
    if (!c) continue;
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(c)) {
      invalidos.push(c);
      continue;
    }
    var clave = c.toLowerCase();
    if (!vistos[clave]) {
      vistos[clave] = true;
      validos.push(c);
    }
  }
  return {
    validos: validos,
    invalidos: invalidos,
    texto: validos.join(", ")
  };
}

/**
 * Envía un correo corporativo HTML con toda la información de la solicitud Especiales Empresa.
 */
function enviarCorreoNotificacionIntExt(ss, correoDestino, items, fotoBase64, fotoMime, fotoNombre) {
  var parsedCorreos = parsearCorreosDestino(correoDestino);
  if (parsedCorreos.validos.length === 0 || parsedCorreos.invalidos.length > 0) {
    return {
      emailSent: false,
      emailError: parsedCorreos.invalidos.length > 0
        ? "Correo corporativo inválido: " + parsedCorreos.invalidos.join(", ")
        : "Correo corporativo de destino inválido."
    };
  }
  var emailTo = parsedCorreos.validos.join(",");
  var emailDisplay = parsedCorreos.texto;

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
  var sedeTexto = String(primera.sede || "").trim();
  if (!sedeTexto) {
    var pMailLow = String(primera.producto || "").toLowerCase();
    if (pMailLow.indexOf("alstroemeria") !== -1) sedeTexto = "HA";
    else if (pMailLow.indexOf("clavel") !== -1) sedeTexto = "SC";
    else if (pMailLow.indexOf("rosa") !== -1 || pMailLow.indexOf("bouquet") !== -1 || pMailLow.indexOf("gypso") !== -1) sedeTexto = "MG";
  }
  var semanaTexto = primera.semana ? ("Semana " + primera.semana) : "—";
  var obsTexto = String(primera.observacion || "").trim();
  var notificadoTexto = String(primera.notificado || primera.estado || emailDisplay).trim();
  var fotoUrl = String(primera.fotoCarta || "").trim();
  var fotoEsUrlWeb = fotoUrl.indexOf("http") === 0;
  var fotoHtml = fotoEsUrlWeb
    ? "<a href=\\"" + escapeHtml(fotoUrl) + "\\" style=\\"color:#0a2958;font-weight:700;text-decoration:underline;\\">Ver carta &#8599;</a>"
    : (fotoUrl ? "<span style=\\"color:#047857;font-weight:700;\\">Adjunta en el sistema / correo</span>" : "<span style=\\"color:#64748b;\\">No adjuntada</span>");

  var inlineImagesObj = {};
  var tieneLogo = false;
  try {
    var logoBytes = Utilities.base64Decode(MG_LOGO_BASE64);
    inlineImagesObj.logoMg = Utilities.newBlob(logoBytes, "image/png", "logo-mg.png");
    tieneLogo = true;
  } catch (logoErr) {
    tieneLogo = false;
  }

  var attachmentsList = [];
  if (fotoBase64) {
    try {
      var fotoBytes = Utilities.base64Decode(fotoBase64);
      attachmentsList.push(Utilities.newBlob(fotoBytes, fotoMime || "image/jpeg", fotoNombre || ("Carta_" + ids[0] + ".jpg")));
    } catch (attErr) {}
  }

  var logoHeaderHtml = tieneLogo
    ? "<div style=\\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\\">" +
        "<img src=\\"cid:logoMg\\" alt=\\"MG Consultores S.A.S.\\" width=\\"74\\" height=\\"45\\" style=\\"display:block;border:0;width:74px;height:auto;\\" />" +
      "</div>"
    : "<div style=\\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\\">MG</div>";

  var asunto = "Flor de Obsequio - Especiales Empresa: " + idsTexto + " (" + String(primera.motivo || "Solicitud") + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\\n" +
    "NUEVA SOLICITUD: ESPECIALES EMPRESA\\n" +
    "==================================================\\n" +
    "Id(s): " + idsTexto + "\\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\\n" +
    "Registrado por: " + String(primera.nombre || "") + " (" + String(primera.codigo || "") + ")\\n" +
    (sedeTexto ? ("Sede: " + sedeTexto + "\\n") : "") +
    "Motivo: " + String(primera.motivo || "") + "\\n" +
    "Semana: " + semanaTexto + "\\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\\n" +
    "Hora de Entrega: " + String(primera.horaEntrega || "—") + "\\n" +
    "Foto Carta: " + (fotoUrl || (attachmentsList.length > 0 ? "Adjunta en este correo" : "No adjuntada")) + "\\n" +
    "Notificado a: " + notificadoTexto + "\\n" +
    "Observación: " + (obsTexto || "Sin observaciones adicionales.") + "\\n\\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\\n" +
    filasTexto + "\\n" +
    "Sistema Flor de Obsequio • Notificación automática.\\n";

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
                    "<div style=\\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\\">Nueva Solicitud: Especiales Empresa</div>" +
                    "<div style=\\"font-size:13px;color:#cbd5e1;margin-top:4px;\\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\\"right\\" style=\\"vertical-align:top;padding-left:12px;\\">" +
                    logoHeaderHtml +
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
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Hora de Entrega</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;\\">" + escapeHtml(primera.horaEntrega || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Solicitado / Registrado por</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.nombre || "") + " (" + escapeHtml(primera.codigo || "") + ")</td>" +
                "</tr>" +
                (sedeTexto
                  ? ("<tr>" +
                      "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Sede</td>" +
                      "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(sedeTexto) + "</td>" +
                    "</tr>")
                  : "") +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Motivo</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Foto Carta</td>" +
                  "<td style=\\"padding:7px 0;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + fotoHtml + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;\\">Notificado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\\">" + escapeHtml(notificadoTexto) + "</td>" +
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
              "<strong>Sistema Flor de Obsequio</strong> &bull; Notificación automática." +
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
    var mailPayload = {
      to: emailTo,
      subject: asunto,
      body: textBody,
      htmlBody: htmlBody,
      name: "Notificaciones Flor de Obsequio"
    };
    if (tieneLogo) {
      mailPayload.inlineImages = inlineImagesObj;
    }
    if (attachmentsList.length > 0) {
      mailPayload.attachments = attachmentsList;
    }
    MailApp.sendEmail(mailPayload);
    var quotaRemaining = null;
    try { quotaRemaining = MailApp.getRemainingDailyQuota(); } catch (qe) {}
    return { emailSent: true, to: emailDisplay, senderEmail: senderEmail, quotaRemaining: quotaRemaining };
  } catch (mailErr) {
    return { emailSent: false, to: emailDisplay, senderEmail: senderEmail, emailError: String(mailErr) };
  }
}

/**
 * Envía un correo corporativo HTML con toda la información de la solicitud Especiales Personal.
 */
function enviarCorreoNotificacionEspecialPersonal(ss, correoDestino, items, fotoBase64, fotoMime, fotoNombre, correoConfirmacionParam) {
  var DESTINO_FIJO = "angela.garcia@mg-consultores.com";
  var parsedCorreos = parsearCorreosDestino(correoDestino || DESTINO_FIJO);
  if (parsedCorreos.validos.length === 0 || parsedCorreos.invalidos.length > 0) {
    parsedCorreos = parsearCorreosDestino(DESTINO_FIJO);
  }
  var emailTo = parsedCorreos.validos.join(",");
  var emailDisplay = parsedCorreos.texto;

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
  var estadoTexto = String(primera.estado || "Pendiente Aprobación").trim();
  var correoConfTexto = String(primera.correoConfirmacion || correoConfirmacionParam || "").trim();
  var notificadoTexto = String(primera.notificado || emailDisplay).trim();
  var colorTexto = String(primera.color || "").trim();
  var fotoUrl = String(primera.fotoCarta || "").trim();
  var fotoEsUrlWeb = fotoUrl.indexOf("http") === 0;
  var fotoHtml = fotoEsUrlWeb
    ? "<a href=\\"" + escapeHtml(fotoUrl) + "\\" style=\\"color:#0a2958;font-weight:700;text-decoration:underline;\\">Ver carta &#8599;</a>"
    : (fotoUrl ? "<span style=\\"color:#047857;font-weight:700;\\">Adjunta en el sistema / correo</span>" : "");

  var inlineImagesObj = {};
  var tieneLogo = false;
  try {
    var logoBytes = Utilities.base64Decode(MG_LOGO_BASE64);
    inlineImagesObj.logoMg = Utilities.newBlob(logoBytes, "image/png", "logo-mg.png");
    tieneLogo = true;
  } catch (logoErr) {
    tieneLogo = false;
  }

  var attachmentsList = [];
  if (fotoBase64) {
    try {
      var fotoBytes = Utilities.base64Decode(fotoBase64);
      attachmentsList.push(Utilities.newBlob(fotoBytes, fotoMime || "image/jpeg", fotoNombre || ("Carta_" + ids[0] + ".jpg")));
    } catch (attErr) {}
  }

  var logoHeaderHtml = tieneLogo
    ? "<div style=\\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\\">" +
        "<img src=\\"cid:logoMg\\" alt=\\"MG Consultores S.A.S.\\" width=\\"74\\" height=\\"45\\" style=\\"display:block;border:0;width:74px;height:auto;\\" />" +
      "</div>"
    : "<div style=\\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\\">MG</div>";

  var asunto = "Flor de Obsequio - Especiales Personal: " + idsTexto + " (" + String(primera.motivo || "Solicitud") + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\\n" +
    "NUEVA SOLICITUD: ESPECIALES PERSONAL\\n" +
    "==================================================\\n" +
    "Id(s): " + idsTexto + "\\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\\n" +
    "Colaborador Beneficiario: " + String(primera.nombre || "") + "\\n" +
    "Cédula: " + String(primera.cedula || "") + "\\n" +
    "Sede: " + String(primera.sede || "") + "\\n" +
    "Motivo: " + String(primera.motivo || "") + "\\n" +
    (colorTexto ? ("Color: " + colorTexto + "\\n") : "") +
    "Semana: " + semanaTexto + "\\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\\n" +
    "Correo de confirmación: " + correoConfTexto + "\\n" +
    "Estado: " + estadoTexto + "\\n" +
    (fotoUrl ? ("Foto Carta: " + fotoUrl + "\\n") : "") +
    "Notificado a: " + notificadoTexto + "\\n\\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\\n" +
    filasTexto + "\\n" +
    "Nota: Esta solicitud queda sujeta a verificación, disponibilidad y autorización por parte de la dirección de Poscosecha.\\n" +
    "Sistema Flor de Obsequio • Notificación automática.\\n";

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
                    "<div style=\\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\\">Nueva Solicitud: Especiales Personal</div>" +
                    "<div style=\\"font-size:13px;color:#cbd5e1;margin-top:4px;\\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\\"right\\" style=\\"vertical-align:top;padding-left:12px;\\">" +
                    logoHeaderHtml +
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
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Colaborador Beneficiario</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.nombre || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Cédula</td>" +
                  "<td style=\\"padding:7px 0;font-family:'Courier New',monospace;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.cedula || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Sede</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.sede || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Motivo</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                (colorTexto ? (
                  "<tr>" +
                    "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Color</td>" +
                    "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(colorTexto) + "</td>" +
                  "</tr>"
                ) : "") +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Correo de confirmación</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;word-break:break-word;\\">" + escapeHtml(correoConfTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Estado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:800;color:#b45309;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(estadoTexto) + "</td>" +
                "</tr>" +
                (fotoHtml ? (
                  "<tr>" +
                    "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Foto Carta</td>" +
                    "<td style=\\"padding:7px 0;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + fotoHtml + "</td>" +
                  "</tr>"
                ) : "") +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;\\">Notificado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\\">" + escapeHtml(notificadoTexto) + "</td>" +
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
              "<div style=\\"background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 14px;font-size:12px;line-height:1.5;color:#92400e;\\">" +
                "Al realizar esta solicitud, queda sujeta a verificación, disponibilidad y autorización por parte de la dirección de Poscosecha." +
              "</div>" +
            "</td></tr>" +

            "<tr><td style=\\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11px;color:#64748b;\\">" +
              "<strong>Sistema Flor de Obsequio</strong> &bull; Notificación automática." +
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
    var mailPayload = {
      to: emailTo,
      subject: asunto,
      body: textBody,
      htmlBody: htmlBody,
      name: "Notificaciones Flor de Obsequio"
    };
    if (correoConfTexto && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(correoConfTexto)) {
      mailPayload.replyTo = correoConfTexto;
    }
    if (tieneLogo) {
      mailPayload.inlineImages = inlineImagesObj;
    }
    if (attachmentsList.length > 0) {
      mailPayload.attachments = attachmentsList;
    }
    MailApp.sendEmail(mailPayload);
    var quotaRemaining = null;
    try { quotaRemaining = MailApp.getRemainingDailyQuota(); } catch (qe) {}
    return { emailSent: true, to: emailDisplay, senderEmail: senderEmail, quotaRemaining: quotaRemaining };
  } catch (mailErr) {
    return { emailSent: false, to: emailDisplay, senderEmail: senderEmail, emailError: String(mailErr) };
  }
}

/**
 * Envía un correo corporativo HTML con toda la información de la Solicitud Comunidad.
 */
function enviarCorreoNotificacionSolicitudComunidad(ss, correoDestino, items, fotoBase64, fotoMime, fotoNombre) {
  var parsedCorreos = parsearCorreosDestino(correoDestino);
  if (parsedCorreos.validos.length === 0 || parsedCorreos.invalidos.length > 0) {
    return {
      emailSent: false,
      emailError: parsedCorreos.invalidos.length > 0
        ? "Correo corporativo inválido: " + parsedCorreos.invalidos.join(", ")
        : "Correo corporativo de destino inválido."
    };
  }
  var emailTo = parsedCorreos.validos.join(",");
  var emailDisplay = parsedCorreos.texto;

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
  var sedesUnicas = [];
  for (var si = 0; si < lista.length; si++) {
    var sd = String(lista[si].sede || "").trim();
    if (sd && sedesUnicas.indexOf(sd) === -1) sedesUnicas.push(sd);
  }
  var sedeTexto = sedesUnicas.length > 0 ? sedesUnicas.join(", ") : String(primera.sede || "—");
  var semanaTexto = primera.semana ? ("Semana " + primera.semana) : "—";
  var correoConfTexto = String(primera.correoConfirmacion || "").trim();
  var estadoTexto = String(primera.estado || "Pendiente Aprobación").trim();
  var notificadoTexto = String(primera.notificado || emailDisplay).trim();
  var fotoUrl = String(primera.fotoCarta || "").trim();
  var fotoEsUrlWeb = fotoUrl.indexOf("http") === 0;
  var fotoHtml = fotoEsUrlWeb
    ? "<a href=\\"" + escapeHtml(fotoUrl) + "\\" style=\\"color:#0a2958;font-weight:700;text-decoration:underline;\\">Ver carta autorizada &#8599;</a>"
    : (fotoUrl ? "<span style=\\"color:#047857;font-weight:700;\\">Adjunta en el sistema / correo</span>" : "<span style=\\"color:#64748b;\\">No adjuntada</span>");

  var inlineImagesObj = {};
  var tieneLogo = false;
  try {
    var logoBytes = Utilities.base64Decode(MG_LOGO_BASE64);
    inlineImagesObj.logoMg = Utilities.newBlob(logoBytes, "image/png", "logo-mg.png");
    tieneLogo = true;
  } catch (logoErr) {
    tieneLogo = false;
  }

  var attachmentsList = [];
  if (fotoBase64) {
    try {
      var fotoBytes = Utilities.base64Decode(fotoBase64);
      attachmentsList.push(Utilities.newBlob(fotoBytes, fotoMime || "image/jpeg", fotoNombre || ("Carta_" + ids[0] + ".jpg")));
    } catch (attErr) {}
  }

  var logoHeaderHtml = tieneLogo
    ? "<div style=\\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\\">" +
        "<img src=\\"cid:logoMg\\" alt=\\"MG Consultores S.A.S.\\" width=\\"74\\" height=\\"45\\" style=\\"display:block;border:0;width:74px;height:auto;\\" />" +
      "</div>"
    : "<div style=\\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\\">MG</div>";

  var asunto = "Flor de Obsequio - Solicitud Comunidad: " + idsTexto + " (" + String(primera.entidad || "Comunidad") + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\\n" +
    "NUEVA SOLICITUD: SOLICITUD COMUNIDAD\\n" +
    "==================================================\\n" +
    "Id(s): " + idsTexto + "\\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\\n" +
    "Registrado por (Usuario): " + String(primera.usuario || "") + "\\n" +
    "Entidad: " + String(primera.entidad || "") + "\\n" +
    "Motivo: " + String(primera.motivo || "") + "\\n" +
    "Sede: " + sedeTexto + "\\n" +
    "Semana: " + semanaTexto + "\\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\\n" +
    "Correo de confirmación: " + correoConfTexto + "\\n" +
    "Estado: " + estadoTexto + "\\n" +
    "Foto Carta: " + (fotoUrl || "No adjuntada") + "\\n" +
    "Notificado a: " + notificadoTexto + "\\n\\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\\n" +
    filasTexto + "\\n" +
    "Sistema Flor de Obsequio • Notificación automática.\\n";

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
                    "<div style=\\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\\">Nueva Solicitud: Solicitud Comunidad</div>" +
                    "<div style=\\"font-size:13px;color:#cbd5e1;margin-top:4px;\\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\\"right\\" style=\\"vertical-align:top;padding-left:12px;\\">" +
                    logoHeaderHtml +
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
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Registrado por (Usuario)</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.usuario || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Entidad</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.entidad || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Motivo</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Sede</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(sedeTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Correo de confirmación</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;word-break:break-word;\\">" + escapeHtml(correoConfTexto || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Estado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:800;color:#b45309;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(estadoTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Carta Autorizada</td>" +
                  "<td style=\\"padding:7px 0;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + fotoHtml + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;\\">Notificado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\\">" + escapeHtml(notificadoTexto) + "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\\"padding:18px 28px 18px 28px;\\">" +
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

            "<tr><td style=\\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11px;color:#64748b;\\">" +
              "<strong>Sistema Flor de Obsequio</strong> &bull; Notificación automática." +
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
    var mailPayload = {
      to: emailTo,
      subject: asunto,
      body: textBody,
      htmlBody: htmlBody,
      name: "Notificaciones Flor de Obsequio"
    };
    if (tieneLogo) {
      mailPayload.inlineImages = inlineImagesObj;
    }
    if (attachmentsList.length > 0) {
      mailPayload.attachments = attachmentsList;
    }
    MailApp.sendEmail(mailPayload);
    var quotaRemaining = null;
    try { quotaRemaining = MailApp.getRemainingDailyQuota(); } catch (qe) {}
    return { emailSent: true, to: emailDisplay, senderEmail: senderEmail, quotaRemaining: quotaRemaining };
  } catch (mailErr) {
    return { emailSent: false, to: emailDisplay, senderEmail: senderEmail, emailError: String(mailErr) };
  }
}

function enviarCorreoNotificacionIngresosSeleccion(ss, correoDestino, items) {
  var parsedCorreos = parsearCorreosDestino(correoDestino);
  if (parsedCorreos.validos.length === 0 || parsedCorreos.invalidos.length > 0) {
    return {
      emailSent: false,
      emailError: parsedCorreos.invalidos.length > 0
        ? "Correo corporativo inválido: " + parsedCorreos.invalidos.join(", ")
        : "Correo corporativo de destino inválido."
    };
  }
  var emailTo = parsedCorreos.validos.join(",");
  var emailDisplay = parsedCorreos.texto;

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
  var notificadoTexto = String(primera.notificado || emailDisplay).trim();
  var motivoTexto = String(primera.motivo || "Ingresos").trim();

  var inlineImagesObj = {};
  var tieneLogo = false;
  try {
    var logoBytes = Utilities.base64Decode(MG_LOGO_BASE64);
    inlineImagesObj.logoMg = Utilities.newBlob(logoBytes, "image/png", "logo-mg.png");
    tieneLogo = true;
  } catch (logoErr) {
    tieneLogo = false;
  }

  var logoHeaderHtml = tieneLogo
    ? "<div style=\\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\\">" +
        "<img src=\\"cid:logoMg\\" alt=\\"MG Consultores S.A.S.\\" width=\\"74\\" height=\\"45\\" style=\\"display:block;border:0;width:74px;height:auto;\\" />" +
      "</div>"
    : "<div style=\\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\\">MG</div>";

  var asunto = "Flor de Obsequio - Ingresos Personal: " + idsTexto + " (Sede " + String(primera.sede || "") + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\\n" +
    "NUEVA SOLICITUD: INGRESOS PERSONAL\\n" +
    "==================================================\\n" +
    "Id(s): " + idsTexto + "\\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\\n" +
    "Registrado por: " + String(primera.nombre || "") + " (" + String(primera.codigo || "") + ")\\n" +
    "Sede: " + String(primera.sede || "") + "\\n" +
    "Motivo: " + motivoTexto + "\\n" +
    "Semana: " + semanaTexto + "\\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\\n" +
    "Hora de Entrega: " + String(primera.horaEntrega || "—") + "\\n" +
    "Notificado a: " + notificadoTexto + "\\n" +
    "Observación: " + (obsTexto || "Sin observaciones adicionales.") + "\\n\\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\\n" +
    filasTexto + "\\n" +
    "Sistema Flor de Obsequio • Notificación automática.\\n";

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
                    "<div style=\\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\\">Nueva Solicitud: Ingresos Personal</div>" +
                    "<div style=\\"font-size:13px;color:#cbd5e1;margin-top:4px;\\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\\"right\\" style=\\"vertical-align:top;padding-left:12px;\\">" +
                    logoHeaderHtml +
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
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Hora de Entrega</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.horaEntrega || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Registrado por</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.nombre || "") + " (" + escapeHtml(primera.codigo || "") + ")</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Sede</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.sede || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Motivo</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(motivoTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;\\">Notificado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\\">" + escapeHtml(notificadoTexto) + "</td>" +
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
              "<strong>Sistema Flor de Obsequio</strong> &bull; Notificación automática." +
            "</td></tr>" +
          "</table>" +
        "</td></tr>" +
      "</table>" +
    "</body>" +
    "</html>";

  var senderEmail = "";
  try { senderEmail = Session.getEffectiveUser().getEmail() || ""; } catch (ue) {}

  try {
    var mailPayload = {
      to: emailTo,
      subject: asunto,
      body: textBody,
      htmlBody: htmlBody,
      name: "Notificaciones Flor de Obsequio"
    };
    if (tieneLogo) {
      mailPayload.inlineImages = inlineImagesObj;
    }
    MailApp.sendEmail(mailPayload);
    var quotaRemaining = null;
    try { quotaRemaining = MailApp.getRemainingDailyQuota(); } catch (qe) {}
    return { emailSent: true, to: emailDisplay, senderEmail: senderEmail, quotaRemaining: quotaRemaining };
  } catch (mailErr) {
    return { emailSent: false, to: emailDisplay, senderEmail: senderEmail, emailError: String(mailErr) };
  }
}

function enviarCorreoNotificacionObsequioVisitantes(ss, correoDestino, items) {
  var parsedCorreos = parsearCorreosDestino(correoDestino);
  if (parsedCorreos.validos.length === 0 || parsedCorreos.invalidos.length > 0) {
    return {
      emailSent: false,
      emailError: parsedCorreos.invalidos.length > 0
        ? "Correo corporativo inválido: " + parsedCorreos.invalidos.join(", ")
        : "Correo corporativo de destino inválido."
    };
  }
  var emailTo = parsedCorreos.validos.join(",");
  var emailDisplay = parsedCorreos.texto;

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
  var notificadoTexto = String(primera.notificado || emailDisplay).trim();
  var motivoTexto = String(primera.motivo || "Visitante").trim();
  var visitanteTexto = String(primera.nombreVisitante || "").trim();
  var empresaTexto = String(primera.empresa || "").trim();

  var inlineImagesObj = {};
  var tieneLogo = false;
  try {
    var logoBytes = Utilities.base64Decode(MG_LOGO_BASE64);
    inlineImagesObj.logoMg = Utilities.newBlob(logoBytes, "image/png", "logo-mg.png");
    tieneLogo = true;
  } catch (logoErr) {
    tieneLogo = false;
  }

  var logoHeaderHtml = tieneLogo
    ? "<div style=\\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\\">" +
        "<img src=\\"cid:logoMg\\" alt=\\"MG Consultores S.A.S.\\" width=\\"74\\" height=\\"45\\" style=\\"display:block;border:0;width:74px;height:auto;\\" />" +
      "</div>"
    : "<div style=\\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\\">MG</div>";

  var asunto = "Flor de Obsequio - Obsequio Visitantes: " + idsTexto + " (" + (visitanteTexto || ("Sede " + String(primera.sede || ""))) + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\\n" +
    "NUEVA SOLICITUD: OBSEQUIO VISITANTES\\n" +
    "==================================================\\n" +
    "Id(s): " + idsTexto + "\\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\\n" +
    "Registrado por: " + String(primera.nombre || "") + " (" + String(primera.codigo || "") + ")\\n" +
    "Nombre Visitante: " + visitanteTexto + "\\n" +
    "Empresa: " + (empresaTexto || "—") + "\\n" +
    "Sede: " + String(primera.sede || "") + "\\n" +
    "Motivo: " + motivoTexto + "\\n" +
    "Semana: " + semanaTexto + "\\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\\n" +
    "Notificado a: " + notificadoTexto + "\\n" +
    "Observación: " + (obsTexto || "Sin observaciones adicionales.") + "\\n\\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\\n" +
    filasTexto + "\\n" +
    "Sistema Flor de Obsequio • Notificación automática.\\n";

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
                    "<div style=\\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\\">Nueva Solicitud: Obsequio Visitantes</div>" +
                    "<div style=\\"font-size:13px;color:#cbd5e1;margin-top:4px;\\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\\"right\\" style=\\"vertical-align:top;padding-left:12px;\\">" +
                    logoHeaderHtml +
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
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Registrado por</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.nombre || "") + " (" + escapeHtml(primera.codigo || "") + ")</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Nombre Visitante</td>" +
                  "<td style=\\"padding:7px 0;font-weight:800;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(visitanteTexto || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Empresa</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(empresaTexto || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Sede</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(primera.sede || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Motivo</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\\">" + escapeHtml(motivoTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\\"padding:7px 0;color:#64748b;\\">Notificado</td>" +
                  "<td style=\\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\\">" + escapeHtml(notificadoTexto) + "</td>" +
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
              "<strong>Sistema Flor de Obsequio</strong> &bull; Notificación automática." +
            "</td></tr>" +
          "</table>" +
        "</td></tr>" +
      "</table>" +
    "</body>" +
    "</html>";

  var senderEmail = "";
  try { senderEmail = Session.getEffectiveUser().getEmail() || ""; } catch (ue) {}

  try {
    var mailPayload = {
      to: emailTo,
      subject: asunto,
      body: textBody,
      htmlBody: htmlBody,
      name: "Notificaciones Flor de Obsequio"
    };
    if (tieneLogo) {
      mailPayload.inlineImages = inlineImagesObj;
    }
    MailApp.sendEmail(mailPayload);
    var quotaRemaining = null;
    try { quotaRemaining = MailApp.getRemainingDailyQuota(); } catch (qe) {}
    return { emailSent: true, to: emailDisplay, senderEmail: senderEmail, quotaRemaining: quotaRemaining };
  } catch (mailErr) {
    return { emailSent: false, to: emailDisplay, senderEmail: senderEmail, emailError: String(mailErr) };
  }
}

/**
 * Ejecute esta función una vez desde el editor de Apps Script (▶ Ejecutar)
 * para otorgar permisos de envío de correos (MailApp) y almacenamiento en Drive (DriveApp).
 */
function autorizarEnvioCorreos() {
  var cuota = MailApp.getRemainingDailyQuota();
  var rootName = DriveApp.getRootFolder().getName();
  Logger.log("Permisos MailApp y DriveApp autorizados. Cuota diaria: " + cuota + " | Drive: " + rootName);
  return {
    status: "success",
    message: "Permisos de envío de correo y Drive autorizados. Cuota diaria restante: " + cuota
  };
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return responder({ status: "error", message: "No se pudo abrir la hoja" });
    var workers = leerTrabajadores(ss);
    var solicitudes = leerSolicitudes(ss);
    var solicitudesIntExt = leerSolicitudesIntExt(ss);
    var solicitudesEspecialesPersonal = leerEspecialesPersonal(ss);
    var solicitudesComunidad = leerSolicitudesComunidad(ss);
    var solicitudesIngresosSeleccion = leerIngresosSeleccion(ss);
    var solicitudesObsequioVisitantes = leerObsequioVisitantes(ss);
    var permisosFormularios = leerPermisosFormularios(ss);
    var hojaIntExt = buscarHojaPorNombre(ss, ["Especiales Empresa"]);
    var hojaEp = buscarHojaPorNombre(ss, ["Especiales Personal"]);
    var hojaSc = buscarHojaPorNombre(ss, ["Solicitud Comunidad"]);
    var hojaIs = obtenerHojaIngresosPersonal(ss, false);
    var hojaOv = buscarHojaPorNombre(ss, ["Obsequio Visitantes", "Obsequio Visitante"]);
    return responder({
      status: "success",
      message: "Conexión exitosa",
      spreadsheetName: ss.getName(),
      totalWorkers: workers.length,
      workers: workers,
      solicitudes: solicitudes,
      solicitudesIntExt: solicitudesIntExt,
      solicitudesEspecialesPersonal: solicitudesEspecialesPersonal,
      solicitudesComunidad: solicitudesComunidad,
      solicitudesIngresosSeleccion: solicitudesIngresosSeleccion,
      solicitudesObsequioVisitantes: solicitudesObsequioVisitantes,
      permisosFormularios: permisosFormularios,
      supportsIntExt: true,
      supportsEspecialesPersonal: true,
      supportsEspecialesPersonalEstado: true,
      supportsSolicitudComunidad: true,
      supportsIngresosSeleccion: true,
      supportsObsequioVisitantes: true,
      supportsPermisosFormularios: true,
      supportsEmailNotification: true,
      intExtSheetName: hojaIntExt ? hojaIntExt.getName() : "Especiales Empresa",
      especialesPersonalSheetName: hojaEp ? hojaEp.getName() : "Especiales Personal",
      solicitudComunidadSheetName: hojaSc ? hojaSc.getName() : "Solicitud Comunidad",
      ingresosSeleccionSheetName: hojaIs ? hojaIs.getName() : "Ingresos Personal",
      obsequioVisitantesSheetName: hojaOv ? hojaOv.getName() : "Obsequio Visitantes"
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
    "Id", "Fecha Solicitud", "Código", "Nombre", "Sede",
    "Producto", "Cantidad", "Motivo", "Semana", "Fecha Entrega", "Hora Entrega", "Observación", "Foto Carta", "Notificado"
  ];
  if (!headers.length || !headers[0]) {
    headers = headersDefault;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  } else {
    var tieneColSede = false;
    var idxNombreCol = -1;
    for (var hs = 0; hs < headers.length; hs++) {
      var hSedeCheck = String(headers[hs] || "").toUpperCase();
      if (hSedeCheck.indexOf("SEDE") !== -1) tieneColSede = true;
      if (hSedeCheck.indexOf("NOMBRE") !== -1 && idxNombreCol < 0) idxNombreCol = hs;
    }
    if (!tieneColSede) {
      if (idxNombreCol >= 0) {
        sheet.insertColumnAfter(idxNombreCol + 1);
        sheet.getRange(1, idxNombreCol + 2)
          .setValue("Sede")
          .setFontWeight("bold")
          .setBackground("#0a2958")
          .setFontColor("#ffffff");
        headers.splice(idxNombreCol + 1, 0, "Sede");
      } else {
        sheet.getRange(1, headers.length + 1)
          .setValue("Sede")
          .setFontWeight("bold")
          .setBackground("#0a2958")
          .setFontColor("#ffffff");
        headers.push("Sede");
      }
    }

    var tieneColCarta = false;
    for (var hc = 0; hc < headers.length; hc++) {
      var hCheck = String(headers[hc] || "").toUpperCase();
      if (hCheck.indexOf("CARTA") !== -1 || hCheck.indexOf("FOTO") !== -1) {
        tieneColCarta = true;
        break;
      }
    }
    if (!tieneColCarta) {
      sheet.getRange(1, headers.length + 1)
        .setValue("Foto Carta")
        .setFontWeight("bold")
        .setBackground("#0a2958")
        .setFontColor("#ffffff");
      headers.push("Foto Carta");
    }
  }

  var cantidadNum = Number(data.cantidad);
  if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;

  var sedeInferida = String(data.sede || "").trim();
  if (!sedeInferida) {
    var prodLow = String(data.producto || "").toLowerCase();
    if (prodLow.indexOf("alstroemeria") !== -1) sedeInferida = "HA";
    else if (prodLow.indexOf("clavel") !== -1) sedeInferida = "SC";
    else if (prodLow.indexOf("rosa") !== -1 || prodLow.indexOf("bouquet") !== -1 || prodLow.indexOf("gypso") !== -1) sedeInferida = "MG";
  }

  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\\s+/g, " ").trim();
    if (h === "ID" || h === "ID.") return data.id || ("SIE-" + new Date().getTime());
    if (h.indexOf("HORA") !== -1) return data.horaEntrega || "";
    if (h === "FECHA ENTREGA" || (h.indexOf("ENTREGA") !== -1 && h.indexOf("HORA") === -1)) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CÓDIGO") !== -1 || h.indexOf("CODIGO") !== -1) return data.codigo || "";
    if (h.indexOf("NOMBRE") !== -1) return data.nombre || "";
    if (h.indexOf("SEDE") !== -1) return sedeInferida;
    if (h.indexOf("ÁREA") !== -1 || h.indexOf("AREA") !== -1) return data.area || "";
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
    if (h.indexOf("CANTIDAD") !== -1) return cantidadNum;
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "";
    if (h.indexOf("SEMANA") !== -1) return data.semana || "";
    if (h.indexOf("OBSERVACI") !== -1) return data.observacion || "";
    if (h.indexOf("CARTA") !== -1 || h.indexOf("FOTO") !== -1) return data.fotoCarta || "";
    if (h.indexOf("NOTIFICAD") !== -1 || h.indexOf("ESTADO") !== -1) return data.notificado || data.estado || "Registrada";
    return "";
  }

  var fila = [];
  for (var c = 0; c < headers.length; c++) {
    fila.push(valorParaHeader(headers[c]));
  }
  sheet.appendRow(fila);
}

/**
 * Escribe una fila en la hoja Especiales Personal:
 * Id | Fecha Solicitud | Cédula | Nombre | Sede | Producto | Color | Cantidad | Motivo | Semana | Fecha Entrega | Correo de confirmación | Estado | Notificado
 */
function escribirEspecialPersonal(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Cédula", "Nombre", "Sede",
    "Producto", "Color", "Cantidad", "Motivo", "Semana", "Fecha Entrega", "Correo de confirmación", "Estado", "Notificado"
  ];
  if (!headers.length || !headers[0]) {
    headers = headersDefault;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  } else if (data.color && indiceColumnaExactoOPista(headers, ["COLOR"], ["COLOR"]) < 0) {
    headers.push("Color");
    sheet.getRange(1, headers.length).setValue("Color").setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  }

  var cantidadNum = Number(data.cantidad);
  if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;

  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\\s+/g, " ").trim();
    if (h === "ID" || h === "ID.") return data.id || ("SEP-" + new Date().getTime());
    if (h.indexOf("ENTREGA") !== -1) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CORREO") !== -1 || h.indexOf("CONFIRMACI") !== -1) return data.correoConfirmacion || "";
    if (h.indexOf("CÉDULA") !== -1 || h.indexOf("CEDULA") !== -1 || h === "CC" || h.indexOf("DOCUMENTO") !== -1) return data.cedula || "";
    if (h.indexOf("NOMBRE") !== -1) return data.nombre || "";
    if (h.indexOf("SEDE") !== -1) return data.sede || "";
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
    if (h.indexOf("COLOR") !== -1) return data.color || "";
    if (h.indexOf("CANTIDAD") !== -1) return cantidadNum;
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "";
    if (h.indexOf("SEMANA") !== -1) return data.semana || "";
    if (h.indexOf("ESTADO") !== -1) return data.estado || "Pendiente Aprobación";
    if (h.indexOf("OBSERVACI") !== -1) return data.estado || data.observacion || "Pendiente Aprobación";
    if (h.indexOf("CARTA") !== -1 || h.indexOf("FOTO") !== -1) return data.fotoCarta || "";
    if (h.indexOf("NOTIFICAD") !== -1) return data.notificado || "angela.garcia@mg-consultores.com";
    return "";
  }

  var fila = [];
  for (var c = 0; c < headers.length; c++) {
    fila.push(valorParaHeader(headers[c]));
  }
  sheet.appendRow(fila);
}

function actualizarEstadoEspecialPersonal(ss, idSolicitud, nuevoEstado) {
  var sheet = buscarHojaPorNombre(ss, ["Especiales Personal"]);
  if (!sheet) {
    return { updated: false, message: "No se encontró la hoja Especiales Personal." };
  }
  var idTarget = String(idSolicitud || "").trim().toUpperCase();
  var estadoVal = String(nuevoEstado || "").trim();
  if (!idTarget || !estadoVal) {
    return { updated: false, message: "Id o estado inválido." };
  }
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return { updated: false, message: "La hoja Especiales Personal no tiene registros." };
  }
  var headers = values[0];
  var idxId = indiceColumnaExactoOPista(headers, ["ID", "ID."], []);
  if (idxId < 0) idxId = 0;
  var idxEstado = indiceColumnaExactoOPista(headers, ["ESTADO"], ["ESTADO"]);
  if (idxEstado < 0) {
    idxEstado = headers.length;
    sheet.getRange(1, idxEstado + 1).setValue("Estado").setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  }

  var updated = false;
  for (var r = 1; r < values.length; r++) {
    var rowId = String(values[r][idxId] || "").trim().toUpperCase();
    if (rowId === idTarget) {
      sheet.getRange(r + 1, idxEstado + 1).setValue(estadoVal);
      updated = true;
      break;
    }
  }
  if (updated) {
    SpreadsheetApp.flush();
  }
  return { updated: updated, id: idSolicitud, estado: estadoVal };
}

function enviarCorreoRespuestaEstadoEspecialPersonal(ss, item) {
  var it = item || {};
  var correoDestino = String(it.correoConfirmacion || "").trim();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(correoDestino)) {
    return { emailSent: false, to: correoDestino, emailError: "Correo de confirmación inválido." };
  }
  var estadoTexto = String(it.estado || "Pendiente Aprobación").trim();
  var esAprobado = estadoTexto.toUpperCase() === "APROBADO";
  var colorBadge = esAprobado ? "#047857" : "#b91c1c";
  var bgBadge = esAprobado ? "#ecfdf5" : "#fef2f2";
  var asunto = "Respuesta Solicitud Especiales Personal " + String(it.id || "") + ": " + estadoTexto;

  var colorResp = String(it.color || "").trim();
  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\\n" +
    "RESPUESTA A SOLICITUD ESPECIALES PERSONAL\\n" +
    "==================================================\\n" +
    "Id: " + String(it.id || "") + "\\n" +
    "Colaborador: " + String(it.nombre || "") + "\\n" +
    "Producto: " + String(it.producto || "") + " (" + String(it.cantidad || 1) + " ramos)\\n" +
    (colorResp ? ("Color: " + colorResp + "\\n") : "") +
    "Motivo: " + String(it.motivo || "") + "\\n" +
    "Fecha de Entrega: " + String(it.fechaEntrega || "") + "\\n" +
    "Estado de la Solicitud: " + estadoTexto + "\\n\\n" +
    "Sistema Flor de Obsequio • Notificación automática.\\n";

  var htmlBody =
    "<!DOCTYPE html><html lang=\\"es\\"><head><meta charset=\\"UTF-8\\"></head>" +
    "<body style=\\"margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b;\\">" +
      "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\" style=\\"max-width:580px;margin:0 auto;background-color:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;\\">" +
        "<tr><td style=\\"height:5px;background-color:#E60000;\\"></td></tr>" +
        "<tr><td style=\\"background-color:#0a2958;padding:20px 24px;color:#ffffff;\\">" +
          "<div style=\\"font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#fca5a5;\\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
          "<div style=\\"font-size:19px;font-weight:800;margin-top:4px;\\">Respuesta de Solicitud: Especiales Personal</div>" +
        "</td></tr>" +
        "<tr><td style=\\"padding:22px 24px;\\">" +
          "<div style=\\"display:inline-block;padding:8px 14px;border-radius:8px;background-color:" + bgBadge + ";color:" + colorBadge + ";font-size:14px;font-weight:800;margin-bottom:16px;\\">" +
            "Estado: " + escapeHtml(estadoTexto) +
          "</div>" +
          "<table role=\\"presentation\\" width=\\"100%\\" cellspacing=\\"0\\" cellpadding=\\"0\\" style=\\"font-size:13px;\\">" +
            "<tr><td style=\\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Id</td><td style=\\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + escapeHtml(it.id || "—") + "</td></tr>" +
            "<tr><td style=\\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Colaborador</td><td style=\\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + escapeHtml(it.nombre || "—") + "</td></tr>" +
            "<tr><td style=\\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Producto</td><td style=\\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + escapeHtml(it.producto || "—") + " (" + escapeHtml(it.cantidad || 1) + " ramos)</td></tr>" +
            (colorResp ? ("<tr><td style=\\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Color</td><td style=\\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + escapeHtml(colorResp) + "</td></tr>") : "") +
            "<tr><td style=\\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\\">Motivo</td><td style=\\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\\">" + escapeHtml(it.motivo || "—") + "</td></tr>" +
            "<tr><td style=\\"padding:6px 0;color:#64748b;\\">Fecha de Entrega</td><td style=\\"padding:6px 0;font-weight:700;text-align:right;\\">" + escapeHtml(it.fechaEntrega || "—") + "</td></tr>" +
          "</table>" +
        "</td></tr>" +
        "<tr><td style=\\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 24px;text-align:center;font-size:11px;color:#64748b;\\">" +
          "<strong>Sistema Flor de Obsequio</strong> &bull; Respuesta de autorización." +
        "</td></tr>" +
      "</table>" +
    "</body></html>";

  var senderEmail = "";
  try { senderEmail = Session.getEffectiveUser().getEmail() || ""; } catch (ue) {}
  try {
    MailApp.sendEmail({
      to: correoDestino,
      cc: "angela.garcia@mg-consultores.com",
      replyTo: "angela.garcia@mg-consultores.com",
      subject: asunto,
      body: textBody,
      htmlBody: htmlBody,
      name: "Notificaciones Flor de Obsequio"
    });
    return { emailSent: true, to: correoDestino, senderEmail: senderEmail };
  } catch (mailErr) {
    return { emailSent: false, to: correoDestino, senderEmail: senderEmail, emailError: String(mailErr) };
  }
}

/**
 * Escribe una fila en la hoja Solicitud Comunidad:
 * Id | Fecha Solicitud | Usuario | Entidad | Motivo | Sede | Producto | Cantidad | Semana | Fecha Entrega | Correo de confirmación | Estado | Foto Carta | Notificado
 */
function escribirSolicitudComunidad(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Usuario", "Entidad", "Motivo", "Sede",
    "Producto", "Cantidad", "Semana", "Fecha Entrega", "Correo de confirmación", "Estado", "Foto Carta", "Notificado"
  ];
  if (!headers.length || !headers[0]) {
    headers = headersDefault;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  }

  var cantidadNum = Number(data.cantidad);
  if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;

  var sedeInferida = String(data.sede || "").trim();
  if (!sedeInferida) {
    var prodLow = String(data.producto || "").toLowerCase();
    if (prodLow.indexOf("alstroemeria") !== -1) sedeInferida = "HA";
    else if (prodLow.indexOf("clavel") !== -1) sedeInferida = "SC";
    else if (prodLow.indexOf("rosa") !== -1 || prodLow.indexOf("bouquet") !== -1 || prodLow.indexOf("gypso") !== -1) sedeInferida = "MG";
  }

  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\\s+/g, " ").trim();
    if (h === "ID" || h === "ID.") return data.id || ("SC-" + new Date().getTime());
    if (h.indexOf("ENTREGA") !== -1) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CORREO") !== -1 || h.indexOf("CONFIRMACI") !== -1) return data.correoConfirmacion || "";
    if (h.indexOf("USUARIO") !== -1) return data.usuario || "";
    if (h.indexOf("ENTIDAD") !== -1) return data.entidad || "";
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "";
    if (h.indexOf("LUGAR") !== -1) return data.lugar || "";
    if (h.indexOf("SEDE") !== -1) return sedeInferida;
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
    if (h.indexOf("CANTIDAD") !== -1) return cantidadNum;
    if (h.indexOf("SEMANA") !== -1) return data.semana || "";
    if (h.indexOf("ESTADO") !== -1) return data.estado || "Pendiente Aprobación";
    if (h.indexOf("OBSERVACI") !== -1) return data.estado || data.observacion || "Pendiente Aprobación";
    if (h.indexOf("CARTA") !== -1 || h.indexOf("FOTO") !== -1) return data.fotoCarta || "";
    if (h.indexOf("NOTIFICAD") !== -1) return data.notificado || "Registrada";
    return "";
  }

  var fila = [];
  for (var c = 0; c < headers.length; c++) {
    fila.push(valorParaHeader(headers[c]));
  }
  sheet.appendRow(fila);
}

/**
 * Escribe una fila en la hoja Ingresos Personal:
 * Id | Fecha Solicitud | Código | Nombre | Sede | Producto | Cantidad | Motivo | Semana | Fecha Entrega | Hora Entrega | Observación | Notificado
 */
function escribirIngresoSeleccion(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Código", "Nombre", "Sede",
    "Producto", "Cantidad", "Motivo", "Semana", "Fecha Entrega", "Hora Entrega", "Observación", "Notificado"
  ];
  if (!headers.length || !headers[0]) {
    headers = headersDefault;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  } else {
    var tieneColHora = false;
    var idxFechaEntregaCol = -1;
    for (var hc = 0; hc < headers.length; hc++) {
      var hUpper = String(headers[hc] || "").toUpperCase();
      if (hUpper.indexOf("HORA") !== -1) tieneColHora = true;
      if (hUpper.indexOf("ENTREGA") !== -1 && hUpper.indexOf("HORA") === -1) idxFechaEntregaCol = hc;
    }
    if (!tieneColHora) {
      if (idxFechaEntregaCol >= 0) {
        sheet.insertColumnAfter(idxFechaEntregaCol + 1);
        sheet.getRange(1, idxFechaEntregaCol + 2)
          .setValue("Hora Entrega")
          .setFontWeight("bold")
          .setBackground("#0a2958")
          .setFontColor("#ffffff");
        headers.splice(idxFechaEntregaCol + 1, 0, "Hora Entrega");
      } else {
        sheet.getRange(1, headers.length + 1)
          .setValue("Hora Entrega")
          .setFontWeight("bold")
          .setBackground("#0a2958")
          .setFontColor("#ffffff");
        headers.push("Hora Entrega");
      }
    }
  }

  var cantidadNum = Number(data.cantidad);
  if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;

  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\\s+/g, " ").trim();
    if (h === "ID" || h === "ID.") return data.id || ("IS-" + new Date().getTime());
    if (h.indexOf("HORA") !== -1) return data.horaEntrega || "";
    if (h === "FECHA ENTREGA" || (h.indexOf("ENTREGA") !== -1 && h.indexOf("HORA") === -1)) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CÓDIGO") !== -1 || h.indexOf("CODIGO") !== -1) return data.codigo || "";
    if (h.indexOf("NOMBRE") !== -1) return data.nombre || "";
    if (h.indexOf("SEDE") !== -1) return data.sede || "";
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
    if (h.indexOf("CANTIDAD") !== -1) return cantidadNum;
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "Ingresos";
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

/**
 * Escribe una fila en la hoja Obsequio Visitantes:
 * Id | Fecha Solicitud | Código | Nombre | Sede | Producto | Cantidad | Motivo | Nombre Visitante | Empresa | Semana | Fecha Entrega | Observación | Notificado
 */
function escribirObsequioVisitante(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Código", "Nombre", "Sede",
    "Producto", "Cantidad", "Motivo", "Nombre Visitante", "Empresa", "Semana", "Fecha Entrega", "Observación", "Notificado"
  ];
  if (!headers.length || !headers[0]) {
    headers = headersDefault;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  } else {
    var tieneColEmpresa = false;
    var idxVisitanteCol = -1;
    for (var hc = 0; hc < headers.length; hc++) {
      var hUpper = String(headers[hc] || "").toUpperCase();
      if (hUpper.indexOf("EMPRESA") !== -1) tieneColEmpresa = true;
      if (hUpper.indexOf("VISITANTE") !== -1) idxVisitanteCol = hc;
    }
    if (!tieneColEmpresa) {
      if (idxVisitanteCol >= 0) {
        sheet.insertColumnAfter(idxVisitanteCol + 1);
        sheet.getRange(1, idxVisitanteCol + 2)
          .setValue("Empresa")
          .setFontWeight("bold")
          .setBackground("#0a2958")
          .setFontColor("#ffffff");
        headers.splice(idxVisitanteCol + 1, 0, "Empresa");
      } else {
        sheet.getRange(1, headers.length + 1)
          .setValue("Empresa")
          .setFontWeight("bold")
          .setBackground("#0a2958")
          .setFontColor("#ffffff");
        headers.push("Empresa");
      }
    }
  }

  var cantidadNum = Number(data.cantidad);
  if (!cantidadNum || isNaN(cantidadNum)) cantidadNum = 1;

  function valorParaHeader(headerRaw) {
    var h = String(headerRaw || "").toUpperCase().replace(/\\s+/g, " ").trim();
    if (h === "ID" || h === "ID.") return data.id || ("OV-" + new Date().getTime());
    if (h.indexOf("ENTREGA") !== -1) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CÓDIGO") !== -1 || h.indexOf("CODIGO") !== -1) return data.codigo || "";
    if (h.indexOf("EMPRESA") !== -1) return data.empresa || "";
    if (h.indexOf("VISITANTE") !== -1) return data.nombreVisitante || "";
    if (h.indexOf("NOMBRE") !== -1) return data.nombre || "";
    if (h.indexOf("SEDE") !== -1) return data.sede || "";
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
    if (h.indexOf("CANTIDAD") !== -1) return cantidadNum;
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "Visitante";
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

function parsearListaPermiso(raw) {
  var txt = String(raw || "").trim();
  if (!txt) return [];
  var partes = txt.split("|");
  var out = [];
  for (var i = 0; i < partes.length; i++) {
    var v = String(partes[i] || "").trim();
    if (v) out.push(v);
  }
  return out;
}

function leerPermisosFormularios(ss) {
  var sheet = buscarHojaPorNombre(ss, ["Permisos Formularios", "Permisos"]);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;

  var headers = data[0] || [];
  var idxForm = indiceColumnaEstricto(headers, ["FORMULARIO"]);
  var idxTodos = indiceColumnaEstricto(headers, ["TODOS"]);
  var idxCargos = indiceColumnaExactoOPista(headers, ["CARGOS"], ["CARGOS"]);
  var idxPalabras = indiceColumnaEstricto(headers, ["PALABRAS", "CLAVE"]);
  var idxCodigos = indiceColumnaExactoOPista(headers, ["CÓDIGOS", "CODIGOS"], ["CÓDIGO", "CODIGO"]);
  var idxExcluidos = indiceColumnaEstricto(headers, ["EXCLUIDO"]);

  if (idxForm < 0) idxForm = 0;
  if (idxTodos < 0) idxTodos = 2;
  if (idxCargos < 0) idxCargos = 3;
  if (idxPalabras < 0) idxPalabras = 4;
  if (idxCodigos < 0) idxCodigos = 5;
  if (idxExcluidos < 0) idxExcluidos = 6;

  var mapa = {};
  var count = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var formKey = String(row[idxForm] || "").trim();
    if (!formKey) continue;
    var rawTodos = String(row[idxTodos] || "").trim().toUpperCase();
    var todos = rawTodos === "SI" || rawTodos === "SÍ" || rawTodos === "TRUE" || rawTodos === "1";
    mapa[formKey] = {
      todos: todos,
      cargos: parsearListaPermiso(row[idxCargos]),
      palabrasClaveCargo: parsearListaPermiso(row[idxPalabras]),
      codigos: parsearListaPermiso(row[idxCodigos]),
      codigosExcluidos: parsearListaPermiso(row[idxExcluidos])
    };
    count++;
  }
  return count > 0 ? mapa : null;
}

function guardarPermisosFormularios(ss, permisosObj, actualizadoPor) {
  var sheet = buscarHojaPorNombre(ss, ["Permisos Formularios", "Permisos"]) || ss.insertSheet("Permisos Formularios");
  var etiquetas = {
    "formulario": "Solicitud Personal",
    "especiales-personal": "Especiales Personal",
    "int-ext": "Especiales Empresa",
    "ingresos-seleccion": "Ingresos Personal",
    "obsequio-visitantes": "Obsequio Visitantes",
    "solicitud-comunidad": "Solicitud Comunidad",
    "solicitudes": "Resumen Solicitud",
    "consolidado": "Consolidado"
  };
  var keys = [
    "formulario",
    "especiales-personal",
    "int-ext",
    "ingresos-seleccion",
    "obsequio-visitantes",
    "solicitud-comunidad",
    "solicitudes",
    "consolidado"
  ];

  sheet.clearContents();
  var headers = ["Formulario", "Etiqueta", "Todos", "Cargos", "Palabras Clave Cargo", "Códigos", "Códigos Excluidos", "Actualizado"];
  var rows = [headers];
  var stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + (actualizadoPor ? (" (" + actualizadoPor + ")") : "");

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var regra = (permisosObj && permisosObj[k]) ? permisosObj[k] : {};
    rows.push([
      k,
      etiquetas[k] || k,
      regra.todos ? "SI" : "NO",
      Array.isArray(regra.cargos) ? regra.cargos.join(" | ") : "",
      Array.isArray(regra.palabrasClaveCargo) ? regra.palabrasClaveCargo.join(" | ") : "",
      Array.isArray(regra.codigos) ? regra.codigos.join(" | ") : "",
      Array.isArray(regra.codigosExcluidos) ? regra.codigosExcluidos.join(" | ") : "",
      stamp
    ]);
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  SpreadsheetApp.flush();
  return leerPermisosFormularios(ss);
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
      var hojaEpPing = buscarHojaPorNombre(ss, ["Especiales Personal"]);
      var hojaScPing = buscarHojaPorNombre(ss, ["Solicitud Comunidad"]);
      var hojaIsPing = obtenerHojaIngresosPersonal(ss, false);
      var hojaOvPing = buscarHojaPorNombre(ss, ["Obsequio Visitantes", "Obsequio Visitante"]);
      return responder({
        status: "success",
        message: data.action === "ping" ? "Ping recibido" : "Listado",
        spreadsheetName: ss.getName(),
        totalWorkers: workers.length,
        workers: workers,
        solicitudes: leerSolicitudes(ss),
        solicitudesIntExt: leerSolicitudesIntExt(ss),
        solicitudesEspecialesPersonal: leerEspecialesPersonal(ss),
        solicitudesComunidad: leerSolicitudesComunidad(ss),
        solicitudesIngresosSeleccion: leerIngresosSeleccion(ss),
        solicitudesObsequioVisitantes: leerObsequioVisitantes(ss),
        permisosFormularios: leerPermisosFormularios(ss),
        supportsIntExt: true,
        supportsEspecialesPersonal: true,
        supportsEspecialesPersonalEstado: true,
        supportsSolicitudComunidad: true,
        supportsIngresosSeleccion: true,
        supportsObsequioVisitantes: true,
        supportsPermisosFormularios: true,
        supportsEmailNotification: true,
        intExtSheetName: hojaIntExtPing ? hojaIntExtPing.getName() : "Especiales Empresa",
        especialesPersonalSheetName: hojaEpPing ? hojaEpPing.getName() : "Especiales Personal",
        solicitudComunidadSheetName: hojaScPing ? hojaScPing.getName() : "Solicitud Comunidad",
        ingresosSeleccionSheetName: hojaIsPing ? hojaIsPing.getName() : "Ingresos Personal",
        obsequioVisitantesSheetName: hojaOvPing ? hojaOvPing.getName() : "Obsequio Visitantes"
      });
    }

    if (data.action === "guardar_permisos_formularios") {
      var guardadosPermisos = guardarPermisosFormularios(ss, data.permisos || {}, data.actualizadoPor || "");
      return responder({
        status: "success",
        message: "Permisos de formularios guardados en Google Drive",
        permisosFormularios: guardadosPermisos,
        supportsPermisosFormularios: true
      });
    }

    if (data.action === "sincronizar_maestro" || data.action === "agregar_trabajador_maestro") {
      var listaMaestro = (data.workers && data.workers.length) ? data.workers : (data.worker ? [data.worker] : []);
      var actualizadosMaestro = sincronizarMaestroHoja(ss, listaMaestro);
      return responder({
        status: "success",
        syncedMaestro: true,
        message: "Maestro sincronizado en Google Drive (" + actualizadosMaestro.length + " trabajadores)",
        workers: actualizadosMaestro
      });
    }

    if (data.action === "subir_foto_carta") {
      return responder(subirFotoCartaDrive(ss, data.base64, data.mimeType, data.fileName, data.folderName || ""));
    }

    if (data.action === "notificar_int_ext") {
      var itemsCorreo = (data.items && data.items.length) ? data.items : [data];
      var destinoCorreo = data.correoDestino || data.correo || (itemsCorreo[0] ? (itemsCorreo[0].notificado || itemsCorreo[0].estado) : "");
      var resMail = enviarCorreoNotificacionIntExt(
        ss,
        destinoCorreo,
        itemsCorreo,
        data.fotoCartaBase64 || "",
        data.fotoCartaMime || "image/jpeg",
        data.fotoCartaNombre || ""
      );
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

    if (data.action === "notificar_ingresos_seleccion") {
      var itemsCorreoIs = (data.items && data.items.length) ? data.items : [data];
      var destinoCorreoIs = data.correoDestino || data.correo || (itemsCorreoIs[0] ? (itemsCorreoIs[0].notificado || itemsCorreoIs[0].estado) : "");
      var resMailIs = enviarCorreoNotificacionIngresosSeleccion(ss, destinoCorreoIs, itemsCorreoIs);
      return responder({
        status: "success",
        emailSent: !!resMailIs.emailSent,
        to: resMailIs.to || destinoCorreoIs || "",
        senderEmail: resMailIs.senderEmail || "",
        quotaRemaining: resMailIs.quotaRemaining,
        emailError: resMailIs.emailError || "",
        message: resMailIs.emailError || (resMailIs.emailSent ? "Correo enviado" : ""),
        supportsEmailNotification: true,
        supportsIngresosSeleccion: true
      });
    }

    if (data.action === "notificar_obsequio_visitantes") {
      var itemsCorreoOv = (data.items && data.items.length) ? data.items : [data];
      var destinoCorreoOv = data.correoDestino || data.correo || (itemsCorreoOv[0] ? (itemsCorreoOv[0].notificado || itemsCorreoOv[0].estado) : "");
      var resMailOv = enviarCorreoNotificacionObsequioVisitantes(ss, destinoCorreoOv, itemsCorreoOv);
      return responder({
        status: "success",
        emailSent: !!resMailOv.emailSent,
        to: resMailOv.to || destinoCorreoOv || "",
        senderEmail: resMailOv.senderEmail || "",
        quotaRemaining: resMailOv.quotaRemaining,
        emailError: resMailOv.emailError || "",
        message: resMailOv.emailError || (resMailOv.emailSent ? "Correo enviado" : ""),
        supportsEmailNotification: true,
        supportsObsequioVisitantes: true
      });
    }

    if (data.action === "notificar_especial_personal") {
      var itemsCorreoEp = (data.items && data.items.length) ? data.items : [data];
      var destinoCorreoEp = data.correoDestino || data.correo || "angela.garcia@mg-consultores.com";
      var correoConfEp = data.correoConfirmacion || (itemsCorreoEp[0] ? itemsCorreoEp[0].correoConfirmacion : "");
      var resMailEp = enviarCorreoNotificacionEspecialPersonal(
        ss,
        destinoCorreoEp,
        itemsCorreoEp,
        data.fotoCartaBase64 || "",
        data.fotoCartaMime || "image/jpeg",
        data.fotoCartaNombre || "",
        correoConfEp
      );
      return responder({
        status: "success",
        emailSent: !!resMailEp.emailSent,
        to: resMailEp.to || destinoCorreoEp || "",
        senderEmail: resMailEp.senderEmail || "",
        quotaRemaining: resMailEp.quotaRemaining,
        emailError: resMailEp.emailError || "",
        message: resMailEp.emailError || (resMailEp.emailSent ? "Correo enviado" : ""),
        supportsEmailNotification: true,
        supportsEspecialesPersonal: true
      });
    }

    if (data.action === "notificar_solicitud_comunidad") {
      var itemsCorreoSc = (data.items && data.items.length) ? data.items : [data];
      var destinoCorreoSc = data.correoDestino || data.correo || (itemsCorreoSc[0] ? (itemsCorreoSc[0].notificado || itemsCorreoSc[0].estado) : "");
      var resMailSc = enviarCorreoNotificacionSolicitudComunidad(
        ss,
        destinoCorreoSc,
        itemsCorreoSc,
        data.fotoCartaBase64 || "",
        data.fotoCartaMime || "image/jpeg",
        data.fotoCartaNombre || ""
      );
      return responder({
        status: "success",
        emailSent: !!resMailSc.emailSent,
        to: resMailSc.to || destinoCorreoSc || "",
        senderEmail: resMailSc.senderEmail || "",
        quotaRemaining: resMailSc.quotaRemaining,
        emailError: resMailSc.emailError || "",
        message: resMailSc.emailError || (resMailSc.emailSent ? "Correo enviado" : ""),
        supportsEmailNotification: true,
        supportsSolicitudComunidad: true
      });
    }

    if (data.action === "registrar_ingresos_seleccion" || data.hoja === "Ingresos Personal" || data.hoja === "Ingresos Selección" || data.hoja === "Ingresos Seleccion") {
      var sheetIs = obtenerHojaIngresosPersonal(ss, true);
      escribirIngresoSeleccion(sheetIs, data);
      return responder({
        status: "success",
        message: "Solicitud registrada en " + sheetIs.getName(),
        id: data.id,
        solicitudesIngresosSeleccion: leerIngresosSeleccion(ss),
        supportsIngresosSeleccion: true,
        supportsEmailNotification: true,
        ingresosSeleccionSheetName: sheetIs.getName()
      });
    }

    if (data.action === "registrar_obsequio_visitantes" || data.hoja === "Obsequio Visitantes" || data.hoja === "Obsequio Visitante") {
      var sheetOv = buscarHojaPorNombre(ss, ["Obsequio Visitantes", "Obsequio Visitante"]) || ss.insertSheet("Obsequio Visitantes");
      escribirObsequioVisitante(sheetOv, data);
      return responder({
        status: "success",
        message: "Solicitud registrada en " + sheetOv.getName(),
        id: data.id,
        solicitudesObsequioVisitantes: leerObsequioVisitantes(ss),
        supportsObsequioVisitantes: true,
        supportsEmailNotification: true,
        obsequioVisitantesSheetName: sheetOv.getName()
      });
    }

    if (data.action === "registrar_solicitud_comunidad" || data.hoja === "Solicitud Comunidad") {
      var sheetSc = buscarHojaPorNombre(ss, ["Solicitud Comunidad"]) || ss.insertSheet("Solicitud Comunidad");
      escribirSolicitudComunidad(sheetSc, data);
      return responder({
        status: "success",
        message: "Solicitud registrada en " + sheetSc.getName(),
        id: data.id,
        solicitudesComunidad: leerSolicitudesComunidad(ss),
        supportsSolicitudComunidad: true,
        supportsEmailNotification: true,
        solicitudComunidadSheetName: sheetSc.getName()
      });
    }

    if (data.action === "registrar_especial_personal" || data.hoja === "Especiales Personal") {
      var sheetEp = buscarHojaPorNombre(ss, ["Especiales Personal"]) || ss.insertSheet("Especiales Personal");
      escribirEspecialPersonal(sheetEp, data);
      return responder({
        status: "success",
        message: "Solicitud registrada en " + sheetEp.getName(),
        id: data.id,
        solicitudesEspecialesPersonal: leerEspecialesPersonal(ss),
        supportsEspecialesPersonal: true,
        supportsEspecialesPersonalEstado: true,
        supportsEmailNotification: true,
        especialesPersonalSheetName: sheetEp.getName()
      });
    }

    if (data.action === "actualizar_estado_especial_personal") {
      var resEstadoEp = actualizarEstadoEspecialPersonal(ss, data.id, data.estado);
      var listaActualizadaEp = leerEspecialesPersonal(ss);
      return responder({
        status: "success",
        updated: !!resEstadoEp.updated,
        id: resEstadoEp.id || data.id,
        estado: resEstadoEp.estado || data.estado,
        message: resEstadoEp.updated ? "Estado actualizado" : (resEstadoEp.message || "Registro no encontrado"),
        solicitudesEspecialesPersonal: listaActualizadaEp,
        supportsEspecialesPersonal: true,
        supportsEspecialesPersonalEstado: true
      });
    }

    if (data.action === "notificar_respuesta_especial_personal") {
      var resMailResp = enviarCorreoRespuestaEstadoEspecialPersonal(ss, data.item || data);
      return responder({
        status: "success",
        emailSent: !!resMailResp.emailSent,
        to: resMailResp.to || "",
        senderEmail: resMailResp.senderEmail || "",
        emailError: resMailResp.emailError || "",
        message: resMailResp.emailError || (resMailResp.emailSent ? "Respuesta enviada" : ""),
        supportsEspecialesPersonalEstado: true
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
              <strong>Autorizar correos y Drive (obligatorio una sola vez):</strong> En la barra superior de Apps Script seleccione la función <code>autorizarEnvioCorreos</code>, haga clic en <strong>▶ Ejecutar</strong> y acepte <strong>Revisar permisos &gt; Configuración avanzada &gt; Permitir</strong>.
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
