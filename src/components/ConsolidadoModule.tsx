import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  Calendar,
  ChevronDown,
  Check,
  Eye,
  X,
  FileText,
  Layers,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  EspecialPersonal,
  SolicitudIntExt,
  IngresoSeleccion,
  ObsequioVisitante,
  SolicitudComunidad,
} from '../types';
import { formatShortDate, getISOWeekNumber } from '../utils/dateUtils';

export type ModuloConsolidadoKey =
  | 'especiales-personal'
  | 'int-ext'
  | 'ingresos-seleccion'
  | 'obsequio-visitantes'
  | 'solicitud-comunidad';

interface ModuloMeta {
  key: ModuloConsolidadoKey;
  label: string;
  shortLabel: string;
}

const MODULOS_CONSOLIDADO: ModuloMeta[] = [
  { key: 'especiales-personal', label: 'Especiales Personal', shortLabel: 'Esp. Personal' },
  { key: 'int-ext', label: 'Especiales Empresa', shortLabel: 'Esp. Empresa' },
  { key: 'ingresos-seleccion', label: 'Ingresos Personal', shortLabel: 'Ingresos' },
  { key: 'obsequio-visitantes', label: 'Obsequio Visitantes', shortLabel: 'Visitantes' },
  { key: 'solicitud-comunidad', label: 'Solicitud Comunidad', shortLabel: 'Comunidad' },
];

const PRODUCTOS_BASE = [
  'Rosa',
  'Rosa (Roja)',
  'Rosa (Color)',
  'Bouquet',
  'Alstroemeria',
  'Clavel',
] as const;

interface ConsolidadoItem {
  uid: string;
  id: string;
  moduloKey: ModuloConsolidadoKey;
  moduloLabel: string;
  fechaSolicitud: string;
  fechaEntrega: string;
  horaEntrega: string;
  semanaNum: number;
  semanaLabel: string;
  sede: string;
  solicitante: string;
  codigoOCedula: string;
  detalle: string;
  productoRaw: string;
  productoNorm: string;
  cantidad: number;
  motivo: string;
  observacion: string;
  estadoONotificado: string;
  fotoCarta: string;
  ordenTimestamp: number;
}

interface ConsolidadoModuleProps {
  solicitudesEspecialesPersonal: EspecialPersonal[];
  solicitudesIntExt: SolicitudIntExt[];
  ingresosSeleccion: IngresoSeleccion[];
  obsequioVisitantes: ObsequioVisitante[];
  solicitudesComunidad: SolicitudComunidad[];
  onRecargarConsolidado?: () => Promise<void>;
}

function normalizarProductoConsolidado(raw: string): string {
  const limpio = String(raw || '').trim();
  if (!limpio) return 'Sin especificar';
  const lower = limpio.toLowerCase();
  if (lower.includes('bouquet')) return 'Bouquet';
  if (lower.includes('alstroemeria')) return 'Alstroemeria';
  if (lower.includes('clavel')) return 'Clavel';
  if (lower.includes('rosa')) {
    if (lower.includes('color')) return 'Rosa (Color)';
    if (lower.includes('roja') || lower.includes('rojo')) return 'Rosa (Roja)';
    return 'Rosa';
  }
  return limpio;
}

function extraerSemana(semanaRaw?: string, fechaFallback?: string): { num: number; label: string } {
  const m = String(semanaRaw || '').match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (n > 0) return { num: n, label: `Semana ${n}` };
  }
  if (fechaFallback && /^\d{4}-\d{2}-\d{2}/.test(fechaFallback)) {
    const n = getISOWeekNumber(fechaFallback.slice(0, 10));
    if (n > 0) return { num: n, label: `Semana ${n}` };
  }
  return { num: 0, label: 'Sin semana' };
}

function normalizarSedeCorta(raw?: string): string {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '—';
  if (s.includes('MG')) return 'MG';
  if (s.includes('HA')) return 'HA';
  if (s.includes('SC')) return 'SC';
  return String(raw || '').trim();
}

function parseTimestampOrden(fechaSolicitud: string, creadoEn?: number): number {
  if (typeof creadoEn === 'number' && Number.isFinite(creadoEn) && creadoEn > 0) {
    return creadoEn;
  }
  if (fechaSolicitud && /^\d{4}-\d{2}-\d{2}/.test(fechaSolicitud)) {
    const t = Date.parse(fechaSolicitud.slice(0, 10));
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function colorEstadoTexto(estado: string): string {
  const lower = String(estado || '').toLowerCase();
  if (lower.includes('rechaz') || lower.includes('cancel')) {
    return 'text-[#DC2626]';
  }
  if (lower.includes('pendiente')) {
    return 'text-[#D97706]';
  }
  if (lower.includes('aprob') || lower.includes('entreg') || lower.includes('@')) {
    return 'text-[#16A34A]';
  }
  return 'text-slate-700';
}

function colorDotEstado(estado: string): string {
  const lower = String(estado || '').toLowerCase();
  if (lower.includes('rechaz') || lower.includes('cancel')) {
    return 'bg-[#DC2626]';
  }
  if (lower.includes('pendiente')) {
    return 'bg-[#D97706]';
  }
  if (lower.includes('aprob') || lower.includes('entreg') || lower.includes('@')) {
    return 'bg-[#16A34A]';
  }
  return 'bg-slate-400';
}

export const ConsolidadoModule: React.FC<ConsolidadoModuleProps> = ({
  solicitudesEspecialesPersonal,
  solicitudesIntExt,
  ingresosSeleccion,
  obsequioVisitantes,
  solicitudesComunidad,
  onRecargarConsolidado,
}) => {
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [productosSeleccionados, setProductosSeleccionados] = useState<string[]>([]);
  const [moduloActivo, setModuloActivo] = useState<'todos' | ModuloConsolidadoKey>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [dropdownProductoAbierto, setDropdownProductoAbierto] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<ConsolidadoItem | null>(null);
  const dropdownProductoRef = useRef<HTMLDivElement | null>(null);

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

  // Unificar los 5 formularios en una estructura común
  const registrosConsolidados = useMemo<ConsolidadoItem[]>(() => {
    const lista: ConsolidadoItem[] = [];

    for (const r of solicitudesEspecialesPersonal) {
      const sem = extraerSemana(r.semana, r.fechaEntrega || r.fechaSolicitud);
      const prodNorm = normalizarProductoConsolidado(r.producto);
      lista.push({
        uid: `ep-${r.id}`,
        id: r.id,
        moduloKey: 'especiales-personal',
        moduloLabel: 'Especiales Personal',
        fechaSolicitud: r.fechaSolicitud || '',
        fechaEntrega: r.fechaEntrega || '',
        horaEntrega: '',
        semanaNum: sem.num,
        semanaLabel: sem.label,
        sede: normalizarSedeCorta(r.sede),
        solicitante: r.nombre || '—',
        codigoOCedula: r.cedula || '—',
        detalle: r.usuario ? `Registrado por: ${r.usuario}` : '',
        productoRaw: r.producto || '',
        productoNorm: prodNorm,
        cantidad: Math.max(0, Number(r.cantidad) || 0),
        motivo: r.motivo || '—',
        observacion: r.observacion || '',
        estadoONotificado: r.estado || r.notificado || 'Registrada',
        fotoCarta: r.fotoCarta || '',
        ordenTimestamp: parseTimestampOrden(r.fechaSolicitud, r.creadoEn),
      });
    }

    for (const r of solicitudesIntExt) {
      const sem = extraerSemana(r.semana, r.fechaEntrega || r.fechaSolicitud);
      const prodNorm = normalizarProductoConsolidado(r.producto);
      lista.push({
        uid: `ie-${r.id}`,
        id: r.id,
        moduloKey: 'int-ext',
        moduloLabel: 'Especiales Empresa',
        fechaSolicitud: r.fechaSolicitud || '',
        fechaEntrega: r.fechaEntrega || '',
        horaEntrega: r.horaEntrega || '',
        semanaNum: sem.num,
        semanaLabel: sem.label,
        sede: normalizarSedeCorta(r.sede),
        solicitante: r.nombre || '—',
        codigoOCedula: r.codigo || '—',
        detalle: r.area ? `Área: ${r.area}` : '',
        productoRaw: r.producto || '',
        productoNorm: prodNorm,
        cantidad: Math.max(0, Number(r.cantidad) || 0),
        motivo: r.motivo || '—',
        observacion: r.observacion || '',
        estadoONotificado: r.notificado || r.estado || 'Registrada',
        fotoCarta: r.fotoCarta || '',
        ordenTimestamp: parseTimestampOrden(r.fechaSolicitud, r.creadoEn),
      });
    }

    for (const r of ingresosSeleccion) {
      const sem = extraerSemana(r.semana, r.fechaEntrega || r.fechaSolicitud);
      const prodNorm = normalizarProductoConsolidado(r.producto);
      lista.push({
        uid: `is-${r.id}`,
        id: r.id,
        moduloKey: 'ingresos-seleccion',
        moduloLabel: 'Ingresos Personal',
        fechaSolicitud: r.fechaSolicitud || '',
        fechaEntrega: r.fechaEntrega || '',
        horaEntrega: r.horaEntrega || '',
        semanaNum: sem.num,
        semanaLabel: sem.label,
        sede: normalizarSedeCorta(r.sede),
        solicitante: r.nombre || '—',
        codigoOCedula: r.codigo || '—',
        detalle: '',
        productoRaw: r.producto || '',
        productoNorm: prodNorm,
        cantidad: Math.max(0, Number(r.cantidad) || 0),
        motivo: r.motivo || '—',
        observacion: r.observacion || '',
        estadoONotificado: r.notificado || r.estado || 'Registrada',
        fotoCarta: '',
        ordenTimestamp: parseTimestampOrden(r.fechaSolicitud, r.creadoEn),
      });
    }

    for (const r of obsequioVisitantes) {
      const sem = extraerSemana(r.semana, r.fechaEntrega || r.fechaSolicitud);
      const prodNorm = normalizarProductoConsolidado(r.producto);
      const detalleVisitante = [
        r.nombreVisitante ? `Visitante: ${r.nombreVisitante}` : '',
        r.empresa ? `Empresa: ${r.empresa}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      lista.push({
        uid: `ov-${r.id}`,
        id: r.id,
        moduloKey: 'obsequio-visitantes',
        moduloLabel: 'Obsequio Visitantes',
        fechaSolicitud: r.fechaSolicitud || '',
        fechaEntrega: r.fechaEntrega || '',
        horaEntrega: '',
        semanaNum: sem.num,
        semanaLabel: sem.label,
        sede: normalizarSedeCorta(r.sede),
        solicitante: r.nombre || '—',
        codigoOCedula: r.codigo || '—',
        detalle: detalleVisitante,
        productoRaw: r.producto || '',
        productoNorm: prodNorm,
        cantidad: Math.max(0, Number(r.cantidad) || 0),
        motivo: r.motivo || '—',
        observacion: r.observacion || '',
        estadoONotificado: r.notificado || r.estado || 'Registrada',
        fotoCarta: '',
        ordenTimestamp: parseTimestampOrden(r.fechaSolicitud, r.creadoEn),
      });
    }

    for (const r of solicitudesComunidad) {
      const sem = extraerSemana(r.semana, r.fechaEntrega || r.fechaSolicitud);
      const prodNorm = normalizarProductoConsolidado(r.producto);
      const detalleComunidad = [r.entidad || '', r.lugar || ''].filter(Boolean).join(' · ');
      lista.push({
        uid: `sc-${r.id}`,
        id: r.id,
        moduloKey: 'solicitud-comunidad',
        moduloLabel: 'Solicitud Comunidad',
        fechaSolicitud: r.fechaSolicitud || '',
        fechaEntrega: r.fechaEntrega || '',
        horaEntrega: '',
        semanaNum: sem.num,
        semanaLabel: sem.label,
        sede: normalizarSedeCorta(r.sede),
        solicitante: r.usuario || '—',
        codigoOCedula: r.entidad || '—',
        detalle: detalleComunidad,
        productoRaw: r.producto || '',
        productoNorm: prodNorm,
        cantidad: Math.max(0, Number(r.cantidad) || 0),
        motivo: r.motivo || '—',
        observacion: r.observacion || '',
        estadoONotificado: r.estado || r.notificado || 'Registrada',
        fotoCarta: r.fotoCarta || '',
        ordenTimestamp: parseTimestampOrden(r.fechaSolicitud, r.creadoEn),
      });
    }

    return lista.sort((a, b) => {
      if (b.semanaNum !== a.semanaNum) return b.semanaNum - a.semanaNum;
      if (b.ordenTimestamp !== a.ordenTimestamp) return b.ordenTimestamp - a.ordenTimestamp;
      return b.id.localeCompare(a.id, 'es');
    });
  }, [
    solicitudesEspecialesPersonal,
    solicitudesIntExt,
    ingresosSeleccion,
    obsequioVisitantes,
    solicitudesComunidad,
  ]);

  // Opciones disponibles de Semana (ordenadas descendente)
  const semanasDisponibles = useMemo(() => {
    const set = new Set<number>();
    let tieneSinSemana = false;
    for (const item of registrosConsolidados) {
      if (item.semanaNum > 0) set.add(item.semanaNum);
      else tieneSinSemana = true;
    }
    return {
      numeros: Array.from(set).sort((a, b) => b - a),
      tieneSinSemana,
    };
  }, [registrosConsolidados]);

  // Opciones disponibles de Producto (base + productos adicionales presentes en registros)
  const productosDisponibles = useMemo(() => {
    const ordenados: string[] = [...PRODUCTOS_BASE];
    const extras = new Set<string>();
    for (const item of registrosConsolidados) {
      if (item.productoNorm && !ordenados.includes(item.productoNorm)) {
        extras.add(item.productoNorm);
      }
    }
    return [...ordenados, ...Array.from(extras).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [registrosConsolidados]);

  // Registros filtrados solo por Semana (para mostrar conteo por producto y formulario dentro de esa semana)
  const registrosPorSemana = useMemo(() => {
    if (filtroSemana === 'todas') return registrosConsolidados;
    if (filtroSemana === 'sin') {
      return registrosConsolidados.filter((r) => r.semanaNum === 0);
    }
    const target = Number(filtroSemana);
    return registrosConsolidados.filter((r) => r.semanaNum === target);
  }, [registrosConsolidados, filtroSemana]);

  const conteoPorProductoSemana = useMemo(() => {
    const mapa: Record<string, { solicitudes: number; unidades: number }> = {};
    for (const r of registrosPorSemana) {
      if (!mapa[r.productoNorm]) {
        mapa[r.productoNorm] = { solicitudes: 0, unidades: 0 };
      }
      mapa[r.productoNorm].solicitudes += 1;
      mapa[r.productoNorm].unidades += r.cantidad;
    }
    return mapa;
  }, [registrosPorSemana]);

  // Registros filtrados por Semana + Producto + Búsqueda (antes del tab de formulario)
  const registrosSemanaProductoBusqueda = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return registrosPorSemana.filter((r) => {
      if (
        productosSeleccionados.length > 0 &&
        !productosSeleccionados.includes(r.productoNorm)
      ) {
        return false;
      }
      if (q) {
        const hay =
          r.id.toLowerCase().includes(q) ||
          r.moduloLabel.toLowerCase().includes(q) ||
          r.solicitante.toLowerCase().includes(q) ||
          r.codigoOCedula.toLowerCase().includes(q) ||
          r.detalle.toLowerCase().includes(q) ||
          r.sede.toLowerCase().includes(q) ||
          r.productoRaw.toLowerCase().includes(q) ||
          r.productoNorm.toLowerCase().includes(q) ||
          r.motivo.toLowerCase().includes(q) ||
          r.observacion.toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [registrosPorSemana, productosSeleccionados, busqueda]);

  // Registros finales mostrados (aplicando también el filtro por formulario seleccionado)
  const registrosFiltrados = useMemo(() => {
    if (moduloActivo === 'todos') return registrosSemanaProductoBusqueda;
    return registrosSemanaProductoBusqueda.filter((r) => r.moduloKey === moduloActivo);
  }, [registrosSemanaProductoBusqueda, moduloActivo]);

  // Métricas consolidadas de la vista filtrada actual
  const resumenGeneral = useMemo(() => {
    let totalSolicitudes = 0;
    let totalUnidades = 0;
    const porSede: Record<'MG' | 'HA' | 'SC' | 'Otra', number> = {
      MG: 0,
      HA: 0,
      SC: 0,
      Otra: 0,
    };
    const porProducto = new Map<
      string,
      { producto: string; solicitudes: number; unidades: number; mg: number; ha: number; sc: number }
    >();

    for (const r of registrosFiltrados) {
      totalSolicitudes += 1;
      totalUnidades += r.cantidad;
      if (r.sede === 'MG' || r.sede === 'HA' || r.sede === 'SC') {
        porSede[r.sede] += r.cantidad;
      } else {
        porSede.Otra += r.cantidad;
      }

      const prev = porProducto.get(r.productoNorm) || {
        producto: r.productoNorm,
        solicitudes: 0,
        unidades: 0,
        mg: 0,
        ha: 0,
        sc: 0,
      };
      prev.solicitudes += 1;
      prev.unidades += r.cantidad;
      if (r.sede === 'MG') prev.mg += r.cantidad;
      else if (r.sede === 'HA') prev.ha += r.cantidad;
      else if (r.sede === 'SC') prev.sc += r.cantidad;
      porProducto.set(r.productoNorm, prev);
    }

    const listaProductos = Array.from(porProducto.values()).sort(
      (a, b) => b.unidades - a.unidades || b.solicitudes - a.solicitudes
    );

    return {
      totalSolicitudes,
      totalUnidades,
      porSede,
      listaProductos,
    };
  }, [registrosFiltrados]);

  // Resumen por cada uno de los 5 formularios (usando Semana + Producto + Búsqueda)
  const resumenPorModulo = useMemo(() => {
    const mapa: Record<ModuloConsolidadoKey, { solicitudes: number; unidades: number }> = {
      'especiales-personal': { solicitudes: 0, unidades: 0 },
      'int-ext': { solicitudes: 0, unidades: 0 },
      'ingresos-seleccion': { solicitudes: 0, unidades: 0 },
      'obsequio-visitantes': { solicitudes: 0, unidades: 0 },
      'solicitud-comunidad': { solicitudes: 0, unidades: 0 },
    };
    for (const r of registrosSemanaProductoBusqueda) {
      mapa[r.moduloKey].solicitudes += 1;
      mapa[r.moduloKey].unidades += r.cantidad;
    }
    return mapa;
  }, [registrosSemanaProductoBusqueda]);

  const toggleProductoFiltro = (producto: string) => {
    setProductosSeleccionados((prev) =>
      prev.includes(producto) ? prev.filter((p) => p !== producto) : [...prev, producto]
    );
  };

  const hayFiltrosActivos =
    filtroSemana !== 'todas' ||
    productosSeleccionados.length > 0 ||
    moduloActivo !== 'todos' ||
    busqueda.trim().length > 0;

  const limpiarFiltros = () => {
    setFiltroSemana('todas');
    setProductosSeleccionados([]);
    setModuloActivo('todos');
    setBusqueda('');
  };

  const handleRecargar = async () => {
    if (!onRecargarConsolidado || actualizando) return;
    setActualizando(true);
    try {
      await onRecargarConsolidado();
    } finally {
      setActualizando(false);
    }
  };

  const handleExportarExcel = () => {
    const wb = XLSX.utils.book_new();

    const rowsDetalle = registrosFiltrados.map((r) => ({
      Formulario: r.moduloLabel,
      ID: r.id,
      Semana: r.semanaLabel,
      'Fecha Solicitud': r.fechaSolicitud,
      'Solicitante / Responsable': r.solicitante,
      'Código / Cédula / Entidad': r.codigoOCedula,
      'Detalle Adicional': r.detalle || '—',
      Sede: r.sede,
      Producto: r.productoRaw || r.productoNorm,
      'Producto Normalizado': r.productoNorm,
      Cantidad: r.cantidad,
      Motivo: r.motivo,
      'Fecha Entrega': r.fechaEntrega,
      'Hora Entrega': r.horaEntrega || '—',
      'Estado / Notificado': r.estadoONotificado,
      Observación: r.observacion || '—',
    }));
    const wsDetalle = XLSX.utils.json_to_sheet(rowsDetalle);
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Consolidado');

    const rowsFormularios = MODULOS_CONSOLIDADO.map((m) => ({
      Formulario: m.label,
      Solicitudes: resumenPorModulo[m.key].solicitudes,
      'Ramos / Unidades': resumenPorModulo[m.key].unidades,
    }));
    rowsFormularios.push({
      Formulario: 'TOTAL GENERAL',
      Solicitudes: registrosSemanaProductoBusqueda.length,
      'Ramos / Unidades': registrosSemanaProductoBusqueda.reduce((acc, r) => acc + r.cantidad, 0),
    });
    const wsFormularios = XLSX.utils.json_to_sheet(rowsFormularios);
    XLSX.utils.book_append_sheet(wb, wsFormularios, 'Por Formulario');

    const rowsProductos = resumenGeneral.listaProductos.map((p) => ({
      Producto: p.producto,
      Solicitudes: p.solicitudes,
      'Total Ramos / Unidades': p.unidades,
      'Sede MG': p.mg,
      'Sede HA': p.ha,
      'Sede SC': p.sc,
    }));
    const wsProductos = XLSX.utils.json_to_sheet(rowsProductos);
    XLSX.utils.book_append_sheet(wb, wsProductos, 'Por Producto');

    const suffixSem = filtroSemana === 'todas' ? 'todas-semanas' : `sem-${filtroSemana}`;
    XLSX.writeFile(wb, `Consolidado_Flor_Obsequio_${suffixSem}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Encabezado del módulo */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#0a2958] shrink-0" />
            <h1 className="text-lg sm:text-xl font-extrabold text-[#0a2958] tracking-tight">
              Consolidado de Solicitudes
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Especiales Personal · Especiales Empresa · Ingresos Personal · Obsequio Visitantes · Solicitud Comunidad
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onRecargarConsolidado && (
            <button
              type="button"
              onClick={handleRecargar}
              disabled={actualizando}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actualizando ? 'animate-spin' : ''}`} />
              <span>{actualizando ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={registrosFiltrados.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0a2958] hover:bg-[#0d3470] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Barra de filtros principales: Semana, Producto y Búsqueda */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Filtro 1: Semana */}
          <div className="md:col-span-3">
            <label
              htmlFor="consolidado-filtro-semana"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Semana
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="consolidado-filtro-semana"
                value={filtroSemana}
                onChange={(e) => setFiltroSemana(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a2958]/20 focus:border-[#0a2958] cursor-pointer"
              >
                <option value="todas">Todas las semanas</option>
                {semanasDisponibles.numeros.map((num) => (
                  <option key={num} value={String(num)}>
                    Semana {num}
                  </option>
                ))}
                {semanasDisponibles.tieneSinSemana && (
                  <option value="sin">Sin semana asignada</option>
                )}
              </select>
            </div>
          </div>

          {/* Filtro 2: Producto (multi-selección) */}
          <div className="md:col-span-4 relative" ref={dropdownProductoRef}>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Producto
            </span>
            <button
              type="button"
              onClick={() => setDropdownProductoAbierto((prev) => !prev)}
              aria-expanded={dropdownProductoAbierto}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100/70 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {productosSeleccionados.length === 0
                    ? 'Todos los productos'
                    : productosSeleccionados.length === 1
                    ? productosSeleccionados[0]
                    : `${productosSeleccionados.length} productos seleccionados`}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                  dropdownProductoAbierto ? 'rotate-180' : ''
                }`}
              />
            </button>

            {dropdownProductoAbierto && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 space-y-1">
                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Filtrar por producto
                  </span>
                  {productosSeleccionados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setProductosSeleccionados([])}
                      className="text-[11px] font-bold text-[#E60000] hover:underline cursor-pointer"
                    >
                      Ver todos
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                  {productosDisponibles.map((prod) => {
                    const checked = productosSeleccionados.includes(prod);
                    const stats = conteoPorProductoSemana[prod];
                    return (
                      <button
                        key={prod}
                        type="button"
                        onClick={() => toggleProductoFiltro(prod)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          checked
                            ? 'bg-[#0a2958]/5 text-[#0a2958] font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked
                                ? 'bg-[#0a2958] border-[#0a2958] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <span className="truncate">{prod}</span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                          {stats ? `${stats.solicitudes} (${stats.unidades})` : '0'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Búsqueda rápida */}
          <div className="md:col-span-5">
            <label
              htmlFor="consolidado-busqueda"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Buscar en registros
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="consolidado-busqueda"
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="ID, nombre, código, sede, visitante, empresa, entidad..."
                className="w-full pl-9 pr-8 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a2958]/20 focus:border-[#0a2958]"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pestañas interactivas por formulario */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filtrar por formulario">
            <button
              type="button"
              role="tab"
              aria-selected={moduloActivo === 'todos'}
              onClick={() => setModuloActivo('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                moduloActivo === 'todos'
                  ? 'bg-[#0a2958] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              Todos{' '}
              <span className="font-mono tabular-nums ml-1 opacity-85">
                ({registrosSemanaProductoBusqueda.length})
              </span>
            </button>

            {MODULOS_CONSOLIDADO.map((mod) => {
              const activo = moduloActivo === mod.key;
              const stats = resumenPorModulo[mod.key];
              return (
                <button
                  key={mod.key}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setModuloActivo(mod.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    activo
                      ? 'bg-[#E60000] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  {mod.label}{' '}
                  <span className="font-mono tabular-nums ml-1 opacity-85">
                    ({stats.solicitudes})
                  </span>
                </button>
              );
            })}
          </div>

          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs font-bold text-[#E60000] hover:underline cursor-pointer whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Banda consolidada de métricas y desglose (single-elevation con divisores 1px) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-200">
          <div className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Solicitudes Filtradas
            </p>
            <p className="text-2xl font-extrabold text-[#0a2958] font-mono tabular-nums mt-1">
              {resumenGeneral.totalSolicitudes}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {filtroSemana === 'todas'
                ? 'Todas las semanas'
                : filtroSemana === 'sin'
                ? 'Sin semana asignada'
                : `Semana ${filtroSemana}`}
            </p>
          </div>

          <div className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Ramos / Unidades
            </p>
            <p className="text-2xl font-extrabold text-[#E60000] font-mono tabular-nums mt-1">
              {resumenGeneral.totalUnidades}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
              MG {resumenGeneral.porSede.MG} · HA {resumenGeneral.porSede.HA} · SC {resumenGeneral.porSede.SC}
            </p>
          </div>

          <div className="p-4 col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Desglose por Producto (Filtro Actual)
            </p>
            {resumenGeneral.listaProductos.length === 0 ? (
              <p className="text-xs text-slate-400">Sin unidades registradas para este filtro.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                {resumenGeneral.listaProductos.map((item) => (
                  <div
                    key={item.producto}
                    className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1"
                  >
                    <span className="font-semibold text-slate-700 truncate">{item.producto}</span>
                    <span className="font-mono tabular-nums font-bold text-[#0a2958] shrink-0">
                      {item.unidades}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resumen numérico por formulario */}
        <div className="border-t border-slate-200 bg-slate-50/70 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {MODULOS_CONSOLIDADO.map((m) => {
            const st = resumenPorModulo[m.key];
            const esActivo = moduloActivo === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setModuloActivo(esActivo ? 'todos' : m.key)}
                className={`px-4 py-2.5 text-left transition-colors cursor-pointer ${
                  esActivo ? 'bg-[#0a2958]/5' : 'hover:bg-slate-100/70'
                }`}
              >
                <p className="text-[11px] font-bold text-slate-600 truncate">{m.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  <span className="font-extrabold text-[#0a2958]">{st.solicitudes}</span> reg. ·{' '}
                  <span className="font-extrabold text-slate-800">{st.unidades}</span> unid.
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla principal de consolidado */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {actualizando && registrosConsolidados.length === 0 ? (
          <div className="p-4 space-y-2.5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-10 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">
                No hay registros para mostrar
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {registrosConsolidados.length === 0
                  ? 'Aún no se han registrado solicitudes en Especiales Personal, Especiales Empresa, Ingresos Personal, Obsequio Visitantes o Solicitud Comunidad.'
                  : 'Ninguna solicitud coincide con la combinación actual de Semana, Producto, Formulario o búsqueda.'}
              </p>
            </div>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d3470] transition-colors cursor-pointer"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Formulario</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">ID / Semana</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Solicitante / Detalle</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Sede</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Producto</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Cant.</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Entrega</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Estado / Notificado</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {registrosFiltrados.map((item) => (
                  <tr
                    key={item.uid}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-bold text-[#0a2958]">
                      {item.moduloLabel}
                    </td>

                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="font-mono tabular-nums font-bold text-slate-800">
                        {item.id}
                      </div>
                      <div className="font-mono tabular-nums text-[11px] text-slate-500">
                        {item.semanaLabel}
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 max-w-[260px]">
                      <div className="font-semibold text-slate-800 truncate" title={item.solicitante}>
                        {item.solicitante}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        <span className="font-mono tabular-nums">{item.codigoOCedula}</span>
                        {item.detalle ? ` · ${item.detalle}` : ''}
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 whitespace-nowrap font-bold text-slate-700">
                      {item.sede}
                    </td>

                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{item.productoNorm}</div>
                      {item.productoRaw &&
                        item.productoRaw.trim().toLowerCase() !== item.productoNorm.toLowerCase() && (
                          <div className="text-[11px] text-slate-400">{item.productoRaw}</div>
                        )}
                    </td>

                    <td className="py-2.5 px-3.5 whitespace-nowrap text-right font-mono tabular-nums font-extrabold text-[#0a2958]">
                      {item.cantidad}
                    </td>

                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="font-mono tabular-nums text-slate-700">
                        {item.fechaEntrega ? formatShortDate(item.fechaEntrega) : '—'}
                      </div>
                      {item.horaEntrega && (
                        <div className="font-mono tabular-nums text-[11px] text-slate-500">
                          {item.horaEntrega}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3.5 max-w-[190px]">
                      <div
                        className={`flex items-center gap-1.5 font-semibold truncate ${colorEstadoTexto(
                          item.estadoONotificado
                        )}`}
                        title={item.estadoONotificado}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorDotEstado(
                            item.estadoONotificado
                          )}`}
                        />
                        <span className="truncate">{item.estadoONotificado}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetalleSeleccionado(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-bold text-[#0a2958] hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de detalle del registro */}
      {detalleSeleccionado && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de solicitud consolidada"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {detalleSeleccionado.moduloLabel}
                </p>
                <h2 className="text-base font-extrabold text-[#0a2958] font-mono tabular-nums">
                  {detalleSeleccionado.id} · {detalleSeleccionado.semanaLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetalleSeleccionado(null)}
                aria-label="Cerrar detalle"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block">Solicitante / Usuario</span>
                  <span className="font-bold text-slate-800">{detalleSeleccionado.solicitante}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Código / Cédula / Entidad</span>
                  <span className="font-mono tabular-nums font-bold text-slate-800">
                    {detalleSeleccionado.codigoOCedula}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Producto</span>
                  <span className="font-bold text-slate-800">
                    {detalleSeleccionado.productoRaw || detalleSeleccionado.productoNorm}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cantidad</span>
                  <span className="font-mono tabular-nums font-extrabold text-[#E60000]">
                    {detalleSeleccionado.cantidad}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sede</span>
                  <span className="font-bold text-slate-800">{detalleSeleccionado.sede}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fecha Solicitud</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    {detalleSeleccionado.fechaSolicitud || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fecha Entrega</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    {detalleSeleccionado.fechaEntrega || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Hora Entrega</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    {detalleSeleccionado.horaEntrega || '—'}
                  </span>
                </div>
              </div>

              {detalleSeleccionado.detalle && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block">Información Específica</span>
                  <span className="font-semibold text-slate-800">{detalleSeleccionado.detalle}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block">Motivo</span>
                <span className="font-semibold text-slate-800">{detalleSeleccionado.motivo}</span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block">Estado / Notificado</span>
                <span className="font-semibold text-slate-800">
                  {detalleSeleccionado.estadoONotificado}
                </span>
              </div>

              {detalleSeleccionado.observacion && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block">Observación</span>
                  <p className="text-slate-700 mt-0.5">{detalleSeleccionado.observacion}</p>
                </div>
              )}

              {detalleSeleccionado.fotoCarta &&
                /^https?:\/\//i.test(detalleSeleccionado.fotoCarta) && (
                  <div className="pt-2 border-t border-slate-100">
                    <a
                      href={detalleSeleccionado.fotoCarta}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a2958] hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Abrir carta adjunta en Drive</span>
                    </a>
                  </div>
                )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setDetalleSeleccionado(null)}
                className="px-4 py-1.5 rounded-lg bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d3470] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
