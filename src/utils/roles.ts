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

/**
 * Controla si el usuario puede acceder al formulario "Especiales Empresa" (antes Solicitud Extra):
 * - AUXILIAR GESTIÓN HUMANA EAI
 * - ANALISTA GESTIÓN DE INFORMACIÓN EAI (administrador)
 */
export function puedeVerSolicitudIntExt(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;

  const cargo = String(trabajador.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cargo.includes('auxiliar') && cargo.includes('gestion') && cargo.includes('humana')) {
    return true;
  }

  if (cargo.includes('analista') && cargo.includes('gestion') && cargo.includes('informacion')) {
    return true;
  }

  return false;
}

/**
 * Controla si el usuario visualiza el menú lateral derecho de módulos:
 * - AUXILIAR GESTIÓN HUMANA EAI
 * - ANALISTA GESTIÓN DE INFORMACIÓN EAI
 */
export function puedeVerMenuLateral(trabajador?: TrabajadorMaestro | null): boolean {
  return puedeVerSolicitudIntExt(trabajador);
}

/**
 * Administradores del sistema (ANALISTA GESTIÓN DE INFORMACIÓN EAI):
 * Únicos usuarios autorizados para visualizar el estado y configuración de Google Drive.
 */
export function esAdministradorSistema(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;

  const cargo = String(trabajador.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

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

  const cargo = String(trabajador.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

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
 * - Administradores del sistema (ANALISTA GESTIÓN DE INFORMACIÓN EAI / Administrador)
 * - AUXILIAR TÉCNICO POSCOSECHA EAI
 */
export function puedeVerEspecialesPersonal(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  if (esAdministradorSistema(trabajador)) return true;

  const cargo = String(trabajador.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    cargo.includes('auxiliar') &&
    cargo.includes('tecnico') &&
    cargo.includes('poscosecha')
  );
}

/**
 * Controla si el usuario puede acceder al formulario "Solicitud Comunidad" (antes Especiales Externos):
 * - Administradores del sistema (ANALISTA GESTIÓN DE INFORMACIÓN EAI / Administrador)
 * - AUXILIAR TÉCNICO POSCOSECHA EAI
 */
export function puedeVerSolicitudComunidad(trabajador?: TrabajadorMaestro | null): boolean {
  if (!trabajador) return false;
  if (esAdministradorSistema(trabajador)) return true;

  const cargo = String(trabajador.cargo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    cargo.includes('auxiliar') &&
    cargo.includes('tecnico') &&
    cargo.includes('poscosecha')
  );
}
