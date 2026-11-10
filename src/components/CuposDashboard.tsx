import React, { useState, useMemo } from 'react';
import { Calendar, Building2, Flower, Sparkles, ArrowRight } from 'lucide-react';
import { SolicitudFlor, Sede } from '../types';
import { CUPOS_CONFIG } from '../data/initialData';
import { getUpcomingFridays, formatShortDate, getWeekLabel } from '../utils/dateUtils';

interface CuposDashboardProps {
  solicitudes: SolicitudFlor[];
  onIrAFormulario: () => void;
}

export const CuposDashboard: React.FC<CuposDashboardProps> = ({
  solicitudes,
  onIrAFormulario,
}) => {
  const upcomingFridays = useMemo(() => getUpcomingFridays(8), []);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(upcomingFridays[0]?.dateString || '');

  const semanaNombre = useMemo(() => getWeekLabel(semanaSeleccionada), [semanaSeleccionada]);

  // Métricas por sede para la semana seleccionada
  const metricasPorSede = useMemo(() => {
    const solicitudesSemana = solicitudes.filter(
      (s) => s.fechaEntrega === semanaSeleccionada && s.estado !== 'Cancelada'
    );

    const sedes: Sede[] = ['Sede MG', 'Sede HA', 'Sede SC'];

    return sedes.map((sede) => {
      const config = CUPOS_CONFIG[sede];
      const enSede = solicitudesSemana.filter((s) => s.sede === sede);
      const ramosUsados = enSede.filter((s) => s.tipoProducto === 'ramo').length;
      const bouquetsUsados = enSede.filter((s) => s.tipoProducto === 'bouquet').length;
      const totalUsados = enSede.length;

      const ramosMax = config.ramosMax;
      const bouquetsMax = config.bouquetsMax || 0;

      const ramosDisponibles = Math.max(0, ramosMax - ramosUsados);
      const bouquetsDisponibles = Math.max(0, bouquetsMax - bouquetsUsados);
      const totalDisponibles = Math.max(0, ramosMax - totalUsados);

      const porcentajeRamos = Math.min(100, Math.round((ramosUsados / ramosMax) * 100));
      const porcentajeBouquets = bouquetsMax > 0 ? Math.min(100, Math.round((bouquetsUsados / bouquetsMax) * 100)) : 0;
      const porcentajeTotal = Math.min(100, Math.round((totalUsados / ramosMax) * 100));

      return {
        sede,
        ramosMax,
        ramosUsados,
        ramosDisponibles,
        porcentajeRamos,
        bouquetsMax,
        bouquetsUsados,
        bouquetsDisponibles,
        porcentajeBouquets,
        totalUsados,
        totalDisponibles,
        porcentajeTotal,
        solicitudesDetalle: enSede,
      };
    });
  }, [solicitudes, semanaSeleccionada]);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E60000]">
            Capacidad Semanal de Poscosecha
          </span>
          <h2 className="text-xl font-extrabold text-[#0a2958] tracking-tight">
            Cupos Semanales de Flor por Sede ({semanaNombre})
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Disponibilidad de ramos y bouquets para entrega de los días viernes
          </p>
        </div>

        {/* Selector de Viernes */}
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

      {/* Reglas de Cupos fijadas por la empresa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Regla 1: Sede MG */}
        <div className="bg-white p-4 rounded-xl border border-[#0a2958]/15 shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0a2958] text-white flex items-center justify-center font-bold text-xs shrink-0">
            MG
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-[#0a2958]">Sede MG (Cupo Mixto)</h4>
            <p className="text-slate-600 mt-0.5">
              <strong className="text-[#0a2958]">20 ramos/semana</strong> y{' '}
              <strong className="text-[#E60000]">5 bouquet/semana</strong>
            </p>
            <span className="text-[10px] text-slate-400 font-medium">Poscosecha Principal MG</span>
          </div>
        </div>

        {/* Regla 2: Sede HA */}
        <div className="bg-white p-4 rounded-xl border border-[#0a2958]/15 shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0a2958]/80 text-white flex items-center justify-center font-bold text-xs shrink-0">
            HA
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-[#0a2958]">Sede HA</h4>
            <p className="text-slate-600 mt-0.5">
              <strong className="text-[#0a2958]">30 ramos/semana</strong> en total
            </p>
            <span className="text-[10px] text-slate-400 font-medium">Poscosecha Sede HA</span>
          </div>
        </div>

        {/* Regla 3: Sede SC */}
        <div className="bg-white p-4 rounded-xl border border-[#0a2958]/15 shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0a2958]/70 text-white flex items-center justify-center font-bold text-xs shrink-0">
            SC
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-[#0a2958]">Sede SC</h4>
            <p className="text-slate-600 mt-0.5">
              <strong className="text-[#0a2958]">20 ramos/semana</strong> en total
            </p>
            <span className="text-[10px] text-slate-400 font-medium">Poscosecha Sede SC</span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Capacidad por Sede para la semana */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {metricasPorSede.map((m) => {
          const isMG = m.sede === 'Sede MG';

          return (
            <div
              key={m.sede}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between"
            >
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#0a2958]" />
                    <h3 className="font-extrabold text-[#0a2958] text-base">{m.sede}</h3>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#0a2958]/10 text-[#0a2958]">
                    {semanaNombre}
                  </span>
                </div>

                {/* Métricas específicas */}
                {isMG ? (
                  <div className="space-y-4">
                    {/* Ramos MG */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 flex items-center gap-1">
                          <Flower className="w-3.5 h-3.5 text-[#E60000]" /> Ramos Monovarietales
                        </span>
                        <span className="text-slate-900">
                          {m.ramosUsados} / {m.ramosMax} ({m.ramosDisponibles} disp.)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            m.porcentajeRamos >= 100
                              ? 'bg-[#E60000]'
                              : m.porcentajeRamos >= 75
                              ? 'bg-amber-500'
                              : 'bg-[#0a2958]'
                          }`}
                          style={{ width: `${m.porcentajeRamos}%` }}
                        />
                      </div>
                    </div>

                    {/* Bouquets MG */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-[#0a2958]" /> Bouquets Mixtos
                        </span>
                        <span className="text-slate-900">
                          {m.bouquetsUsados} / {m.bouquetsMax} ({m.bouquetsDisponibles} disp.)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            m.porcentajeBouquets >= 100
                              ? 'bg-[#E60000]'
                              : m.porcentajeBouquets >= 75
                              ? 'bg-amber-500'
                              : 'bg-[#0a2958]'
                          }`}
                          style={{ width: `${m.porcentajeBouquets}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Sede HA / SC */
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700 flex items-center gap-1">
                        <Flower className="w-3.5 h-3.5 text-[#0a2958]" /> Ramos Totales
                      </span>
                      <span className="text-slate-900">
                        {m.totalUsados} / {m.ramosMax} ({m.totalDisponibles} disp.)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          m.porcentajeTotal >= 100
                            ? 'bg-[#E60000]'
                            : m.porcentajeTotal >= 75
                            ? 'bg-amber-500'
                            : 'bg-[#0a2958]'
                        }`}
                        style={{ width: `${m.porcentajeTotal}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Lista compacta de solicitudes para esta sede y semana */}
              <div className="p-4 bg-slate-50/70 text-xs">
                <span className="font-bold text-slate-600 block mb-2 text-[11px] uppercase tracking-wider">
                  Solicitudes para este viernes ({m.solicitudesDetalle.length})
                </span>
                {m.solicitudesDetalle.length === 0 ? (
                  <p className="text-slate-400 text-xs italic py-2">
                    No hay solicitudes registradas aún para este viernes.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {m.solicitudesDetalle.map((sol) => (
                      <div
                        key={sol.id}
                        className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-800">{sol.nombre}</span>
                          <span className="text-slate-500 block">{sol.producto}</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#0a2958] font-bold">
                          {sol.codigo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón para ir a solicitar */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onIrAFormulario}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
        >
          <span>Ir al Formulario de Solicitud</span>
          <ArrowRight className="w-4 h-4 text-[#E60000]" />
        </button>
      </div>
    </div>
  );
};
