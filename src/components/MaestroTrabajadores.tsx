import React, { useState, useMemo } from 'react';
import { Users, Search, Plus, Upload, CheckCircle2, RefreshCw } from 'lucide-react';
import { TrabajadorMaestro, Sede } from '../types';

interface MaestroTrabajadoresProps {
  maestro: TrabajadorMaestro[];
  onAgregarTrabajador: (nuevo: TrabajadorMaestro) => void;
  onImportarCSV: (trabajadores: TrabajadorMaestro[]) => void;
  isDriveConnected: boolean;
  onRecargarDeDrive?: () => Promise<void>;
  isSyncing: boolean;
}

export const MaestroTrabajadores: React.FC<MaestroTrabajadoresProps> = ({
  maestro,
  onAgregarTrabajador,
  onImportarCSV,
  isDriveConnected,
  onRecargarDeDrive,
  isSyncing,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroSede, setFiltroSede] = useState<string>('todas');
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);

  // Formulario nuevo trabajador
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaSede, setNuevaSede] = useState<Sede>('Sede MG');
  const [nuevoCargo, setNuevoCargo] = useState('Operario Poscosecha');
  const [errorModal, setErrorModal] = useState('');

  // Filtrado
  const trabajadoresFiltrados = useMemo(() => {
    return maestro.filter((t) => {
      const q = busqueda.toLowerCase().trim();
      const matchBusqueda =
        !q ||
        t.codigo.toLowerCase().includes(q) ||
        t.nombre.toLowerCase().includes(q) ||
        (t.cargo && t.cargo.toLowerCase().includes(q));

      const matchSede = filtroSede === 'todas' || t.sede === filtroSede;
      return matchBusqueda && matchSede;
    });
  }, [maestro, busqueda, filtroSede]);

  // Manejar creación
  const handleGuardarNuevo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCodigo.trim()) {
      setErrorModal('El código es obligatorio');
      return;
    }
    if (!nuevoNombre.trim()) {
      setErrorModal('El nombre es obligatorio');
      return;
    }

    const existe = maestro.some(
      (m) => m.codigo.trim().toUpperCase() === nuevoCodigo.trim().toUpperCase()
    );
    if (existe) {
      setErrorModal('Ya existe un trabajador con este código en el Maestro');
      return;
    }

    onAgregarTrabajador({
      codigo: nuevoCodigo.trim().toUpperCase(),
      nombre: nuevoNombre.trim(),
      sede: nuevaSede,
      cargo: nuevoCargo.trim() || 'Operario',
      area: 'Poscosecha',
      activo: true,
    });

    setNuevoCodigo('');
    setNuevoNombre('');
    setErrorModal('');
    setMostrarModalNuevo(false);
  };

  // Importar desde archivo CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return;

        const nuevosTrabajadores: TrabajadorMaestro[] = [];
        const startIdx = lines[0].toLowerCase().includes('código') || lines[0].toLowerCase().includes('codigo') ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
          if (cols.length >= 2 && cols[0] && cols[1]) {
            const rawSede = cols[2] || 'Sede MG';
            let parsedSede: Sede = 'Sede MG';
            if (rawSede.toUpperCase().includes('HA')) parsedSede = 'Sede HA';
            else if (rawSede.toUpperCase().includes('SC')) parsedSede = 'Sede SC';

            nuevosTrabajadores.push({
              codigo: cols[0].toUpperCase(),
              nombre: cols[1],
              sede: parsedSede,
              cargo: cols[3] || 'Operario',
              area: 'Poscosecha',
              activo: true,
            });
          }
        }

        if (nuevosTrabajadores.length > 0) {
          onImportarCSV(nuevosTrabajadores);
        }
      } catch (err) {
        console.error('Error al parsear archivo CSV:', err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Modal Agregar Trabajador */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-extrabold text-[#0a2958] mb-1">
              Agregar Trabajador al Maestro
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Este registro estará disponible de inmediato para el autocompletado del formulario.
            </p>

            {errorModal && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#E60000] text-xs font-semibold">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleGuardarNuevo} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Código de Empleado *
                </label>
                <input
                  type="text"
                  value={nuevoCodigo}
                  onChange={(e) => setNuevoCodigo(e.target.value)}
                  placeholder="Ej: 5705, MG-111, HA-209, SC-307"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0a2958] font-mono uppercase font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Nombres y apellidos completos"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0a2958] font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sede Asignada *
                </label>
                <select
                  value={nuevaSede}
                  onChange={(e) => setNuevaSede(e.target.value as Sede)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-[#0a2958]"
                >
                  <option value="Sede MG">Sede MG</option>
                  <option value="Sede HA">Sede HA</option>
                  <option value="Sede SC">Sede SC</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cargo / Función
                </label>
                <input
                  type="text"
                  value={nuevoCargo}
                  onChange={(e) => setNuevoCargo(e.target.value)}
                  placeholder="Ej: Operaria de Hidratación, Clasificación..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white font-bold cursor-pointer"
                >
                  Guardar en Maestro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E60000]">
            Catálogo Oficial de Personal
          </span>
          <h2 className="text-xl font-extrabold text-[#0a2958] tracking-tight">
            Hoja Maestro: Solicitud Flor Obsequio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            El formulario valida automáticamente el código, nombre y sede con esta base de datos ({maestro.length} registros)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDriveConnected && onRecargarDeDrive && (
            <button
              onClick={onRecargarDeDrive}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#0a2958]/20 bg-[#0a2958]/5 hover:bg-[#0a2958]/10 text-[#0a2958] text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar Maestro con Drive</span>
            </button>
          )}

          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Importar CSV</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setMostrarModalNuevo(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#E60000]" />
            <span>Nuevo Trabajador</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código (ej: 5705), nombre o cargo..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-bold shrink-0">Filtrar Sede:</span>
          <select
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-[#0a2958]"
          >
            <option value="todas">Todas las Sedes</option>
            <option value="Sede MG">Sede MG</option>
            <option value="Sede HA">Sede HA</option>
            <option value="Sede SC">Sede SC</option>
          </select>
        </div>
      </div>

      {/* Tabla Maestro */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nombre Trabajador</th>
                <th className="py-3 px-4">Sede</th>
                <th className="py-3 px-4">Cargo / Función</th>
                <th className="py-3 px-4">Área</th>
                <th className="py-3 px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {trabajadoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No se encontraron trabajadores con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                trabajadoresFiltrados.map((t) => (
                  <tr key={t.codigo} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#0a2958] whitespace-nowrap">
                      {t.codigo}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {t.nombre}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-[#0a2958]">{t.sede}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {t.cargo || 'Operario'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {t.area || 'Poscosecha'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Activo
                      </span>
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
