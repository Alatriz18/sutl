'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface FirmaPadHandle {
  // PNG de la firma, o null si no se dibujó nada.
  aPng: () => Promise<Blob | null>;
  limpiar: () => void;
}

// Lienzo para firmar con el dedo, el lápiz o el mouse. Usa eventos de puntero (sirve igual en celular y escritorio)
// y fondo blanco, para que la firma se vea bien al descargarla.
export const FirmaPad = forwardRef<FirmaPadHandle, { etiqueta?: string; onCambio?: (hayFirma: boolean) => void }>(function FirmaPad({ etiqueta = 'Firma de quien recibe', onCambio }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0D2040';
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    canvas.current?.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un toque sin movimiento también deja un punto.
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    if (!hayTrazo) {
      setHayTrazo(true);
      onCambio?.(true);
    }
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  const terminar = () => {
    dibujando.current = false;
  };

  const limpiar = () => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    setHayTrazo(false);
    onCambio?.(false);
  };

  useImperativeHandle(ref, () => ({
    limpiar,
    aPng: () => new Promise<Blob | null>((ok) => (hayTrazo && canvas.current ? canvas.current.toBlob((b) => ok(b), 'image/png') : ok(null))),
  }));

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-navy" id="firma-etiqueta">{etiqueta} (opcional)</p>
      <canvas
        ref={canvas}
        width={600}
        height={200}
        role="img"
        aria-labelledby="firma-etiqueta"
        aria-describedby="firma-ayuda"
        // touch-action: none evita que el dedo desplace la página mientras se firma.
        style={{ touchAction: 'none' }}
        className="h-40 w-full max-w-xl cursor-crosshair rounded-md border border-dashed border-navy/30 bg-white"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        onPointerCancel={terminar}
      />
      <div className="mt-1 flex items-center gap-3">
        <span id="firma-ayuda" className="text-xs text-navy/50">Firma dentro del recuadro con el dedo, el lápiz o el mouse.</span>
        <Button type="button" variant="ghost" disabled={!hayTrazo} onClick={limpiar}>Borrar firma</Button>
      </div>
    </div>
  );
});
