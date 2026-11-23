import { TrabajadorMaestro } from '../types';

/**
 * Roles con acceso a pestañas administrativas y a la hoja de Drive:
 * - Auxiliar de Gestión humana (o área Gestión Humana)
 * - Cargos administrativos de Poscosecha (Auxiliar, Líder, Supervisor, Director)
 * No incluye operarios de línea aunque digan "Poscosecha" en el cargo.
 */
export function esRolAdmin(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;

  const normalizar = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cargo = normalizar(trabajador.cargo || '');
  const area = normalizar(trabajador.area || '');
  const full = `${cargo} ${area}`;

  // Gestión Humana / Auxiliar de Gestión
  if (full.includes('gestion humana') || full.includes('auxiliar de gestion')) {
    return true;
  }

  // Analista Gestión de Información EAI
  if (full.includes('analista') && full.includes('gestion') && full.includes('informacion')) {
    return true;
  }

  // Cargo exactamente "Poscosecha" (rol de área)
  if (cargo === 'poscosecha') {
    return true;
  }

  // Poscosecha con cargo de apoyo/administración (no operario de línea)
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
 * Exclusivo para el administrador (ANALISTA GESTIÓN DE INFORMACIÓN EAI).
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

  const normalizar = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cargo = normalizar(trabajador.cargo || '');
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

  const cargo = String(trabajador.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    cargo.includes('analista') &&
    cargo.includes('gestion') &&
    cargo.includes('informacion')
  );
}

function normalizarTextoRol(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
 * Controla si el usuario puede acceder al formulario "Especiales Empresa" (antes Solicitud Extra):
 * - AUXILIAR GESTIÓN HUMANA EAI
 * - ANALISTA GESTIÓN HUMANA (1 EAI, 2 EAI, 3 EAI, etc.)
 * - ANALISTA GESTIÓN DE INFORMACIÓN EAI (administrador)
 */
export function puedeVerSolicitudIntExt(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  if (esAnalistaGestionHumana(trabajador)) return true;

  const cargo = normalizarTextoRol(trabajador.cargo || '');

  if (cargo.includes('auxiliar') && cargo.includes('gestion') && cargo.includes('humana')) {
    return true;
  }

  if (cargo.includes('analista') && cargo.includes('gestion') && cargo.includes('informacion')) {
    return true;
  }

  return false;
}

/**
 * Controla si el usuario visualiza módulos adicionales en el menú lateral:
 * Todo trabajador del Maestro tiene al menos Solicitud Personal y Especiales Personal.
 */
export function puedeVerMenuLateral(trabajador?: TrabajadorMaestro | null): boolean {
  return Boolean(trabajador);
}

/**
 * Administradores del sistema (ANALISTA GESTIÓN DE INFORMACIÓN EAI):
 * Únicos usuarios autorizados para visualizar el estado y configuración de Google Drive.
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
 * Controla si el usuario puede visualizar "Resumen Solicitud":
 * - AUXILIAR GESTIÓN HUMANA EAI
 * - AUXILIAR TÉCNICO POSCOSECHA EAI
 * - Administradores (ANALISTA GESTIÓN DE INFORMACIÓN EAI)
 */
export function puedeVerResumenSolicitud(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  if (esAdministradorSistema(trabajador)) return true;

  const cargo = normalizarTextoRol(trabajador.cargo || '');

  if (
    cargo.includes('auxiliar') &&
    cargo.includes('gestion') &&
    cargo.includes('humana')
  ) {
    return true;
  }

  return (
    cargo.includes('auxiliar') &&
    cargo.includes('tecnico') &&
    cargo.includes('poscosecha')
  );
}

/**
 * Controla si el usuario puede acceder al formulario "Especiales Personal":
 * Visible para todo el personal del Maestro.
 */
export function puedeVerEspecialesPersonal(trabajador?: TrabajadorMaestro | null): boolean {
  return Boolean(trabajador);
}

/**
 * Controla si el usuario puede visualizar la sección "Registros en Especiales Personal":
 * Visible para la persona que realizó la solicitud (sus propios registros),
 * ANALISTA GESTIÓN HUMANA y administradores.
 */
export function puedeVerRegistrosEspecialesPersonal(
  trabajador?: TrabajadorMaestro | null
): boolean {
  return Boolean(trabajador);
}

/**
 * Controla si el usuario puede ver TODAS las solicitudes en "Registros en Especiales Personal":
 * - ANALISTA GESTIÓN HUMANA (1 EAI, 2 EAI, 3 EAI, etc.)
 * - Administradores del sistema (ANALISTA GESTIÓN DE INFORMACIÓN EAI / Administrador)
 */
export function puedeVerTodosRegistrosEspecialesPersonal(
  trabajador?: TrabajadorMaestro | null
): boolean {
  if (!trabajador) return false;
  return esAdministradorSistema(trabajador) || esAnalistaGestionHumana(trabajador);
}

/**
 * Controla si el usuario puede acceder al formulario "Solicitud Comunidad" (antes Especiales Externos):
 * - Administradores del sistema (ANALISTA GESTIÓN DE INFORMACIÓN EAI / Administrador)
 * - ANALISTA GESTIÓN HUMANA (1 EAI, 2 EAI, 3 EAI, etc.)
 * - AUXILIAR TÉCNICO POSCOSECHA EAI
 */
export function puedeVerSolicitudComunidad(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  if (esAdministradorSistema(trabajador)) return true;
  if (esAnalistaGestionHumana(trabajador)) return true;

  const cargo = normalizarTextoRol(trabajador.cargo || '');

  return (
    cargo.includes('auxiliar') &&
    cargo.includes('tecnico') &&
    cargo.includes('poscosecha')
  );
}
