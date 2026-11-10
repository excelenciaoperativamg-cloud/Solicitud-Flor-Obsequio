/**
 * Servicio de sincronización e integración con Google Drive y Google Sheets
 */
import { SolicitudFlor, TrabajadorMaestro } from '../types';

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

  // Encabezados exactos: Id, Fecha, Semana, Código, Nombre, Producto, Sede, Motivo, Fecha Entrega, Remitente, Estado
  const solicitudesHeaders = [
    ['Id', 'Fecha', 'Semana', 'Código', 'Nombre', 'Producto', 'Sede', 'Motivo', 'Fecha Entrega', 'Remitente', 'Estado'],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Solicitudes!A1:K1?valueInputOption=USER_ENTERED`,
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
    ['Código', 'Nombre', 'Sede', 'Cargo', 'Estado'],
    ...initialEmployees.map((emp) => [
      emp.codigo,
      emp.nombre,
      emp.sede,
      emp.cargo || 'Operario',
      emp.activo ? 'Activo' : 'Inactivo',
    ]),
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Maestro!A1:E?valueInputOption=USER_ENTERED`,
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
  const rowValues = [
    [
      solicitud.id,
      solicitud.fecha,
      solicitud.semana,
      solicitud.codigo,
      solicitud.nombre,
      solicitud.producto,
      solicitud.sede,
      solicitud.motivo,
      solicitud.fechaEntrega,
      solicitud.remitente,
      solicitud.estado || 'Registrada',
    ],
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Solicitudes!A:K:append?valueInputOption=USER_ENTERED`,
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
        worker.nombre,
        worker.sede,
        worker.cargo || 'Operario',
        worker.activo ? 'Activo' : 'Inactivo',
      ],
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Maestro!A:E:append?valueInputOption=USER_ENTERED`,
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
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Solicitudes!A2:K`,
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
      // Manejar formato nuevo (con Semana en col 2) o anterior
      const hasSemanaCol = r.length >= 11;
      const semanaVal = hasSemanaCol ? r[2] : '';
      const codigoVal = hasSemanaCol ? r[3] : r[2];
      const nombreVal = hasSemanaCol ? r[4] : r[3];
      const prodStr = hasSemanaCol ? (r[5] || '') : (r[4] || '');
      const sedeVal = hasSemanaCol ? r[6] : r[5];
      const motivoVal = hasSemanaCol ? r[7] : r[6];
      const fechaEntregaVal = hasSemanaCol ? r[8] : r[7];
      const remitenteVal = hasSemanaCol ? r[9] : r[8];
      const estadoVal = hasSemanaCol ? r[10] : r[9];

      const isBouquet = prodStr.toLowerCase().includes('bouquet');
      let florPrincipal: any = 'Rosa';
      if (prodStr.toLowerCase().includes('clavel')) florPrincipal = 'Clavel';
      else if (prodStr.toLowerCase().includes('alstroemeria')) florPrincipal = 'Alstroemeria';

      return {
        id: r[0],
        fecha: r[1] || '',
        semana: semanaVal || 'Semana 46',
        codigo: codigoVal || '',
        nombre: nombreVal || '',
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
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Maestro!A1:E`,
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
  const firstRow = allRows[0];
  const isHeader = firstRow.some((col) =>
    col.toLowerCase().includes('código') ||
    col.toLowerCase().includes('codigo') ||
    col.toLowerCase().includes('nombre')
  );

  const rows = isHeader ? allRows.slice(1) : allRows;

  return rows
    .filter((r) => r[0] && r[1])
    .map((r) => {
      const rawSede = String(r[2] || 'Sede MG').trim();
      let parsedSede: any = 'Sede MG';
      if (rawSede.toUpperCase().includes('HA')) parsedSede = 'Sede HA';
      else if (rawSede.toUpperCase().includes('SC')) parsedSede = 'Sede SC';
      else if (rawSede.toUpperCase().includes('MG')) parsedSede = 'Sede MG';

      return {
        codigo: String(r[0]).trim(),
        nombre: String(r[1]).trim(),
        sede: parsedSede,
        cargo: r[3] ? String(r[3]).trim() : 'Operario',
        area: 'Poscosecha',
        activo: (r[4] || 'Activo').toLowerCase() !== 'inactivo',
      };
    });
};
