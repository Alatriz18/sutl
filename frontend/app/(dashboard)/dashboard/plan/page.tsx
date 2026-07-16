'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shipment, User } from '@/types';

const PLAN_ACTUAL = {
  nombre: 'trial',
  precioMensual: 0,
  maxUsuarios: 3,
  maxEnvios: 20,
  estado: 'prueba',
  fechaInicio: '2026-05-01',
};

const FACTURAS_DEMO = [
  { id: '1', periodo: 'Junio 2026', monto: '$0.00', estado: 'Pagada' },
  { id: '2', periodo: 'Mayo 2026', monto: '$0.00', estado: 'Pagada' },
];

const PLANES = [
  { nombre: 'trial', precio: 0, usuarios: 3, envios: 20, actual: true },
  { nombre: 'pro', precio: 600, usuarios: 20, envios: 500, actual: false },
];

function UsageBar({ label, actual, max }: { label: string; actual: number; max: number }) {
  const pct = Math.min(100, Math.round((actual / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-navy/70">{label}</span>
        <span className="text-navy/60">
          {actual} / {max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-navy/10">
        <div
          className={`h-full rounded-full ${pct > 85 ? 'bg-[#d03b3b]' : 'bg-sky'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PlanPage() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);

  useEffect(() => {
    Promise.all([api.get<User[]>('/users'), api.get<Shipment[]>('/shipments')])
      .then(([uRes, sRes]) => {
        setUsuarios(uRes.data);
        setShipments(sRes.data);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Plan y facturación</h1>
      <p className="mt-1 text-navy/60">Panel SaaS — suscripción del tenant.</p>

      <DemoBanner>
        Las tablas <code>subscription_plans</code> y <code>subscriptions</code> ya existen y el
        tenant demo tiene una suscripción real al plan <code>trial</code>. La integración con
        Stripe/Culqui (cobro real, upgrade de plan) todavía no está conectada — el uso de usuarios
        y envíos de abajo sí es real.
      </DemoBanner>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-navy/40">Plan actual</p>
              <p className="text-xl font-bold capitalize text-navy">{PLAN_ACTUAL.nombre}</p>
            </div>
            <span className="rounded-full bg-sky/10 px-3 py-1 text-xs font-medium capitalize text-sky">
              {PLAN_ACTUAL.estado}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <UsageBar label="Usuarios" actual={usuarios.length} max={PLAN_ACTUAL.maxUsuarios} />
            <UsageBar label="Envíos" actual={shipments.length} max={PLAN_ACTUAL.maxEnvios} />
          </div>

          <p className="mt-4 text-xs text-navy/40">
            Suscripción activa desde {PLAN_ACTUAL.fechaInicio} · ${PLAN_ACTUAL.precioMensual}/mes
          </p>
        </Card>

        <Card>
          <span className="mb-2 inline-flex rounded-md bg-navy/10 p-2 text-navy">
            <CreditCard size={18} />
          </span>
          <p className="font-medium text-navy">Método de pago</p>
          <p className="mt-1 text-sm text-navy/60">No hay método de pago registrado (sandbox).</p>
          <Button disabled className="mt-3 w-full opacity-60">
            Agregar tarjeta
          </Button>
        </Card>
      </div>

      <CardTitle className="mb-3 mt-8">Planes disponibles</CardTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLANES.map((p) => (
          <Card key={p.nombre} className={p.actual ? 'border-sky' : ''}>
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold capitalize text-navy">{p.nombre}</p>
              {p.actual && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-sky">
                  <CheckCircle2 size={14} /> Actual
                </span>
              )}
            </div>
            <p className="mt-1 text-2xl font-bold text-navy">
              ${p.precio}
              <span className="text-sm font-normal text-navy/50">/mes</span>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-navy/60">
              <li>Hasta {p.usuarios} usuarios</li>
              <li>Hasta {p.envios} envíos/mes</li>
            </ul>
            <Button disabled={p.actual} className="mt-4 w-full" variant={p.actual ? 'ghost' : 'secondary'}>
              {p.actual ? 'Plan actual' : 'Cambiar de plan'}
            </Button>
          </Card>
        ))}
      </div>

      <CardTitle className="mb-3 mt-8">Historial de facturas</CardTitle>
      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 font-medium">Periodo</th>
              <th className="px-4 py-3 font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {FACTURAS_DEMO.map((f) => (
              <tr key={f.id} className="border-t border-navy/5">
                <td className="px-4 py-3 text-navy">{f.periodo}</td>
                <td className="px-4 py-3 text-navy/60">{f.monto}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    {f.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
