import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FilePlus2,
  UserCheck,
  Sparkles,
  Calendar,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Printer,
  Copy,
  LogOut,
  Search,
  Download,
  RefreshCw,
  Check,
  X,
  ChevronDown,
  Mail,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { EspecialPersonal, TrabajadorMaestro } from '../types';
import {
  EmailNotificationResult,
  EstadoEspecialPersonal,
  retryEmailEspecialesPersonalApi,
  notifyRespuestaEspecialPersonalApi,
} from '../services/apiClient';
import {
  getTodayString,
  formatDateSpanish,
  formatShortDate,
  getISOWeekNumber,
  addDaysToDateString,
} from '../utils/dateUtils';
import {
  puedeVerRegistrosEspecialesPersonal,
  puedeVerTodosRegistrosEspecialesPersonal,
  puedeEditarEstadoEspecialesPersonal,
} from '../utils/roles';

export interface FotoCartaUpload {
  base64: string;
  mimeType: string;
  fileName: string;
  previewUrl: string;
  sizeKB: number;
}

interface EspecialesPersonalFormProps {
  sesion: TrabajadorMaestro;
  maestro: TrabajadorMaestro[];
  solicitudesEspecialesPersonal: EspecialPersonal[];
  sheetsSupported: boolean;
  emailSupported?: boolean;
  especialesPersonalSheetActual?: string;
  needsAppsScriptUpdate?: boolean;
  onGuardarEspecialPersonal: (
    nueva: EspecialPersonal | EspecialPersonal[],
    correoNotificacion?: string,
    fotoCarta?: { base64: string; mimeType: string; fileName: string } | null
  ) => Promise<{
    success: boolean;
    error?: string;
    solicitud?: EspecialPersonal;
    solicitudes?: EspecialPersonal[];
    pendingAppsScriptUpdate?: boolean;
    especialesPersonalSheetName?: string;
    needsAppsScriptUpdate?: boolean;
    fotoCartaDriveError?: string;
    emailNotification?: EmailNotificationResult;
  }>;
  onRecargarEspecialPersonal?: () => Promise<void>;
  onActualizarEstadoEspecialPersonal?: (
    id: string,
    estado: EstadoEspecialPersonal
  ) => Promise<{
    success: boolean;
    error?: string;
    pendingAppsScriptUpdate?: boolean;
  }>;
  onRecargarMaestro?: () => Promise<void>;
  onCerrarSesion?: () => void;
}

const ROSA_VARIANTES_EP = ['Rosa (Color)', 'Rosa (Roja)', 'Bouquet'] as const;
const PRODUCTOS_RESTO_EP = ['Clavel', 'Alstroemeria', 'Gypso'] as const;
const PRODUCTOS_EP = [
  'Rosa (Color)',
  'Rosa (Roja)',
  'Bouquet',
  'Clavel',
  'Alstroemeria',
  'Gypso',
] as const;
const COLORES_BASE_EP = ['Rosado', 'Blanco', 'Amarillo', 'Naranja'] as const;
const MAX_SOLICITUDES_POR_ANO_EP = 2;
const MOTIVOS_BASE_EP = [
  'Matrimonio',
  '15 años',
  'Bautismo',
  'Celebración Religiosa',
] as const;
const DIAS_ANTICIPACION_OFFSET_EP = 9; // Día 10 contando desde la fecha de solicitud (ej. 23 nov -> 2 dic)
const CORREO_NOTIFICADO_FIJO_EP = 'angela.garcia@mg-consultores.com';
const ESTADO_INICIAL_EP = 'Pendiente Aprobación';

const EMAIL_ITEM_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarCorreoIndividual(raw: string): {
  correo: string;
  valido: boolean;
  tieneMultiples: boolean;
} {
  const limpio = String(raw || '').trim();
  if (!limpio) {
    return { correo: '', valido: false, tieneMultiples: false };
  }
  const tieneMultiples = /[,;\s]/.test(limpio);
  return {
    correo: limpio,
    valido: !tieneMultiples && EMAIL_ITEM_REGEX.test(limpio),
    tieneMultiples,
  };
}

function normalizarDigitos(raw?: string): string {
  return String(raw || '').replace(/\D/g, '');
}

function normalizarTextoComp(raw?: string): string {
  return String(raw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function esEstadoPendienteAprobacion(estado?: string): boolean {
  return normalizarTextoComp(estado) === 'PENDIENTE APROBACION';
}

function esEstadoNoAprobado(estado?: string): boolean {
  return normalizarTextoComp(estado) === 'NO APROBADO';
}

function esSolicitudDelUsuario(
  s: EspecialPersonal,
  usuarioNombre?: string,
  cedulaUsuario?: string
): boolean {
  const cedSol = normalizarDigitos(s.cedula);
  const cedUser = normalizarDigitos(cedulaUsuario);
  if (cedSol && cedUser && cedSol === cedUser) return true;

  const nomUser = normalizarTextoComp(usuarioNombre);
  if (!nomUser) return false;
  const usuSol = normalizarTextoComp(s.usuario);
  const nomSol = normalizarTextoComp(s.nombre);
  return (Boolean(usuSol) && usuSol === nomUser) || (Boolean(nomSol) && nomSol === nomUser);
}

function obtenerNumSemanaEP(s: EspecialPersonal): number {
  const m = String(s.semana || '').match(/(\d+)/);
  if (m) return Number(m[1]);
  if (s.fechaEntrega) return getISOWeekNumber(s.fechaEntrega);
  return 0;
}

function obtenerAnoSolicitudEP(s: EspecialPersonal): string {
  const fSol = String(s.fechaSolicitud || '').trim();
  if (/^\d{4}/.test(fSol)) return fSol.slice(0, 4);
  const fEnt = String(s.fechaEntrega || '').trim();
  if (/^\d{4}/.test(fEnt)) return fEnt.slice(0, 4);
  if (s.creadoEn && Number.isFinite(s.creadoEn)) {
    return String(new Date(s.creadoEn).getFullYear());
  }
  return String(new Date().getFullYear());
}

function claveOcasionSolicitudEP(s: EspecialPersonal): string {
  const fSol = String(s.fechaSolicitud || '').trim();
  const fEnt = String(s.fechaEntrega || '').trim();
  const mot = normalizarTextoComp(s.motivo);
  const corr = String(s.correoConfirmacion || '').trim().toLowerCase();
  const col = normalizarTextoComp(s.color);
  const compuesto = [fSol, fEnt, mot, corr, col].join('|');
  return compuesto.replace(/\|/g, '') ? compuesto : String(s.id || Math.random());
}

export const EspecialesPersonalForm: React.FC<EspecialesPersonalFormProps> = ({
  sesion,
  maestro,
  solicitudesEspecialesPersonal,
  sheetsSupported,
  emailSupported = true,
  especialesPersonalSheetActual = '',
  needsAppsScriptUpdate = false,
  onGuardarEspecialPersonal,
  onRecargarEspecialPersonal,
  onActualizarEstadoEspecialPersonal,
  onRecargarMaestro,
  onCerrarSesion,
}) => {
  const fechaSolicitud = getTodayString();
  const fechaMinimaEntrega = useMemo(
    () => addDaysToDateString(fechaSolicitud, DIAS_ANTICIPACION_OFFSET_EP),
    [fechaSolicitud]
  );
  const verRegistros = puedeVerRegistrosEspecialesPersonal(sesion);
  const verTodosRegistros = puedeVerTodosRegistrosEspecialesPersonal(sesion);
  const puedeEditarEstado = puedeEditarEstadoEspecialesPersonal(sesion);

  // Cédula manual de respaldo solo si el Maestro aún no tiene cédula cargada para la sesión
  const [cedulaManual, setCedulaManual] = useState('');
  const [sincronizandoMaestro, setSincronizandoMaestro] = useState(false);

  // Productos y cantidades
  const [productosCantidades, setProductosCantidades] = useState<Record<string, string>>({});
  const [rosaAbierto, setRosaAbierto] = useState(false);

  // Color con persistencia para opciones agregadas
  const [coloresPersonalizados, setColoresPersonalizados] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sfo_colores_especiales_personal_custom');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [coloresSeleccionados, setColoresSeleccionados] = useState<string[]>([]);
  const [mostrandoInputColor, setMostrandoInputColor] = useState(false);
  const [nuevoColorInput, setNuevoColorInput] = useState('');

  // Motivos con persistencia para opciones agregadas
  const [motivosPersonalizados, setMotivosPersonalizados] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sfo_motivos_especiales_personal_custom');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('');
  const [mostrandoInputMotivo, setMostrandoInputMotivo] = useState(false);
  const [nuevoMotivoInput, setNuevoMotivoInput] = useState('');

  // Fecha entrega (mínimo 10 días desde la solicitud), semana calculada, correo confirmación
  const [fechaEntrega, setFechaEntrega] = useState(() =>
    addDaysToDateString(getTodayString(), DIAS_ANTICIPACION_OFFSET_EP)
  );
  const [correoConfirmacion, setCorreoConfirmacion] = useState('');

  // Envío y modal confirmación
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solicitudesExitosas, setSolicitudesExitosas] = useState<EspecialPersonal[]>([]);
  const [emailResultado, setEmailResultado] = useState<EmailNotificationResult | null>(null);
  const [reintentandoCorreo, setReintentandoCorreo] = useState(false);
  const [avisoPendienteScript, setAvisoPendienteScript] = useState(false);
  const [copiadoId, setCopiadoId] = useState(false);

  // Filtros tabla historial
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [productosFiltro, setProductosFiltro] = useState<string[]>([]);
  const [dropdownProductoAbierto, setDropdownProductoAbierto] = useState(false);
  const dropdownProductoRef = useRef<HTMLDivElement | null>(null);
  const [recargandoTabla, setRecargandoTabla] = useState(false);

  // Edición de Estado (Administrador y ANALISTA GESTIÓN HUMANA)
  const [actualizandoEstadoId, setActualizandoEstadoId] = useState<string | null>(null);
  const [enviandoRespuestaId, setEnviandoRespuestaId] = useState<string | null>(null);
  const [feedbackEstado, setFeedbackEstado] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const handleCambiarEstadoSolicitud = async (
    s: EspecialPersonal,
    nuevoEstado: EstadoEspecialPersonal
  ) => {
    if (!onActualizarEstadoEspecialPersonal) return;
    const estadoAnterior = s.estado || ESTADO_INICIAL_EP;
    if (nuevoEstado === estadoAnterior) return;

    setActualizandoEstadoId(s.id);
    setFeedbackEstado(null);
    try {
      const res = await onActualizarEstadoEspecialPersonal(s.id, nuevoEstado);
      if (res.success) {
        setFeedbackEstado({
          type: res.pendingAppsScriptUpdate ? 'warning' : 'success',
          text: res.pendingAppsScriptUpdate
            ? `Estado de ${s.id} cambiado a "${nuevoEstado}" en respaldo local. Actualice Google Apps Script e implemente una Nueva versión para reflejarlo en Google Sheets.`
            : `Estado de ${s.id} actualizado a "${nuevoEstado}" en Google Sheets.`,
        });
      } else {
        setFeedbackEstado({
          type: 'error',
          text: res.error || `No se pudo actualizar el estado de ${s.id}.`,
        });
      }
    } finally {
      setActualizandoEstadoId(null);
    }
  };

  const handleEnviarRespuestaCorreo = async (
    s: EspecialPersonal,
    estadoActual: EstadoEspecialPersonal
  ) => {
    if (!s.correoConfirmacion) return;
    setEnviandoRespuestaId(s.id);
    setFeedbackEstado(null);
    try {
      const res = await notifyRespuestaEspecialPersonalApi({
        item: { ...s, estado: estadoActual },
        usuarioCodigo: sesion.codigo || '',
        usuarioCargo: sesion.cargo || '',
      });
      if (res.sent) {
        setFeedbackEstado({
          type: 'success',
          text: `Respuesta enviada a ${s.correoConfirmacion} (CC: ${CORREO_NOTIFICADO_FIJO_EP}) para ${s.id}.`,
        });
      } else {
        setFeedbackEstado({
          type: res.pendingAppsScriptUpdate ? 'warning' : 'error',
          text:
            res.error ||
            `No se pudo enviar la respuesta al correo ${s.correoConfirmacion}.`,
        });
      }
    } finally {
      setEnviandoRespuestaId(null);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        'sfo_colores_especiales_personal_custom',
        JSON.stringify(coloresPersonalizados)
      );
    } catch {}
  }, [coloresPersonalizados]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'sfo_motivos_especiales_personal_custom',
        JSON.stringify(motivosPersonalizados)
      );
    } catch {}
  }, [motivosPersonalizados]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownProductoRef.current &&
        !dropdownProductoRef.current.contains(e.target as Node)
      ) {
        setDropdownProductoAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Datos del colaborador tomados de la hoja Maestro para la persona que inicia sesión
  const colaboradorSesion = useMemo(() => {
    const cod = String(sesion?.codigo || '').trim().toUpperCase();
    const encontrado = maestro.find(
      (t) => String(t.codigo || '').trim().toUpperCase() === cod
    );
    return {
      codigo: encontrado?.codigo || sesion.codigo,
      cedula: normalizarDigitos(encontrado?.cedula || sesion.cedula),
      nombre: encontrado?.nombre || sesion.nombre,
      sede: encontrado?.sede || sesion.sede,
      cargo: encontrado?.cargo || sesion.cargo,
    };
  }, [maestro, sesion]);

  const cedulaEfectiva = colaboradorSesion.cedula || normalizarDigitos(cedulaManual);
  const nombreBeneficiario = colaboradorSesion.nombre || '';
  const sedeBeneficiario = colaboradorSesion.sede || '';

  const solicitudesVisiblesUsuario = useMemo(() => {
    if (verTodosRegistros) return solicitudesEspecialesPersonal;
    return solicitudesEspecialesPersonal.filter((s) =>
      esSolicitudDelUsuario(s, colaboradorSesion.nombre || sesion.nombre, cedulaEfectiva)
    );
  }, [
    verTodosRegistros,
    solicitudesEspecialesPersonal,
    colaboradorSesion.nombre,
    sesion.nombre,
    cedulaEfectiva,
  ]);

  const solicitudesPendientesUsuario = useMemo(() => {
    return solicitudesEspecialesPersonal.filter(
      (s) =>
        esEstadoPendienteAprobacion(s.estado) &&
        esSolicitudDelUsuario(s, colaboradorSesion.nombre || sesion.nombre, cedulaEfectiva)
    );
  }, [solicitudesEspecialesPersonal, colaboradorSesion.nombre, sesion.nombre, cedulaEfectiva]);

  const tieneSolicitudPendiente = solicitudesPendientesUsuario.length > 0;

  const anoActual = useMemo(() => fechaSolicitud.slice(0, 4), [fechaSolicitud]);

  const solicitudesAnoActualUsuario = useMemo(() => {
    const claves = new Set<string>();
    for (const s of solicitudesEspecialesPersonal) {
      if (esEstadoNoAprobado(s.estado)) continue;
      if (obtenerAnoSolicitudEP(s) !== anoActual) continue;
      if (!esSolicitudDelUsuario(s, colaboradorSesion.nombre || sesion.nombre, cedulaEfectiva)) {
        continue;
      }
      claves.add(claveOcasionSolicitudEP(s));
    }
    return claves.size;
  }, [
    solicitudesEspecialesPersonal,
    anoActual,
    colaboradorSesion.nombre,
    sesion.nombre,
    cedulaEfectiva,
  ]);

  const excedioLimiteAnual = solicitudesAnoActualUsuario >= MAX_SOLICITUDES_POR_ANO_EP;

  const semanaCalculada = useMemo(() => {
    return fechaEntrega ? getISOWeekNumber(fechaEntrega) : getISOWeekNumber(fechaMinimaEntrega);
  }, [fechaEntrega, fechaMinimaEntrega]);

  const siguienteNumeroId = useMemo(() => {
    const year = new Date().getFullYear();
    let maxNum = 0;
    for (const s of solicitudesEspecialesPersonal) {
      const m = String(s.id || '').match(/^SEP-(\d{4})-(\d+)$/i);
      if (m && Number(m[1]) === year) {
        maxNum = Math.max(maxNum, Number(m[2]));
      }
    }
    return Math.max(maxNum + 1, solicitudesEspecialesPersonal.length + 1);
  }, [solicitudesEspecialesPersonal]);

  const productosSeleccionadosOrdenados = useMemo(
    () => PRODUCTOS_EP.filter((p) => Object.prototype.hasOwnProperty.call(productosCantidades, p)),
    [productosCantidades]
  );

  const soloRosaRoja =
    productosSeleccionadosOrdenados.length === 1 &&
    productosSeleccionadosOrdenados[0] === 'Rosa (Roja)';

  const totalRamosSeleccionados = useMemo(() => {
    return productosSeleccionadosOrdenados.reduce((acc, prod) => {
      const n = Number(productosCantidades[prod]);
      return acc + (!Number.isNaN(n) && n > 0 ? Math.floor(n) : 0);
    }, 0);
  }, [productosSeleccionadosOrdenados, productosCantidades]);

  const opcionesColorVisibles = useMemo(() => {
    const mapa = new Map<string, string>();
    const agregar = (val?: string) => {
      const partes = String(val || '').split(/[,;]+/);
      for (const parte of partes) {
        const limpio = parte.trim();
        if (!limpio) continue;
        const clave = limpio.toLowerCase();
        if (!mapa.has(clave)) mapa.set(clave, limpio);
      }
    };
    COLORES_BASE_EP.forEach(agregar);
    coloresPersonalizados.forEach(agregar);
    solicitudesEspecialesPersonal.forEach((s) => agregar(s.color));
    return Array.from(mapa.values());
  }, [coloresPersonalizados, solicitudesEspecialesPersonal]);

  const coloresFinales = useMemo(() => {
    const mapa = new Map<string, string>();
    const agregar = (val?: string) => {
      const partes = String(val || '').split(/[,;]+/);
      for (const parte of partes) {
        const limpio = parte.trim();
        if (!limpio) continue;
        const clave = limpio.toLowerCase();
        if (!mapa.has(clave)) mapa.set(clave, limpio);
      }
    };
    coloresSeleccionados.forEach(agregar);
    if (mostrandoInputColor && nuevoColorInput.trim()) {
      agregar(nuevoColorInput);
    }
    return Array.from(mapa.values());
  }, [coloresSeleccionados, mostrandoInputColor, nuevoColorInput]);

  const colorFinal = coloresFinales.join(', ');

  useEffect(() => {
    if (soloRosaRoja) {
      setErrores((prev) => {
        if (!prev.color) return prev;
        const next = { ...prev };
        delete next.color;
        return next;
      });
    }
  }, [soloRosaRoja]);

  const opcionesMotivoVisibles = useMemo(() => {
    const set = new Set<string>([...MOTIVOS_BASE_EP, ...motivosPersonalizados]);
    return Array.from(set);
  }, [motivosPersonalizados]);

  const motivoFinal =
    mostrandoInputMotivo && nuevoMotivoInput.trim()
      ? nuevoMotivoInput.trim()
      : motivoSeleccionado.trim();

  const rosaColorActivo = Object.prototype.hasOwnProperty.call(productosCantidades, 'Rosa (Color)');
  const rosaRojaActivo = Object.prototype.hasOwnProperty.call(productosCantidades, 'Rosa (Roja)');
  const bouquetActivo = Object.prototype.hasOwnProperty.call(productosCantidades, 'Bouquet');
  const rosaTieneSeleccion = rosaColorActivo || rosaRojaActivo || bouquetActivo;
  const rosaExpandido = rosaAbierto || rosaTieneSeleccion;

  const toggleRosaPrincipal = () => {
    if (rosaExpandido) {
      setRosaAbierto(false);
      setProductosCantidades((prev) => {
        const next = { ...prev };
        delete next['Rosa (Color)'];
        delete next['Rosa (Roja)'];
        delete next['Bouquet'];
        return next;
      });
      setErrores((prev) => {
        const next = { ...prev };
        delete next.producto;
        delete next.cantidad;
        delete next['cant_Rosa (Color)'];
        delete next['cant_Rosa (Roja)'];
        delete next['cant_Bouquet'];
        return next;
      });
    } else {
      setRosaAbierto(true);
      setErrores((prev) => {
        const next = { ...prev };
        delete next.producto;
        return next;
      });
    }
  };

  const toggleProducto = (prod: string) => {
    setProductosCantidades((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, prod)) {
        delete next[prod];
      } else {
        next[prod] = '1';
      }
      return next;
    });
    setErrores((prev) => {
      const next = { ...prev };
      delete next.producto;
      delete next.cantidad;
      delete next[`cant_${prod}`];
      return next;
    });
  };

  const cambiarCantidadProducto = (prod: string, valor: string) => {
    setProductosCantidades((prev) => ({
      ...prev,
      [prod]: valor.replace(/\D/g, ''),
    }));
    setErrores((prev) => {
      const next = { ...prev };
      delete next.cantidad;
      delete next[`cant_${prod}`];
      return next;
    });
  };

  const toggleColor = (color: string) => {
    const clave = color.trim().toLowerCase();
    setColoresSeleccionados((prev) => {
      const existe = prev.some((c) => c.trim().toLowerCase() === clave);
      if (existe) {
        return prev.filter((c) => c.trim().toLowerCase() !== clave);
      }
      return [...prev, color];
    });
    setErrores((prev) => {
      const next = { ...prev };
      delete next.color;
      return next;
    });
  };

  const handleAgregarColorPersonalizado = () => {
    const partes = nuevoColorInput
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (partes.length === 0) return;

    const nuevosPersonalizados: string[] = [];
    for (const limpio of partes) {
      const existeEnOpciones =
        opcionesColorVisibles.some((c) => c.toLowerCase() === limpio.toLowerCase()) ||
        nuevosPersonalizados.some((c) => c.toLowerCase() === limpio.toLowerCase());
      if (!existeEnOpciones) {
        nuevosPersonalizados.push(limpio);
      }
    }
    if (nuevosPersonalizados.length > 0) {
      setColoresPersonalizados((prev) => [...prev, ...nuevosPersonalizados]);
    }

    setColoresSeleccionados((prev) => {
      const next = [...prev];
      for (const limpio of partes) {
        if (!next.some((c) => c.trim().toLowerCase() === limpio.toLowerCase())) {
          next.push(limpio);
        }
      }
      return next;
    });
    setNuevoColorInput('');
    setMostrandoInputColor(false);
    setErrores((prev) => {
      const next = { ...prev };
      delete next.color;
      return next;
    });
  };

  const handleAgregarMotivoPersonalizado = () => {
    const limpio = nuevoMotivoInput.trim();
    if (!limpio) return;
    if (!opcionesMotivoVisibles.some((m) => m.toLowerCase() === limpio.toLowerCase())) {
      setMotivosPersonalizados((prev) => [...prev, limpio]);
    }
    setMotivoSeleccionado(limpio);
    setNuevoMotivoInput('');
    setMostrandoInputMotivo(false);
    setErrores((prev) => {
      const next = { ...prev };
      delete next.motivo;
      return next;
    });
  };

  const validarFormulario = (): boolean => {
    const errs: Record<string, string> = {};

    if (!cedulaEfectiva) {
      errs.cedula =
        'No se encontró su cédula en el Maestro. Presione "Sincronizar Maestro" o digite su cédula.';
    }

    if (productosSeleccionadosOrdenados.length === 0) {
      errs.producto = rosaAbierto
        ? 'Seleccione Rosa (Color), Rosa (Roja) y/o Bouquet, o elija otro producto.'
        : 'Seleccione al menos un producto (Rosa, Clavel, Alstroemeria o Gypso).';
    } else {
      for (const prod of productosSeleccionadosOrdenados) {
        const cantNum = Number(productosCantidades[prod]);
        if (!productosCantidades[prod] || Number.isNaN(cantNum) || cantNum < 1) {
          errs[`cant_${prod}`] = `Ingrese una cantidad válida (mínimo 1) para ${prod}.`;
          errs.cantidad = 'Revise las cantidades ingresadas por producto.';
        }
      }
    }

    if (!soloRosaRoja && !colorFinal) {
      errs.color = 'Especifique el color que requiere.';
    }

    if (!motivoFinal) {
      errs.motivo = 'Seleccione o agregue el motivo de la solicitud.';
    }

    if (!fechaEntrega) {
      errs.fechaEntrega = 'Ingrese la fecha en la que requiere la flor.';
    } else if (fechaEntrega < fechaMinimaEntrega) {
      errs.fechaEntrega = `La entrega debe solicitarse con 10 días de anticipación (a partir del ${formatShortDate(
        fechaMinimaEntrega
      )}).`;
    }

    const parsedCorreo = normalizarCorreoIndividual(correoConfirmacion);
    if (!parsedCorreo.correo) {
      errs.correoConfirmacion =
        'Ingrese un Correo de confirmación para recibir la respuesta de Solicitud.';
    } else if (!parsedCorreo.valido) {
      errs.correoConfirmacion = parsedCorreo.tieneMultiples
        ? 'Ingrese un único correo electrónico personal válido.'
        : 'El correo electrónico ingresado no tiene un formato válido.';
    }

    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const limpiarFormulario = () => {
    setCedulaManual('');
    setProductosCantidades({});
    setRosaAbierto(false);
    setColoresSeleccionados([]);
    setMostrandoInputColor(false);
    setNuevoColorInput('');
    setMotivoSeleccionado('');
    setMostrandoInputMotivo(false);
    setNuevoMotivoInput('');
    setFechaEntrega(fechaMinimaEntrega);
    setCorreoConfirmacion('');
    setErrores({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tieneSolicitudPendiente) {
      setErrores({
        general:
          'Ya tiene una solicitud en estado Pendiente Aprobación. No puede realizar una solicitud adicional hasta que sea aprobada o gestionada.',
      });
      return;
    }
    if (excedioLimiteAnual) {
      setErrores({
        general: `Ha alcanzado el límite máximo de ${MAX_SOLICITUDES_POR_ANO_EP} solicitudes al año (${anoActual}) en Especiales Personal.`,
      });
      return;
    }
    if (!validarFormulario() || !nombreBeneficiario || !sedeBeneficiario) return;

    setIsSubmitting(true);
    setErrores({});

    try {
      // Si había colores nuevos escritos sin haber presionado "Agregar", guardarlos
      if (!soloRosaRoja && mostrandoInputColor && nuevoColorInput.trim()) {
        const nuevos = nuevoColorInput
          .split(/[,;]+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .filter(
            (cLimpio) =>
              !opcionesColorVisibles.some((c) => c.toLowerCase() === cLimpio.toLowerCase())
          );
        if (nuevos.length > 0) {
          setColoresPersonalizados((prev) => [...prev, ...nuevos]);
        }
      }

      // Si había un motivo nuevo escrito sin haber presionado "Agregar", guardarlo
      if (mostrandoInputMotivo && nuevoMotivoInput.trim()) {
        const mLimpio = nuevoMotivoInput.trim();
        if (!opcionesMotivoVisibles.some((m) => m.toLowerCase() === mLimpio.toLowerCase())) {
          setMotivosPersonalizados((prev) => [...prev, mLimpio]);
        }
      }

      const correoPersonal = normalizarCorreoIndividual(correoConfirmacion).correo;
      const year = new Date().getFullYear();
      const semanaStr = String(semanaCalculada);
      const colorAGuardar = soloRosaRoja ? '' : colorFinal;

      const listaSolicitudes: EspecialPersonal[] = productosSeleccionadosOrdenados.map((prod, idx) => ({
        id: `SEP-${year}-${String(siguienteNumeroId + idx).padStart(3, '0')}`,
        fechaSolicitud,
        cedula: cedulaEfectiva,
        nombre: nombreBeneficiario,
        sede: sedeBeneficiario,
        producto: prod,
        color: colorAGuardar,
        cantidad: Math.max(1, Math.floor(Number(productosCantidades[prod]) || 1)),
        motivo: motivoFinal,
        semana: semanaStr,
        fechaEntrega,
        correoConfirmacion: correoPersonal,
        observacion: '',
        fotoCarta: '',
        notificado: CORREO_NOTIFICADO_FIJO_EP,
        estado: ESTADO_INICIAL_EP,
        creadoEn: Date.now() + idx,
      }));

      const res = await onGuardarEspecialPersonal(
        listaSolicitudes,
        CORREO_NOTIFICADO_FIJO_EP,
        null
      );

      if (res.success && (res.solicitudes?.length || res.solicitud)) {
        const guardadas =
          res.solicitudes && res.solicitudes.length > 0
            ? res.solicitudes
            : res.solicitud
            ? [res.solicitud]
            : listaSolicitudes;
        setSolicitudesExitosas(guardadas);
        setEmailResultado(res.emailNotification || null);
        setAvisoPendienteScript(
          !!res.pendingAppsScriptUpdate || !!res.needsAppsScriptUpdate
        );
        limpiarFormulario();
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.65 },
            colors: ['#0a2958', '#E60000', '#10b981'],
          });
        } catch {}
      } else {
        setErrores({
          general: res.error || 'No se pudo guardar en la hoja Especiales Personal.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReintentarCorreo = async () => {
    if (solicitudesExitosas.length === 0) return;
    setReintentandoCorreo(true);
    try {
      const resMail = await retryEmailEspecialesPersonalApi(
        solicitudesExitosas,
        CORREO_NOTIFICADO_FIJO_EP
      );
      setEmailResultado(resMail);
    } finally {
      setReintentandoCorreo(false);
    }
  };

  // Opciones dinámicas de filtros tabla
  const semanasDisponiblesTabla = useMemo(() => {
    const set = new Set<number>();
    for (const s of solicitudesVisiblesUsuario) {
      const num = obtenerNumSemanaEP(s);
      if (num > 0) set.add(num);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [solicitudesVisiblesUsuario]);

  const productosDisponiblesTabla = useMemo(() => {
    const set = new Set<string>(PRODUCTOS_EP);
    for (const s of solicitudesVisiblesUsuario) {
      const p = String(s.producto || '').trim();
      if (p) set.add(p);
    }
    return Array.from(set);
  }, [solicitudesVisiblesUsuario]);

  const toggleProductoFiltro = (prod: string) => {
    setProductosFiltro((prev) =>
      prev.includes(prod) ? prev.filter((p) => p !== prod) : [...prev, prod]
    );
  };

  const solicitudesFiltradas = useMemo(() => {
    const q = busquedaTabla.toLowerCase().trim();
    return solicitudesVisiblesUsuario.filter((s) => {
      if (filtroSemana !== 'todas') {
        const sem = obtenerNumSemanaEP(s);
        if (String(sem) !== filtroSemana) return false;
      }
      if (productosFiltro.length > 0) {
        const prod = String(s.producto || '').trim().toLowerCase();
        const coincideProd = productosFiltro.some((p) => p.toLowerCase() === prod);
        if (!coincideProd) return false;
      }
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        (s.usuario || '').toLowerCase().includes(q) ||
        (s.cedula || '').toLowerCase().includes(q) ||
        s.nombre.toLowerCase().includes(q) ||
        s.sede.toLowerCase().includes(q) ||
        s.producto.toLowerCase().includes(q) ||
        (s.color || '').toLowerCase().includes(q) ||
        s.motivo.toLowerCase().includes(q) ||
        (s.correoConfirmacion || '').toLowerCase().includes(q) ||
        (s.estado || '').toLowerCase().includes(q) ||
        (s.notificado || '').toLowerCase().includes(q)
      );
    });
  }, [solicitudesVisiblesUsuario, busquedaTabla, filtroSemana, productosFiltro]);

  const totalRamosFiltrados = useMemo(
    () => solicitudesFiltradas.reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0),
    [solicitudesFiltradas]
  );

  const hayFiltrosTablaActivos =
    Boolean(busquedaTabla.trim()) || filtroSemana !== 'todas' || productosFiltro.length > 0;

  const limpiarFiltrosTabla = () => {
    setBusquedaTabla('');
    setFiltroSemana('todas');
    setProductosFiltro([]);
  };

  const exportarExcel = () => {
    const rows = solicitudesFiltradas.map((s) => ({
      Id: s.id,
      'Fecha Solicitud': s.fechaSolicitud,
      Cédula: s.cedula,
      Nombre: s.nombre,
      Sede: s.sede,
      Producto: s.producto,
      Color: s.color || '',
      Cantidad: s.cantidad,
      Motivo: s.motivo,
      Semana: s.semana,
      'Fecha Entrega': s.fechaEntrega,
      'Correo de confirmación': s.correoConfirmacion || '',
      Estado: s.estado || ESTADO_INICIAL_EP,
      Notificado: s.notificado || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Especiales Personal');
    XLSX.writeFile(wb, `Especiales_Personal_${getTodayString()}.xlsx`);
  };

  const primeraExitosa = solicitudesExitosas[0];
  const idsExitososTexto = solicitudesExitosas.map((s) => s.id).join(', ');
  const totalExitosaRamos = solicitudesExitosas.reduce(
    (acc, s) => acc + (Number(s.cantidad) || 1),
    0
  );

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Modal de Confirmación */}
      {primeraExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="w-14 h-14 bg-[#0a2958]/10 text-[#0a2958] rounded-full flex items-center justify-center mx-auto ring-8 ring-[#0a2958]/5">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-[#0a2958]">¡Registro Exitoso!</h3>
              <p className="text-xs text-slate-500 mt-1">
                {solicitudesExitosas.length > 1
                  ? `Se registraron ${solicitudesExitosas.length} productos por separado en `
                  : 'La solicitud fue registrada en '}
                <strong>Especiales Personal</strong>.
              </p>
            </div>

            {avisoPendienteScript && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Guardado en respaldo local. Para escribir en la hoja <strong>Especiales Personal</strong>, el administrador debe actualizar el Apps Script e implementar una <strong>Nueva versión</strong>.
                </span>
              </div>
            )}

            {emailResultado?.requested && (
              <div
                className={`p-3 rounded-xl border text-xs text-left space-y-2 ${
                  emailResultado.sent
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {emailResultado.sent ? (
                    <Mail className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    {emailResultado.sent ? (
                      <span>
                        Notificación enviada a <strong className="break-all">{emailResultado.to}</strong>.
                      </span>
                    ) : (
                      <span>
                        <strong>Notificación pendiente para {emailResultado.to}:</strong>{' '}
                        {emailResultado.error || 'No se pudo enviar el correo automáticamente.'}
                      </span>
                    )}
                  </div>
                </div>
                {!emailResultado.sent && (
                  <button
                    type="button"
                    onClick={handleReintentarCorreo}
                    disabled={reintentandoCorreo}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#0a2958] hover:bg-[#0d346e] text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reintentandoCorreo ? 'animate-spin' : ''}`} />
                    <span>{reintentandoCorreo ? 'Reintentando envío…' : 'Reintentar envío de correo'}</span>
                  </button>
                )}
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold shrink-0">
                  {solicitudesExitosas.length > 1 ? 'Ids:' : 'Id:'}
                </span>
                <div className="flex items-center gap-1.5 justify-end flex-wrap">
                  <span className="font-mono font-extrabold text-[#0a2958] text-sm text-right">
                    {idsExitososTexto}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(idsExitososTexto);
                      setCopiadoId(true);
                      setTimeout(() => setCopiadoId(false), 1800);
                    }}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                    title="Copiar Id(s)"
                  >
                    {copiadoId ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha Solicitud:</span>
                <span className="font-semibold text-slate-900">{primeraExitosa.fechaSolicitud}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cédula Beneficiario:</span>
                <span className="font-mono font-bold text-[#0a2958]">{primeraExitosa.cedula}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre:</span>
                <span className="font-bold text-slate-900 text-right">{primeraExitosa.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sede:</span>
                <span className="font-bold text-slate-900">{primeraExitosa.sede}</span>
              </div>

              {solicitudesExitosas.length === 1 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Producto:</span>
                    <span className="font-bold text-slate-900">{primeraExitosa.producto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cantidad:</span>
                    <span className="font-bold font-mono tabular-nums text-[#0a2958]">
                      {primeraExitosa.cantidad} ramos
                    </span>
                  </div>
                </>
              ) : (
                <div className="pt-1 pb-1">
                  <span className="text-slate-500 block mb-1.5 font-semibold">
                    Detalle por producto (un registro por producto):
                  </span>
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold">
                        <tr>
                          <th className="py-1.5 px-2.5">Id</th>
                          <th className="py-1.5 px-2.5">Producto</th>
                          <th className="py-1.5 px-2.5 text-right">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {solicitudesExitosas.map((item) => (
                          <tr key={item.id}>
                            <td className="py-1.5 px-2.5 font-mono font-bold text-[#0a2958]">
                              {item.id}
                            </td>
                            <td className="py-1.5 px-2.5 font-semibold text-slate-800">
                              {item.producto}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-[#0a2958]">
                              {item.cantidad}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-extrabold text-[#0a2958]">
                        <tr>
                          <td colSpan={2} className="py-1.5 px-2.5">
                            Total ramos ({solicitudesExitosas.length} registros)
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono tabular-nums">
                            {totalExitosaRamos}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Color:</span>
                <span className="font-bold text-[#0a2958] text-right">
                  {primeraExitosa.color || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Motivo:</span>
                <span className="font-bold text-slate-900">{primeraExitosa.motivo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Semana:</span>
                <span className="font-bold text-[#E60000]">
                  Semana {primeraExitosa.semana || getISOWeekNumber(primeraExitosa.fechaEntrega)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha Entrega:</span>
                <span className="font-semibold text-slate-900">
                  {formatDateSpanish(primeraExitosa.fechaEntrega)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Correo de confirmación:</span>
                <span className="font-semibold text-[#0a2958] break-all text-right">
                  {primeraExitosa.correoConfirmacion || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-slate-500 shrink-0">Estado:</span>
                <span className="font-extrabold text-amber-700 text-right">
                  {primeraExitosa.estado || ESTADO_INICIAL_EP}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Notificado:</span>
                <span className="font-bold text-emerald-700 break-all text-right">
                  {primeraExitosa.notificado || CORREO_NOTIFICADO_FIJO_EP}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => {
                  setSolicitudesExitosas([]);
                  setEmailResultado(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nueva Solicitud
              </button>
              <button
                type="button"
                onClick={() => {
                  setSolicitudesExitosas([]);
                  setEmailResultado(null);
                  onCerrarSesion?.();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#E60000]" /> Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario Principal ESPECIALES PERSONAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2958]/10 flex items-center justify-center">
              <FilePlus2 className="w-5 h-5 text-[#E60000]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0a2958] uppercase tracking-wide">
                ESPECIALES PERSONAL
              </h2>
              <p className="text-[11px] text-slate-500">
                Solicitudes especiales por trabajador (máximo {MAX_SOLICITUDES_POR_ANO_EP} solicitudes al año)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
            <Calendar className="w-4 h-4 text-[#0a2958] shrink-0" />
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
              Fecha Solicitud:
            </span>
            <input
              type="date"
              value={fechaSolicitud}
              readOnly
              tabIndex={-1}
              className="text-xs font-extrabold text-[#0a2958] bg-transparent outline-hidden pointer-events-none select-none"
            />
          </div>
        </div>

        {!sheetsSupported || needsAppsScriptUpdate ? (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              La hoja <strong>Especiales Personal</strong> aún no está activa en el webhook de Google Apps Script
              {especialesPersonalSheetActual ? ` (${especialesPersonalSheetActual})` : ''}. Para sincronizar directamente con Google Drive, el administrador debe copiar el código actualizado desde <strong>Administración → Google Drive</strong>, ejecutar <code>autorizarEnvioCorreos</code> e implementar una <strong>Nueva versión</strong>.
            </div>
          </div>
        ) : !emailSupported ? (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              Para activar el envío automático de correos desde Google Sheets, el administrador debe implementar la versión actualizada del script y autorizar permisos.
            </div>
          </div>
        ) : null}

        {!tieneSolicitudPendiente && !excedioLimiteAnual && errores.general && (
          <div className="mx-6 mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errores.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {tieneSolicitudPendiente ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#E60000] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold text-[#E60000]">
                  Solicitud en curso en estado Pendiente Aprobación
                </p>
                <p className="font-medium text-rose-900">
                  Ya tiene{' '}
                  {solicitudesPendientesUsuario.length === 1
                    ? 'una solicitud registrada'
                    : `${solicitudesPendientesUsuario.length} registros en curso`}{' '}
                  (
                  <strong className="font-mono">
                    {solicitudesPendientesUsuario.map((s) => s.id).join(', ')}
                  </strong>
                  ). No podrá realizar ninguna solicitud adicional en este formulario mientras se encuentre en estado{' '}
                  <strong>Pendiente Aprobación</strong>. Puede consultar el estado de su solicitud abajo en{' '}
                  <strong>Registros en Especiales Personal</strong>.
                </p>
              </div>
            </div>
          ) : excedioLimiteAnual ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#E60000] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold text-[#E60000]">
                  Límite anual alcanzado (máximo {MAX_SOLICITUDES_POR_ANO_EP} veces al año)
                </p>
                <p className="font-medium text-rose-900">
                  Ya realizó{' '}
                  <strong>
                    {solicitudesAnoActualUsuario} de {MAX_SOLICITUDES_POR_ANO_EP}
                  </strong>{' '}
                  solicitudes permitidas en el año <strong>{anoActual}</strong> en Especiales Personal. No es posible registrar más solicitudes este año.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Nota de verificación, autorización y límite anual */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-medium">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Al realizar esta solicitud, queda sujeta a verificación, disponibilidad y autorización por parte de la dirección de Poscosecha. Máximo {MAX_SOLICITUDES_POR_ANO_EP} solicitudes al año por persona.
                  </span>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-[11px] font-extrabold text-[#0a2958] whitespace-nowrap shrink-0">
                  Año {anoActual}: {solicitudesAnoActualUsuario} de {MAX_SOLICITUDES_POR_ANO_EP} usadas
                </span>
              </div>

              {/* 1. DATOS DEL COLABORADOR (DESDE HOJA MAESTRO DE LA SESIÓN) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  1. DATOS DEL COLABORADOR
                </h3>
              </div>

              {onRecargarMaestro && !colaboradorSesion.cedula && (
                <button
                  type="button"
                  disabled={sincronizandoMaestro}
                  onClick={async () => {
                    setSincronizandoMaestro(true);
                    try {
                      await onRecargarMaestro();
                    } finally {
                      setSincronizandoMaestro(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#0a2958]/20 bg-[#0a2958]/5 hover:bg-[#0a2958]/10 text-[#0a2958] text-[11px] font-bold cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${sincronizandoMaestro ? 'animate-spin' : ''}`} />
                  <span>Sincronizar Maestro</span>
                </button>
              )}
            </div>

            {!colaboradorSesion.cedula && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Aún no aparece su número de <strong>Cédula</strong> en el Maestro local. Puede presionar <strong>Sincronizar Maestro</strong> o digitar su cédula manualmente.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="ep-cedula"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Cédula <span className="text-[#E60000]">*</span>
                </label>
                {colaboradorSesion.cedula ? (
                  <input
                    id="ep-cedula"
                    type="text"
                    value={colaboradorSesion.cedula}
                    readOnly
                    tabIndex={-1}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-[#0a2958] outline-hidden"
                  />
                ) : (
                  <input
                    id="ep-cedula"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cedulaManual}
                    onChange={(e) => {
                      const soloDigitos = e.target.value.replace(/\D/g, '');
                      setCedulaManual(soloDigitos);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.cedula;
                        return next;
                      });
                    }}
                    placeholder="Digite su número de cédula"
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-mono font-bold outline-hidden ${
                      errores.cedula
                        ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                        : 'border-slate-300 focus:border-[#0a2958] text-slate-900'
                    }`}
                  />
                )}
                {errores.cedula && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.cedula}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="ep-nombre"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Nombre
                </label>
                <input
                  id="ep-nombre"
                  type="text"
                  value={nombreBeneficiario}
                  readOnly
                  tabIndex={-1}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="ep-sede"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Sede
                </label>
                <input
                  id="ep-sede"
                  type="text"
                  value={sedeBeneficiario}
                  readOnly
                  tabIndex={-1}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-bold text-[#0a2958] outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* 2. PRODUCTO Y CANTIDAD */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0a2958]" />
                <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                  2. PRODUCTO Y CANTIDAD (Ramos)
                </h3>
              </div>
              {productosSeleccionadosOrdenados.length > 0 && (
                <span className="text-[11px] font-bold text-[#0a2958] bg-[#0a2958]/10 px-2.5 py-1 rounded-lg">
                  {productosSeleccionadosOrdenados.length}{' '}
                  {productosSeleccionadosOrdenados.length === 1
                    ? 'producto (1 registro)'
                    : 'productos (se guardan por separado)'}{' '}
                  · Total: <strong className="font-mono tabular-nums">{totalRamosSeleccionados}</strong>
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Producto <span className="text-[#E60000]">*</span>{' '}
                <span className="text-[11px] font-normal text-slate-500">
                  (Puede seleccionar varios productos; cada uno se guarda por separado)
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
                {/* Tarjeta Rosa con subopciones Rosa (Color), Rosa (Roja) y Bouquet */}
                <div
                  className={`rounded-xl border p-3 transition ${
                    rosaExpandido
                      ? 'border-[#0a2958] bg-[#0a2958]/[0.04] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-[#0a2958]/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={toggleRosaPrincipal}
                    aria-pressed={rosaExpandido}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span
                      className={`text-xs font-extrabold ${
                        rosaExpandido ? 'text-[#0a2958]' : 'text-slate-700'
                      }`}
                    >
                      Rosa
                    </span>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                        rosaExpandido
                          ? 'bg-[#0a2958] border-[#0a2958] text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {rosaExpandido && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {rosaExpandido && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2">
                      {ROSA_VARIANTES_EP.map((variante) => {
                        const activoVar = Object.prototype.hasOwnProperty.call(
                          productosCantidades,
                          variante
                        );
                        const cantValorVar = productosCantidades[variante] ?? '';
                        const errCantVar = errores[`cant_${variante}`];

                        return (
                          <div
                            key={variante}
                            className={`rounded-lg border p-2 transition ${
                              activoVar
                                ? 'border-[#0a2958]/60 bg-white shadow-2xs'
                                : 'border-slate-200 bg-white/80 hover:border-[#0a2958]/30'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleProducto(variante)}
                              aria-pressed={activoVar}
                              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                            >
                              <span
                                className={`text-[11px] font-bold ${
                                  activoVar ? 'text-[#0a2958]' : 'text-slate-700'
                                }`}
                              >
                                {variante}
                              </span>
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                                  activoVar
                                    ? 'bg-[#0a2958] border-[#0a2958] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {activoVar && <Check className="w-3 h-3" />}
                              </span>
                            </button>

                            {activoVar && (
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                  Cantidad <span className="text-[#E60000]">*</span>
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={cantValorVar}
                                  onChange={(e) => cambiarCantidadProducto(variante, e.target.value)}
                                  placeholder="Ej: 1"
                                  className={`w-full px-2.5 py-1 text-xs rounded-lg border font-mono font-bold text-[#0a2958] bg-white outline-hidden ${
                                    errCantVar
                                      ? 'border-rose-400 bg-rose-50/40'
                                      : 'border-slate-300 focus:border-[#0a2958]'
                                  }`}
                                />
                                {errCantVar && (
                                  <p className="text-[10px] text-[#E60000] font-semibold mt-1">
                                    {errCantVar}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Clavel, Alstroemeria, Gypso */}
                {PRODUCTOS_RESTO_EP.map((prod) => {
                  const activo = Object.prototype.hasOwnProperty.call(productosCantidades, prod);
                  const cantValor = productosCantidades[prod] ?? '';
                  const errCant = errores[`cant_${prod}`];

                  return (
                    <div
                      key={prod}
                      className={`rounded-xl border p-3 transition ${
                        activo
                          ? 'border-[#0a2958] bg-[#0a2958]/[0.04] shadow-xs'
                          : 'border-slate-200 bg-white hover:border-[#0a2958]/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleProducto(prod)}
                        aria-pressed={activo}
                        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <span
                          className={`text-xs font-extrabold ${
                            activo ? 'text-[#0a2958]' : 'text-slate-700'
                          }`}
                        >
                          {prod}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                            activo
                              ? 'bg-[#0a2958] border-[#0a2958] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {activo && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {activo && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Cantidad <span className="text-[#E60000]">*</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={cantValor}
                            onChange={(e) => cambiarCantidadProducto(prod, e.target.value)}
                            placeholder="Ej: 1"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono font-bold text-[#0a2958] bg-white outline-hidden ${
                              errCant
                                ? 'border-rose-400 bg-rose-50/40'
                                : 'border-slate-300 focus:border-[#0a2958]'
                            }`}
                          />
                          {errCant && (
                            <p className="text-[10px] text-[#E60000] font-semibold mt-1">
                              {errCant}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {errores.producto && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">
                  {errores.producto}
                </p>
              )}
              {errores.cantidad && !errores.producto && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">
                  {errores.cantidad}
                </p>
              )}
            </div>

            {/* Color después de Producto (selección múltiple; oculto si solo selecciona Rosa Roja) */}
            {!soloRosaRoja && (
              <div className="pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-0.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Color <span className="text-[#E60000]">*</span>
                  </label>
                  {coloresFinales.length > 0 && (
                    <span className="text-[11px] font-bold text-[#0a2958]">
                      {coloresFinales.length === 1
                        ? `1 seleccionado: ${colorFinal}`
                        : `${coloresFinales.length} seleccionados: ${colorFinal}`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 font-medium mb-2">
                  Especifique el color que requiere. Puede seleccionar uno o varios colores.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {opcionesColorVisibles.map((col) => {
                    const activo = coloresSeleccionados.some(
                      (c) => c.trim().toLowerCase() === col.trim().toLowerCase()
                    );
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => toggleColor(col)}
                        aria-pressed={activo}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer ${
                          activo
                            ? 'border-[#0a2958] bg-[#0a2958]/5 text-[#0a2958] ring-2 ring-[#0a2958]/10'
                            : errores.color
                            ? 'border-rose-300 bg-rose-50/30 text-slate-700 hover:border-[#0a2958]/50'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-[#0a2958]/50 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                            activo
                              ? 'bg-[#0a2958] border-[#0a2958] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {activo && <Check className="w-3 h-3" />}
                        </span>
                        <span>{col}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setMostrandoInputColor((prev) => !prev);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.color;
                        return next;
                      });
                    }}
                    aria-expanded={mostrandoInputColor}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                      mostrandoInputColor
                        ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/40'
                        : 'bg-slate-50 text-slate-700 border-slate-300 border-dashed hover:border-[#0a2958] hover:text-[#0a2958]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar otro</span>
                  </button>
                </div>

                {mostrandoInputColor && (
                  <div className="flex gap-2 pt-2.5 max-w-md">
                    <input
                      type="text"
                      value={nuevoColorInput}
                      onChange={(e) => {
                        setNuevoColorInput(e.target.value);
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.color;
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAgregarColorPersonalizado();
                        }
                      }}
                      placeholder="Escriba el color requerido…"
                      className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarColorPersonalizado}
                      className="px-3.5 py-2 rounded-xl bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d346e] cursor-pointer shrink-0"
                    >
                      Agregar
                    </button>
                  </div>
                )}

                {errores.color && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">{errores.color}</p>
                )}
              </div>
            )}
          </div>

          {/* 3. MOTIVO, ENTREGA Y NOTIFICACIÓN */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                3. MOTIVO, ENTREGA Y NOTIFICACIÓN
              </h3>
            </div>

            {/* Motivo (lista desplegable), Fecha de Entrega (mínimo 10 días) y Semana */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <label
                  htmlFor="select-motivo-ep"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Motivo <span className="text-[#E60000]">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <select
                      id="select-motivo-ep"
                      value={mostrandoInputMotivo ? '__AGREGAR__' : motivoSeleccionado}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__AGREGAR__') {
                          setMostrandoInputMotivo(true);
                        } else {
                          setMotivoSeleccionado(val);
                          setMostrandoInputMotivo(false);
                        }
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.motivo;
                          return next;
                        });
                      }}
                      className={`w-full appearance-none pl-3.5 pr-9 py-2.5 text-xs rounded-xl border font-bold bg-white outline-hidden cursor-pointer truncate ${
                        errores.motivo
                          ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                          : 'border-slate-300 focus:border-[#0a2958] text-slate-800'
                      }`}
                    >
                      <option value="">Seleccione un motivo…</option>
                      {opcionesMotivoVisibles.map((mot) => (
                        <option key={mot} value={mot}>
                          {mot}
                        </option>
                      ))}
                      <option value="__AGREGAR__">+ Agregar otro motivo…</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrandoInputMotivo((prev) => !prev);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.motivo;
                        return next;
                      });
                    }}
                    title="Agregar otro motivo"
                    aria-label="Agregar otro motivo"
                    className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                      mostrandoInputMotivo
                        ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/40'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-[#0a2958] hover:text-[#0a2958]'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {mostrandoInputMotivo && (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={nuevoMotivoInput}
                      onChange={(e) => {
                        setNuevoMotivoInput(e.target.value);
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.motivo;
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAgregarMotivoPersonalizado();
                        }
                      }}
                      placeholder="Escriba el nuevo motivo…"
                      className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarMotivoPersonalizado}
                      className="px-3.5 py-2 rounded-xl bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d346e] cursor-pointer shrink-0"
                    >
                      Agregar
                    </button>
                  </div>
                )}

                {errores.motivo && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.motivo}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="ep-fecha-entrega"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Fecha Entrega <span className="text-[#E60000]">*</span>
                </label>
                <input
                  id="ep-fecha-entrega"
                  type="date"
                  min={fechaMinimaEntrega}
                  value={fechaEntrega}
                  onChange={(e) => {
                    setFechaEntrega(e.target.value);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.fechaEntrega;
                      return next;
                    });
                  }}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-semibold outline-hidden ${
                    errores.fechaEntrega
                      ? 'border-rose-400 bg-rose-50/40'
                      : 'border-slate-300 focus:border-[#0a2958]'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ingrese la fecha en la que requiere la flor.{' '}
                  <span className="text-[#0a2958] font-semibold">
                    (Mín. 10 días de anticipación).
                  </span>
                </p>
                {errores.fechaEntrega && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                    {errores.fechaEntrega}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Semana
                </label>
                <div className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-extrabold text-[#E60000] flex items-center justify-between gap-2">
                  <span className="shrink-0">Semana {semanaCalculada}</span>
                  <span className="text-[11px] font-medium text-slate-500 truncate">
                    {fechaEntrega ? formatDateSpanish(fechaEntrega) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Correo de confirmación y Estado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label
                  htmlFor="ep-correo-confirmacion"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-[#0a2958]" />
                  <span>Correo de confirmación</span>
                  <span className="text-[#E60000]">*</span>
                </label>
                <input
                  id="ep-correo-confirmacion"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={correoConfirmacion}
                  onChange={(e) => {
                    setCorreoConfirmacion(e.target.value);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.correoConfirmacion;
                      return next;
                    });
                  }}
                  placeholder="Ej. micorreo@gmail.com"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-semibold outline-hidden ${
                    errores.correoConfirmacion
                      ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                      : 'border-slate-300 focus:border-[#0a2958] text-slate-800'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ingrese un Correo de confirmación para recibir la respuesta de Solicitud.
                </p>
                {errores.correoConfirmacion && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">
                    {errores.correoConfirmacion}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="ep-estado"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Estado</span>
                </label>
                <input
                  id="ep-estado"
                  type="text"
                  value={ESTADO_INICIAL_EP}
                  readOnly
                  tabIndex={-1}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-amber-200 bg-amber-50/70 font-extrabold text-amber-800 outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Toda solicitud registrada inicia en estado <strong>{ESTADO_INICIAL_EP}</strong>.
                </p>
              </div>
            </div>

            {/* Notificado (destinatario fijo para revisión y respuesta) */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Mail className="w-3.5 h-3.5 text-[#0a2958]" />
                <span>Notificado (correo electrónico)</span>
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#0a2958] break-all">
                  {CORREO_NOTIFICADO_FIJO_EP}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Destinatario fijo para aprobación y respuesta al Correo de confirmación.
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Campos con <span className="text-[#E60000] font-bold">*</span> son obligatorios.
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando…</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#E60000]" />
                  <span>
                    {productosSeleccionadosOrdenados.length > 1
                      ? `Registrar ${productosSeleccionadosOrdenados.length} productos`
                      : 'Registrar Especiales Personal'}
                  </span>
                </>
              )}
            </button>
          </div>
            </>
          )}
        </form>
      </div>

      {/* Historial: Registros en Especiales Personal */}
      {verRegistros && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#0a2958]">
                Registros en Especiales Personal ({solicitudesFiltradas.length})
              </h3>
              <p className="text-xs text-slate-500">
                {verTodosRegistros ? 'Mostrando ' : 'Sus solicitudes registradas: '}
                <strong className="text-slate-700">{solicitudesFiltradas.length}</strong> de{' '}
                <strong className="text-slate-700">{solicitudesVisiblesUsuario.length}</strong> registros · Total:{' '}
                <strong className="font-mono tabular-nums text-[#0a2958]">
                  {totalRamosFiltrados} ramos
                </strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onRecargarEspecialPersonal && (
                <button
                  type="button"
                  disabled={recargandoTabla}
                  onClick={async () => {
                    setRecargandoTabla(true);
                    try {
                      await onRecargarEspecialPersonal();
                    } finally {
                      setRecargandoTabla(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${recargandoTabla ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              )}
              <button
                type="button"
                onClick={exportarExcel}
                disabled={solicitudesFiltradas.length === 0}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Filtros: Búsqueda, Semana y Producto */}
          <div className="flex flex-col md:flex-row md:items-center gap-2.5 pt-2 border-t border-slate-100">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busquedaTabla}
                onChange={(e) => setBusquedaTabla(e.target.value)}
                placeholder="Buscar por ID, cédula, nombre, sede, motivo o correo…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-[#0a2958] outline-hidden font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="filtro-semana-ep"
                className="text-xs font-bold text-slate-500 shrink-0"
              >
                Semana:
              </label>
              <select
                id="filtro-semana-ep"
                value={filtroSemana}
                onChange={(e) => setFiltroSemana(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-[#0a2958] outline-hidden font-semibold text-slate-800 cursor-pointer"
              >
                <option value="todas">Todas las semanas</option>
                {semanasDisponiblesTabla.map((sem) => (
                  <option key={sem} value={String(sem)}>
                    Semana {sem}
                  </option>
                ))}
              </select>
            </div>

            <div ref={dropdownProductoRef} className="relative flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 shrink-0">Producto:</span>
              <button
                type="button"
                onClick={() => setDropdownProductoAbierto((prev) => !prev)}
                aria-expanded={dropdownProductoAbierto}
                className="flex-1 md:flex-initial min-w-[175px] flex items-center justify-between gap-2 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#0a2958]/40 focus:border-[#0a2958] outline-hidden font-semibold text-slate-800 cursor-pointer"
              >
                <span className="truncate">
                  {productosFiltro.length === 0
                    ? 'Todos los productos'
                    : productosFiltro.length <= 2
                    ? productosFiltro.join(', ')
                    : `${productosFiltro.length} productos`}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                    dropdownProductoAbierto ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {dropdownProductoAbierto && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-30 p-2 space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 mb-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Filtrar productos
                    </span>
                    {productosFiltro.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProductosFiltro([])}
                        className="text-[11px] font-bold text-[#E60000] hover:underline cursor-pointer"
                      >
                        Todos
                      </button>
                    )}
                  </div>
                  {productosDisponiblesTabla.map((prod) => {
                    const seleccionado = productosFiltro.includes(prod);
                    return (
                      <button
                        key={prod}
                        type="button"
                        onClick={() => toggleProductoFiltro(prod)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          seleccionado
                            ? 'bg-[#0a2958]/10 text-[#0a2958]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{prod}</span>
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            seleccionado
                              ? 'bg-[#0a2958] border-[#0a2958] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {seleccionado && <Check className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {hayFiltrosTablaActivos && (
              <button
                type="button"
                onClick={limpiarFiltrosTabla}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-[#E60000] hover:bg-rose-50 inline-flex items-center gap-1 cursor-pointer shrink-0"
                title="Limpiar filtros"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {feedbackEstado && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                feedbackEstado.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : feedbackEstado.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {feedbackEstado.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedbackEstado.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackEstado(null)}
                className="p-1 rounded-md hover:bg-black/5 cursor-pointer shrink-0"
                aria-label="Cerrar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3">Id</th>
                <th className="py-2.5 px-3">Fecha Solicitud</th>
                <th className="py-2.5 px-3">Cédula</th>
                <th className="py-2.5 px-3">Nombre</th>
                <th className="py-2.5 px-3">Sede</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3">Color</th>
                <th className="py-2.5 px-3 text-right">Cantidad</th>
                <th className="py-2.5 px-3">Motivo</th>
                <th className="py-2.5 px-3">Semana</th>
                <th className="py-2.5 px-3">Fecha Entrega</th>
                <th className="py-2.5 px-3">Correo de confirmación</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Notificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitudesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-400">
                    {solicitudesVisiblesUsuario.length === 0
                      ? 'No hay registros en Especiales Personal todavía.'
                      : 'No hay registros que coincidan con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                solicitudesFiltradas.map((s, idx) => {
                  const estadoMostrar = s.estado || ESTADO_INICIAL_EP;
                  const notificadoMostrar = s.notificado || CORREO_NOTIFICADO_FIJO_EP;
                  return (
                    <tr key={`${s.id}-${s.cedula}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0a2958] whitespace-nowrap">
                        {s.id}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaSolicitud}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0a2958]">
                        {s.cedula}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{s.nombre}</td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">{s.sede}</td>
                      <td className="py-2.5 px-3 font-semibold">{s.producto}</td>
                      <td
                        className="py-2.5 px-3 font-semibold text-[#0a2958] min-w-[120px] max-w-[220px]"
                        title={s.color || ''}
                      >
                        {s.color || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#0a2958]">
                        {s.cantidad}
                      </td>
                      <td className="py-2.5 px-3">{s.motivo}</td>
                      <td className="py-2.5 px-3 font-bold text-[#E60000]">
                        {s.semana ||
                          (s.fechaEntrega ? String(getISOWeekNumber(s.fechaEntrega)) : '—')}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaEntrega}</td>
                      <td
                        className="py-2.5 px-3 font-semibold text-[#0a2958] max-w-[200px] truncate"
                        title={s.correoConfirmacion || ''}
                      >
                        {s.correoConfirmacion || '—'}
                      </td>
                      {puedeEditarEstado && onActualizarEstadoEspecialPersonal ? (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Estado de solicitud ${s.id}`}
                              value={estadoMostrar}
                              disabled={actualizandoEstadoId === s.id}
                              onChange={(e) =>
                                handleCambiarEstadoSolicitud(
                                  s,
                                  e.target.value as EstadoEspecialPersonal
                                )
                              }
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg border outline-hidden cursor-pointer disabled:opacity-60 ${
                                esEstadoPendienteAprobacion(estadoMostrar)
                                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                                  : esEstadoNoAprobado(estadoMostrar)
                                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              }`}
                            >
                              <option value="Pendiente Aprobación">Pendiente Aprobación</option>
                              <option value="Aprobado">Aprobado</option>
                              <option value="No Aprobado">No Aprobado</option>
                            </select>
                            {actualizandoEstadoId === s.id && (
                              <RefreshCw className="w-3.5 h-3.5 text-[#0a2958] animate-spin shrink-0" />
                            )}
                            {(estadoMostrar === 'Aprobado' || estadoMostrar === 'No Aprobado') &&
                              s.correoConfirmacion && (
                                <button
                                  type="button"
                                  disabled={
                                    enviandoRespuestaId === s.id ||
                                    actualizandoEstadoId === s.id
                                  }
                                  onClick={() =>
                                    handleEnviarRespuestaCorreo(
                                      s,
                                      estadoMostrar as EstadoEspecialPersonal
                                    )
                                  }
                                  title={`Enviar respuesta al Correo de confirmación (${s.correoConfirmacion})`}
                                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-[#0a2958]/10 text-[#0a2958] transition cursor-pointer disabled:opacity-50"
                                >
                                  {enviandoRespuestaId === s.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                          </div>
                        </td>
                      ) : (
                        <td
                          className={`py-2.5 px-3 whitespace-nowrap font-bold ${
                            esEstadoPendienteAprobacion(estadoMostrar)
                              ? 'text-amber-700'
                              : esEstadoNoAprobado(estadoMostrar)
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {estadoMostrar}
                        </td>
                      )}
                      <td
                        className="py-2.5 px-3 font-semibold text-emerald-700 max-w-[220px] truncate"
                        title={notificadoMostrar}
                      >
                        {notificadoMostrar}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
};
