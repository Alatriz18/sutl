import { useMemo } from 'react';

export interface PuntoRecorrido {
  id: string;
  lat: number;
  lng: number;
  etiqueta: string;
  timestamp: string;
}

const W = 640;
const H = 320;
const PAD = 36;

function esValido(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

// Quita los eventos sin coordenadas válidas y los ordena del más antiguo al más reciente.
export function puntosDeRecorrido<T extends { _id: string; lat?: number; lng?: number; ubicacion?: string; estado: string; timestamp: string }>(eventos: T[]): PuntoRecorrido[] {
  return eventos
    .filter((e) => esValido(e.lat) && esValido(e.lng) && Math.abs(e.lat) <= 90 && Math.abs(e.lng) <= 180)
    .map((e) => ({ id: e._id, lat: e.lat as number, lng: e.lng as number, etiqueta: e.ubicacion || e.estado, timestamp: e.timestamp }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Paso "redondo" de la cuadrícula según cuánto abarca el recorrido.
function pasoCuadricula(span: number) {
  for (const p of [0.5, 1, 2, 5, 10, 20, 30]) if (span / p <= 8) return p;
  return 45;
}

// Mapa del recorrido dibujado en SVG, sin proveedor de mapas externo: no carga imágenes de terceros ni envía
// las coordenadas a nadie. Es una vista de ruta (puntos y trayecto sobre una cuadrícula de coordenadas).
export function RecorridoMapa({ puntos, enVivo = false }: { puntos: PuntoRecorrido[]; enVivo?: boolean }) {
  const g = useMemo(() => {
    if (puntos.length === 0) return null;
    const lats = puntos.map((p) => p.lat);
    const lngs = puntos.map((p) => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const k = Math.max(Math.cos((midLat * Math.PI) / 180), 0.2); // un grado de longitud mide menos lejos del ecuador
    const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 4);
    const spanLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * k, 4 * k);
    const escala = Math.min((W - 2 * PAD) / spanLng, (H - 2 * PAD) / spanLat);
    const cLat = midLat;
    const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const x = (lng: number) => W / 2 + (lng - cLng) * k * escala;
    const y = (lat: number) => H / 2 - (lat - cLat) * escala;
    const paso = pasoCuadricula(Math.max(spanLat, spanLng / k));
    const lineasLat: number[] = [];
    const lineasLng: number[] = [];
    const latMin = cLat - H / 2 / escala;
    const latMax = cLat + H / 2 / escala;
    const lngMin = cLng - W / 2 / escala / k;
    const lngMax = cLng + W / 2 / escala / k;
    for (let v = Math.ceil(latMin / paso) * paso; v <= latMax; v += paso) lineasLat.push(v);
    for (let v = Math.ceil(lngMin / paso) * paso; v <= lngMax; v += paso) lineasLng.push(v);
    return { x, y, lineasLat, lineasLng };
  }, [puntos]);

  if (!g) return null;
  const ultimo = puntos[puntos.length - 1];
  const trayecto = puntos.map((p) => `${g.x(p.lng).toFixed(1)},${g.y(p.lat).toFixed(1)}`).join(' ');

  return (
    <figure data-testid="recorrido-mapa" className="overflow-hidden rounded-lg border border-navy/10 bg-white">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mapa del recorrido: ${puntos.length} ${puntos.length === 1 ? 'punto' : 'puntos'}; último: ${ultimo.etiqueta}`} className="block h-auto w-full bg-[#F4F8FC]">
        <g stroke="#0D2040" strokeOpacity="0.08" strokeWidth="1">
          {g.lineasLat.map((v) => <line key={`a${v}`} x1="0" x2={W} y1={g.y(v)} y2={g.y(v)} />)}
          {g.lineasLng.map((v) => <line key={`o${v}`} y1="0" y2={H} x1={g.x(v)} x2={g.x(v)} />)}
        </g>
        {puntos.length > 1 && <polyline points={trayecto} fill="none" stroke="#2E86DE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7" />}
        {puntos.length > 1 && <polyline points={trayecto} fill="none" stroke="#2E86DE" strokeWidth="1.5" strokeOpacity="0.55" strokeLinejoin="round" />}
        {puntos.map((p, i) => {
          const esUltimo = i === puntos.length - 1;
          return (
            <g key={p.id}>
              <title>{`${p.etiqueta} (${p.lat.toFixed(3)}, ${p.lng.toFixed(3)})`}</title>
              {esUltimo && enVivo && <circle cx={g.x(p.lng)} cy={g.y(p.lat)} r="14" fill="#2E86DE" fillOpacity="0.25" className="motion-safe:animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />}
              <circle cx={g.x(p.lng)} cy={g.y(p.lat)} r={esUltimo ? 8 : 5} fill={esUltimo ? '#0D2040' : '#FFFFFF'} stroke={esUltimo ? '#FFFFFF' : '#2E86DE'} strokeWidth={esUltimo ? 3 : 2.5} />
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-navy/10 px-3 py-2 text-xs text-navy/60">
        <span>
          <span className="font-medium text-navy">Último punto:</span> {ultimo.etiqueta}
        </span>
        <span>{puntos.length} {puntos.length === 1 ? 'punto' : 'puntos'} del recorrido · la cuadrícula marca grados de latitud y longitud</span>
      </figcaption>
    </figure>
  );
}
