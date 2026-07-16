'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, FileWarning, RefreshCcw, Sliders } from 'lucide-react';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AlertaDemo {
  id: string;
  nombre: string;
  descripcion: string;
  icon: typeof AlertTriangle;
  activo: boolean;
}

const ALERTAS_INICIALES: AlertaDemo[] = [
  {
    id: '1',
    nombre: 'Retraso en tránsito',
    descripcion: 'Avisar si un envío lleva más de 5 días en estado "en_transito" sin actualización.',
    icon: Clock,
    activo: true,
  },
  {
    id: '2',
    nombre: 'Retención en aduana',
    descripcion: 'Avisar si un envío lleva más de 3 días en estado "en_aduana".',
    icon: FileWarning,
    activo: true,
  },
  {
    id: '3',
    nombre: 'Cambio de estado',
    descripcion: 'Notificar al destinatario cada vez que cambia el estado de su envío.',
    icon: RefreshCcw,
    activo: true,
  },
  {
    id: '4',
    nombre: 'Documento faltante',
    descripcion: 'Avisar si un envío marítimo no tiene BL cargado 48h antes del zarpe estimado.',
    icon: AlertTriangle,
    activo: false,
  },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-sky' : 'bg-navy/20',
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState(ALERTAS_INICIALES);

  function toggle(id: string) {
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, activo: !a.activo } : a)));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Alertas</h1>
      <p className="mt-1 text-navy/60">Umbrales configurables por tenant.</p>

      <DemoBanner>
        La tabla <code>alerts</code> ya existe en la base de datos (con condición en JSON por
        regla). Los toggles de abajo son visuales — falta el motor que evalúa las condiciones y
        dispara la notificación correspondiente.
      </DemoBanner>

      <div className="grid grid-cols-1 gap-4">
        {alertas.map((a) => {
          const Icon = a.icon;
          return (
            <Card key={a.id} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-navy/10 p-2 text-navy">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-medium text-navy">{a.nombre}</p>
                  <p className="mt-0.5 text-sm text-navy/60">{a.descripcion}</p>
                </div>
              </div>
              <Toggle checked={a.activo} onChange={() => toggle(a.id)} />
            </Card>
          );
        })}

        <Card className="flex items-center gap-3 border-dashed">
          <span className="rounded-md bg-gold/10 p-2 text-gold">
            <Sliders size={18} />
          </span>
          <p className="text-sm text-navy/60">
            Próximamente: crear reglas de alerta personalizadas por envío o por umbral numérico.
          </p>
        </Card>
      </div>
    </div>
  );
}
