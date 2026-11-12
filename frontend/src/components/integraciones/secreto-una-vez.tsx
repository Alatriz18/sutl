'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Muestra un secreto recién creado (API key, secreto de webhook). El servidor
// no lo vuelve a entregar: por eso se avisa con claridad y se ofrece copiarlo.
export function SecretoUnaVez({ titulo, valor, onCerrar }: { titulo: string; valor: string; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el valor sigue visible para copiarlo a mano.
    }
  }

  return (
    <div role="status" className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3">
      <p className="text-sm font-semibold text-[#8A5A12]">{titulo}</p>
      <p className="mt-0.5 text-xs text-[#8A5A12]">Cópiala ahora y guárdala en un lugar seguro: no se vuelve a mostrar.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded bg-white px-2 py-1.5 text-xs text-navy">{valor}</code>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-navy/20 bg-white px-2.5 py-1.5 text-xs font-medium text-navy hover:bg-navy/5"
        >
          {copiado ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      <button type="button" onClick={onCerrar} className="mt-2 text-xs font-medium text-navy/60 underline">
        Ya la guardé
      </button>
    </div>
  );
}
