/**
 * Servicio de sincronización e integración con Google Drive y Google Sheets
 */
import { SolicitudFlor, SolicitudIntExt, TrabajadorMaestro } from '../types';

export const SPREADSHEET_TITLE = 'Solicitud Flor Obsequio';

export interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

/**
 * Busca si ya existe la hoja "Solicitud Flor Obsequio" en el Google Drive del usuario.
 */
export const findSpreadsheetInDrive = async (accessToken: string): Promise<DriveFileInfo | null> => {
  try {
    const q = encodeURIComponent(`name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Error buscando hoja de cálculo en Drive:', err);
      return null;
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return {
        id: data.files[0].id,
        name: data.files[0].name,
        webViewLink: data.files[0].webViewLink || `https://docs.google.com/spreadsheets/d/${data.files[0].id}/edit`,
      };
    }
    return null;
  } catch (error) {
    console.error('Error al consultar Drive API:', error);
    return null;
  }
};

/**
 * Crea la hoja de cálculo con las pestañas "Solicitudes" y "Maestro" con sus respectivos encabezados.
 */
export const createSpreadsheetWithTemplate = async (
  accessToken: string,
  initialEmployees: TrabajadorMaestro[]
): Promise<DriveFileInfo> => {
  const requestBody = {
    properties: {
      title: SPREADSHEET_TITLE,
    },
    sheets: [
      {
        properties: {
          title: 'Solicitudes',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'Maestro',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error creando hoja en Google Drive: ${err.error?.message || res.statusText}`);
  }

  const createdSheet = await res.json();
  const spreadsheetId = createdSheet.spreadsheetId;

  // Encabezados: Id, Fecha, Semana, Código, Nombre, Cargo, Cantidad, Producto, Sede, Motivo, Fecha Entrega, Remitente, Estado
  const solicitudesHeaders = [
    ['Id', 'Fecha', 'Semana', 'Código', 'Nombre', 'Cargo', 'Cantidad', 'Producto', 'Sede', 'Motivo', 'Fecha Entrega', 'Remitente', 'Estado'],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Solicitudes!A1:M1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: solicitudesHeaders }),
    }
  );

  // Poblar encabezados y lista inicial de empleados en Maestro
  const maestroRows: (string | number)[][] = [
    ['Código', 'Cédula', 'Nombre', 'Sede', 'Cargo', 'Estado'],
    ...initialEmployees.map((emp) => [
      emp.codigo,
      emp.cedula || '',
      emp.nombre,
      emp.sede,
      emp.cargo || 'Operario',
      emp.activo ? 'Activo' : 'Inactivo',
    ]),
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Maestro!A1:F?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: maestroRows }),
    }
  );

  return {
    id: spreadsheetId,
    name: SPREADSHEET_TITLE,
    webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
};

/**
 * Obtiene o crea la hoja de cálculo
 */
export const getOrCreateSpreadsheet = async (
  accessToken: string,
  initialEmployees: TrabajadorMaestro[]
): Promise<DriveFileInfo> => {
  const existing = await findSpreadsheetInDrive(accessToken);
  if (existing) {
    return existing;
  }
  return await createSpreadsheetWithTemplate(accessToken, initialEmployees);
};

/**
 * Agrega una fila de solicitud a la pestaña "Solicitudes" de Google Sheets
 * Incluye el campo Semana
 */
export const appendSolicitudToDrive = async (
  accessToken: string,
  spreadsheetId: string,
  solicitud: SolicitudFlor
): Promise<boolean> => {
  const soloSemana = String(solicitud.semana || '').match(/(\d+)/)?.[1] || solicitud.semana;
  const soloSede = String(solicitud.sede || '').replace(/^sede\s+/i, '').trim();
  const rawProd = String(solicitud.producto || '').trim();
  const lowProd = rawProd.toLowerCase();
  let soloProducto = rawProd;
  if (lowProd.includes('bouquet')) soloProducto = 'Bouquet';
  else if (lowProd.includes('clavel')) soloProducto = 'Clavel';
  else if (lowProd.includes('alstroemeria')) soloProducto = 'Alstroemeria';
  else if (lowProd.includes('rosa')) soloProducto = lowProd.includes('color') ? 'Rosa (Color)' : 'Rosa (Rojo)';

  const rowValues = [
    [
      solicitud.id,
      solicitud.fecha,
      soloSemana,
      solicitud.codigo,
      solicitud.nombre,
      solicitud.cargo || '',
      solicitud.cantidad || 1,
      soloProducto,
      soloSede,
      solicitud.motivo,
      solicitud.fechaEntrega,
      solicitud.remitente || '',
      solicitud.estado || 'Registrada',
    ],
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Solicitudes!A:M:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rowValues }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Error al registrar solicitud en Google Sheets:', err);
    throw new Error(err.error?.message || 'Error al guardar en Google Sheets');
  }

  return true;
};

/**
 * Agrega un nuevo trabajador a la pestaña "Maestro" de Google Sheets
 */
export const appendWorkerToMaestroDrive = async (
  accessToken: string,
  spreadsheetId: string,
  worker: TrabajadorMaestro
): Promise<boolean> => {
  try {
    const rowValues = [
      [
        worker.codigo,
        worker.cedula || '',
        worker.nombre,
        worker.sede,
        worker.cargo || 'Operario',
        worker.activo ? 'Activo' : 'Inactivo',
      ],
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Maestro!A:F:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rowValues }),
      }
    );

    return res.ok;
  } catch (error) {
    console.warn('Error al guardar trabajador en Maestro de Drive:', error);
    return false;
  }
};

/**
 * Lee todas las solicitudes registradas en la hoja de Google Sheets
 */
export const fetchSolicitudesFromDrive = async (
  accessToken: string,
  spreadsheetId: string
): Promise<SolicitudFlor[]> => {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Solicitudes!A2:M`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows
    .filter((r) => r.length >= 4 && r[0])
    .map((r, index) => {
      // Formatos:
      // Antiguo corto: Id, Fecha, Código, Nombre, Producto, Sede, Motivo, FechaEntrega, Remitente, Estado
      // Con Semana: Id, Fecha, Semana, Código, Nombre, Producto, Sede, Motivo, FechaEntrega, Remitente, Estado (11 cols)
      // Nuevo: Id, Fecha, Semana, Código, Nombre, Cargo, Cantidad, Producto, Sede, Motivo, FechaEntrega, Remitente, Estado (13 cols)
      const isNewWithCargo = r.length >= 13;
      const hasSemanaCol = r.length >= 11;

      let semanaVal = '';
      let codigoVal = '';
      let nombreVal = '';
      let cargoVal = '';
      let cantidadVal = 1;
      let prodStr = '';
      let sedeVal = '';
      let motivoVal = '';
      let fechaEntregaVal = '';
      let remitenteVal = '';
      let estadoVal = '';

      if (isNewWithCargo) {
        semanaVal = r[2] || '';
        codigoVal = r[3] || '';
        nombreVal = r[4] || '';
        cargoVal = r[5] || '';
        cantidadVal = parseInt(r[6], 10) || 1;
        prodStr = r[7] || '';
        sedeVal = r[8] || '';
        motivoVal = r[9] || '';
        fechaEntregaVal = r[10] || '';
        remitenteVal = r[11] || '';
        estadoVal = r[12] || '';
      } else if (hasSemanaCol) {
        semanaVal = r[2] || '';
        codigoVal = r[3] || '';
        nombreVal = r[4] || '';
        prodStr = r[5] || '';
        sedeVal = r[6] || '';
        motivoVal = r[7] || '';
        fechaEntregaVal = r[8] || '';
        remitenteVal = r[9] || '';
        estadoVal = r[10] || '';
      } else {
        codigoVal = r[2] || '';
        nombreVal = r[3] || '';
        prodStr = r[4] || '';
        sedeVal = r[5] || '';
        motivoVal = r[6] || '';
        fechaEntregaVal = r[7] || '';
        remitenteVal = r[8] || '';
        estadoVal = r[9] || '';
      }

      const isBouquet = prodStr.toLowerCase().includes('bouquet');
      let florPrincipal: any = 'Rosa';
      if (prodStr.toLowerCase().includes('clavel')) florPrincipal = 'Clavel';
      else if (prodStr.toLowerCase().includes('alstroemeria')) florPrincipal = 'Alstroemeria';

      return {
        id: r[0],
        fecha: r[1] || '',
        semana: String(semanaVal || '').match(/(\d+)/)?.[1] || '46',
        codigo: codigoVal || '',
        nombre: nombreVal || '',
        cargo: cargoVal || undefined,
        cantidad: cantidadVal,
        producto: prodStr,
        tipoProducto: isBouquet ? 'bouquet' : 'ramo',
        florPrincipal,
        sede: (sedeVal as any) || 'Sede MG',
        motivo: motivoVal || '',
        fechaEntrega: fechaEntregaVal || '',
        remitente: remitenteVal || '',
        estado: (estadoVal as any) || 'Registrada',
        syncedToDrive: true,
        driveSpreadsheetId: spreadsheetId,
        driveRowIndex: index + 2,
        creadoEn: Date.now(),
      };
    });
};

/**
 * Lee los trabajadores de la hoja "Maestro" de Google Sheets
 */
export const fetchMaestroFromDrive = async (
  accessToken: string,
  spreadsheetId: string
): Promise<TrabajadorMaestro[]> => {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Maestro!A1:Z`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const allRows: string[][] = data.values || [];
  if (allRows.length <= 1) return [];

  // Chequeo si primera fila es encabezado
  const firstRow = allRows[0] || [];
  const normHeader = (c: string) =>
    String(c || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  const normHeaders = firstRow.map(normHeader);
  const isHeader = normHeaders.some(
    (h) => h.includes('codigo') || h.includes('nombre') || h.includes('id rh') || h.includes('cedula')
  );

  const findHeader = (clues: string[], fallback: number) => {
    if (!isHeader) return fallback;
    const idx = normHeaders.findIndex((h) => clues.some((c) => h.includes(c)));
    return idx >= 0 ? idx : fallback;
  };
  const findOptionalHeader = (clues: string[]) => {
    if (!isHeader) return -1;
    return normHeaders.findIndex((h) => clues.some((c) => h.includes(c)));
  };

  const idxCodigo = findHeader(['codigo', 'id rh'], 0);
  const idxCedula = findOptionalHeader(['cedula', 'documento', 'identificacion', 'cc']);
  const idxNombre = findHeader(['nombre'], 1);
  const idxSede = findHeader(['sede'], 2);
  const idxCargo = findHeader(['cargo', 'funcion'], 3);
  const idxEstado = findOptionalHeader(['estado']);

  const rows = isHeader ? allRows.slice(1) : allRows;

  return rows
    .filter((r) => r[idxCodigo] && r[idxNombre])
    .map((r) => {
      const rawSede = String(r[idxSede] || 'Sede MG').trim();
      let parsedSede: any = 'Sede MG';
      if (rawSede.toUpperCase().includes('HA')) parsedSede = 'Sede HA';
      else if (rawSede.toUpperCase().includes('SC')) parsedSede = 'Sede SC';
      else if (rawSede.toUpperCase().includes('MG')) parsedSede = 'Sede MG';

      return {
        codigo: String(r[idxCodigo]).trim(),
        cedula: idxCedula >= 0 && r[idxCedula] ? String(r[idxCedula]).trim() : '',
        nombre: String(r[idxNombre]).trim(),
        sede: parsedSede,
        cargo: idxCargo >= 0 && r[idxCargo] ? String(r[idxCargo]).trim() : 'Operario',
        area: 'Poscosecha',
        activo: (idxEstado >= 0 ? r[idxEstado] || 'Activo' : 'Activo').toLowerCase() !== 'inactivo',
      };
    });
};

/**
 * Agrega una fila a la pestaña "Especiales Empresa" de Google Sheets
 */
export const appendSolicitudIntExtToDrive = async (
  accessToken: string,
  spreadsheetId: string,
  solicitud: SolicitudIntExt
): Promise<boolean> => {
  const rowValues = [
    [
      solicitud.id,
      solicitud.fechaSolicitud,
      solicitud.codigo,
      solicitud.nombre,
      solicitud.sede,
      solicitud.area,
      solicitud.producto,
      solicitud.cantidad,
      solicitud.motivo,
      solicitud.semana || '',
      solicitud.fechaEntrega,
      solicitud.observacion || '',
      solicitud.estado || 'Registrada',
    ],
  ];

  const sheetRange = encodeURIComponent('Especiales Empresa!A:M');
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rowValues }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al guardar en Especiales Empresa');
  }

  return true;
};

/**
 * Lee todas las filas registradas en la hoja "Especiales Empresa" de Google Sheets
 */
export const fetchSolicitudesIntExtFromDrive = async (
  accessToken: string,
  spreadsheetId: string
): Promise<SolicitudIntExt[]> => {
  const sheetRange = encodeURIComponent('Especiales Empresa!A2:M');
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows
    .filter((r) => r.length >= 4 && r[0])
    .map((r) => ({
      id: String(r[0] || '').trim(),
      fechaSolicitud: String(r[1] || '').trim(),
      codigo: String(r[2] || '').trim(),
      nombre: String(r[3] || '').trim(),
      sede: String(r[4] || '').trim(),
      area: String(r[5] || '').trim(),
      producto: String(r[6] || '').trim(),
      cantidad: Math.max(1, parseInt(r[7], 10) || 1),
      motivo: String(r[8] || '').trim(),
      semana: String(r[9] || '').trim(),
      fechaEntrega: String(r[10] || '').trim(),
      observacion: String(r[11] || '').trim(),
      estado: String(r[12] || 'Registrada').trim(),
      syncedToDrive: true,
      creadoEn: Date.now(),
    }));
};
