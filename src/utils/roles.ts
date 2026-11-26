import {
  TrabajadorMaestro,
  FormularioPermisoKey,
  PermisoFormulario,
  PermisosFormulariosMap,
} from '../types';

export function normalizarTextoRol(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FormularioMeta {
  key: FormularioPermisoKey;
  nombre: string;
  modulo: string;
  descripcion: string;
}

export const FORMULARIOS_PERMISOS_META: FormularioMeta[] = [
  {
    key: 'formulario',
    nombre: 'Solicitud Personal',
    modulo: 'Solicitud Personal',
    descripcion: 'Formulario principal de solicitud semanal de flor para colaboradores.',
  },
  {
    key: 'especiales-personal',
    nombre: 'Especiales Personal',
    modulo: 'Especiales Personal',
    descripcion: 'Solicitudes especiales de trabajadores con carta de solicitud adjunta.',
  },
  {
    key: 'int-ext',
    nombre: 'Especiales Empresa',
    modulo: 'Especiales Empresa',
    descripcion: 'Solicitudes internas o especiales registradas a nombre de la empresa.',
  },
  {
    key: 'ingresos-seleccion',
    nombre: 'Ingresos Personal',
    modulo: 'Ingresos Personal',
    descripcion: 'Solicitudes de flor para procesos de ingresos de personal.',
  },
  {
    key: 'obsequio-visitantes',
    nombre: 'Obsequio Visitantes',
    modulo: 'Obsequio Visitantes',
    descripcion: 'Solicitudes de obsequio de flor para visitantes externos o institucionales.',
  },
  {
    key: 'solicitud-comunidad',
    nombre: 'Solicitud Comunidad',
    modulo: 'Solicitud Comunidad',
    descripcion: 'Solicitudes de obsequio de flor dirigidas a entidades y comunidad.',
  },
  {
    key: 'solicitudes',
    nombre: 'Resumen Solicitud',
    modulo: 'Solicitud Personal',
    descripcion: 'Tabla consolidada con el resumen de solicitudes personales registradas.',
  },
  {
    key: 'consolidado',
    nombre: 'Consolidado',
    modulo: 'Consolidado',
    descripcion:
      'Módulo consolidado de Especiales Personal, Especiales Empresa, Ingresos Personal, Obsequio Visitantes y Solicitud Comunidad.',
  },
];

export const DEFAULT_PERMISOS_FORMULARIOS: PermisosFormulariosMap = {
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
  consolidado: {
    todos: false,
    cargos: [],
    palabrasClaveCargo: [
      'AUXILIAR GESTIÓN HUMANA',
      'ANALISTA GESTIÓN HUMANA',
      'AUXILIAR TÉCNICO POSCOSECHA',
      'DIRECTOR',
    ],
    codigos: [],
    codigosExcluidos: [],
  },
};

function clonarReglaPermiso(regla?: Partial<PermisoFormulario>): PermisoFormulario {
  return {
    todos: Boolean(regla?.todos),
    cargos: Array.isArray(regla?.cargos) ? [...regla.cargos] : [],
    palabrasClaveCargo: Array.isArray(regla?.palabrasClaveCargo)
      ? [...regla.palabrasClaveCargo]
      : [],
    codigos: Array.isArray(regla?.codigos) ? [...regla.codigos] : [],
    codigosExcluidos: Array.isArray(regla?.codigosExcluidos)
      ? [...regla.codigosExcluidos]
      : [],
  };
}

export function clonarPermisosFormularios(
  origen?: Partial<Record<FormularioPermisoKey, Partial<PermisoFormulario>>> | null
): PermisosFormulariosMap {
  const resultado = {} as PermisosFormulariosMap;
  for (const meta of FORMULARIOS_PERMISOS_META) {
    const k = meta.key;
    const custom = origen && origen[k] ? origen[k] : undefined;
    resultado[k] = clonarReglaPermiso(custom || DEFAULT_PERMISOS_FORMULARIOS[k]);
  }
  return resultado;
}

let permisosFormulariosCache: PermisosFormulariosMap = clonarPermisosFormularios(
  DEFAULT_PERMISOS_FORMULARIOS
);

export function setPermisosFormulariosCache(
  permisos?: Partial<Record<FormularioPermisoKey, Partial<PermisoFormulario>>> | null
): PermisosFormulariosMap {
  permisosFormulariosCache = clonarPermisosFormularios(permisos);
  return permisosFormulariosCache;
}

export function getPermisosFormulariosCache(): PermisosFormulariosMap {
  return permisosFormulariosCache;
}

/**
 * Administradores del sistema (ANALISTA GESTIÓN DE INFORMACIÓN EAI / Administrador):
 * Únicos usuarios con acceso administrativo total, configuración de Google Drive y editor de permisos.
 */
export function esAdministradorSistema(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;

  const cargo = normalizarTextoRol(trabajador.cargo || '');

  if (
    cargo.includes('analista') &&
    cargo.includes('gestion') &&
    cargo.includes('informacion')
  ) {
    return true;
  }

  return cargo === 'administrador' || cargo.startsWith('administrador ');
}

/**
 * Roles con acceso a pestañas administrativas y a la hoja de Drive:
 * - Auxiliar de Gestión humana (o área Gestión Humana)
 * - Cargos administrativos de Poscosecha (Auxiliar, Líder, Supervisor, Director)
 * No incluye operarios de línea aunque digan "Poscosecha" en el cargo.
 */
export function esRolAdmin(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;

  const cargo = normalizarTextoRol(trabajador.cargo || '');
  const area = normalizarTextoRol(trabajador.area || '');
  const full = `${cargo} ${area}`;

  if (full.includes('gestion humana') || full.includes('auxiliar de gestion')) {
    return true;
  }

  if (full.includes('analista') && full.includes('gestion') && full.includes('informacion')) {
    return true;
  }

  if (cargo === 'poscosecha') {
    return true;
  }

  if (full.includes('poscosecha')) {
    const esAdminPoscosecha =
      full.includes('auxiliar') ||
      full.includes('lider') ||
      full.includes('supervisor') ||
      full.includes('director') ||
      full.includes('coordinador');
    if (esAdminPoscosecha) return true;
  }

  return false;
}

/**
 * Controla si el usuario puede visualizar la sección "Actualizar Maestro" (Hoja Maestro).
 * Exclusivo para el administrador (ANALISTA GESTIÓN DE INFORMACIÓN EAI / Administrador).
 */
export function puedeVerHojaMaestro(trabajador?: TrabajadorMaestro | null): boolean {
  return esAdministradorSistema(trabajador);
}

/**
 * Verifica si el trabajador tiene el cargo de DIRECTOR POSCOSECHA,
 * quien tiene habilitado el formulario todos los días de la semana.
 */
export function esDirectorPoscosecha(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  const cargo = normalizarTextoRol(trabajador.cargo || '');
  return cargo.includes('director') && cargo.includes('poscosecha');
}

/**
 * Verifica si el trabajador tiene habilitado el formulario todos los días de la semana:
 * - DIRECTOR POSCOSECHA
 * - ANALISTA GESTIÓN DE INFORMACIÓN EAI
 */
export function tieneFormularioTodosLosDias(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  if (esDirectorPoscosecha(trabajador)) return true;

  const cargo = normalizarTextoRol(trabajador.cargo || '');
  return (
    cargo.includes('analista') &&
    cargo.includes('gestion') &&
    cargo.includes('informacion')
  );
}

/**
 * Verifica si el trabajador tiene el cargo ANALISTA GESTIÓN HUMANA (incluye variantes como 1 EAI, 2 EAI, 3 EAI).
 */
export function esAnalistaGestionHumana(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  const cargo = normalizarTextoRol(trabajador.cargo || '');
  return (
    cargo.includes('analista') &&
    cargo.includes('gestion') &&
    cargo.includes('humana')
  );
}

/**
 * Evalúa si un colaborador tiene permiso para acceder a un formulario específico
 * según la configuración editable por el administrador.
 * Los administradores del sistema siempre conservan acceso.
 */
export function evaluarPermisoFormulario(
  trabajador: TrabajadorMaestro | null | undefined,
  formKey: FormularioPermisoKey,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  if (!trabajador) return false;
  if (esAdministradorSistema(trabajador)) return true;

  const mapa = permisosMap || permisosFormulariosCache || DEFAULT_PERMISOS_FORMULARIOS;
  const regla = mapa[formKey] || DEFAULT_PERMISOS_FORMULARIOS[formKey];
  if (!regla) return false;

  const codigoTrab = String(trabajador.codigo || '').trim().toUpperCase();

  if (
    Array.isArray(regla.codigosExcluidos) &&
    regla.codigosExcluidos.some((c) => String(c || '').trim().toUpperCase() === codigoTrab)
  ) {
    return false;
  }

  if (regla.todos) return true;

  if (
    codigoTrab &&
    Array.isArray(regla.codigos) &&
    regla.codigos.some((c) => String(c || '').trim().toUpperCase() === codigoTrab)
  ) {
    return true;
  }

  const cargoTrab = normalizarTextoRol(trabajador.cargo || '');
  if (!cargoTrab) return false;

  if (
    Array.isArray(regla.cargos) &&
    regla.cargos.some((c) => normalizarTextoRol(c) === cargoTrab)
  ) {
    return true;
  }

  if (
    Array.isArray(regla.palabrasClaveCargo) &&
    regla.palabrasClaveCargo.some((kw) => {
      const kwNorm = normalizarTextoRol(kw);
      return kwNorm.length > 0 && cargoTrab.includes(kwNorm);
    })
  ) {
    return true;
  }

  return false;
}

export function puedeVerSolicitudPersonal(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'formulario', permisosMap);
}

export function puedeVerSolicitudIntExt(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'int-ext', permisosMap);
}

export function puedeVerMenuLateral(trabajador?: TrabajadorMaestro | null): boolean {
  return Boolean(trabajador);
}

export function puedeVerResumenSolicitud(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'solicitudes', permisosMap);
}

export function puedeVerEspecialesPersonal(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'especiales-personal', permisosMap);
}

export function puedeVerRegistrosEspecialesPersonal(
  trabajador?: TrabajadorMaestro | null
): boolean {
  return Boolean(trabajador);
}

export function puedeVerTodosRegistrosEspecialesPersonal(
  trabajador?: TrabajadorMaestro | null
): boolean {
  if (!trabajador) return false;
  return esAdministradorSistema(trabajador) || esAnalistaGestionHumana(trabajador);
}

export function puedeEditarEstadoEspecialesPersonal(
  trabajador?: TrabajadorMaestro | null
): boolean {
  if (!trabajador) return false;
  return esAdministradorSistema(trabajador) || esAnalistaGestionHumana(trabajador);
}

export function puedeVerSolicitudComunidad(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'solicitud-comunidad', permisosMap);
}

export function puedeVerIngresosSeleccion(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'ingresos-seleccion', permisosMap);
}

export function puedeVerObsequioVisitantes(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'obsequio-visitantes', permisosMap);
}

export function puedeVerConsolidado(
  trabajador?: TrabajadorMaestro | null,
  permisosMap?: PermisosFormulariosMap | null
): boolean {
  return evaluarPermisoFormulario(trabajador, 'consolidado', permisosMap);
}
