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
  var sheetMaestro = null;
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === "Solicitudes") continue;
    var val = sheets[i].getRange(1, 1).getValue();
    if (val && String(val).toUpperCase().indexOf("ID") !== -1) {
      sheetMaestro = sheets[i];
      break;
    }
  }
  if (!sheetMaestro) sheetMaestro = ss.getSheetByName("Maestro") || sheets[0];
  var data = sheetMaestro ? sheetMaestro.getDataRange().getValues() : [];
  var workers = [];
  var headers = data[0] || [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0] || !row[1]) continue;
    workers.push({
      codigo: String(row[0]).trim(),
      nombre: String(row[1]).trim(),
      sede: normSede(row[2]),
      cargo: cargoDeFila(headers, row),
      activo: true
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
    var id = String(cel(["ID", "ID"]) || row[0] || "").trim();
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

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return responder({ status: "error", message: "No se pudo abrir la hoja" });
    var workers = leerTrabajadores(ss);
    var solicitudes = leerSolicitudes(ss);
    return responder({
      status: "success",
      message: "Conexión exitosa",
      spreadsheetName: ss.getName(),
      totalWorkers: workers.length,
      workers: workers,
      solicitudes: solicitudes
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
        solicitudes: leerSolicitudes(ss)
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
