import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Eye,
  Calendar,
  ChevronDown,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SolicitudFlor, Sede } from '../types';
import {
  formatDateSpanish,
  formatShortDate,
  getUpcomingFridays,
  getWeekLabel,
} from '../utils/dateUtils';

type CategoriaProducto =
  | 'Rosa (Rojo)'
  | 'Rosa (Color)'
  | 'Alstroemeria'
  | 'Clavel'
  | 'Gypso'
  | 'Bouquet';

const CATEGORIAS_PRODUCTO: CategoriaProducto[] = [
  'Rosa (Rojo)',
  'Rosa (Color)',
  'Alstroemeria',
  'Clavel',
  'Gypso',
  'Bouquet',
];

function categorizarProducto(s: SolicitudFlor): CategoriaProducto {
  const prod = String(s.producto || '').toLowerCase();
  if (s.tipoProducto === 'bouquet' || prod.includes('bouquet')) return 'Bouquet';
  if (prod.includes('clavel') || s.florPrincipal === 'Clavel') return 'Clavel';
  if (prod.includes('alstroemeria') || s.florPrincipal === 'Alstroemeria') return 'Alstroemeria';
  if (prod.includes('gypso') || s.florPrincipal === 'Gypso') return 'Gypso';
  if (prod.includes('color') || String(s.opcionFlor || '').toLowerCase().includes('color')) {
    return 'Rosa (Color)';
  }
  return 'Rosa (Rojo)';
}

function extraerNumSemana(s: SolicitudFlor): number {
  const m = String(s.semana || '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

interface SolicitudesTableProps {
  solicitudes: SolicitudFlor[];
  isDriveConnected: boolean;
  spreadsheetLink: string | null;
  onSincronizarConDrive: () => Promise<void>;
  isSyncing: boolean;
}

export const SolicitudesTable: React.FC<SolicitudesTableProps> = ({
  solicitudes,
  isDriveConnected,
  spreadsheetLink,
  onSincronizarConDrive,
  isSyncing,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [productosSeleccionados, setProductosSeleccionados] = useState<CategoriaProducto[]>([]);
  const [dropdownProductoAbierto, setDropdownProductoAbierto] = useState(false);
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudFlor | null>(null);
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

  const toggleProductoFiltro = (cat: CategoriaProducto) => {
    setProductosSeleccionados((prev) =>
      prev.includes(cat) ? prev.filter((p) => p !== cat) : [...prev, cat]
    );
  };

  const semanasDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const s of solicitudes) {
      const num = extraerNumSemana(s);
      if (num > 0) set.add(num);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [solicitudes]);

  const upcomingFridays = useMemo(() => getUpcomingFridays(8), []);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(upcomingFridays[0]?.dateString || '');
  const semanaNombre = useMemo(() => getWeekLabel(semanaSeleccionada), [semanaSeleccionada]);

  const solicitudesSemanaActivas = useMemo(
    () =>
      solicitudes.filter(
        (s) => s.fechaEntrega === semanaSeleccionada && s.estado !== 'Cancelada'
      ),
    [solicitudes, semanaSeleccionada]
  );

  const resumenPorProducto = useMemo(() => {
    const mapa: Record<
      CategoriaProducto,
      { total: number; porSede: Record<Sede, number> }
    > = {
      'Rosa (Rojo)': { total: 0, porSede: { 'Sede MG': 0, 'Sede HA': 0, 'Sede SC': 0 } },
      'Rosa (Color)': { total: 0, porSede: { 'Sede MG': 0, 'Sede HA': 0, 'Sede SC': 0 } },
      Alstroemeria: { total: 0, porSede: { 'Sede MG': 0, 'Sede HA': 0, 'Sede SC': 0 } },
      Clavel: { total: 0, porSede: { 'Sede MG': 0, 'Sede HA': 0, 'Sede SC': 0 } },
      Gypso: { total: 0, porSede: { 'Sede MG': 0, 'Sede HA': 0, 'Sede SC': 0 } },
      Bouquet: { total: 0, porSede: { 'Sede MG': 0, 'Sede HA': 0, 'Sede SC': 0 } },
    };

    const sedesRamos: Record<Sede, number> = { 'Sede MG': 0, 'Sede HA': 0, 'Sede SC': 0 };
    let totalRamos = 0;

    for (const s of solicitudesSemanaActivas) {
      const cant = Number(s.cantidad) || 1;
      const cat = categorizarProducto(s);
      const sedeNorm: Sede =
        s.sede === 'Sede HA' || s.sede === 'Sede SC' ? s.sede : 'Sede MG';

      mapa[cat].total += cant;
      mapa[cat].porSede[sedeNorm] += cant;

      if (cat !== 'Bouquet') {
        totalRamos += cant;
        sedesRamos[sedeNorm] += cant;
      }
    }

    return { mapa, totalRamos, sedesRamos };
  }, [solicitudesSemanaActivas]);

  // Filtrado reactivo y orden por semana de mayor a menor
  const solicitudesFiltradas = useMemo(() => {
    const filtradas = solicitudes.filter((item) => {
      const q = busqueda.toLowerCase().trim();
      const matchBusqueda =
        !q ||
        item.id.toLowerCase().includes(q) ||
        item.codigo.toLowerCase().includes(q) ||
        item.nombre.toLowerCase().includes(q) ||
        item.producto.toLowerCase().includes(q) ||
        (item.remitente || '').toLowerCase().includes(q) ||
        item.motivo.toLowerCase().includes(q) ||
        (item.semana && item.semana.toLowerCase().includes(q));

      const matchProducto =
        productosSeleccionados.length === 0 ||
        productosSeleccionados.includes(categorizarProducto(item));

      const matchSemana =
        filtroSemana === 'todas' || String(extraerNumSemana(item)) === filtroSemana;

      return matchBusqueda && matchProducto && matchSemana;
    });

    return [...filtradas].sort((a, b) => {
      const semDiff = extraerNumSemana(b) - extraerNumSemana(a);
      if (semDiff !== 0) return semDiff;
      const fechaDiff = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      if (fechaDiff !== 0) return fechaDiff;
      return (b.creadoEn || 0) - (a.creadoEn || 0);
    });
  }, [solicitudes, busqueda, productosSeleccionados, filtroSemana]);

  // Exportar a Excel (.xlsx) con los encabezados incluyendo Semana
  const exportarExcel = () => {
    const headers = [
      'Id',
      'Fecha',
      'Semana',
      'Código',
      'Nombre',
      'Producto',
      'Sede',
      'Motivo',
      'Fecha Entrega',
      'Remitente',
      'Estado',
    ];
    const rows = solicitudesFiltradas.map((s) => [
      s.id,
      s.fecha,
      s.semana || '',
      s.codigo,
      s.nombre,
      s.producto,
      s.sede,
      s.motivo,
      s.fechaEntrega,
      s.remitente || '',
      s.estado,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [
      { wch: 15 }, // Id
      { wch: 12 }, // Fecha
      { wch: 12 }, // Semana
      { wch: 12 }, // Código
      { wch: 30 }, // Nombre
      { wch: 36 }, // Producto
      { wch: 12 }, // Sede
      { wch: 28 }, // Motivo
      { wch: 14 }, // Fecha Entrega
      { wch: 26 }, // Remitente
      { wch: 14 }, // Estado
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Solicitudes');
    XLSX.writeFile(workbook, `Solicitudes_Flor_Obsequio_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Modal de Detalle */}
      {solicitudSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <span className="font-mono font-bold text-[#0a2958] text-sm">
                Radicado: {solicitudSeleccionada.id}
              </span>
              <button
                onClick={() => setSolicitudSeleccionada(null)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-[#0a2958]/5 rounded-xl border border-[#0a2958]/20">
                <span className="text-[11px] text-[#0a2958] font-bold block uppercase">
                  Producto Solicitado
                </span>
                <span className="text-sm font-extrabold text-[#0a2958]">
                  {solicitudSeleccionada.producto}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Código Trabajador
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {solicitudSeleccionada.codigo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Nombre Completo
                  </span>
                  <span className="font-bold text-slate-900">
                    {solicitudSeleccionada.nombre}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Semana
                  </span>
                  <span className="font-bold text-[#E60000]">
                    {solicitudSeleccionada.semana}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Sede (Maestro)
                  </span>
                  <span className="font-bold text-[#0a2958]">
                    {solicitudSeleccionada.sede}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Fecha Solicitud
                  </span>
                  <span className="text-slate-800">{formatShortDate(solicitudSeleccionada.fecha)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Fecha Entrega (Viernes)
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatDateSpanish(solicitudSeleccionada.fechaEntrega)}
                  </span>
                </div>
                {solicitudSeleccionada.remitente && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Remitente
                    </span>
                    <span className="text-slate-800">{solicitudSeleccionada.remitente}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Motivo
                </span>
                <span className="text-slate-800">{solicitudSeleccionada.motivo}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                <strong>Lugar de Entrega:</strong> Área de Poscosecha los viernes, al finalizar la jornada laboral.
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSolicitudSeleccionada(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capacidad Semanal de Poscosecha */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E60000]">
            Capacidad Semanal de Poscosecha
          </span>
          <h2 className="text-xl font-extrabold text-[#0a2958] tracking-tight">
            Cupos Semanales de Flor ({semanaNombre})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#0a2958] shrink-0" />
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400">
              Viernes de Entrega:
            </label>
            <select
              value={semanaSeleccionada}
              onChange={(e) => setSemanaSeleccionada(e.target.value)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden text-[#0a2958]"
            >
              {upcomingFridays.map((f) => (
                <option key={f.dateString} value={f.dateString}>
                  {f.label} ({getWeekLabel(f.dateString)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Consolidado Total por Producto */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E60000]">
              Consolidado Total por Producto
            </span>
            <h3 className="text-sm font-extrabold text-[#0a2958]">
              Conteo general de ramos por producto ({semanaNombre})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="text-[#0a2958] bg-[#0a2958]/5 border border-[#0a2958]/15 px-3 py-1.5 rounded-xl">
              Rosa (Rojo + Color):{' '}
              {resumenPorProducto.mapa['Rosa (Rojo)'].total +
                resumenPorProducto.mapa['Rosa (Color)'].total}{' '}
              / 20
            </span>
            <span className="text-[#0a2958] bg-[#0a2958]/5 border border-[#0a2958]/15 px-3 py-1.5 rounded-xl">
              Total Ramos (3 sedes): {resumenPorProducto.totalRamos}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {CATEGORIAS_PRODUCTO.map((cat) => {
            const info = resumenPorProducto.mapa[cat];
            const isBouquet = cat === 'Bouquet';
            const cupoLabel =
              cat === 'Bouquet'
                ? 'de 5 disp.'
                : cat === 'Clavel'
                ? 'de 20 disp.'
                : cat === 'Gypso'
                ? 'de 20 disp.'
                : cat === 'Alstroemeria'
                ? 'de 30 disp.'
                : 'comparte 20 disp.';
            return (
              <div
                key={cat}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block">{cat}</span>
                  <div className="text-2xl font-extrabold text-[#0a2958] mt-1">
                    {info.total}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isBouquet ? `bouquets (${cupoLabel})` : `ramos (${cupoLabel})`}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/80 text-[10px] text-slate-600 font-semibold flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>MG: {info.porSede['Sede MG']}</span>
                  <span>HA: {info.porSede['Sede HA']}</span>
                  <span>SC: {info.porSede['Sede SC']}</span>
                </div>
              </div>
            );
          })}

          <div className="p-3.5 rounded-xl border border-[#0a2958]/20 bg-[#0a2958]/5 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#0a2958] block">Total Ramos</span>
              <div className="text-2xl font-extrabold text-[#E60000] mt-1">
                {resumenPorProducto.totalRamos}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                en las 3 sedes
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#0a2958]/15 text-[10px] text-[#0a2958] font-bold flex flex-wrap gap-x-2 gap-y-0.5">
              <span>MG: {resumenPorProducto.sedesRamos['Sede MG']}</span>
              <span>HA: {resumenPorProducto.sedesRamos['Sede HA']}</span>
              <span>SC: {resumenPorProducto.sedesRamos['Sede SC']}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Encabezado y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E60000]">
            Base de Datos Oficial
          </span>
          <h2 className="text-xl font-extrabold text-[#0a2958] tracking-tight">
            Registro Histórico de Flores de Obsequio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total registrado: {solicitudes.length} solicitudes • Visualizando: {solicitudesFiltradas.length}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDriveConnected && (
            <button
              onClick={onSincronizarConDrive}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#0a2958]/20 bg-[#0a2958]/5 hover:bg-[#0a2958]/10 text-[#0a2958] text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar con Drive'}</span>
            </button>
          )}

          <button
            onClick={exportarExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#E60000]" />
            <span>Descargar Excel</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ID, semana, código, trabajador, motivo o remitente..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-bold shrink-0">Semana:</span>
          <select
            value={filtroSemana}
            onChange={(e) => setFiltroSemana(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#0a2958] outline-hidden font-semibold"
          >
            <option value="todas">Todas las semanas</option>
            {semanasDisponibles.map((sem) => (
              <option key={sem} value={String(sem)}>
                Semana {sem}
              </option>
            ))}
          </select>
        </div>

        <div ref={dropdownProductoRef} className="relative flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-bold shrink-0">Producto:</span>
          <button
            type="button"
            onClick={() => setDropdownProductoAbierto((prev) => !prev)}
            className="flex-1 md:flex-initial min-w-[190px] flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white hover:border-[#0a2958]/50 focus:border-[#0a2958] outline-hidden font-semibold text-slate-800 cursor-pointer"
          >
            <span className="truncate">
              {productosSeleccionados.length === 0
                ? 'Todos los productos'
                : productosSeleccionados.length <= 2
                ? productosSeleccionados.join(', ')
                : `${productosSeleccionados.length} productos`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${dropdownProductoAbierto ? 'rotate-180' : ''}`} />
          </button>

          {dropdownProductoAbierto && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl z-30 p-2 space-y-1">
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 mb-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Filtrar productos
                </span>
                {productosSeleccionados.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setProductosSeleccionados([])}
                    className="text-[11px] font-bold text-[#E60000] hover:underline cursor-pointer"
                  >
                    Todos
                  </button>
                )}
              </div>
              {CATEGORIAS_PRODUCTO.map((cat) => {
                const seleccionado = productosSeleccionados.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleProductoFiltro(cat)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      seleccionado
                        ? 'bg-[#0a2958]/10 text-[#0a2958]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat}</span>
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
      </div>

      {/* Tabla con encabezados solicitados: Id, Fecha, Semana, Código, Nombre, Producto, Sede, Motivo, Fecha Entrega, Remitente */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="w-full max-h-[520px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
                <th className="py-3 px-4">Id</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Semana</th>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nombre</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4">Sede</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Fecha Entrega</th>
                <th className="py-3 px-4">Remitente</th>
                <th className="py-3 px-4">Drive</th>
                <th className="py-3 px-4 text-center">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {solicitudesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    No se encontraron solicitudes con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                solicitudesFiltradas.map((s, idx) => (
                  <tr key={`${s.id}-${s.codigo}-${idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#0a2958] whitespace-nowrap">
                      {s.id}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatShortDate(s.fecha)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-[#E60000]">
                      {s.semana}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {s.codigo}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {s.nombre}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                          s.tipoProducto === 'bouquet'
                            ? 'bg-[#0a2958]/10 text-[#0a2958] border border-[#0a2958]/20'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {s.producto}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-[#0a2958]">
                      {s.sede}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[170px] truncate" title={s.motivo}>
                      {s.motivo}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                      {formatShortDate(s.fechaEntrega)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {s.remitente}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {s.syncedToDrive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Drive
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Local
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSolicitudSeleccionada(s)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#0a2958] transition cursor-pointer"
                        title="Ver Ficha Completa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
