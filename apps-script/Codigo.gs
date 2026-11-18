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
  var sheet = buscarHojaPorNombre(ss, ["Especiales Empresa", "Solicitud Extra", "Solicitud_Int-Ext"]);
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
      estado: String(cel(["ESTADO"]) || "Registrada"),
      creadoEn: new Date().getTime()
    });
  }
  return out;
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return responder({ status: "error", message: "No se pudo abrir la hoja" });
    var workers = leerTrabajadores(ss);
    var solicitudes = leerSolicitudes(ss);
    var solicitudesIntExt = leerSolicitudesIntExt(ss);
    var hojaIntExt = buscarHojaPorNombre(ss, ["Especiales Empresa", "Solicitud Extra", "Solicitud_Int-Ext"]);
    return responder({
      status: "success",
      message: "Conexión exitosa",
      spreadsheetName: ss.getName(),
      totalWorkers: workers.length,
      workers: workers,
      solicitudes: solicitudes,
      solicitudesIntExt: solicitudesIntExt,
      supportsIntExt: true,
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
 * Escribe una fila en la hoja Solicitud Extra:
 * Id | Fecha Solicitud | Código | Nombre | Sede | Area | Producto | Cantidad | Motivo | Semana | Fecha Entrega | Observación | Estado
 */
function escribirSolicitudIntExt(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Código", "Nombre", "Sede", "Area",
    "Producto", "Cantidad", "Motivo", "Semana", "Fecha Entrega", "Observación", "Estado"
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
    if (h.indexOf("ESTADO") !== -1) return data.estado || "Registrada";
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
      return responder({
        status: "success",
        message: data.action === "ping" ? "Ping recibido" : "Listado",
        spreadsheetName: ss.getName(),
        totalWorkers: workers.length,
        workers: workers,
        solicitudes: leerSolicitudes(ss),
        solicitudesIntExt: leerSolicitudesIntExt(ss),
        supportsIntExt: true
      });
    }

    if (data.action === "registrar_int_ext" || data.hoja === "Especiales Empresa" || data.hoja === "Solicitud Extra" || data.hoja === "Solicitud_Int-Ext") {
      var sheetIntExt = buscarHojaPorNombre(ss, ["Especiales Empresa", "Solicitud Extra", "Solicitud_Int-Ext"]) || ss.insertSheet("Especiales Empresa");
      escribirSolicitudIntExt(sheetIntExt, data);
      return responder({
        status: "success",
        message: "Solicitud registrada en " + sheetIntExt.getName(),
        id: data.id,
        solicitudesIntExt: leerSolicitudesIntExt(ss),
        supportsIntExt: true,
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
