'use client';

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

// Dibuja un código QR como SVG (sin imágenes externas: la clave del segundo factor nunca sale del navegador).
// Se arma con rectángulos, no con HTML inyectado.
export function QrCode({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const { n, oscuros } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    const oscuros: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) oscuros.push([r, c]);
    return { n, oscuros };
  }, [texto]);
  const margen = 4; // zona de silencio exigida por el estándar
  const lado = n + margen * 2;
  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      className="h-48 w-48 rounded-md border border-navy/10 bg-white"
    >
      <rect width={lado} height={lado} fill="#fff" />
      {oscuros.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c + margen} y={r + margen} width={1} height={1} fill="#0D2040" />
      ))}
    </svg>
  );
}
