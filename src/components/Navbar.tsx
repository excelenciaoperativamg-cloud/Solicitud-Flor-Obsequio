import React from 'react';
import { Cloud, Settings, Menu, ChevronRight } from 'lucide-react';
import { User } from 'firebase/auth';
import { DriveConfig } from '../services/apiClient';
import { TrabajadorMaestro } from '../types';
import { esAdministradorSistema } from '../utils/roles';
import type { TabNavegacion } from './SidebarNavegacion';

interface NavbarProps {
  activeTab: TabNavegacion;
  user: User | null;
  driveConfig: DriveConfig;
  onOpenDriveModal: () => void;
  sesion?: TrabajadorMaestro | null;
  onToggleMenuMovil?: () => void;
}

const CONTEXTO_POR_TAB: Record<TabNavegacion, { seccion: string; modulo: string; pagina: string }> = {
  formulario: {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Solicitud Personal',
    pagina: 'Formulario de Solicitud',
  },
  solicitudes: {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Solicitud Personal',
    pagina: 'Resumen Solicitud',
  },
  'int-ext': {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Especiales Empresa',
    pagina: 'Formulario Especiales Empresa',
  },
  'especiales-personal': {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Especiales Personal',
    pagina: 'Formulario Especiales Personal',
  },
  'solicitud-comunidad': {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Solicitud Comunidad',
    pagina: 'Formulario Solicitud Comunidad',
  },
  'ingresos-seleccion': {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Ingresos Personal',
    pagina: 'Formulario Ingresos Personal',
  },
  'obsequio-visitantes': {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Obsequio Visitantes',
    pagina: 'Formulario Obsequio Visitantes',
  },
  consolidado: {
    seccion: 'Gestión de Solicitudes',
    modulo: 'Consolidado',
    pagina: 'Consolidado de Solicitudes',
  },
  maestro: {
    seccion: 'Administración',
    modulo: 'Personal',
    pagina: 'Actualizar Maestro',
  },
  permisos: {
    seccion: 'Administración',
    modulo: 'Control de Acceso',
    pagina: 'Permisos Formularios',
  },
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  user,
  driveConfig,
  onOpenDriveModal,
  sesion,
  onToggleMenuMovil,
}) => {
  const isDriveActive = !!(driveConfig.webhookUrl || user);
  const puedeVerDrive = esAdministradorSistema(sesion);
  const contexto = CONTEXTO_POR_TAB[activeTab];

  // Encabezado limpio para la pantalla de inicio de sesión (antes de autenticar)
  if (!sesion) {
    return (
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="h-1.5 w-full bg-[#0a2958] flex">
          <div className="w-1/3 bg-[#E60000]"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
          <div className="flex items-center bg-white p-1 rounded-xl shadow-xs border border-slate-200">
            <img
              src="/assets/aistudio/logo_639f00ab.png"
              alt="MG Consultores S.A.S."
              className="h-10 sm:h-11 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/public/assets/aistudio/logo_639f00ab.png';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#0a2958] tracking-tight">
                Flor de Obsequio
              </h1>
              <span className="text-xs font-bold text-[#E60000]">
                · Poscosecha
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Gestión de solicitudes y cupos semanales
            </p>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      {/* Barra superior fina de acento corporativo */}
      <div className="h-1 w-full bg-[#0a2958] flex">
        <div className="w-1/4 bg-[#E60000]"></div>
      </div>

      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Izquierda: botón hamburguesa en móvil/tableta + ruta de navegación contextual */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleMenuMovil}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-[#0a2958] hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Abrir menú lateral"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav
            aria-label="Ubicación actual"
            className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0 truncate"
          >
            <span className="hidden sm:inline font-medium text-slate-500 whitespace-nowrap">
              {contexto.seccion}
            </span>
            <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="hidden md:inline font-semibold text-slate-700 whitespace-nowrap">
              {contexto.modulo}
            </span>
            <ChevronRight className="hidden md:inline w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-extrabold text-[#0a2958] truncate">
              {contexto.pagina}
            </span>
          </nav>
        </div>

        {/* Derecha: Acceso rápido a Google Drive solo para administradores */}
        <div className="flex items-center gap-2 shrink-0">
          {puedeVerDrive && (
            <button
              type="button"
              onClick={onOpenDriveModal}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border whitespace-nowrap ${
                isDriveActive
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-[#0a2958]/5 text-[#0a2958] border-[#0a2958]/20 hover:bg-[#0a2958]/10'
              }`}
            >
              <Cloud
                className={`w-4 h-4 shrink-0 ${
                  isDriveActive ? 'text-emerald-600' : 'text-[#0a2958]'
                }`}
              />
              <span className="hidden sm:inline">
                {isDriveActive ? 'Google Drive Conectado' : 'Conectar Google Drive'}
              </span>
              <span className="sm:hidden">Drive</span>
              <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
