'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { EstadoBadge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { TrackingEvent, TrackingPublicoResponse } from '@/types';
import { useEnVivo } from '@/lib/en-vivo';
import { IndicadorEnVivo } from '@/components/tracking/indicador-en-vivo';
import { RecorridoMapa, puntosDeRecorrido } from '@/components/tracking/recorrido-mapa';

// Texto legible sobre el color de acento: blanco u oscuro según su luminancia (WCAG).
function textoSobre(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0D2040' : '#FFFFFF';
}

const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/;
const LOGO_VALIDO = /^https:\/\//;

export default function TrackingResultPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [data, setData] = useState<TrackingPublicoResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    api
      .get<TrackingPublicoResponse>(`/shipments/tracking/${codigo}`)
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [codigo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // La página se actualiza sola cuando la empresa registra un movimiento nuevo.
  const enVivo = useEnVivo<TrackingEvent>(data ? `/shipments/tracking/${codigo}/stream` : null, (ev) =>
    setData((d) => (d && !d.eventos.some((x) => x._id === ev._id) ? { ...d, estado: ev.estado, eventos: [ev, ...d.eventos] } : d)), cargar);
  const puntos = data ? puntosDeRecorrido(data.eventos) : [];

  // Defensa en profundidad: el servidor ya valida la marca, pero aquí no se confía en ella para estilos ni imágenes.
  const marca = data?.marca;
  const color = marca?.colorPrimario && COLOR_VALIDO.test(marca.colorPrimario) ? marca.colorPrimario : null;
  const logo = marca?.logoUrl && LOGO_VALIDO.test(marca.logoUrl) ? marca.logoUrl : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {marca && (
          <header className="mb-6 flex items-center gap-3 rounded-lg px-4 py-3" style={color ? { background: color, color: textoSobre(color) } : undefined} data-testid="marca-encabezado">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element -- el logo es una dirección externa de la empresa
              <img src={logo} alt={`Logo de ${marca.nombre ?? 'la empresa'}`} className="h-10 w-auto max-w-[8rem] rounded bg-white/90 object-contain p-1" referrerPolicy="no-referrer" />
            )}
            <span className={`text-lg font-semibold ${color ? '' : 'text-navy'}`}>{marca.nombre}</span>
          </header>
        )}
        <Link href="/tracking" className="text-sm text-sky hover:underline">
          ← Buscar otro envío
        </Link>

        {loading && <p className="mt-6 text-navy/60">Buscando envío...</p>}

        {!loading && error && (
          <Card className="mt-6">
            <p className="text-red-600">
              No encontramos un envío con el código <strong>{codigo}</strong>. Verifica que esté
              escrito correctamente.
            </p>
          </Card>
        )}

        {!loading && data && (
          <>
            <Card className="mt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{data.codigoGuia}</CardTitle>
                  <p className="mt-1 text-navy/60">
                    {data.origen} → {data.destino}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <EstadoBadge estado={data.estado} />
                  <IndicadorEnVivo estado={enVivo} />
                </div>
              </div>
              <p className="mt-3 text-sm text-navy/60">
                Destinatario: <span className="text-navy">{data.destinatarioNombre}</span>
              </p>
            </Card>

            {marca?.mensaje && <p className="mt-4 rounded-lg border border-navy/10 bg-white p-4 text-sm text-navy/80">{marca.mensaje}</p>}

            {puntos.length > 0 && (
              <div className="mt-6">
                <CardTitle className="mb-3">Recorrido</CardTitle>
                <RecorridoMapa puntos={puntos} enVivo={enVivo === 'en_vivo'} />
              </div>
            )}

            <div className="mt-6">
              <CardTitle className="mb-3">Historial</CardTitle>
              <ol className="space-y-3">
                {data.eventos.length === 0 && (
                  <p className="text-sm text-navy/50">Aún no hay eventos registrados.</p>
                )}
                {data.eventos.map((ev) => (
                  <li
                    key={ev._id}
                    className="rounded-lg border border-navy/10 bg-white p-4 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <EstadoBadge estado={ev.estado} />
                      <span className="text-navy/50">{formatDateTime(ev.timestamp)}</span>
                    </div>
                    {ev.ubicacion && <p className="mt-2 text-navy">📍 {ev.ubicacion}</p>}
                    {ev.descripcion && <p className="text-navy/70">{ev.descripcion}</p>}
                  </li>
                ))}
              </ol>
            </div>

            {marca?.mostrarSutl && <p className="mt-8 text-center text-xs text-navy/40">Con tecnología de SUTL</p>}
          </>
        )}
      </div>
    </main>
  );
}
