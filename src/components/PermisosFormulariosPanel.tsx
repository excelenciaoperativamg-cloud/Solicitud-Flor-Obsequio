import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Briefcase,
  Search,
  Plus,
  X,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserMinus,
  Eye,
  Lock,
  Globe,
} from 'lucide-react';
import {
  TrabajadorMaestro,
  FormularioPermisoKey,
  PermisoFormulario,
  PermisosFormulariosMap,
} from '../types';
import {
  FORMULARIOS_PERMISOS_META,
  clonarPermisosFormularios,
  evaluarPermisoFormulario,
  normalizarTextoRol,
} from '../utils/roles';

interface PermisosFormulariosPanelProps {
  sesion: TrabajadorMaestro;
  maestro: TrabajadorMaestro[];
  permisos: PermisosFormulariosMap;
  sheetsSupported?: boolean;
  needsAppsScriptUpdate?: boolean;
  onGuardarPermisos: (
    nuevosPermisos: PermisosFormulariosMap
  ) => Promise<{
    success: boolean;
    error?: string;
    syncedToDrive?: boolean;
    pendingAppsScriptUpdate?: boolean;
  }>;
  onRestaurarDefecto: (formKey?: FormularioPermisoKey) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

export const PermisosFormulariosPanel: React.FC<PermisosFormulariosPanelProps> = ({
  maestro,
  permisos,
  needsAppsScriptUpdate,
  onGuardarPermisos,
  onRestaurarDefecto,
}) => {
  const [borrador, setBorrador] = useState<PermisosFormulariosMap>(() =>
    clonarPermisosFormularios(permisos)
  );
  const [formSeleccionado, setFormSeleccionado] = useState<FormularioPermisoKey>('ingresos-seleccion');
  const [busquedaPersona, setBusquedaPersona] = useState('');
  const [busquedaCargo, setBusquedaCargo] = useState('');
  const [nuevaPalabraClave, setNuevaPalabraClave] = useState('');
  const [busquedaExcluido, setBusquedaExcluido] = useState('');
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false);
  const [busquedaPreview, setBusquedaPreview] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<{
    tipo: 'ok' | 'warn' | 'err';
    texto: string;
  } | null>(null);

  useEffect(() => {
    setBorrador(clonarPermisosFormularios(permisos));
  }, [permisos]);

  const hayCambios = useMemo(() => {
    return JSON.stringify(borrador) !== JSON.stringify(clonarPermisosFormularios(permisos));
  }, [borrador, permisos]);

  // Catálogo de cargos únicos del Maestro con cantidad de colaboradores activos
  const cargosCatalogo = useMemo(() => {
    const mapa = new Map<string, { nombre: string; norm: string; cantidad: number }>();
    for (const w of maestro) {
      if (w.activo === false) continue;
      const rawCargo = String(w.cargo || '').trim();
      if (!rawCargo) continue;
      const norm = normalizarTextoRol(rawCargo);
      const existente = mapa.get(norm);
      if (existente) {
        existente.cantidad += 1;
      } else {
        mapa.set(norm, { nombre: rawCargo, norm, cantidad: 1 });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [maestro]);

  // Mapa rápido por código de trabajador
  const mapaMaestroPorCodigo = useMemo(() => {
    const mapa = new Map<string, TrabajadorMaestro>();
    for (const w of maestro) {
      const cod = String(w.codigo || '').trim().toUpperCase();
      if (cod) mapa.set(cod, w);
    }
    return mapa;
  }, [maestro]);

  // Conteo de personas habilitadas por formulario según el borrador actual
  const conteosPorFormulario = useMemo(() => {
    const conteos: Record<string, number> = {};
    const activos = maestro.filter((w) => w.activo !== false);
    for (const meta of FORMULARIOS_PERMISOS_META) {
      let c = 0;
      for (const w of activos) {
        if (evaluarPermisoFormulario(w, meta.key, borrador)) {
          c += 1;
        }
      }
      conteos[meta.key] = c;
    }
    return conteos;
  }, [maestro, borrador]);

  const metaActual = useMemo(
    () =>
      FORMULARIOS_PERMISOS_META.find((m) => m.key === formSeleccionado) ||
      FORMULARIOS_PERMISOS_META[0],
    [formSeleccionado]
  );

  const reglaActual: PermisoFormulario = borrador[formSeleccionado];

  const actualizarRegla = (updater: (prev: PermisoFormulario) => PermisoFormulario) => {
    setMensajeEstado(null);
    setBorrador((prev) => ({
      ...prev,
      [formSeleccionado]: updater(prev[formSeleccionado]),
    }));
  };

  // Búsqueda de trabajadores para agregar por código
  const resultadosBusquedaPersona = useMemo(() => {
    const q = normalizarTextoRol(busquedaPersona);
    if (!q) return [];
    const yaAgregados = new Set(reglaActual.codigos.map((c) => c.trim().toUpperCase()));
    return maestro
      .filter((w) => {
        if (w.activo === false) return false;
        const cod = String(w.codigo || '').trim().toUpperCase();
        if (yaAgregados.has(cod)) return false;
        return (
          normalizarTextoRol(w.codigo).includes(q) ||
          normalizarTextoRol(w.cedula || '').includes(q) ||
          normalizarTextoRol(w.nombre).includes(q) ||
          normalizarTextoRol(w.cargo || '').includes(q)
        );
      })
      .slice(0, 12);
  }, [busquedaPersona, maestro, reglaActual.codigos]);

  // Búsqueda de trabajadores para excluir
  const resultadosBusquedaExcluido = useMemo(() => {
    const q = normalizarTextoRol(busquedaExcluido);
    if (!q) return [];
    const yaExcluidos = new Set(
      (reglaActual.codigosExcluidos || []).map((c) => c.trim().toUpperCase())
    );
    return maestro
      .filter((w) => {
        if (w.activo === false) return false;
        const cod = String(w.codigo || '').trim().toUpperCase();
        if (yaExcluidos.has(cod)) return false;
        return (
          normalizarTextoRol(w.codigo).includes(q) ||
          normalizarTextoRol(w.cedula || '').includes(q) ||
          normalizarTextoRol(w.nombre).includes(q)
        );
      })
      .slice(0, 10);
  }, [busquedaExcluido, maestro, reglaActual.codigosExcluidos]);

  // Cargos filtrados
  const cargosFiltrados = useMemo(() => {
    const q = normalizarTextoRol(busquedaCargo);
    if (!q) return cargosCatalogo;
    return cargosCatalogo.filter((c) => c.norm.includes(q));
  }, [cargosCatalogo, busquedaCargo]);

  // Trabajadores con acceso en vivo (vista previa)
  const trabajadoresConAccesoPreview = useMemo(() => {
    if (!mostrarVistaPrevia) return [];
    const q = normalizarTextoRol(busquedaPreview);
    return maestro
      .filter((w) => w.activo !== false && evaluarPermisoFormulario(w, formSeleccionado, borrador))
      .filter((w) => {
        if (!q) return true;
        return (
          normalizarTextoRol(w.codigo).includes(q) ||
          normalizarTextoRol(w.nombre).includes(q) ||
          normalizarTextoRol(w.cargo || '').includes(q) ||
          normalizarTextoRol(w.sede).includes(q)
        );
      })
      .slice(0, 60);
  }, [mostrarVistaPrevia, busquedaPreview, maestro, formSeleccionado, borrador]);

  const toggleCargo = (cargoNombre: string) => {
    const normTarget = normalizarTextoRol(cargoNombre);
    actualizarRegla((prev) => {
      const existe = prev.cargos.some((c) => normalizarTextoRol(c) === normTarget);
      return {
        ...prev,
        cargos: existe
          ? prev.cargos.filter((c) => normalizarTextoRol(c) !== normTarget)
          : [...prev.cargos, cargoNombre],
      };
    });
  };

  const agregarCodigo = (codigo: string) => {
    const limpio = String(codigo || '').trim().toUpperCase();
    if (!limpio) return;
    actualizarRegla((prev) => {
      if (prev.codigos.some((c) => c.trim().toUpperCase() === limpio)) return prev;
      return {
        ...prev,
        codigos: [...prev.codigos, limpio],
      };
    });
    setBusquedaPersona('');
  };

  const quitarCodigo = (codigo: string) => {
    const limpio = codigo.trim().toUpperCase();
    actualizarRegla((prev) => ({
      ...prev,
      codigos: prev.codigos.filter((c) => c.trim().toUpperCase() !== limpio),
    }));
  };

  const agregarPalabraClave = (valor?: string) => {
    const val = String(valor ?? nuevaPalabraClave).trim().toUpperCase();
    if (!val) return;
    const norm = normalizarTextoRol(val);
    actualizarRegla((prev) => {
      if (prev.palabrasClaveCargo.some((k) => normalizarTextoRol(k) === norm)) return prev;
      return {
        ...prev,
        palabrasClaveCargo: [...prev.palabrasClaveCargo, val],
      };
    });
    if (valor === undefined) setNuevaPalabraClave('');
  };

  const quitarPalabraClave = (kw: string) => {
    const norm = normalizarTextoRol(kw);
    actualizarRegla((prev) => ({
      ...prev,
      palabrasClaveCargo: prev.palabrasClaveCargo.filter((k) => normalizarTextoRol(k) !== norm),
    }));
  };

  const agregarExcluido = (codigo: string) => {
    const limpio = String(codigo || '').trim().toUpperCase();
    if (!limpio) return;
    actualizarRegla((prev) => {
      const lista = prev.codigosExcluidos || [];
      if (lista.some((c) => c.trim().toUpperCase() === limpio)) return prev;
      return {
        ...prev,
        codigosExcluidos: [...lista, limpio],
      };
    });
    setBusquedaExcluido('');
  };

  const quitarExcluido = (codigo: string) => {
    const limpio = codigo.trim().toUpperCase();
    actualizarRegla((prev) => ({
      ...prev,
      codigosExcluidos: (prev.codigosExcluidos || []).filter(
        (c) => c.trim().toUpperCase() !== limpio
      ),
    }));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setMensajeEstado(null);
    try {
      const res = await onGuardarPermisos(borrador);
      if (!res.success) {
        setMensajeEstado({
          tipo: 'err',
          texto: res.error || 'No se pudieron guardar los permisos.',
        });
      } else if (res.pendingAppsScriptUpdate) {
        setMensajeEstado({
          tipo: 'warn',
          texto:
            'Permisos aplicados inmediatamente en la aplicación. Para guardarlos también en Google Sheets, implemente una Nueva versión de Apps Script desde Google Drive.',
        });
      } else {
        setMensajeEstado({
          tipo: 'ok',
          texto: 'Permisos guardados y sincronizados correctamente con Google Drive.',
        });
      }
    } catch (err: any) {
      setMensajeEstado({
        tipo: 'err',
        texto: err?.message || 'Error inesperado guardando los permisos.',
      });
    } finally {
      setGuardando(false);
    }
  };

  const handleRestaurar = async (soloActual: boolean) => {
    setGuardando(true);
    setMensajeEstado(null);
    try {
      const res = await onRestaurarDefecto(soloActual ? formSeleccionado : undefined);
      if (!res.success) {
        setMensajeEstado({
          tipo: 'err',
          texto: res.error || 'No se pudieron restaurar los permisos por defecto.',
        });
      } else {
        setMensajeEstado({
          tipo: 'ok',
          texto: soloActual
            ? `Permisos de "${metaActual.nombre}" restaurados a la configuración por defecto.`
            : 'Todos los formularios fueron restaurados a los permisos por defecto.',
        });
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Encabezado */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0a2958] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E60000]">
              Administración • Control de Acceso
            </span>
            <h2 className="text-xl font-extrabold text-[#0a2958] tracking-tight">
              Permisos de Acceso a Formularios
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina quién puede visualizar y registrar en cada formulario por persona (código), cargo o acceso general.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={guardando}
            onClick={() => handleRestaurar(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Restaurar todos</span>
          </button>

          <button
            type="button"
            disabled={guardando || !hayCambios}
            onClick={handleGuardar}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer ${
              hayCambios
                ? 'bg-[#E60000] hover:bg-[#c70000] text-white'
                : 'bg-[#0a2958] text-white opacity-60 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{guardando ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      {/* Avisos de guardado / Apps Script */}
      {mensajeEstado && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
            mensajeEstado.tipo === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : mensajeEstado.tipo === 'warn'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-[#E60000]'
          }`}
        >
          {mensajeEstado.tipo === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{mensajeEstado.texto}</span>
        </div>
      )}

      {needsAppsScriptUpdate && !mensajeEstado && (
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Los permisos se aplican de inmediato en la aplicación y en el servidor. Si desea respaldarlos también en la hoja{' '}
            <strong>Permisos Formularios</strong> de Google Sheets, copie el código actualizado desde{' '}
            <strong>Administración → Google Drive</strong> e implemente una <strong>Nueva versión</strong>.
          </span>
        </div>
      )}

      {/* Distribución principal: Lista de formularios + Editor de reglas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna izquierda: Formularios */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0a2958]">
              Formularios del Sistema
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {FORMULARIOS_PERMISOS_META.map((meta) => {
              const regla = borrador[meta.key];
              const activo = formSeleccionado === meta.key;
              const conteo = conteosPorFormulario[meta.key] ?? 0;

              return (
                <button
                  key={meta.key}
                  type="button"
                  onClick={() => {
                    setFormSeleccionado(meta.key);
                    setMostrarVistaPrevia(false);
                    setBusquedaPreview('');
                  }}
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                    activo
                      ? 'bg-[#0a2958] text-white'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">{meta.nombre}</div>
                    <div
                      className={`text-[11px] mt-0.5 line-clamp-1 ${
                        activo ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {regla.todos
                        ? 'Todo el personal habilitado'
                        : `${regla.cargos.length + regla.palabrasClaveCargo.length} regla(s) cargo · ${regla.codigos.length} persona(s)`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tabular-nums ${
                      activo
                        ? 'bg-white/15 text-white'
                        : regla.todos
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-[#0a2958]'
                    }`}
                  >
                    {conteo}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Columna derecha: Editor del formulario seleccionado */}
        <div className="lg:col-span-8 space-y-5">
          {/* Cabecera del formulario */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#0a2958]">{metaActual.nombre}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{metaActual.descripcion}</p>
              </div>
              <button
                type="button"
                disabled={guardando}
                onClick={() => handleRestaurar(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition cursor-pointer shrink-0 self-start sm:self-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar por defecto</span>
              </button>
            </div>

            {/* Garantía para administradores */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-700">
              <Lock className="w-4 h-4 text-[#0a2958] shrink-0" />
              <span>
                Los <strong>administradores</strong> (<em>ANALISTA GESTIÓN DE INFORMACIÓN EAI</em> /{' '}
                <em>Administrador</em>) siempre conservan acceso garantizado a este formulario.
              </span>
            </div>

            {/* Switch: Todo el personal */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    reglaActual.todos
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-[#0a2958]">
                    Acceso libre para todo el personal del Maestro
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Si está activado, cualquier trabajador activo podrá ver y utilizar este formulario (salvo códigos excluidos).
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={reglaActual.todos}
                onClick={() =>
                  actualizarRegla((prev) => ({
                    ...prev,
                    todos: !prev.todos,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  reglaActual.todos ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    reglaActual.todos ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Configuración por personas y cargos (cuando no es acceso total o para ajustar reglas) */}
          {!reglaActual.todos && (
            <>
              {/* 1. Personas específicas por código */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0a2958]" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0a2958]">
                      Personas Específicas Habilitadas ({reglaActual.codigos.length})
                    </h4>
                  </div>
                </div>

                {/* Buscador para agregar persona */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={busquedaPersona}
                    onChange={(e) => setBusquedaPersona(e.target.value)}
                    placeholder="Buscar trabajador en Maestro por código (ej: 8558), cédula o nombre para agregar..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/15"
                  />
                </div>

                {resultadosBusquedaPersona.length > 0 && (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-slate-50/70">
                    {resultadosBusquedaPersona.map((w) => (
                      <div
                        key={w.codigo}
                        className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-white transition"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            <span className="font-mono text-[#0a2958] mr-1.5">{w.codigo}</span>
                            {w.nombre}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {w.cargo || 'Sin cargo'} · {w.sede}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => agregarCodigo(w.codigo)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0a2958] hover:bg-[#0d346e] text-white text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {reglaActual.codigos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No hay personas específicas agregadas por código individual.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {reglaActual.codigos.map((cod) => {
                      const info = mapaMaestroPorCodigo.get(cod.trim().toUpperCase());
                      return (
                        <div
                          key={cod}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#0a2958]/20 bg-[#0a2958]/[0.03]"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-[#0a2958] truncate">
                              <span className="font-mono">{cod}</span>
                              {info ? ` · ${info.nombre}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {info ? `${info.cargo || 'Sin cargo'} · ${info.sede}` : 'Código manual'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => quitarCodigo(cod)}
                            title="Quitar acceso a esta persona"
                            className="p-1 rounded-lg text-slate-400 hover:text-[#E60000] hover:bg-red-50 transition cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Reglas de Cargo y Cargos exactos del Maestro */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#0a2958]" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0a2958]">
                    Cargos Habilitados
                  </h4>
                </div>

                {/* Reglas por coincidencia (agrupa todas las variantes de un cargo) */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div>
                    <p className="text-xs font-bold text-[#0a2958]">
                      Reglas por grupo o palabra clave de cargo
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Habilita automáticamente todos los cargos que contengan el texto indicado (por ejemplo,{' '}
                      <span className="font-mono">DIRECTOR</span> o{' '}
                      <span className="font-mono">ANALISTA GESTIÓN HUMANA</span>).
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nuevaPalabraClave}
                      onChange={(e) => setNuevaPalabraClave(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          agregarPalabraClave();
                        }
                      }}
                      placeholder="Ej: DIRECTOR, SUPERVISOR POSCOSECHA, JEFE..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium uppercase focus:outline-none focus:border-[#0a2958]"
                    />
                    <button
                      type="button"
                      onClick={() => agregarPalabraClave()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0a2958] hover:bg-[#0d346e] text-white text-xs font-bold cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar regla</span>
                    </button>
                  </div>

                  {reglaActual.palabrasClaveCargo.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {reglaActual.palabrasClaveCargo.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a2958] text-white text-[11px] font-bold"
                        >
                          <span>Contiene: {kw}</span>
                          <button
                            type="button"
                            onClick={() => quitarPalabraClave(kw)}
                            className="hover:text-red-300 cursor-pointer"
                            title="Eliminar regla"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lista de cargos exactos del Maestro */}
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      Selección individual por cargo del Maestro ({reglaActual.cargos.length} seleccionados)
                    </span>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={busquedaCargo}
                        onChange={(e) => setBusquedaCargo(e.target.value)}
                        placeholder="Filtrar cargos..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#0a2958]"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {cargosFiltrados.map((cargoItem) => {
                      const marcadoExacto = reglaActual.cargos.some(
                        (c) => normalizarTextoRol(c) === cargoItem.norm
                      );
                      const cubiertoPorRegla = reglaActual.palabrasClaveCargo.some((kw) => {
                        const kwNorm = normalizarTextoRol(kw);
                        return kwNorm.length > 0 && cargoItem.norm.includes(kwNorm);
                      });
                      const checked = marcadoExacto || cubiertoPorRegla;

                      return (
                        <label
                          key={cargoItem.norm}
                          className={`px-3.5 py-2 flex items-center justify-between gap-3 text-xs cursor-pointer transition ${
                            checked ? 'bg-slate-50/90' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={cubiertoPorRegla && !marcadoExacto}
                              onChange={() => toggleCargo(cargoItem.nombre)}
                              className="w-4 h-4 accent-[#0a2958] rounded cursor-pointer shrink-0"
                            />
                            <span className="font-semibold text-slate-800 truncate">
                              {cargoItem.nombre}
                            </span>
                            {cubiertoPorRegla && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                                Por regla
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 shrink-0">
                            {cargoItem.cantidad}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 3. Excepciones (códigos excluidos) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2">
              <UserMinus className="w-4 h-4 text-[#E60000]" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0a2958]">
                Exclusiones Puntuales ({(reglaActual.codigosExcluidos || []).length})
              </h4>
            </div>
            <p className="text-[11px] text-slate-500">
              Opcional: bloquee personas específicas por código aunque pertenezcan a un cargo habilitado o al acceso general (no aplica a administradores).
            </p>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={busquedaExcluido}
                onChange={(e) => setBusquedaExcluido(e.target.value)}
                placeholder="Buscar persona a excluir por código o nombre..."
                className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#0a2958]"
              />
            </div>

            {resultadosBusquedaExcluido.length > 0 && (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto bg-slate-50">
                {resultadosBusquedaExcluido.map((w) => (
                  <div
                    key={w.codigo}
                    className="px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-white text-xs"
                  >
                    <span className="truncate font-semibold text-slate-800">
                      <span className="font-mono text-[#0a2958] mr-1.5">{w.codigo}</span>
                      {w.nombre} ({w.cargo})
                    </span>
                    <button
                      type="button"
                      onClick={() => agregarExcluido(w.codigo)}
                      className="px-2 py-1 rounded bg-[#E60000] text-white text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(reglaActual.codigosExcluidos || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(reglaActual.codigosExcluidos || []).map((cod) => {
                  const info = mapaMaestroPorCodigo.get(cod.trim().toUpperCase());
                  return (
                    <span
                      key={cod}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-[#E60000] border border-rose-200 text-[11px] font-bold"
                    >
                      <span>
                        {cod}
                        {info ? ` · ${info.nombre}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarExcluido(cod)}
                        className="hover:text-rose-900 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Vista previa en vivo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0a2958]" />
                <span className="text-xs font-extrabold text-[#0a2958]">
                  Total con acceso actual a {metaActual.nombre}:{' '}
                  <span className="text-[#E60000] font-mono">
                    {conteosPorFormulario[formSeleccionado] ?? 0}
                  </span>{' '}
                  colaboradores activos
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarVistaPrevia((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0a2958]/20 bg-[#0a2958]/5 hover:bg-[#0a2958]/10 text-[#0a2958] text-xs font-bold cursor-pointer self-start sm:self-center"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{mostrarVistaPrevia ? 'Ocultar lista' : 'Ver personas habilitadas'}</span>
              </button>
            </div>

            {mostrarVistaPrevia && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  value={busquedaPreview}
                  onChange={(e) => setBusquedaPreview(e.target.value)}
                  placeholder="Filtrar personas habilitadas..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#0a2958]"
                />
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {trabajadoresConAccesoPreview.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Ninguna persona coincide con el filtro actual.
                    </div>
                  ) : (
                    trabajadoresConAccesoPreview.map((w) => (
                      <div
                        key={w.codigo}
                        className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-[#0a2958] mr-2">{w.codigo}</span>
                          <span className="font-semibold text-slate-800">{w.nombre}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 truncate">
                          {w.cargo || 'Sin cargo'} · {w.sede}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
