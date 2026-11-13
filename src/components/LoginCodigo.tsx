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
        <div className="relative mb-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          <img
            src="/assets/aistudio/login-banner-sm.jpg"
            alt="Flor de Obsequio — equipo MG Poscosecha"
            className="w-full h-auto block"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#061a3a] via-[#0a2958]/92 to-transparent pt-7 pb-3 px-4">
            <p className="text-sm text-white text-center leading-snug font-medium drop-shadow-xs">
              Solicitudes solo <strong className="font-bold text-amber-300">lunes y martes</strong>; entrega el{' '}
              <strong className="font-bold text-amber-300">viernes</strong> de la misma semana. Un solo ramo cada 15 días.
            </p>
          </div>
        </div>

        <form
          onSubmit={ingresar}
          className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
        >
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Código</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            value={codigo}
            onChange={(e) => {
              const soloNumeros = e.target.value.replace(/\D/g, '');
              setCodigo(soloNumeros);
              setError('');
            }}
            placeholder="Digite su código de nómina"
            className="w-full px-3.5 py-3 text-sm rounded-xl border border-slate-300 font-mono font-bold focus:border-[#0a2958] focus:ring-2 focus:ring-[#0a2958]/20 outline-hidden"
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
