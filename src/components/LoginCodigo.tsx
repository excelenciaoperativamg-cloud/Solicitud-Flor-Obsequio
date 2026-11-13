import React, { useState } from 'react';
import { TrabajadorMaestro } from '../types';

interface LoginCodigoProps {
  maestro: TrabajadorMaestro[];
  cargando: boolean;
  onIngresar: (trabajador: TrabajadorMaestro) => void;
}

export const LoginCodigo: React.FC<LoginCodigoProps> = ({ maestro, cargando, onIngresar }) => {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');

  const ingresar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = codigo.trim().toLowerCase();
    if (!limpio) {
      setError('Escriba su código');
      return;
    }
    const encontrado = maestro.find(
      (t) => String(t.codigo).trim().toLowerCase() === limpio && t.activo !== false
    );
    if (!encontrado) {
      setError('Ese código no está en el maestro. Verifique e intente de nuevo.');
      return;
    }
    onIngresar(encontrado);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Banner ilustración Flor de Obsequio */}
        <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          <img
            src="/assets/aistudio/login-flor-obsequio.jpg"
            alt="Flor de Obsequio — equipo MG Poscosecha"
            className="w-full h-auto object-cover max-h-56 sm:max-h-72"
            onError={(e) => {
              // Si aún no está el archivo en public, ocultar el marco vacío
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <form
          onSubmit={ingresar}
          className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#E60000]">
            Flor de Obsequio
          </p>
          <h2 className="text-xl font-extrabold text-[#0a2958] mt-1">Ingrese con su código</h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Use el código del maestro. Entra directo al formulario, sin correo ni contraseña.
            Solicitudes solo <strong>lunes y martes</strong>; entrega el <strong>viernes</strong> de la
            misma semana. Un solo ramo cada 15 días.
          </p>
          <label className="block text-xs font-bold text-slate-700 mb-1">Código</label>
          <input
            autoFocus
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value);
              setError('');
            }}
            placeholder="Ej: 5705"
            className="w-full px-3.5 py-3 text-sm rounded-xl border border-slate-300 font-mono font-bold uppercase focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden"
          />
          {error && <p className="text-[11px] text-[#E60000] font-semibold mt-2">{error}</p>}
          <button
            type="submit"
            disabled={cargando}
            className="mt-4 w-full py-3 rounded-xl bg-[#0a2958] text-white text-sm font-bold disabled:opacity-60"
          >
            {cargando ? 'Cargando maestro…' : 'Entrar al formulario'}
          </button>
          {!cargando && (
            <p className="text-[11px] text-slate-400 mt-3">{maestro.length} trabajadores en el maestro</p>
          )}
        </form>
      </div>
    </div>
  );
};
