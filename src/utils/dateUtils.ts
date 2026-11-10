/**
 * Utilidades de fecha para el sistema de Solicitud de Flor de Obsequio
 */

// Formato de fecha en español
export const formatDateSpanish = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

export const formatShortDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

// Obtener número de semana ISO (1 - 53)
export const getISOWeekNumber = (dateString: string): number => {
  if (!dateString) return 1;
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
  } catch {
    return 1;
  }
};

export const getWeekLabel = (dateString: string): string => {
  const week = getISOWeekNumber(dateString);
  return `Semana ${week}`;
};

// Obtener fecha actual en formato YYYY-MM-DD
export const getTodayString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Obtener el próximo viernes a partir de una fecha base
export const getNextFriday = (fromDate?: Date): Date => {
  const d = fromDate ? new Date(fromDate) : new Date();
  // 0 = Domingo, 1 = Lunes, ..., 5 = Viernes, 6 = Sábado
  const day = d.getDay();
  let diff = 5 - day;
  if (diff <= 0) {
    // Si hoy es viernes tarde o fin de semana, programar para el siguiente viernes (o si es viernes hoy + 7 días)
    // Para dar tiempo a Poscosecha, si hoy es viernes o sábado/domingo, el próximo viernes es en (diff + 7)
    diff += 7;
  }
  const nextFriday = new Date(d);
  nextFriday.setDate(d.getDate() + diff);
  nextFriday.setHours(0, 0, 0, 0);
  return nextFriday;
};

// Obtener los próximos N viernes disponibles
export const getUpcomingFridays = (count = 6): Array<{ dateString: string; label: string; isNext: boolean }> => {
  const fridays: Array<{ dateString: string; label: string; isNext: boolean }> = [];
  let currentFriday = getNextFriday();

  for (let i = 0; i < count; i++) {
    const year = currentFriday.getFullYear();
    const month = String(currentFriday.getMonth() + 1).padStart(2, '0');
    const day = String(currentFriday.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const label = currentFriday.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    fridays.push({
      dateString,
      label: `Viernes, ${label}${i === 0 ? ' (Más próximo)' : ''}`,
      isNext: i === 0,
    });

    // Avanzar 7 días al siguiente viernes
    currentFriday = new Date(currentFriday.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return fridays;
};

// Calcular diferencia de días entre dos fechas (dateB - dateA)
export const daysDifference = (dateStringA: string, dateStringB: string): number => {
  const [y1, m1, d1] = dateStringA.split('-').map(Number);
  const [y2, m2, d2] = dateStringB.split('-').map(Number);
  const dateA = new Date(y1, m1 - 1, d1);
  const dateB = new Date(y2, m2 - 1, d2);
  const diffTime = Math.abs(dateB.getTime() - dateA.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// Validar regla de 15 días:
// "Cada trabajador podrá solicitar flor de obsequio una vez cada 15 días"
export interface Regla15DiasResultado {
  puedeSolicitar: boolean;
  diasTranscurridos: number;
  diasFaltantes: number;
  ultimaFecha?: string;
  fechaProximaPermitida?: string;
}

export const verificarRegla15Dias = (
  historialSolicitudesTrabajador: Array<{ fecha: string }>,
  fechaActual = getTodayString()
): Regla15DiasResultado => {
  if (!historialSolicitudesTrabajador || historialSolicitudesTrabajador.length === 0) {
    return {
      puedeSolicitar: true,
      diasTranscurridos: 999,
      diasFaltantes: 0,
    };
  }

  // Ordenar de más reciente a más antigua
  const ordenadas = [...historialSolicitudesTrabajador].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ultima = ordenadas[0];

  const dias = daysDifference(ultima.fecha, fechaActual);

  if (dias < 15) {
    const diasFaltantes = 15 - dias;
    const [y, m, d] = ultima.fecha.split('-').map(Number);
    const fechaUltimaDate = new Date(y, m - 1, d);
    const fechaPermitidaDate = new Date(fechaUltimaDate.getTime() + 15 * 24 * 60 * 60 * 1000);

    const py = fechaPermitidaDate.getFullYear();
    const pm = String(fechaPermitidaDate.getMonth() + 1).padStart(2, '0');
    const pd = String(fechaPermitidaDate.getDate()).padStart(2, '0');

    return {
      puedeSolicitar: false,
      diasTranscurridos: dias,
      diasFaltantes,
      ultimaFecha: ultima.fecha,
      fechaProximaPermitida: `${py}-${pm}-${pd}`,
    };
  }

  return {
    puedeSolicitar: true,
    diasTranscurridos: dias,
    diasFaltantes: 0,
    ultimaFecha: ultima.fecha,
  };
};
