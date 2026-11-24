import {
  getPermisosFormulariosStorage,
  savePermisosFormulariosStorage,
  getDriveConfigStorage,
  getMaestroStorage,
  callAppsScript,
} from './_lib/storage.js';

export const DEFAULT_PERMISOS_FORMULARIOS = {
  formulario: {
    todos: true,
    cargos: [],
    palabrasClaveCargo: [],
    codigos: [],
    codigosExcluidos: [],
  },
  'int-ext': {
    todos: false,
    cargos: [],
    palabrasClaveCargo: ['AUXILIAR GESTIÓN HUMANA', 'ANALISTA GESTIÓN HUMANA'],
    codigos: [],
    codigosExcluidos: [],
  },
  'especiales-personal': {
    todos: true,
    cargos: [],
    palabrasClaveCargo: [],
    codigos: [],
    codigosExcluidos: [],
  },
  'solicitud-comunidad': {
    todos: false,
    cargos: [],
    palabrasClaveCargo: ['ANALISTA GESTIÓN HUMANA', 'AUXILIAR TÉCNICO POSCOSECHA'],
    codigos: [],
    codigosExcluidos: [],
  },
  'ingresos-seleccion': {
    todos: false,
    cargos: [],
    palabrasClaveCargo: [],
    codigos: ['8558', '2151'],
    codigosExcluidos: [],
  },
  'obsequio-visitantes': {
    todos: false,
    cargos: [],
    palabrasClaveCargo: ['DIRECTOR', 'ANALISTA GESTIÓN HUMANA'],
    codigos: [],
    codigosExcluidos: [],
  },
  solicitudes: {
    todos: false,
    cargos: [],
    palabrasClaveCargo: ['AUXILIAR GESTIÓN HUMANA', 'AUXILIAR TÉCNICO POSCOSECHA'],
    codigos: [],
    codigosExcluidos: [],
  },
};

const FORM_KEYS = Object.keys(DEFAULT_PERMISOS_FORMULARIOS);

function normalizarTextoComp(raw) {
  return String(raw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function esCargoAdministrador(cargoRaw) {
  const cargo = normalizarTextoComp(cargoRaw);
  if (!cargo) return false;
  if (cargo.includes('ANALISTA') && cargo.includes('GESTION') && cargo.includes('INFORMACION')) {
    return true;
  }
  return cargo === 'ADMINISTRADOR' || cargo.startsWith('ADMINISTRADOR ');
}

function verificarEsAdministrador(usuarioCodigo, usuarioCargo) {
  const cod = String(usuarioCodigo || '').trim().toUpperCase();
  if (cod) {
    const maestro = getMaestroStorage();
    if (Array.isArray(maestro) && maestro.length > 0) {
      const encontrado = maestro.find(
        (w) => String(w?.codigo || '').trim().toUpperCase() === cod
      );
      if (encontrado) {
        return esCargoAdministrador(encontrado.cargo);
      }
    }
  }
  return esCargoAdministrador(usuarioCargo);
}

function limpiarListaTextos(arr, uppercase = false) {
  if (!Array.isArray(arr)) return [];
  const vistos = new Set();
  const res = [];
  for (const item of arr) {
    const val = String(item || '').trim();
    if (!val) continue;
    const norm = uppercase ? val.toUpperCase() : normalizarTextoComp(val);
    if (!norm || vistos.has(norm)) continue;
    vistos.add(norm);
    res.push(uppercase ? val.toUpperCase() : val);
  }
  return res;
}

export function normalizarReglaPermiso(raw, fallback) {
  const base = fallback || {
    todos: false,
    cargos: [],
    palabrasClaveCargo: [],
    codigos: [],
    codigosExcluidos: [],
  };
  if (!raw || typeof raw !== 'object') {
    return {
      todos: Boolean(base.todos),
      cargos: [...base.cargos],
      palabrasClaveCargo: [...base.palabrasClaveCargo],
      codigos: [...base.codigos],
      codigosExcluidos: [...base.codigosExcluidos],
    };
  }
  return {
    todos: Boolean(raw.todos),
    cargos: limpiarListaTextos(raw.cargos, false),
    palabrasClaveCargo: limpiarListaTextos(raw.palabrasClaveCargo, false),
    codigos: limpiarListaTextos(raw.codigos, true),
    codigosExcluidos: limpiarListaTextos(raw.codigosExcluidos, true),
  };
}

export function mergePermisosConDefaults(rawMap) {
  const out = {};
  for (const key of FORM_KEYS) {
    const custom = rawMap && typeof rawMap === 'object' && rawMap[key] ? rawMap[key] : null;
    out[key] = normalizarReglaPermiso(custom, DEFAULT_PERMISOS_FORMULARIOS[key]);
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const driveCfg = getDriveConfigStorage();

    if (req.method === 'POST') {
      const body = req.body || {};

      if (!verificarEsAdministrador(body.usuarioCodigo, body.usuarioCargo)) {
        return res.status(403).json({
          success: false,
          error: 'Solo los administradores del sistema pueden editar los permisos de los formularios.',
        });
      }

      let siguienteMapa;
      if (body.action === 'restaurar_defecto') {
        const actuales = mergePermisosConDefaults(getPermisosFormulariosStorage());
        const targetKey = String(body.formKey || '').trim();
        if (targetKey && FORM_KEYS.includes(targetKey)) {
          siguienteMapa = {
            ...actuales,
            [targetKey]: normalizarReglaPermiso(null, DEFAULT_PERMISOS_FORMULARIOS[targetKey]),
          };
        } else {
          siguienteMapa = mergePermisosConDefaults(DEFAULT_PERMISOS_FORMULARIOS);
        }
      } else {
        if (!body.permisos || typeof body.permisos !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'Debe enviar una configuración válida de permisos.',
          });
        }
        siguienteMapa = mergePermisosConDefaults(body.permisos);
      }

      savePermisosFormulariosStorage(siguienteMapa);

      let syncedToDrive = false;
      let pendingAppsScriptUpdate = false;

      if (driveCfg.webhookUrl) {
        try {
          const sheetData = await callAppsScript(driveCfg.webhookUrl);
          if (sheetData?.supportsPermisosFormularios === true) {
            await callAppsScript(driveCfg.webhookUrl, {
              action: 'guardar_permisos_formularios',
              permisos: siguienteMapa,
              actualizadoPor: String(body.usuarioNombre || body.usuarioCodigo || 'Administrador').trim(),
            });
            syncedToDrive = true;
          } else {
            pendingAppsScriptUpdate = true;
          }
        } catch (err) {
          pendingAppsScriptUpdate = true;
          console.warn('[permisos] aviso sincronizando con Drive:', err?.message || err);
        }
      }

      return res.status(200).json({
        success: true,
        permisos: siguienteMapa,
        syncedToDrive,
        pendingAppsScriptUpdate,
      });
    }

    // GET
    const locales = getPermisosFormulariosStorage();
    let permisosFinales = mergePermisosConDefaults(locales);
    let source = locales ? 'local' : 'default';
    let sheetsSupported = false;
    let needsAppsScriptUpdate = true;

    if (driveCfg.webhookUrl) {
      try {
        const data = await callAppsScript(driveCfg.webhookUrl);
        if (data?.supportsPermisosFormularios === true) {
          sheetsSupported = true;
          needsAppsScriptUpdate = false;
          if (
            data.permisosFormularios &&
            typeof data.permisosFormularios === 'object' &&
            Object.keys(data.permisosFormularios).length > 0
          ) {
            permisosFinales = mergePermisosConDefaults(data.permisosFormularios);
            savePermisosFormulariosStorage(permisosFinales);
            source = 'sheets';
          }
        }
      } catch (e) {
        console.warn('[permisos] lectura desde Apps Script:', e?.message || e);
      }
    }

    return res.status(200).json({
      success: true,
      permisos: permisosFinales,
      source,
      sheetsSupported,
      needsAppsScriptUpdate,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error al procesar permisos de formularios',
    });
  }
}
