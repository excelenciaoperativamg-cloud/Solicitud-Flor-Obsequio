/**
 * Utilidades de fecha para el sistema de Solicitud de Flor de Obsequio
 */

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

export const getTodayString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Viernes de la misma semana laboral (lun–vie) a partir de una fecha. */
export const getFridayOfSameWeek = (fromDate?: Date): Date => {
  const d = fromDate ? new Date(fromDate) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=dom … 5=vie … 6=sáb
  // Llevar al lunes de esa semana y sumar 4 → viernes
  const toMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + toMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(0, 0, 0, 0);
  return friday;
};

export const toDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * El formulario solo se habilita los dos primeros días hábiles de la semana (lunes y martes).
 * La entrega es el viernes de esa misma semana.
 */
export interface VentanaSolicitud {
  abierto: boolean;
  diaSemana: number; // 0=dom … 6=sáb
  nombreDia: string;
  fechaEntrega: string; // YYYY-MM-DD viernes de la semana
  labelEntrega: string;
  mensajeCerrado: string;
}

export const getVentanaSolicitud = (now = new Date()): VentanaSolicitud => {
  const day = now.getDay();
  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const friday = getFridayOfSameWeek(now);
  const fechaEntrega = toDateString(friday);
  const labelEntrega = friday.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Lunes (1) y martes (2)
  const abierto = day === 1 || day === 2;

  let mensajeCerrado = '';
  if (!abierto) {
    if (day === 0 || day === 6) {
      mensajeCerrado =
        'El formulario solo está habilitado los lunes y martes. Vuelva el próximo lunes para solicitar el obsequio de esa semana.';
    } else {
      mensajeCerrado =
        'El formulario solo está habilitado los dos primeros días hábiles (lunes y martes). La ventana de esta semana ya cerró.';
    }
  }

  return {
    abierto,
    diaSemana: day,
    nombreDia: nombres[day],
    fechaEntrega,
    labelEntrega: `Viernes, ${labelEntrega}`,
    mensajeCerrado,
  };
};

// Compatibilidad con código existente
export const getNextFriday = (fromDate?: Date): Date => getFridayOfSameWeek(fromDate);

export const getUpcomingFridays = (count = 6): Array<{ dateString: string; label: string; isNext: boolean }> => {
  const fridays: Array<{ dateString: string; label: string; isNext: boolean }> = [];
  let currentFriday = getFridayOfSameWeek();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Si ya pasó el viernes de esta semana, empezar en el siguiente
  if (currentFriday.getTime() < today.getTime()) {
    currentFriday = new Date(currentFriday.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  for (let i = 0; i < count; i++) {
    const dateString = toDateString(currentFriday);
    const label = currentFriday.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    fridays.push({
      dateString,
      label: `Viernes, ${label}${i === 0 ? ' (Esta semana)' : ''}`,
      isNext: i === 0,
    });
    currentFriday = new Date(currentFriday.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return fridays;
};

export const daysDifference = (dateStringA: string, dateStringB: string): number => {
  const [y1, m1, d1] = dateStringA.split('-').map(Number);
  const [y2, m2, d2] = dateStringB.split('-').map(Number);
  const dateA = new Date(y1, m1 - 1, d1);
  const dateB = new Date(y2, m2 - 1, d2);
  const diffTime = Math.abs(dateB.getTime() - dateA.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

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
