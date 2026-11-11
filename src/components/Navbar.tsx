import React from 'react';
import { Flower, Calendar, Users, FileText, Cloud, ExternalLink, Settings } from 'lucide-react';
import { User } from 'firebase/auth';
import { DriveConfig } from '../services/apiClient';
import { TrabajadorMaestro } from '../types';

interface NavbarProps {
  activeTab: 'formulario' | 'cupos' | 'solicitudes' | 'maestro';
  setActiveTab: (tab: 'formulario' | 'cupos' | 'solicitudes' | 'maestro') => void;
  user: User | null;
  spreadsheetLink: string | null;
  driveConfig: DriveConfig;
  onOpenDriveModal: () => void;
  totalSolicitudes: number;
  sesion?: TrabajadorMaestro | null;
  onCerrarSesion?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  spreadsheetLink,
  driveConfig,
  onOpenDriveModal,
  totalSolicitudes,
  sesion,
  onCerrarSesion,
}) => {
  const isDriveActive = !!(driveConfig.webhookUrl || user);

  return (
    <header className="bg-white border-b-2 border-[#0a2958]/10 shadow-xs sticky top-0 z-30">
      {/* Barra superior de acento con color azul y rojo institucional */}
      <div className="h-1.5 w-full bg-[#0a2958] flex">
        <div className="w-1/3 bg-[#E60000]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-3">
          {/* Logo Oficial MG Consultores y Título */}
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white p-1 rounded-xl shadow-xs border border-slate-200">
              <img
                src="/assets/aistudio/logo_639f00ab.png"
                alt="MG Consultores S.A.S."
                className="h-10 sm:h-12 w-auto object-contain"
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
                <span className="px-2.5 py-0.5 text-xs font-bold bg-[#E60000]/10 text-[#E60000] rounded-full border border-[#E60000]/20">
                  Poscosecha
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Gestión de solicitudes y cupos semanales
              </p>
            </div>
          </div>

          {/* Conexión Automática a Google Drive (Sin pedir correo) */}
          <div className="flex items-center gap-2 flex-wrap">
            {sesion && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
                <div className="text-left leading-tight">
                  <div className="text-xs font-bold text-[#0a2958]">{sesion.nombre}</div>
                  <div className="text-[10px] text-slate-500">{sesion.codigo} · {sesion.cargo || 'Sin cargo'}</div>
                </div>
                <button type="button" onClick={onCerrarSesion} className="text-[11px] font-bold text-[#E60000]">
                  Salir
                </button>
              </div>
            )}
            <button
              onClick={onOpenDriveModal}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border ${
                isDriveActive
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-[#0a2958]/5 text-[#0a2958] border-[#0a2958]/20 hover:bg-[#0a2958]/10'
              }`}
            >
              <Cloud className={`w-4 h-4 ${isDriveActive ? 'text-emerald-600' : 'text-[#0a2958]'}`} />
              <div className="text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <span>{isDriveActive ? 'Google Drive Conectado' : 'Conectar Google Drive'}</span>
                  <span className={`w-2 h-2 rounded-full ${isDriveActive ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal block">
                  {isDriveActive ? 'Guardado automático activo' : 'Configurar sin pedir correo'}
                </span>
              </div>
              <Settings className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {/* Enlace directo a la hoja si existe */}
            {(spreadsheetLink || driveConfig.spreadsheetUrl) && (
              <a
                href={spreadsheetLink || driveConfig.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                title="Abrir hoja de cálculo en Google Drive"
              >
                <span>Ver Hoja</span>
                <ExternalLink className="w-3 h-3 text-[#0a2958]" />
              </a>
            )}
          </div>
        </div>

        {/* Pestañas de Navegación con Colores Institucionales */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-100 pt-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('formulario')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'formulario'
                ? 'bg-[#0a2958] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0a2958] hover:bg-slate-100'
            }`}
          >
            <Flower className={`w-4 h-4 ${activeTab === 'formulario' ? 'text-[#E60000]' : ''}`} />
            <span>Formulario de Solicitud</span>
          </button>

          <button
            onClick={() => setActiveTab('cupos')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'cupos'
                ? 'bg-[#0a2958] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0a2958] hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Cupos Semanales</span>
          </button>

          <button
            onClick={() => setActiveTab('solicitudes')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'solicitudes'
                ? 'bg-[#0a2958] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0a2958] hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Registro de Solicitudes</span>
            {totalSolicitudes > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                  activeTab === 'solicitudes'
                    ? 'bg-[#E60000] text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {totalSolicitudes}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('maestro')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === 'maestro'
                ? 'bg-[#0a2958] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0a2958] hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Hoja Maestro (Trabajadores)</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
