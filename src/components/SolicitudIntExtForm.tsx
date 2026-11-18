import React, { useState, useMemo, useEffect } from 'react';
import {
  FilePlus2,
  Building2,
  Sparkles,
  Calendar,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Printer,
  Copy,
  LogOut,
  Search,
  Download,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { SolicitudIntExt, TrabajadorMaestro } from '../types';
import { getTodayString, formatDateSpanish, getISOWeekNumber } from '../utils/dateUtils';

interface SolicitudIntExtFormProps {
  sesion: TrabajadorMaestro;
  solicitudesIntExt: SolicitudIntExt[];
  sheetsSupported: boolean;
  onGuardarSolicitudIntExt: (
    nueva: SolicitudIntExt
  ) => Promise<{
    success: boolean;
    error?: string;
    solicitud?: SolicitudIntExt;
    pendingAppsScriptUpdate?: boolean;
  }>;
  onRecargarIntExt?: () => Promise<void>;
  onCerrarSesion?: () => void;
}

const SEDES_INTERNAS = ['MG', 'HA', 'SC'] as const;
const AREAS_BASE = ['Gestión Humana', 'Mipe', 'Poscosecha'] as const;
const PRODUCTOS_INT_EXT = ['Rosa', 'Clavel', 'Alstroemeria', 'Bouquet'] as const;
const MOTIVOS_INT_EXT = [
  'Cumpleaños',
  'Grados',
  'Ingresos',
  'Día Madre',
  'Día del Padre',
] as const;

export const SolicitudIntExtForm: React.FC<SolicitudIntExtFormProps> = ({
  sesion,
  solicitudesIntExt,
  sheetsSupported,
  onGuardarSolicitudIntExt,
  onRecargarIntExt,
  onCerrarSesion,
}) => {
  const fechaSolicitud = getTodayString();
  const [sedeTipo, setSedeTipo] = useState<'MG' | 'HA' | 'SC' | null>(null);

  const [areasPersonalizadas, setAreasPersonalizadas] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sfo_areas_int_ext_custom');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [areaSeleccionada, setAreaSeleccionada] = useState('');
  const [mostrandoInputArea, setMostrandoInputArea] = useState(false);
  const [nuevaAreaInput, setNuevaAreaInput] = useState('');

  const [producto, setProducto] = useState('');
  const [cantidad, setCantidad] = useState<string>('1');
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('');
  const [otroMotivo, setOtroMotivo] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState(getTodayString());
  const [observacion, setObservacion] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solicitudExitosa, setSolicitudExitosa] = useState<SolicitudIntExt | null>(null);
  const [avisoPendienteScript, setAvisoPendienteScript] = useState(false);
  const [copiadoId, setCopiadoId] = useState(false);

  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [recargandoTabla, setRecargandoTabla] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('sfo_areas_int_ext_custom', JSON.stringify(areasPersonalizadas));
    } catch {}
  }, [areasPersonalizadas]);

  const proximoId = useMemo(() => {
    const year = new Date().getFullYear();
    let maxNum = 0;
    for (const s of solicitudesIntExt) {
      const m = String(s.id || '').match(/^SIE-(\d{4})-(\d+)$/i);
      if (m && Number(m[1]) === year) {
        maxNum = Math.max(maxNum, Number(m[2]));
      }
    }
    const nextNum = Math.max(maxNum + 1, solicitudesIntExt.length + 1);
    return `SIE-${year}-${String(nextNum).padStart(3, '0')}`;
  }, [solicitudesIntExt]);

  const sedeFinal = sedeTipo || '';
  const areaFinal = mostrandoInputArea && nuevaAreaInput.trim()
    ? nuevaAreaInput.trim()
    : areaSeleccionada.trim();
  const motivoFinal = motivoSeleccionado === 'Otro' ? otroMotivo.trim() : motivoSeleccionado;

  const opcionesAreaVisibles = useMemo(() => {
    const set = new Set<string>([...AREAS_BASE, ...areasPersonalizadas]);
    return Array.from(set);
  }, [areasPersonalizadas]);

  const handleAgregarAreaPersonalizada = () => {
    const limpia = nuevaAreaInput.trim();
    if (!limpia) return;
    if (!opcionesAreaVisibles.some((a) => a.toLowerCase() === limpia.toLowerCase())) {
      setAreasPersonalizadas((prev) => [...prev, limpia]);
    }
    setAreaSeleccionada(limpia);
    setNuevaAreaInput('');
    setMostrandoInputArea(false);
    setErrores((prev) => {
      const next = { ...prev };
      delete next.area;
      return next;
    });
  };

  const limpiarFormulario = () => {
    setSedeTipo(null);
    setAreaSeleccionada('');
    setMostrandoInputArea(false);
    setNuevaAreaInput('');
    setProducto('');
    setCantidad('1');
    setMotivoSeleccionado('');
    setOtroMotivo('');
    setFechaEntrega(getTodayString());
    setObservacion('');
    setErrores({});
  };

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (!fechaSolicitud) nuevos.fechaSolicitud = 'La fecha de solicitud es obligatoria.';
    if (!sedeTipo) nuevos.sede = 'Seleccione la sede (MG, HA o SC).';
    if (!areaFinal) nuevos.area = 'Seleccione o ingrese el área.';
    if (!producto) nuevos.producto = 'Seleccione un producto.';
    const cantNum = Number(cantidad);
    if (!cantidad || Number.isNaN(cantNum) || cantNum < 1 || !Number.isInteger(cantNum)) {
      nuevos.cantidad = 'Ingrese una cantidad válida (mínimo 1 ramo).';
    }
    if (!motivoFinal) nuevos.motivo = 'Seleccione o especifique el motivo.';
    if (!fechaEntrega) nuevos.fechaEntrega = 'Seleccione la fecha de entrega.';

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    if (sedeTipo && mostrandoInputArea && nuevaAreaInput.trim()) {
      const limpia = nuevaAreaInput.trim();
      if (!opcionesAreaVisibles.some((a) => a.toLowerCase() === limpia.toLowerCase())) {
        setAreasPersonalizadas((prev) => [...prev, limpia]);
      }
    }

    setIsSubmitting(true);
    const semanaCalculada = fechaEntrega ? String(getISOWeekNumber(fechaEntrega)) : '';
    const nueva: SolicitudIntExt = {
      id: proximoId,
      fechaSolicitud,
      codigo: sesion.codigo.trim(),
      nombre: sesion.nombre.trim(),
      sede: sedeFinal,
      area: areaFinal,
      producto,
      cantidad: Math.max(1, Math.floor(Number(cantidad) || 1)),
      motivo: motivoFinal,
      semana: semanaCalculada,
      fechaEntrega,
      observacion: observacion.trim(),
      estado: 'Registrada',
      creadoEn: Date.now(),
    };

    try {
      const res = await onGuardarSolicitudIntExt(nueva);
      if (res.success && res.solicitud) {
        setSolicitudExitosa(res.solicitud);
        setAvisoPendienteScript(!!res.pendingAppsScriptUpdate);
        limpiarFormulario();
        try {
          confetti({
            particleCount: 75,
            spread: 65,
            origin: { y: 0.6 },
            colors: ['#0a2958', '#E60000', '#ffffff', '#10b981'],
          });
        } catch {}
      } else {
        setErrores({ general: res.error || 'No se pudo registrar la solicitud Extra.' });
      }
    } catch (err: any) {
      setErrores({ general: err.message || 'Error inesperado al registrar.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copiarIdComprobante = () => {
    if (solicitudExitosa?.id) {
      navigator.clipboard.writeText(solicitudExitosa.id);
      setCopiadoId(true);
      setTimeout(() => setCopiadoId(false), 2000);
    }
  };

  const solicitudesFiltradas = useMemo(() => {
    const q = busquedaTabla.trim().toLowerCase();
    if (!q) return solicitudesIntExt;
    return solicitudesIntExt.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.nombre.toLowerCase().includes(q) ||
        s.codigo.toLowerCase().includes(q) ||
        s.sede.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.producto.toLowerCase().includes(q) ||
        s.motivo.toLowerCase().includes(q) ||
        s.observacion.toLowerCase().includes(q)
    );
  }, [solicitudesIntExt, busquedaTabla]);

  const exportarExcel = () => {
    const rows = solicitudesFiltradas.map((s) => ({
      Id: s.id,
      'Fecha Solicitud': s.fechaSolicitud,
      Código: s.codigo,
      Nombre: s.nombre,
      Sede: s.sede,
      Area: s.area,
      Producto: s.producto,
      Cantidad: s.cantidad,
      Motivo: s.motivo,
      Semana: s.semana || (s.fechaEntrega ? String(getISOWeekNumber(s.fechaEntrega)) : ''),
      'Fecha Entrega': s.fechaEntrega,
      Observación: s.observacion,
      Estado: s.estado || 'Registrada',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitud Extra');
    XLSX.writeFile(wb, `Solicitud_Extra_${getTodayString()}.xlsx`);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {solicitudExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-[#0a2958]/10 text-[#0a2958] flex items-center justify-center mx-auto mb-4 ring-8 ring-[#0a2958]/5">
              <CheckCircle2 className="w-8 h-8 text-[#0a2958]" />
            </div>
            <div className="text-center mb-4">
              <h3 className="text-xl font-extrabold text-[#0a2958] mb-1">¡Registro Exitoso!</h3>
              <p className="text-xs text-slate-600">
                La solicitud fue registrada en <strong>Solicitud Extra</strong>.
              </p>
              {avisoPendienteScript && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] text-left">
                  Se guardó en el respaldo del servidor. Para que escriba directamente en la pestaña{' '}
                  <strong>Solicitud Extra</strong> de Google Sheets, actualice la versión del código en{' '}
                  <strong>Conexión con Drive</strong>.
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2 mb-5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Id:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-[#0a2958] text-sm">
                  <span>{solicitudExitosa.id}</span>
                  <button type="button" onClick={copiarIdComprobante} className="p-1 hover:bg-slate-200 rounded">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiadoId && <span className="text-[10px] text-[#E60000] font-sans font-bold">¡Copiado!</span>}
                </div>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Fecha Solicitud:</span><span className="font-semibold text-slate-900">{solicitudExitosa.fechaSolicitud}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Registrado por:</span><span className="font-bold text-slate-900">{solicitudExitosa.nombre} ({solicitudExitosa.codigo})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sede / Área:</span><span className="font-bold text-slate-900">{solicitudExitosa.sede} · {solicitudExitosa.area}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Producto:</span><span className="font-bold text-slate-900">{solicitudExitosa.producto}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cantidad:</span><span className="font-bold text-[#0a2958]">{solicitudExitosa.cantidad} ramos</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Motivo:</span><span className="font-bold text-slate-900">{solicitudExitosa.motivo}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Semana:</span><span className="font-bold text-[#E60000]">Semana {solicitudExitosa.semana || getISOWeekNumber(solicitudExitosa.fechaEntrega)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fecha Entrega:</span><span className="font-semibold text-slate-900">{formatDateSpanish(solicitudExitosa.fechaEntrega)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estado:</span><span className="font-bold text-emerald-700">{solicitudExitosa.estado || 'Registrada'}</span></div>
              {solicitudExitosa.observacion && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Observación:</span>
                  <p className="text-slate-800 font-medium">{solicitudExitosa.observacion}</p>
                </div>
              )}
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
                onClick={() => setSolicitudExitosa(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nueva Solicitud
              </button>
              <button
                type="button"
                onClick={() => {
                  setSolicitudExitosa(null);
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

      {/* Formulario principal SOLICITUD EXTRA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2958]/10 flex items-center justify-center">
              <FilePlus2 className="w-5 h-5 text-[#E60000]" />
            </div>
            <h2 className="text-base font-extrabold text-[#0a2958] uppercase tracking-wide">
              SOLICITUD EXTRA
            </h2>
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

        {!sheetsSupported && (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              La hoja <strong>Solicitud Extra</strong> aún no responde desde el webhook activo de Apps Script. Para sincronizar en tiempo real con Google Sheets, copie el código actualizado desde <strong>Conexión con Drive</strong> e implemente una <strong>Nueva versión</strong>.
            </div>
          </div>
        )}

        {errores.general && (
          <div className="mx-6 mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errores.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 1. SEDE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                1. SEDE
              </h3>
            </div>

            <div>
              <p className="text-xs text-slate-600 font-medium mb-2.5">
                Seleccione la sede que requiere el producto.
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {SEDES_INTERNAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSedeTipo(s);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.sede;
                        return next;
                      });
                    }}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      sedeTipo === s
                        ? 'bg-[#0a2958] text-white border-[#0a2958] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#0a2958]/40'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {errores.sede && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">{errores.sede}</p>
              )}
            </div>

            {sedeTipo && (
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap gap-2">
                  {opcionesAreaVisibles.map((areaOp) => (
                    <button
                      key={areaOp}
                      type="button"
                      onClick={() => {
                        setAreaSeleccionada(areaOp);
                        setMostrandoInputArea(false);
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.area;
                          return next;
                        });
                      }}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        !mostrandoInputArea && areaSeleccionada === areaOp
                          ? 'bg-[#0a2958] text-white border-[#0a2958] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#0a2958]/40'
                      }`}
                    >
                      {areaOp}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setMostrandoInputArea((prev) => !prev);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.area;
                        return next;
                      });
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer ${
                      mostrandoInputArea
                        ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/40'
                        : 'bg-slate-50 text-slate-700 border-dashed border-slate-300 hover:border-[#0a2958]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar otra área</span>
                  </button>
                </div>

                {mostrandoInputArea && (
                  <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                    <input
                      type="text"
                      value={nuevaAreaInput}
                      onChange={(e) => {
                        setNuevaAreaInput(e.target.value);
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.area;
                          return next;
                        });
                      }}
                      placeholder="Escriba el nombre de la nueva área…"
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarAreaPersonalizada}
                      className="px-4 py-2 rounded-xl bg-[#0a2958] text-white text-xs font-bold hover:bg-[#0d346e] cursor-pointer"
                    >
                      Agregar
                    </button>
                  </div>
                )}

                {errores.area && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">{errores.area}</p>
                )}
              </div>
            )}
          </div>

          {/* 2. Producto y Cantidad */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                2. Producto y Cantidad
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Producto <span className="text-[#E60000]">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRODUCTOS_INT_EXT.map((prod) => (
                    <button
                      key={prod}
                      type="button"
                      onClick={() => {
                        setProducto(prod);
                        setErrores((prev) => {
                          const next = { ...prev };
                          delete next.producto;
                          return next;
                        });
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        producto === prod
                          ? 'bg-[#0a2958] text-white border-[#0a2958] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#0a2958]/40'
                      }`}
                    >
                      {prod}
                    </button>
                  ))}
                </div>
                {errores.producto && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">{errores.producto}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Cantidad <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cantidad}
                  onChange={(e) => {
                    setCantidad(e.target.value);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.cantidad;
                      return next;
                    });
                  }}
                  placeholder="Ej. 10"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-bold text-slate-900 outline-hidden ${
                    errores.cantidad ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 focus:border-[#0a2958]'
                  }`}
                />
                {errores.cantidad && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.cantidad}</p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Motivo, Fecha de Entrega y Observación */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-[#0a2958]" />
              <h3 className="text-sm font-extrabold text-[#0a2958] uppercase tracking-wider">
                3. Motivo, Entrega y Observación
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Motivo <span className="text-[#E60000]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_INT_EXT.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMotivoSeleccionado(m);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.motivo;
                        return next;
                      });
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      motivoSeleccionado === m
                        ? 'bg-[#0a2958] text-white border-[#0a2958] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#0a2958]/40'
                    }`}
                  >
                    {m}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMotivoSeleccionado('Otro');
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.motivo;
                      return next;
                    });
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    motivoSeleccionado === 'Otro'
                      ? 'bg-[#E60000]/10 text-[#E60000] border-[#E60000]/40'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#0a2958]/40'
                  }`}
                >
                  Otro motivo
                </button>
              </div>
              {motivoSeleccionado === 'Otro' && (
                <input
                  type="text"
                  value={otroMotivo}
                  onChange={(e) => {
                    setOtroMotivo(e.target.value);
                    setErrores((prev) => {
                      const next = { ...prev };
                      delete next.motivo;
                      return next;
                    });
                  }}
                  placeholder="Especifique el motivo…"
                  className="mt-2.5 w-full sm:max-w-md px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium"
                />
              )}
              {errores.motivo && (
                <p className="text-[11px] text-[#E60000] font-semibold mt-1.5">{errores.motivo}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Fecha Entrega <span className="text-[#E60000]">*</span>
                </label>
                <input
                  type="date"
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
                    errores.fechaEntrega ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 focus:border-[#0a2958]'
                  }`}
                />
                {errores.fechaEntrega && (
                  <p className="text-[11px] text-[#E60000] font-semibold mt-1">{errores.fechaEntrega}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Observación</span>
                </label>
                <textarea
                  rows={2}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Escriba observaciones o detalles adicionales…"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] outline-hidden font-medium resize-y"
                />
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
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando…</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#E60000]" />
                  <span>Registrar Solicitud Extra</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Historial de registros en hoja Solicitud Extra */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#0a2958]">
              Registros en Solicitud Extra ({solicitudesFiltradas.length})
            </h3>
            <p className="text-xs text-slate-500">
              Historial de solicitudes internas y externas registradas
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busquedaTabla}
                onChange={(e) => setBusquedaTabla(e.target.value)}
                placeholder="Buscar…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-[#0a2958] outline-hidden"
              />
            </div>
            {onRecargarIntExt && (
              <button
                type="button"
                disabled={recargandoTabla}
                onClick={async () => {
                  setRecargandoTabla(true);
                  try {
                    await onRecargarIntExt();
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

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3">Id</th>
                <th className="py-2.5 px-3">Fecha Solicitud</th>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Nombre</th>
                <th className="py-2.5 px-3">Sede</th>
                <th className="py-2.5 px-3">Area</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3 text-right">Cantidad</th>
                <th className="py-2.5 px-3">Motivo</th>
                <th className="py-2.5 px-3">Semana</th>
                <th className="py-2.5 px-3">Fecha Entrega</th>
                <th className="py-2.5 px-3">Observación</th>
                <th className="py-2.5 px-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitudesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-400">
                    No hay registros en Solicitud Extra todavía.
                  </td>
                </tr>
              ) : (
                solicitudesFiltradas.map((s, idx) => (
                  <tr key={`${s.id}-${s.codigo}-${idx}`} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0a2958] whitespace-nowrap">{s.id}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaSolicitud}</td>
                    <td className="py-2.5 px-3 font-mono">{s.codigo}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{s.nombre}</td>
                    <td className="py-2.5 px-3 font-bold">{s.sede}</td>
                    <td className="py-2.5 px-3">{s.area}</td>
                    <td className="py-2.5 px-3 font-semibold">{s.producto}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#0a2958]">{s.cantidad}</td>
                    <td className="py-2.5 px-3">{s.motivo}</td>
                    <td className="py-2.5 px-3 font-bold text-[#E60000]">
                      {s.semana || (s.fechaEntrega ? String(getISOWeekNumber(s.fechaEntrega)) : '—')}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{s.fechaEntrega}</td>
                    <td className="py-2.5 px-3 max-w-xs truncate" title={s.observacion}>
                      {s.observacion || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700">{s.estado || 'Registrada'}</td>
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
