import { TrabajadorMaestro, SolicitudFlor, CupoConfig, FlowerType } from '../types';

export const CUPOS_CONFIG: Record<string, CupoConfig> = {
  'Sede MG': {
    sede: 'Sede MG',
    ramosMax: 20,
    bouquetsMax: 5,
  },
  'Sede HA': {
    sede: 'Sede HA',
    ramosMax: 30,
    bouquetsMax: 0, // En HA son 30 ramos en total
  },
  'Sede SC': {
    sede: 'Sede SC',
    ramosMax: 20,
    bouquetsMax: 0, // En SC son 20 ramos en total
  },
};

export const MOTIVOS_SOLICITUD = [
  'Cumpleaños de familiar o allegado',
  'Aniversario / Celebración de pareja',
  'Reconocimiento laboral / Logro personal',
  'Agradecimiento o apoyo especial',
  'Visita a familiar o convaleciente',
  'Detalle especial del día',
  'Otro motivo',
];

// Base inicial del Maestro de Trabajadores (Hoja Maestro)
// Incluye datos reales de la hoja Solicitud Flor Obsequio (ej: 5705)
export const TRABAJADORES_INICIALES: TrabajadorMaestro[] = [
  // Empleados del archivo oficial (ID RH, NOMBRE, SEDE)
  { codigo: '5705', nombre: 'RODRIGUEZ CAUCHO PAOLA ANDREA', sede: 'Sede MG', cargo: 'Operaria Poscosecha', area: 'Poscosecha', activo: true },
  { codigo: '5701', nombre: 'Andrea Carolina Morales', sede: 'Sede MG', cargo: 'Operaria Hidratación', area: 'Poscosecha', activo: true },
  { codigo: '5702', nombre: 'Santiago Restrepo Duque', sede: 'Sede HA', cargo: 'Operario de Selección', area: 'Poscosecha', activo: true },
  { codigo: '5703', nombre: 'Lina Marcela Vargas Gómez', sede: 'Sede SC', cargo: 'Operaria de Boncheo', area: 'Poscosecha', activo: true },
  { codigo: '5704', nombre: 'Felipe Andrés Castro Gil', sede: 'Sede MG', cargo: 'Técnico de Cuarto Frío', area: 'Almacén', activo: true },
  { codigo: '5706', nombre: 'Beatriz Elena Osorio', sede: 'Sede HA', cargo: 'Líder de Empaque', area: 'Poscosecha', activo: true },
  { codigo: '5707', nombre: 'Guillermo León Ramírez', sede: 'Sede SC', cargo: 'Operario de Despachos', area: 'Logística', activo: true },

  // Sede MG
  { codigo: 'MG-101', nombre: 'Carlos Andrés Morales Gómez', sede: 'Sede MG', cargo: 'Operario Poscosecha', area: 'Clasificación', activo: true },
  { codigo: 'MG-102', nombre: 'María Esperanza Ramírez López', sede: 'Sede MG', cargo: 'Operaria Hidratación', area: 'Poscosecha', activo: true },
  { codigo: 'MG-103', nombre: 'Julián David Herrera Castro', sede: 'Sede MG', cargo: 'Técnico de Cuarto Frío', area: 'Almacén', activo: true },
  { codigo: 'MG-104', nombre: 'Diana Patricia Soto Morales', sede: 'Sede MG', cargo: 'Supervisora de Calidad', area: 'Control Calidad', activo: true },
  { codigo: 'MG-105', nombre: 'Luis Fernando Cárdenas Gil', sede: 'Sede MG', cargo: 'Operario Enmallado', area: 'Poscosecha', activo: true },
  { codigo: 'MG-106', nombre: 'Sandra Milena Pineda Ortiz', sede: 'Sede MG', cargo: 'Líder de Empaque', area: 'Poscosecha', activo: true },
  { codigo: 'MG-107', nombre: 'Jorge Iván Restrepo Zapata', sede: 'Sede MG', cargo: 'Operario de Corte', area: 'Cultivo Bloque 4', activo: true },
  { codigo: 'MG-108', nombre: 'Claudia Marcela Rincón Torres', sede: 'Sede MG', cargo: 'Auxiliar Administrativa', area: 'Gestión Humana', activo: true },
  { codigo: 'MG-109', nombre: 'Héctor Fabio Valencia Ruiz', sede: 'Sede MG', cargo: 'Mecánico de Mantenimiento', area: 'Mantenimiento', activo: true },
  { codigo: 'MG-110', nombre: 'Gloria Amparo Quintero Ríos', sede: 'Sede MG', cargo: 'Operaria Boncheo', area: 'Poscosecha', activo: true },

  // Sede HA
  { codigo: 'HA-201', nombre: 'Andrés Felipe Mejía Salazar', sede: 'Sede HA', cargo: 'Supervisor de Poscosecha', area: 'Poscosecha', activo: true },
  { codigo: 'HA-202', nombre: 'Liliana Patricia Osorio Buitrago', sede: 'Sede HA', cargo: 'Operaria de Selección', area: 'Poscosecha', activo: true },
  { codigo: 'HA-203', nombre: 'José Manuel Cardona Henao', sede: 'Sede HA', cargo: 'Operario de Riego', area: 'Cultivo Bloque 1', activo: true },
  { codigo: 'HA-204', nombre: 'Luz Marina Vargas Guzmán', sede: 'Sede HA', cargo: 'Operaria de Empaque', area: 'Poscosecha', activo: true },
  { codigo: 'HA-205', nombre: 'Camilo Ernesto Benítez Duque', sede: 'Sede HA', cargo: 'Conductor Despachos', area: 'Logística', activo: true },
  { codigo: 'HA-206', nombre: 'Natalia Andrea Giraldo Cano', sede: 'Sede HA', cargo: 'Inspectora Fitosanitaria', area: 'Sanidad Vegetal', activo: true },
  { codigo: 'HA-207', nombre: 'Víctor Hugo Salamanca Peña', sede: 'Sede HA', cargo: 'Operario Cuarto Frío', area: 'Poscosecha', activo: true },
  { codigo: 'HA-208', nombre: 'Yolanda del Carmen Pérez Vera', sede: 'Sede HA', cargo: 'Auxiliar de Enfermería', area: 'SST', activo: true },

  // Sede SC
  { codigo: 'SC-301', nombre: 'Fernando Alonso Vega Mora', sede: 'Sede SC', cargo: 'Líder de Poscosecha', area: 'Poscosecha', activo: true },
  { codigo: 'SC-302', nombre: 'Paola Andrea Castaño Gil', sede: 'Sede SC', cargo: 'Operaria de Clasificación', area: 'Poscosecha', activo: true },
  { codigo: 'SC-303', nombre: 'Juan Camilo Montes Rivera', sede: 'Sede SC', cargo: 'Operario de Fumigación', area: 'Cultivo Bloque 2', activo: true },
  { codigo: 'SC-304', nombre: 'Olga Lucía Forero Marín', sede: 'Sede SC', cargo: 'Operaria de Boncheo', area: 'Poscosecha', activo: true },
  { codigo: 'SC-305', nombre: 'Diego Alejandro Marulanda', sede: 'Sede SC', cargo: 'Técnico de Calderas', area: 'Mantenimiento', activo: true },
  { codigo: 'SC-306', nombre: 'Mónica Tatiana Serna Parra', sede: 'Sede SC', cargo: 'Operaria de Despachos', area: 'Logística', activo: true },
];

// Solicitudes demostrativas iniciales
export const SOLICITUDES_INICIALES: SolicitudFlor[] = [
  {
    id: 'SFO-2026-001',
    fecha: '2026-11-06',
    semana: 'Semana 46',
    codigo: 'MG-101',
    nombre: 'Carlos Andrés Morales Gómez',
    producto: 'Ramo de Rosa (Rojo) (1 unidad)',
    tipoProducto: 'ramo',
    florPrincipal: 'Rosa',
    opcionFlor: 'Rojo',
    sede: 'Sede MG',
    motivo: 'Cumpleaños de familiar o allegado',
    fechaEntrega: '2026-11-13',
    remitente: 'Gestión Humana - Carlos Morales',
    estado: 'Registrada',
    syncedToDrive: true,
    creadoEn: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'SFO-2026-002',
    fecha: '2026-11-06',
    semana: 'Semana 46',
    codigo: 'MG-104',
    nombre: 'Diana Patricia Soto Morales',
    producto: 'Bouquet de Rosas (1 unidad)',
    tipoProducto: 'bouquet',
    florPrincipal: 'Rosa',
    opcionFlor: 'Variado con predominancia de Rosa',
    sede: 'Sede MG',
    motivo: 'Reconocimiento laboral / Logro personal',
    fechaEntrega: '2026-11-13',
    remitente: 'Supervisión de Calidad',
    estado: 'Registrada',
    syncedToDrive: true,
    creadoEn: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'SFO-2026-003',
    fecha: '2026-11-07',
    semana: 'Semana 46',
    codigo: 'HA-202',
    nombre: 'Liliana Patricia Osorio Buitrago',
    producto: 'Ramo de Clavel (Según color disponible) (1 unidad)',
    tipoProducto: 'ramo',
    florPrincipal: 'Clavel',
    opcionFlor: 'Según color disponible',
    sede: 'Sede HA',
    motivo: 'Aniversario / Celebración de pareja',
    fechaEntrega: '2026-11-13',
    remitente: 'Liliana Osorio',
    estado: 'Registrada',
    syncedToDrive: true,
    creadoEn: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'SFO-2026-004',
    fecha: '2026-11-08',
    semana: 'Semana 46',
    codigo: 'SC-302',
    nombre: 'Paola Andrea Castaño Gil',
    producto: 'Ramo de Alstroemeria (Según color disponible) (1 unidad)',
    tipoProducto: 'ramo',
    florPrincipal: 'Alstroemeria',
    opcionFlor: 'Según color disponible',
    sede: 'Sede SC',
    motivo: 'Visita a familiar o convaleciente',
    fechaEntrega: '2026-11-13',
    remitente: 'Paola Castaño',
    estado: 'Registrada',
    syncedToDrive: true,
    creadoEn: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
];
