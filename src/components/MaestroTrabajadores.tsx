import React, { useState, useMemo } from 'react';
import { Users, Search, Plus, Upload, CheckCircle2, RefreshCw, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [nuevaCedula, setNuevaCedula] = useState('');
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
        (t.cedula && t.cedula.toLowerCase().includes(q)) ||
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
    if (!nuevaCedula.trim()) {
      setErrorModal('La cédula es obligatoria');
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
      cedula: nuevaCedula.replace(/\D/g, ''),
      nombre: nuevoNombre.trim(),
      sede: nuevaSede,
      cargo: nuevoCargo.trim() || 'Operario',
      area: 'Poscosecha',
      activo: true,
    });

    setNuevoCodigo('');
    setNuevaCedula('');
    setNuevoNombre('');
    setErrorModal('');
    setMostrarModalNuevo(false);
  };

  // Descargar plantilla en Excel para cargar el Maestro
  const descargarPlantillaMaestro = () => {
    const headers = ['Código', 'Cédula', 'Nombre', 'Sede', 'Cargo', 'Estado'];
    const ejemplo = [
      ['5705', '1036654321', 'EJEMPLO NOMBRE COMPLETO', 'Sede MG', 'OPERARIO POSCOSECHA', 'Activo'],
      ['10203', '1036987654', 'EJEMPLO TRABAJADOR HA', 'Sede HA', 'AUXILIAR POSCOSECHA', 'Activo'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplo]);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 34 },
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maestro');
    XLSX.writeFile(wb, 'Plantilla_Maestro_Trabajadores.xlsx');
  };

  // Importar Maestro desde archivo Excel (.xlsx/.xls) o CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inputEl = e.target;
    const isCsvLike = /\.(csv|txt)$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const result = evt.target?.result;
        if (!result) return;

        const workbook = isCsvLike
          ? XLSX.read(result as string, { type: 'string' })
          : XLSX.read(new Uint8Array(result as ArrayBuffer), { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
        if (!rows || rows.length === 0) return;

        const firstRowStr = rows[0].map((c) => String(c || '').toLowerCase()).join(' ');
        const hasHeader =
          firstRowStr.includes('código') ||
          firstRowStr.includes('codigo') ||
          firstRowStr.includes('nombre') ||
          firstRowStr.includes('cedula') ||
          firstRowStr.includes('cédula');

        const startIdx = hasHeader ? 1 : 0;
        const headers = hasHeader
          ? rows[0].map((c) =>
              String(c || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
            )
          : [];

        const findCol = (clues: string[], fallback: number) => {
          if (!headers.length) return fallback;
          const idx = headers.findIndex((h) => clues.some((c) => h.includes(c)));
          return idx >= 0 ? idx : fallback;
        };

        const idxCodigo = findCol(['codigo', 'id rh', 'id'], 0);
        const idxCedula = findCol(['cedula', 'documento', 'identificacion', 'cc'], -1);
        const idxNombre = findCol(['nombre'], idxCedula === 1 ? 2 : 1);
        const idxSede = findCol(['sede'], idxCedula === 1 ? 3 : 2);
        const idxCargo = findCol(['cargo', 'funcion'], idxCedula === 1 ? 4 : 3);
        const idxEstado = findCol(['estado'], idxCedula === 1 ? 5 : 4);

        const nuevosTrabajadores: TrabajadorMaestro[] = [];

        for (let i = startIdx; i < rows.length; i++) {
          const cols = rows[i];
          const codigoVal = String(cols[idxCodigo] ?? '').trim();
          const nombreVal = String(cols[idxNombre] ?? '').trim();
          if (!codigoVal || !nombreVal) continue;

          const cedulaRaw = idxCedula >= 0 ? String(cols[idxCedula] ?? '').trim() : '';
          const cedulaDigits = cedulaRaw.replace(/\D/g, '');
          const cedulaVal = cedulaDigits || cedulaRaw;

          const rawSede = String(cols[idxSede] ?? 'Sede MG').trim();
          let parsedSede: Sede = 'Sede MG';
          if (rawSede.toUpperCase().includes('HA')) parsedSede = 'Sede HA';
          else if (rawSede.toUpperCase().includes('SC')) parsedSede = 'Sede SC';

          const estadoVal = String(cols[idxEstado] ?? 'Activo').trim().toLowerCase();

          nuevosTrabajadores.push({
            codigo: codigoVal.toUpperCase(),
            cedula: cedulaVal,
            nombre: nombreVal,
            sede: parsedSede,
            cargo: String(cols[idxCargo] ?? '').trim() || 'Operario',
            area: 'Poscosecha',
            activo: estadoVal !== 'inactivo',
          });
        }

        if (nuevosTrabajadores.length > 0) {
          onImportarCSV(nuevosTrabajadores);
        }
      } catch (err) {
        console.error('Error al leer archivo del maestro:', err);
      } finally {
        inputEl.value = '';
      }
    };

    if (isCsvLike) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
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
              Se guardará y sincronizará automáticamente con Google Drive para uso inmediato en los formularios.
            </p>

            {errorModal && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#E60000] text-xs font-semibold">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleGuardarNuevo} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Código de Empleado *
                  </label>
                  <input
                    type="text"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    placeholder="Ej: 5705"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0a2958] font-mono uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cédula *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={nuevaCedula}
                    onChange={(e) => setNuevaCedula(e.target.value.replace(/\D/g, ''))}
                    placeholder="Solo números"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0a2958] font-mono font-bold"
                  />
                </div>
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
            Catálogo Oficial de Personal • Sincronización Automática
          </span>
          <h2 className="text-xl font-extrabold text-[#0a2958] tracking-tight">
            Actualizar Maestro: Solicitud Flor Obsequio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Los formularios validan automáticamente código, cédula, nombre y sede con Google Drive ({maestro.length} registros)
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
            <span>Importar maestro</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
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

      {/* Plantilla para cargar Maestro */}
      <div className="bg-white p-5 rounded-2xl border border-[#0a2958]/15 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0a2958]/10 text-[#0a2958] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#0a2958]">
                Plantilla para cargar Maestro
              </h3>
              <p className="text-xs text-slate-500">
                Use estas columnas (incluida <strong>Cédula</strong>) en su archivo Excel (.xlsx) o CSV antes de presionar <strong>Importar maestro</strong>; los cambios se sincronizan automáticamente con Drive.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={descargarPlantillaMaestro}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#0a2958]/20 bg-[#0a2958]/5 hover:bg-[#0a2958]/10 text-[#0a2958] text-xs font-bold transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#E60000]" />
            <span>Descargar plantilla (.xlsx)</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[#0a2958] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-3">Código *</th>
                <th className="py-2 px-3">Cédula *</th>
                <th className="py-2 px-3">Nombre *</th>
                <th className="py-2 px-3">Sede *</th>
                <th className="py-2 px-3">Cargo</th>
                <th className="py-2 px-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="py-2 px-3 font-mono font-bold text-[#0a2958]">5705</td>
                <td className="py-2 px-3 font-mono">1036654321</td>
                <td className="py-2 px-3">EJEMPLO NOMBRE COMPLETO</td>
                <td className="py-2 px-3 font-semibold">Sede MG</td>
                <td className="py-2 px-3">OPERARIO POSCOSECHA</td>
                <td className="py-2 px-3">Activo</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono font-bold text-[#0a2958]">10203</td>
                <td className="py-2 px-3 font-mono">1036987654</td>
                <td className="py-2 px-3">EJEMPLO TRABAJADOR HA</td>
                <td className="py-2 px-3 font-semibold">Sede HA</td>
                <td className="py-2 px-3">AUXILIAR POSCOSECHA</td>
                <td className="py-2 px-3">Activo</td>
              </tr>
            </tbody>
          </table>
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
            placeholder="Buscar por código (ej: 5705), cédula, nombre o cargo..."
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
                <th className="py-3 px-4">Cédula</th>
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
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No se encontraron trabajadores con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                trabajadoresFiltrados.map((t, idx) => (
                  <tr key={`${t.codigo}-${idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#0a2958] whitespace-nowrap">
                      {t.codigo}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {t.cedula || '—'}
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
                        {t.activo === false ? 'Inactivo' : 'Activo'}
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
