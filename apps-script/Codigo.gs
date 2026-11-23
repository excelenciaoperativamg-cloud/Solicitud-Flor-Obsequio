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

/** Busca primero por nombre exacto de encabezado y luego por pistas. */
function indiceColumnaExactoOPista(headers, exactos, pistas) {
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").toUpperCase().replace(/\s+/g, " ").trim();
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
    if (/^(SFO|SIE|SE|SEP|SC)-\d{4}-/i.test(codigo)) continue;

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
    if (/^(SFO|SIE|SE|SEP|SC)-\d{4}-/i.test(cod)) continue;

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
    var horaEntrega = cel(["HORA ENTREGA", "HORA DE ENTREGA", "HORA"]);
    if (horaEntrega instanceof Date) {
      horaEntrega = Utilities.formatDate(horaEntrega, Session.getScriptTimeZone(), "HH:mm");
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
      horaEntrega: String(horaEntrega || ""),
      observacion: String(cel(["OBSERVACIÓN", "OBSERVACION", "OBSERVACIONES"]) || ""),
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
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
function enviarCorreoNotificacionIntExt(ss, correoDestino, items) {
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
  var notificadoTexto = String(primera.notificado || primera.estado || emailDisplay).trim();

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
    ? "<div style=\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\">" +
        "<img src=\"cid:logoMg\" alt=\"MG Consultores S.A.S.\" width=\"74\" height=\"45\" style=\"display:block;border:0;width:74px;height:auto;\" />" +
      "</div>"
    : "<div style=\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\">MG</div>";

  var asunto = "Flor de Obsequio - Especiales Empresa: " + idsTexto + " (" + String(primera.motivo || "Solicitud") + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\n" +
    "NUEVA SOLICITUD: ESPECIALES EMPRESA\n" +
    "==================================================\n" +
    "Id(s): " + idsTexto + "\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\n" +
    "Registrado por: " + String(primera.nombre || "") + " (" + String(primera.codigo || "") + ")\n" +
    "Motivo: " + String(primera.motivo || "") + "\n" +
    "Semana: " + semanaTexto + "\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\n" +
    "Hora de Entrega: " + String(primera.horaEntrega || "—") + "\n" +
    "Notificado a: " + notificadoTexto + "\n" +
    "Observación: " + (obsTexto || "Sin observaciones adicionales.") + "\n\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\n" +
    filasTexto + "\n" +
    "Sistema Flor de Obsequio • Notificación automática.\n";

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
                    "<div style=\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\">Nueva Solicitud: Especiales Empresa</div>" +
                    "<div style=\"font-size:13px;color:#cbd5e1;margin-top:4px;\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\"right\" style=\"vertical-align:top;padding-left:12px;\">" +
                    logoHeaderHtml +
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
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Hora de Entrega</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'Courier New',monospace;\">" + escapeHtml(primera.horaEntrega || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Solicitado / Registrado por</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.nombre || "") + " (" + escapeHtml(primera.codigo || "") + ")</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Motivo</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;\">Notificado</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\">" + escapeHtml(notificadoTexto) + "</td>" +
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
      "<tr style=\"background-color:" + bgFila + ";\">" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#0a2958;white-space:nowrap;\">" + escapeHtml(it.id) + "</td>" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;\">" + escapeHtml(it.producto) + "</td>" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#0a2958;text-align:right;white-space:nowrap;\">" + cant + " ramos</td>" +
      "</tr>";

    filasTexto += "  - " + String(it.id || "") + " | " + String(it.producto || "") + ": " + cant + " ramos\n";
  }

  var idsTexto = ids.join(", ");
  var semanaTexto = primera.semana ? ("Semana " + primera.semana) : "—";
  var estadoTexto = String(primera.estado || "Pendiente Aprobación").trim();
  var correoConfTexto = String(primera.correoConfirmacion || correoConfirmacionParam || "").trim();
  var notificadoTexto = String(primera.notificado || emailDisplay).trim();
  var fotoUrl = String(primera.fotoCarta || "").trim();
  var fotoEsUrlWeb = fotoUrl.indexOf("http") === 0;
  var fotoHtml = fotoEsUrlWeb
    ? "<a href=\"" + escapeHtml(fotoUrl) + "\" style=\"color:#0a2958;font-weight:700;text-decoration:underline;\">Ver carta &#8599;</a>"
    : (fotoUrl ? "<span style=\"color:#047857;font-weight:700;\">Adjunta en el sistema / correo</span>" : "<span style=\"color:#64748b;\">No adjuntada</span>");

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
    ? "<div style=\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\">" +
        "<img src=\"cid:logoMg\" alt=\"MG Consultores S.A.S.\" width=\"74\" height=\"45\" style=\"display:block;border:0;width:74px;height:auto;\" />" +
      "</div>"
    : "<div style=\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\">MG</div>";

  var asunto = "Flor de Obsequio - Especiales Personal: " + idsTexto + " (" + String(primera.motivo || "Solicitud") + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\n" +
    "NUEVA SOLICITUD: ESPECIALES PERSONAL\n" +
    "==================================================\n" +
    "Id(s): " + idsTexto + "\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\n" +
    "Colaborador Beneficiario: " + String(primera.nombre || "") + "\n" +
    "Cédula: " + String(primera.cedula || "") + "\n" +
    "Sede: " + String(primera.sede || "") + "\n" +
    "Motivo: " + String(primera.motivo || "") + "\n" +
    "Semana: " + semanaTexto + "\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\n" +
    "Correo de confirmación: " + correoConfTexto + "\n" +
    "Estado: " + estadoTexto + "\n" +
    "Foto Carta: " + (fotoUrl || "No adjuntada") + "\n" +
    "Notificado a: " + notificadoTexto + "\n\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\n" +
    filasTexto + "\n" +
    "Nota: Esta solicitud queda sujeta a verificación, disponibilidad y autorización por parte de la dirección de Poscosecha.\n" +
    "Sistema Flor de Obsequio • Notificación automática.\n";

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
                    "<div style=\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\">Nueva Solicitud: Especiales Personal</div>" +
                    "<div style=\"font-size:13px;color:#cbd5e1;margin-top:4px;\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\"right\" style=\"vertical-align:top;padding-left:12px;\">" +
                    logoHeaderHtml +
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
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Colaborador Beneficiario</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.nombre || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Cédula</td>" +
                  "<td style=\"padding:7px 0;font-family:'Courier New',monospace;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.cedula || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Sede</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.sede || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Motivo</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Correo de confirmación</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;word-break:break-word;\">" + escapeHtml(correoConfTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Estado</td>" +
                  "<td style=\"padding:7px 0;font-weight:800;color:#b45309;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(estadoTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Foto Carta</td>" +
                  "<td style=\"padding:7px 0;text-align:right;border-bottom:1px solid #f1f5f9;\">" + fotoHtml + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;\">Notificado</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\">" + escapeHtml(notificadoTexto) + "</td>" +
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
              "<div style=\"background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 14px;font-size:12px;line-height:1.5;color:#92400e;\">" +
                "Al realizar esta solicitud, queda sujeta a verificación, disponibilidad y autorización por parte de la dirección de Poscosecha." +
              "</div>" +
            "</td></tr>" +

            "<tr><td style=\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11px;color:#64748b;\">" +
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
    if (correoConfTexto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoConfTexto)) {
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
      "<tr style=\"background-color:" + bgFila + ";\">" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#0a2958;white-space:nowrap;\">" + escapeHtml(it.id) + "</td>" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#1e293b;\">" + escapeHtml(it.producto) + "</td>" +
        "<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#0a2958;text-align:right;white-space:nowrap;\">" + cant + " ramos</td>" +
      "</tr>";

    filasTexto += "  - " + String(it.id || "") + " | " + String(it.producto || "") + ": " + cant + " ramos\n";
  }

  var idsTexto = ids.join(", ");
  var semanaTexto = primera.semana ? ("Semana " + primera.semana) : "—";
  var correoConfTexto = String(primera.correoConfirmacion || "").trim();
  var estadoTexto = String(primera.estado || "Pendiente Aprobación").trim();
  var notificadoTexto = String(primera.notificado || emailDisplay).trim();
  var fotoUrl = String(primera.fotoCarta || "").trim();
  var fotoEsUrlWeb = fotoUrl.indexOf("http") === 0;
  var fotoHtml = fotoEsUrlWeb
    ? "<a href=\"" + escapeHtml(fotoUrl) + "\" style=\"color:#0a2958;font-weight:700;text-decoration:underline;\">Ver carta autorizada &#8599;</a>"
    : (fotoUrl ? "<span style=\"color:#047857;font-weight:700;\">Adjunta en el sistema / correo</span>" : "<span style=\"color:#64748b;\">No adjuntada</span>");

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
    ? "<div style=\"display:inline-block;background-color:#ffffff;padding:6px 10px;border-radius:8px;border-bottom:3px solid #E60000;\">" +
        "<img src=\"cid:logoMg\" alt=\"MG Consultores S.A.S.\" width=\"74\" height=\"45\" style=\"display:block;border:0;width:74px;height:auto;\" />" +
      "</div>"
    : "<div style=\"display:inline-block;background-color:#ffffff;color:#0a2958;font-weight:800;font-size:13px;padding:6px 10px;border-radius:6px;border-bottom:3px solid #E60000;letter-spacing:0.5px;\">MG</div>";

  var asunto = "Flor de Obsequio - Solicitud Comunidad: " + idsTexto + " (" + String(primera.entidad || "Comunidad") + ")";

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\n" +
    "NUEVA SOLICITUD: SOLICITUD COMUNIDAD\n" +
    "==================================================\n" +
    "Id(s): " + idsTexto + "\n" +
    "Fecha de Solicitud: " + String(primera.fechaSolicitud || "") + "\n" +
    "Registrado por (Usuario): " + String(primera.usuario || "") + "\n" +
    "Entidad: " + String(primera.entidad || "") + "\n" +
    "Motivo: " + String(primera.motivo || "") + "\n" +
    "Lugar: " + String(primera.lugar || "") + "\n" +
    "Sede: " + String(primera.sede || "") + "\n" +
    "Semana: " + semanaTexto + "\n" +
    "Fecha de Entrega: " + String(primera.fechaEntrega || "") + "\n" +
    "Correo de confirmación: " + correoConfTexto + "\n" +
    "Estado: " + estadoTexto + "\n" +
    "Foto Carta: " + (fotoUrl || "No adjuntada") + "\n" +
    "Notificado a: " + notificadoTexto + "\n\n" +
    "PRODUCTOS SOLICITADOS (" + lista.length + " registro(s) | Total: " + totalRamos + " ramos):\n" +
    filasTexto + "\n" +
    "Sistema Flor de Obsequio • Notificación automática.\n";

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
                    "<div style=\"font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
                    "<div style=\"font-size:21px;font-weight:800;line-height:1.25;color:#ffffff;\">Nueva Solicitud: Solicitud Comunidad</div>" +
                    "<div style=\"font-size:13px;color:#cbd5e1;margin-top:4px;\">Notificación corporativa automática de registro y entrega</div>" +
                  "</td>" +
                  "<td align=\"right\" style=\"vertical-align:top;padding-left:12px;\">" +
                    logoHeaderHtml +
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
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Registrado por (Usuario)</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.usuario || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Entidad</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.entidad || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Motivo</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.motivo || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Lugar</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.lugar || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Sede</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(primera.sede || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Correo de confirmación</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#0a2958;border-bottom:1px solid #f1f5f9;text-align:right;word-break:break-word;\">" + escapeHtml(correoConfTexto || "—") + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Estado</td>" +
                  "<td style=\"padding:7px 0;font-weight:800;color:#b45309;border-bottom:1px solid #f1f5f9;text-align:right;\">" + escapeHtml(estadoTexto) + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Carta Autorizada</td>" +
                  "<td style=\"padding:7px 0;text-align:right;border-bottom:1px solid #f1f5f9;\">" + fotoHtml + "</td>" +
                "</tr>" +
                "<tr>" +
                  "<td style=\"padding:7px 0;color:#64748b;\">Notificado</td>" +
                  "<td style=\"padding:7px 0;font-weight:700;color:#047857;text-align:right;word-break:break-word;\">" + escapeHtml(notificadoTexto) + "</td>" +
                "</tr>" +
              "</table>" +
            "</td></tr>" +

            "<tr><td style=\"padding:18px 28px 18px 28px;\">" +
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

            "<tr><td style=\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11px;color:#64748b;\">" +
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
    var hojaIntExt = buscarHojaPorNombre(ss, ["Especiales Empresa"]);
    var hojaEp = buscarHojaPorNombre(ss, ["Especiales Personal"]);
    var hojaSc = buscarHojaPorNombre(ss, ["Solicitud Comunidad"]);
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
      supportsIntExt: true,
      supportsEspecialesPersonal: true,
      supportsEspecialesPersonalEstado: true,
      supportsSolicitudComunidad: true,
      supportsEmailNotification: true,
      intExtSheetName: hojaIntExt ? hojaIntExt.getName() : "Especiales Empresa",
      especialesPersonalSheetName: hojaEp ? hojaEp.getName() : "Especiales Personal",
      solicitudComunidadSheetName: hojaSc ? hojaSc.getName() : "Solicitud Comunidad"
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
 * Id | Fecha Solicitud | Código | Nombre | Producto | Cantidad | Motivo | Semana | Fecha Entrega | Hora Entrega | Observación | Notificado
 */
function escribirSolicitudIntExt(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Código", "Nombre",
    "Producto", "Cantidad", "Motivo", "Semana", "Fecha Entrega", "Hora Entrega", "Observación", "Notificado"
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
    if (h.indexOf("HORA") !== -1) return data.horaEntrega || "";
    if (h === "FECHA ENTREGA" || (h.indexOf("ENTREGA") !== -1 && h.indexOf("HORA") === -1)) return data.fechaEntrega || "";
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

/**
 * Escribe una fila en la hoja Especiales Personal:
 * Id | Fecha Solicitud | Cédula | Nombre | Sede | Producto | Cantidad | Motivo | Semana | Fecha Entrega | Correo de confirmación | Estado | Foto Carta | Notificado
 */
function escribirEspecialPersonal(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Cédula", "Nombre", "Sede",
    "Producto", "Cantidad", "Motivo", "Semana", "Fecha Entrega", "Correo de confirmación", "Estado", "Foto Carta", "Notificado"
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
    if (h === "ID" || h === "ID.") return data.id || ("SEP-" + new Date().getTime());
    if (h.indexOf("ENTREGA") !== -1) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CORREO") !== -1 || h.indexOf("CONFIRMACI") !== -1) return data.correoConfirmacion || "";
    if (h.indexOf("CÉDULA") !== -1 || h.indexOf("CEDULA") !== -1 || h === "CC" || h.indexOf("DOCUMENTO") !== -1) return data.cedula || "";
    if (h.indexOf("NOMBRE") !== -1) return data.nombre || "";
    if (h.indexOf("SEDE") !== -1) return data.sede || "";
    if (h.indexOf("PRODUCTO") !== -1) return data.producto || "";
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoDestino)) {
    return { emailSent: false, to: correoDestino, emailError: "Correo de confirmación inválido." };
  }
  var estadoTexto = String(it.estado || "Pendiente Aprobación").trim();
  var esAprobado = estadoTexto.toUpperCase() === "APROBADO";
  var colorBadge = esAprobado ? "#047857" : "#b91c1c";
  var bgBadge = esAprobado ? "#ecfdf5" : "#fef2f2";
  var asunto = "Respuesta Solicitud Especiales Personal " + String(it.id || "") + ": " + estadoTexto;

  var textBody =
    "MG CONSULTORES S.A.S. - FLOR DE OBSEQUIO\n" +
    "RESPUESTA A SOLICITUD ESPECIALES PERSONAL\n" +
    "==================================================\n" +
    "Id: " + String(it.id || "") + "\n" +
    "Colaborador: " + String(it.nombre || "") + "\n" +
    "Producto: " + String(it.producto || "") + " (" + String(it.cantidad || 1) + " ramos)\n" +
    "Motivo: " + String(it.motivo || "") + "\n" +
    "Fecha de Entrega: " + String(it.fechaEntrega || "") + "\n" +
    "Estado de la Solicitud: " + estadoTexto + "\n\n" +
    "Sistema Flor de Obsequio • Notificación automática.\n";

  var htmlBody =
    "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"></head>" +
    "<body style=\"margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b;\">" +
      "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:580px;margin:0 auto;background-color:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;\">" +
        "<tr><td style=\"height:5px;background-color:#E60000;\"></td></tr>" +
        "<tr><td style=\"background-color:#0a2958;padding:20px 24px;color:#ffffff;\">" +
          "<div style=\"font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#fca5a5;\">MG CONSULTORES S.A.S. &bull; FLOR DE OBSEQUIO</div>" +
          "<div style=\"font-size:19px;font-weight:800;margin-top:4px;\">Respuesta de Solicitud: Especiales Personal</div>" +
        "</td></tr>" +
        "<tr><td style=\"padding:22px 24px;\">" +
          "<div style=\"display:inline-block;padding:8px 14px;border-radius:8px;background-color:" + bgBadge + ";color:" + colorBadge + ";font-size:14px;font-weight:800;margin-bottom:16px;\">" +
            "Estado: " + escapeHtml(estadoTexto) +
          "</div>" +
          "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"font-size:13px;\">" +
            "<tr><td style=\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Id</td><td style=\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\">" + escapeHtml(it.id || "—") + "</td></tr>" +
            "<tr><td style=\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Colaborador</td><td style=\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\">" + escapeHtml(it.nombre || "—") + "</td></tr>" +
            "<tr><td style=\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Producto</td><td style=\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\">" + escapeHtml(it.producto || "—") + " (" + escapeHtml(it.cantidad || 1) + " ramos)</td></tr>" +
            "<tr><td style=\"padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;\">Motivo</td><td style=\"padding:6px 0;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;\">" + escapeHtml(it.motivo || "—") + "</td></tr>" +
            "<tr><td style=\"padding:6px 0;color:#64748b;\">Fecha de Entrega</td><td style=\"padding:6px 0;font-weight:700;text-align:right;\">" + escapeHtml(it.fechaEntrega || "—") + "</td></tr>" +
          "</table>" +
        "</td></tr>" +
        "<tr><td style=\"background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 24px;text-align:center;font-size:11px;color:#64748b;\">" +
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
 * Id | Fecha Solicitud | Usuario | Entidad | Motivo | Lugar | Sede | Producto | Cantidad | Semana | Fecha Entrega | Correo de confirmación | Estado | Foto Carta | Notificado
 */
function escribirSolicitudComunidad(sheet, data) {
  var headers = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var headersDefault = [
    "Id", "Fecha Solicitud", "Usuario", "Entidad", "Motivo", "Lugar", "Sede",
    "Producto", "Cantidad", "Semana", "Fecha Entrega", "Correo de confirmación", "Estado", "Foto Carta", "Notificado"
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
    if (h === "ID" || h === "ID.") return data.id || ("SC-" + new Date().getTime());
    if (h.indexOf("ENTREGA") !== -1) return data.fechaEntrega || "";
    if (h.indexOf("SOLICITUD") !== -1 || h === "FECHA") return data.fechaSolicitud || "";
    if (h.indexOf("CORREO") !== -1 || h.indexOf("CONFIRMACI") !== -1) return data.correoConfirmacion || "";
    if (h.indexOf("USUARIO") !== -1) return data.usuario || "";
    if (h.indexOf("ENTIDAD") !== -1) return data.entidad || "";
    if (h.indexOf("MOTIVO") !== -1) return data.motivo || "";
    if (h.indexOf("LUGAR") !== -1) return data.lugar || "";
    if (h.indexOf("SEDE") !== -1) return data.sede || "";
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
        supportsIntExt: true,
        supportsEspecialesPersonal: true,
        supportsEspecialesPersonalEstado: true,
        supportsSolicitudComunidad: true,
        supportsEmailNotification: true,
        intExtSheetName: hojaIntExtPing ? hojaIntExtPing.getName() : "Especiales Empresa",
        especialesPersonalSheetName: hojaEpPing ? hojaEpPing.getName() : "Especiales Personal",
        solicitudComunidadSheetName: hojaScPing ? hojaScPing.getName() : "Solicitud Comunidad"
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
