import React, { useState } from 'react';
import {
  Flower,
  FileText,
  UserCheck,
  Building2,
  FilePlus2,
  Users,
  Briefcase,
  Cloud,
  LogOut,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { TrabajadorMaestro } from '../types';
import { DriveConfig } from '../services/apiClient';
import {
  esRolAdmin,
  esAdministradorSistema,
  puedeVerHojaMaestro,
  puedeVerResumenSolicitud,
  puedeVerSolicitudIntExt,
  puedeVerEspecialesPersonal,
  puedeVerSolicitudComunidad,
} from '../utils/roles';

export type TabNavegacion =
  | 'formulario'
  | 'int-ext'
  | 'especiales-personal'
  | 'solicitud-comunidad'
  | 'solicitudes'
  | 'maestro';

interface SidebarNavegacionProps {
  activeTab: TabNavegacion;
  onSelectTab: (tab: TabNavegacion) => void;
  sesion: TrabajadorMaestro;
  onCerrarSesion: () => void;
  totalSolicitudes: number;
  driveConfig: DriveConfig;
  userGoogleConnected: boolean;
  onOpenDriveModal: () => void;
  abiertoMovil: boolean;
  onCerrarMovil: () => void;
}

function obtenerIniciales(nombre: string): string {
  const partes = String(nombre || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return 'MG';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

export const SidebarNavegacion: React.FC<SidebarNavegacionProps> = ({
  activeTab,
  onSelectTab,
  sesion,
  onCerrarSesion,
  totalSolicitudes,
  driveConfig,
  userGoogleConnected,
  onOpenDriveModal,
  abiertoMovil,
  onCerrarMovil,
}) => {
  const [contraido, setContraido] = useState(false);
  const [submenuPersonalAbierto, setSubmenuPersonalAbierto] = useState(false);
  const [submenuEmpresaAbierto, setSubmenuEmpresaAbierto] = useState(false);
  const [submenuEspPersonalAbierto, setSubmenuEspPersonalAbierto] = useState(false);
  const [submenuComunidadAbierto, setSubmenuComunidadAbierto] = useState(false);

  const esAdmin = esRolAdmin(sesion);
  const esAdminSistema = esAdministradorSistema(sesion);
  const verMaestro = puedeVerHojaMaestro(sesion);
  const verResumen = puedeVerResumenSolicitud(sesion);
  const verIntExt = puedeVerSolicitudIntExt(sesion);
  const verEspPersonal = puedeVerEspecialesPersonal(sesion);
  const verComunidad = puedeVerSolicitudComunidad(sesion);
  const isDriveActive = !!(driveConfig.webhookUrl || userGoogleConnected);

  const personalActivo = activeTab === 'formulario' || activeTab === 'solicitudes';
  const empresaActivo = activeTab === 'int-ext';
  const espPersonalActivo = activeTab === 'especiales-personal';
  const comunidadActivo = activeTab === 'solicitud-comunidad';
  const maestroActivo = activeTab === 'maestro';

  const iniciales = obtenerIniciales(sesion.nombre);

  const manejarSeleccion = (tab: TabNavegacion) => {
    onSelectTab(tab);
    onCerrarMovil();
  };

  const renderContenido = (esMovil: boolean) => {
    const colapsado = !esMovil && contraido;

    return (
      <div className="flex flex-col h-full bg-[#0a2958] text-white select-none">
        {/* IDENTIDAD CORPORATIVA */}
        <div
          className={`px-3.5 py-4 border-b border-white/10 flex items-center ${
            colapsado ? 'justify-center flex-col gap-2.5' : 'justify-between gap-2.5'
          }`}
        >
          <div className={`flex items-center gap-3 min-w-0 ${colapsado ? 'justify-center' : ''}`}>
            <div
              className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-xs"
              title="MG Consultores S.A.S. — Flor de Obsequio"
            >
              <img
                src="/assets/aistudio/logo_639f00ab.png"
                alt="MG Consultores S.A.S."
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/public/assets/aistudio/logo_639f00ab.png';
                }}
              />
            </div>

            {!colapsado && (
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold tracking-wide text-white leading-tight truncate">
                  FLOR DE OBSEQUIO
                </h1>
                <p className="text-[11px] text-slate-300 leading-snug line-clamp-2 mt-0.5">
                  Gestión de solicitudes y cupos semanales
                </p>
              </div>
            )}
          </div>

          {esMovil ? (
            <button
              type="button"
              onClick={onCerrarMovil}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar menú lateral"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setContraido((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title={colapsado ? 'Expandir menú' : 'Contraer menú'}
              aria-label={colapsado ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            >
              {colapsado ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* NAVEGACIÓN PRINCIPAL */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin"
          aria-label="Navegación principal"
        >
          {/* SECCIÓN: MÓDULO ACTIVO – GESTIÓN DE SOLICITUDES */}
          <div className="space-y-2">
            {!colapsado ? (
              <div className="px-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate">
                  Gestión de Solicitudes
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                  Activo
                </span>
              </div>
            ) : (
              <div className="h-px bg-white/10 mx-1" />
            )}

            {/* Solicitud Personal (con submenú expandible/contraíble) */}
            <div
              className={`rounded-xl transition-colors ${
                personalActivo
                  ? 'bg-[#E60000] text-white shadow-sm'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (colapsado) {
                    manejarSeleccion('formulario');
                  } else {
                    setSubmenuPersonalAbierto((prev) => !prev);
                  }
                }}
                aria-expanded={!colapsado ? submenuPersonalAbierto : undefined}
                title="Solicitud Personal"
                className={`w-full flex items-center ${
                  colapsado ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                } text-left rounded-xl cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <UserCheck className="w-4 h-4 shrink-0 text-white" />
                  {!colapsado && (
                    <span className="text-xs font-extrabold truncate whitespace-nowrap">
                      Solicitud Personal
                    </span>
                  )}
                </span>
                {!colapsado &&
                  (submenuPersonalAbierto ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  ))}
              </button>

              {!colapsado && submenuPersonalAbierto && (
                <div className="px-2 pb-2 pt-0.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => manejarSeleccion('formulario')}
                    aria-current={activeTab === 'formulario' ? 'page' : undefined}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
                      activeTab === 'formulario'
                        ? 'bg-white text-[#0a2958] font-extrabold shadow-xs'
                        : personalActivo
                        ? 'text-white/95 hover:bg-white/15 font-semibold'
                        : 'text-slate-200 hover:bg-white/10 font-medium'
                    }`}
                  >
                    <Flower
                      className={`w-3.5 h-3.5 shrink-0 ${
                        activeTab === 'formulario' ? 'text-[#E60000]' : 'opacity-85'
                      }`}
                    />
                    <span className="truncate">Formulario de Solicitud</span>
                  </button>

                  {verResumen && (
                    <button
                      type="button"
                      onClick={() => manejarSeleccion('solicitudes')}
                      aria-current={activeTab === 'solicitudes' ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'solicitudes'
                          ? 'bg-white text-[#0a2958] font-extrabold shadow-xs'
                          : personalActivo
                          ? 'text-white/95 hover:bg-white/15 font-semibold'
                          : 'text-slate-200 hover:bg-white/10 font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${
                            activeTab === 'solicitudes' ? 'text-[#E60000]' : 'opacity-85'
                          }`}
                        />
                        <span className="truncate">Resumen Solicitud</span>
                      </span>
                      {totalSolicitudes > 0 && (
                        <span
                          className={`font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            activeTab === 'solicitudes'
                              ? 'bg-[#0a2958]/10 text-[#0a2958]'
                              : 'bg-black/20 text-white'
                          }`}
                        >
                          {totalSolicitudes}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Especiales Empresa (visible para AUXILIAR GESTIÓN HUMANA EAI y ANALISTA GESTIÓN DE INFORMACIÓN EAI) */}
            {verIntExt && (
              <div
                className={`rounded-xl transition-colors ${
                  empresaActivo
                    ? 'bg-[#E60000] text-white shadow-sm'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (colapsado) {
                      manejarSeleccion('int-ext');
                    } else {
                      setSubmenuEmpresaAbierto((prev) => !prev);
                      if (!empresaActivo) {
                        manejarSeleccion('int-ext');
                      }
                    }
                  }}
                  aria-expanded={!colapsado ? submenuEmpresaAbierto : undefined}
                  title="Especiales Empresa"
                  className={`w-full flex items-center ${
                    colapsado ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                  } text-left rounded-xl cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="w-4 h-4 shrink-0 text-white" />
                    {!colapsado && (
                      <span className="text-xs font-extrabold truncate whitespace-nowrap">
                        Especiales Empresa
                      </span>
                    )}
                  </span>
                  {!colapsado &&
                    (submenuEmpresaAbierto ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-90" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-90" />
                    ))}
                </button>

                {!colapsado && submenuEmpresaAbierto && (
                  <div className="px-2 pb-2 pt-0.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => manejarSeleccion('int-ext')}
                      aria-current={activeTab === 'int-ext' ? 'page' : undefined}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'int-ext'
                          ? 'bg-white text-[#0a2958] font-extrabold shadow-xs'
                          : 'text-slate-200 hover:bg-white/10 font-medium'
                      }`}
                    >
                      <FilePlus2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeTab === 'int-ext' ? 'text-[#E60000]' : 'opacity-85'
                        }`}
                      />
                      <span className="truncate">Formulario Especiales</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Especiales Personal (visible para administradores y AUXILIAR TÉCNICO POSCOSECHA EAI) */}
            {verEspPersonal && (
              <div
                className={`rounded-xl transition-colors ${
                  espPersonalActivo
                    ? 'bg-[#E60000] text-white shadow-sm'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (colapsado) {
                      manejarSeleccion('especiales-personal');
                    } else {
                      setSubmenuEspPersonalAbierto((prev) => !prev);
                      if (!espPersonalActivo) {
                        manejarSeleccion('especiales-personal');
                      }
                    }
                  }}
                  aria-expanded={!colapsado ? submenuEspPersonalAbierto : undefined}
                  title="Especiales Personal"
                  className={`w-full flex items-center ${
                    colapsado ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                  } text-left rounded-xl cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Users className="w-4 h-4 shrink-0 text-white" />
                    {!colapsado && (
                      <span className="text-xs font-extrabold truncate whitespace-nowrap">
                        Especiales Personal
                      </span>
                    )}
                  </span>
                  {!colapsado &&
                    (submenuEspPersonalAbierto ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-90" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-90" />
                    ))}
                </button>

                {!colapsado && submenuEspPersonalAbierto && (
                  <div className="px-2 pb-2 pt-0.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => manejarSeleccion('especiales-personal')}
                      aria-current={activeTab === 'especiales-personal' ? 'page' : undefined}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'especiales-personal'
                          ? 'bg-white text-[#0a2958] font-extrabold shadow-xs'
                          : 'text-slate-200 hover:bg-white/10 font-medium'
                      }`}
                    >
                      <FilePlus2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeTab === 'especiales-personal' ? 'text-[#E60000]' : 'opacity-85'
                        }`}
                      />
                      <span className="truncate">Formulario Especiales Personal</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Solicitud Comunidad (antes Especiales Externos - Activo) */}
            {verComunidad && (
              <div
                className={`rounded-xl transition-colors ${
                  comunidadActivo
                    ? 'bg-[#E60000] text-white shadow-sm'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (colapsado) {
                      manejarSeleccion('solicitud-comunidad');
                    } else {
                      setSubmenuComunidadAbierto((prev) => !prev);
                      if (!comunidadActivo) {
                        manejarSeleccion('solicitud-comunidad');
                      }
                    }
                  }}
                  aria-expanded={!colapsado ? submenuComunidadAbierto : undefined}
                  title="Solicitud Comunidad"
                  className={`w-full flex items-center ${
                    colapsado ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                  } text-left rounded-xl cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Briefcase className="w-4 h-4 shrink-0 text-white" />
                    {!colapsado && (
                      <span className="text-xs font-extrabold truncate whitespace-nowrap">
                        Solicitud Comunidad
                      </span>
                    )}
                  </span>
                  {!colapsado &&
                    (submenuComunidadAbierto ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-90" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-90" />
                    ))}
                </button>

                {!colapsado && submenuComunidadAbierto && (
                  <div className="px-2 pb-2 pt-0.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => manejarSeleccion('solicitud-comunidad')}
                      aria-current={activeTab === 'solicitud-comunidad' ? 'page' : undefined}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'solicitud-comunidad'
                          ? 'bg-white text-[#0a2958] font-extrabold shadow-xs'
                          : 'text-slate-200 hover:bg-white/10 font-medium'
                      }`}
                    >
                      <FilePlus2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeTab === 'solicitud-comunidad' ? 'text-[#E60000]' : 'opacity-85'
                        }`}
                      />
                      <span className="truncate">Formulario Solicitud Comunidad</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN: ADMINISTRACIÓN */}
          {esAdmin && (verMaestro || esAdminSistema) && (
            <div className="space-y-2 pt-3 border-t border-white/10">
              {!colapsado && (
                <div className="px-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Administración
                  </span>
                </div>
              )}

              {verMaestro && (
                <button
                  type="button"
                  onClick={() => manejarSeleccion('maestro')}
                  aria-current={maestroActivo ? 'page' : undefined}
                  title="Actualizar Maestro"
                  className={`w-full flex items-center ${
                    colapsado ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'
                  } rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    maestroActivo
                      ? 'bg-[#E60000] text-white shadow-sm'
                      : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {!colapsado && <span className="truncate">Actualizar Maestro</span>}
                </button>
              )}

              {esAdminSistema && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenDriveModal();
                    onCerrarMovil();
                  }}
                  title={isDriveActive ? 'Google Drive Conectado' : 'Configurar Google Drive'}
                  className={`w-full flex items-center ${
                    colapsado ? 'justify-center px-2 py-2.5' : 'justify-between gap-2 px-3 py-2.5'
                  } rounded-xl text-xs font-bold text-slate-100 hover:bg-white/10 transition-colors cursor-pointer`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Cloud
                      className={`w-4 h-4 shrink-0 ${
                        isDriveActive ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    />
                    {!colapsado && <span className="truncate">Google Drive</span>}
                  </span>
                  {!colapsado && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider shrink-0 ${
                        isDriveActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                      }`}
                    >
                      {isDriveActive ? 'Activo' : 'Configurar'}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </nav>

        {/* PERFIL DE USUARIO */}
        <div className="border-t border-white/15 bg-[#071e42]/80 p-3 space-y-2.5">
          <div className={`flex items-center ${colapsado ? 'justify-center' : 'gap-2.5'}`}>
            <div
              className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 text-white font-extrabold text-xs flex items-center justify-center shrink-0"
              title={`${sesion.nombre} (${sesion.codigo})`}
            >
              {iniciales}
            </div>
            {!colapsado && (
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-extrabold text-white truncate"
                  title={sesion.nombre}
                >
                  {sesion.nombre}
                </p>
                <p
                  className="text-[10px] text-slate-300 truncate mt-0.5"
                  title={`${sesion.codigo} · ${sesion.cargo || 'Trabajador'}`}
                >
                  <span className="font-mono tabular-nums">{sesion.codigo}</span>
                  {' · '}
                  {sesion.cargo || 'Trabajador'}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onCerrarMovil();
              onCerrarSesion();
            }}
            title="Cerrar sesión"
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-white/10 hover:bg-[#E60000] text-white transition-colors cursor-pointer whitespace-nowrap`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!colapsado && <span>Cerrar sesión</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Sidebar fijo en escritorio (lg+) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen z-30 border-r border-[#071e42] transition-[width] duration-200 ${
          contraido ? 'w-[76px]' : 'w-[268px]'
        }`}
      >
        {renderContenido(false)}
      </aside>

      {/* Menú hamburguesa deslizante en móvil/tableta (< lg) */}
      {abiertoMovil && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <aside className="w-[272px] max-w-[85vw] h-full shadow-2xl border-r border-[#071e42]">
            {renderContenido(true)}
          </aside>
          <button
            type="button"
            onClick={onCerrarMovil}
            className="flex-1 cursor-default"
            aria-label="Cerrar menú"
          />
        </div>
      )}
    </>
  );
};
