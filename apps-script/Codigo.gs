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
      var i = indiceColumna(headers, pistas);
      return i >= 0 ? row[i] : "";
    }
    var id = String(cel(["ID"]) || row[0] || "").trim();
    if (!id) continue;
    var producto = String(cel(["PRODUCTO"]) || "");
    var fechaEntrega = cel(["ENTREGA"]);
    if (fechaEntrega instanceof Date) {
      fechaEntrega = Utilities.formatDate(fechaEntrega, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var fecha = cel(["FECHA"]);
    if (fecha instanceof Date) {
      fecha = Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    out.push({
      id: id,
      fecha: String(fecha || ""),
      semana: String(cel(["SEMANA"]) || ""),
      codigo: String(cel(["CÓDIGO", "CODIGO"]) || ""),
      nombre: String(cel(["NOMBRE"]) || ""),
      cargo: String(cel(["CARGO"]) || ""),
      cantidad: Number(cel(["CANTIDAD"]) || 1) || 1,
      producto: producto,
      tipoProducto: producto.toLowerCase().indexOf("bouquet") !== -1 ? "bouquet" : "ramo",
      florPrincipal: "Rosa",
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

function escribirSolicitud(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  if (!headers.length || !headers[0]) {
    headers = ["Id", "Fecha", "Semana", "Código", "Nombre", "Cargo", "Cantidad", "Producto", "Sede", "Motivo", "Fecha Entrega", "Remitente", "Estado"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0a2958").setFontColor("#ffffff");
  }
  var mapa = {
    ID: data.id || ("SFO-" + new Date().getTime()),
    FECHA: data.fecha || "",
    SEMANA: data.semana || "",
    "CÓDIGO": data.codigo || "",
    CODIGO: data.codigo || "",
    NOMBRE: data.nombre || "",
    CARGO: data.cargo || "",
    CANTIDAD: data.cantidad || 1,
    PRODUCTO: data.producto || "",
    SEDE: data.sede || "",
    MOTIVO: data.motivo || "",
    ENTREGA: data.fechaEntrega || "",
    REMITENTE: data.remitente || "",
    ESTADO: data.estado || "Registrada"
  };
  var fila = [];
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").toUpperCase();
    var valor = "";
    var claves = Object.keys(mapa);
    for (var k = 0; k < claves.length; k++) {
      if (h.indexOf(claves[k]) !== -1) {
        valor = mapa[claves[k]];
        break;
      }
    }
    fila.push(valor);
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
      solicitudes: leerSolicitudes(ss)
    });
  } catch (err) {
    return responder({ status: "error", message: String(err) });
  }
}
