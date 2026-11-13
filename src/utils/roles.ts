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
      .trim();

  const cargo = normalizar(trabajador.cargo || '');
  const area = normalizar(trabajador.area || '');
  const full = `${cargo} ${area}`;

  // Gestión Humana / Auxiliar de Gestión
  if (full.includes('gestion humana') || full.includes('auxiliar de gestion')) {
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
