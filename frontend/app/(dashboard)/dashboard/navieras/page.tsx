'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ship, Plane, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Carrier, Shipment } from '@/types';

const TIPO_ICON = { naviera: Ship, aerolinea: Plane, terrestre: Truck } as const;
const TIPO_LABEL = { naviera: 'Naviera', aerolinea: 'Aerolínea', terrestre: 'Transportista terrestre' } as const;

export default function NavierasPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Carrier[]>('/carriers'), api.get<Shipment[]>('/shipments')])
      .then(([carRes, shipRes]) => {
        setCarriers(carRes.data);
        setShipments(shipRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const conConteo = useMemo(
    () =>
      carriers.map((c) => ({
        ...c,
        cantidad: shipments.filter((s) => s.carrierId === c.id).length,
      })),
    [carriers, shipments],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Navieras y aerolíneas</h1>
      <p className="mt-1 text-navy/60">
        Catálogo global de transportistas integrables. La conexión real con cada API (Maersk, MSC,
        CMA CGM, Hapag-Lloyd, Evergreen, IATA CargoWise) es parte de la Fase 2 del plan — hoy este
        catálogo ya vive en la base de datos y se usa al crear un envío.
      </p>

      {loading ? (
        <p className="mt-6 text-navy/50">Cargando...</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {conConteo.map((c) => {
            const Icon = TIPO_ICON[c.tipo];
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold text-navy">{c.nombre}</p>
                    <p className="text-xs uppercase tracking-wide text-navy/40">
                      {TIPO_LABEL[c.tipo]} {c.codigo && `· ${c.codigo}`}
                    </p>
                  </div>
                  <span className="rounded-md bg-sky/10 p-2 text-sky">
                    <Icon size={18} />
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-navy/60">Envíos con esta naviera</span>
                  <span className="font-semibold text-navy">{c.cantidad}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-navy/60">Integración API</span>
                  <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                    Pendiente (sandbox)
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
