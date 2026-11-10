import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { SolicitudFlor } from '../types';
import { formatDateSpanish, formatShortDate } from '../utils/dateUtils';

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
  const [filtroSede, setFiltroSede] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudFlor | null>(null);

  // Filtrado reactivo
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((item) => {
      const q = busqueda.toLowerCase().trim();
      const matchBusqueda =
        !q ||
        item.id.toLowerCase().includes(q) ||
        item.codigo.toLowerCase().includes(q) ||
        item.nombre.toLowerCase().includes(q) ||
        item.producto.toLowerCase().includes(q) ||
        item.remitente.toLowerCase().includes(q) ||
        item.motivo.toLowerCase().includes(q) ||
        (item.semana && item.semana.toLowerCase().includes(q));

      const matchSede = filtroSede === 'todas' || item.sede === filtroSede;
      const matchTipo = filtroTipo === 'todos' || item.tipoProducto === filtroTipo;

      return matchBusqueda && matchSede && matchTipo;
    });
  }, [solicitudes, busqueda, filtroSede, filtroTipo]);

  // Exportar a CSV con los encabezados exactos del prompt incluyendo SEMANA:
  // Id, Fecha, Semana, Código, Nombre, Producto, Sede, Motivo, Fecha Entrega, Remitente, Estado
  const exportarCSV = () => {
    const headers = ['Id', 'Fecha', 'Semana', 'Código', 'Nombre', 'Producto', 'Sede', 'Motivo', 'Fecha Entrega', 'Remitente', 'Estado'];
    const rows = solicitudesFiltradas.map((s) => [
      `"${s.id}"`,
      `"${s.fecha}"`,
      `"${s.semana || ''}"`,
      `"${s.codigo}"`,
      `"${s.nombre}"`,
      `"${s.producto.replace(/"/g, '""')}"`,
      `"${s.sede}"`,
      `"${s.motivo.replace(/"/g, '""')}"`,
      `"${s.fechaEntrega}"`,
      `"${s.remitente.replace(/"/g, '""')}"`,
      `"${s.estado}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Solicitudes_Flor_Obsequio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Remitente
                  </span>
                  <span className="text-slate-800">{solicitudSeleccionada.remitente}</span>
                </div>
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

          {spreadsheetLink && (
            <a
              href={spreadsheetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#0a2958]" />
              <span>Abrir Hoja de Google</span>
            </a>
          )}

          <button
            onClick={exportarCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#E60000]" />
            <span>Descargar CSV / Excel</span>
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
          <span className="text-xs text-slate-500 font-bold shrink-0">Sede:</span>
          <select
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#0a2958] outline-hidden font-semibold"
          >
            <option value="todas">Todas las Sedes</option>
            <option value="Sede MG">Sede MG</option>
            <option value="Sede HA">Sede HA</option>
            <option value="Sede SC">Sede SC</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-bold shrink-0">Tipo:</span>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#0a2958] outline-hidden font-semibold"
          >
            <option value="todos">Todos los productos</option>
            <option value="ramo">Ramos Monovarietales</option>
            <option value="bouquet">Bouquets Mixtos</option>
          </select>
        </div>
      </div>

      {/* Tabla con encabezados solicitados: Id, Fecha, Semana, Código, Nombre, Producto, Sede, Motivo, Fecha Entrega, Remitente */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
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
                solicitudesFiltradas.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
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
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
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
