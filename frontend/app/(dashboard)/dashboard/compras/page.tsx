'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ClipboardList, PackageCheck, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatTile } from '@/components/ui/stat-tile';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EstadoOcBadge } from '@/components/purchase-orders/estado-oc-badge';
import { ProgressBar } from '@/components/purchase-orders/progress-bar';
import { cn } from '@/lib/utils';
import { extractApiError, formatDate, formatMoney } from '@/lib/format';
import { ESTADO_OC_LABELS, alertaFecha, avanceRecepcion, totalOc } from '@/lib/purchase-orders';
import { EstadoOrdenCompra, PurchaseOrder } from '@/types';

type Filtro = 'todas' | 'abiertas' | EstadoOrdenCompra;

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'abiertas', label: 'Abiertas' },
  { value: 'todas', label: 'Todas' },
  { value: 'borrador', label: ESTADO_OC_LABELS.borrador },
  { value: 'emitida', label: ESTADO_OC_LABELS.emitida },
  { value: 'confirmada', label: ESTADO_OC_LABELS.confirmada },
  { value: 'despachada', label: ESTADO_OC_LABELS.despachada },
  { value: 'recibida_parcial', label: ESTADO_OC_LABELS.recibida_parcial },
  { value: 'recibida', label: ESTADO_OC_LABELS.recibida },
  { value: 'cancelada', label: ESTADO_OC_LABELS.cancelada },
];

const CERRADAS: EstadoOrdenCompra[] = ['recibida', 'cancelada'];

export default function ComprasPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('abiertas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api
      .get<PurchaseOrder[]>('/purchase-orders')
      .then((res) => setOrdenes(res.data))
      .catch((err) => setError(extractApiError(err, 'No se pudieron cargar las órdenes de compra.')))
      .finally(() => setLoading(false));
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ordenes
      .filter((o) =>
        filtro === 'todas' ? true : filtro === 'abiertas' ? !CERRADAS.includes(o.estado) : o.estado === filtro,
      )
      .filter(
        (o) =>
          !q ||
          o.numero.toLowerCase().includes(q) ||
          o.proveedor?.nombre.toLowerCase().includes(q) ||
          o.lineas.some((l) => l.sku.toLowerCase().includes(q)),
      );
  }, [ordenes, filtro, busqueda]);

  const abiertas = ordenes.filter((o) => !CERRADAS.includes(o.estado));
  const enCamino = ordenes.filter((o) => o.estado === 'despachada').length;
  const conAlerta = abiertas.filter((o) => alertaFecha(o)).length;
  const recibidasParcial = ordenes.filter((o) => o.estado === 'recibida_parcial').length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Órdenes de compra</h1>
          <p className="mt-1 text-navy/60">
            Qué se compró, a quién, para cuándo se necesita y cuánto ha llegado.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => router.push('/dashboard/compras/nueva')}>
          + Nueva OC
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="OCs abiertas" value={abiertas.length} icon={ClipboardList} accent="navy" />
        <StatTile label="En camino" value={enCamino} icon={Truck} accent="sky" hint="Despachadas por el proveedor" />
        <StatTile
          label="Recepción parcial"
          value={recibidasParcial}
          icon={PackageCheck}
          accent="warning"
          hint="Falta mercadería por llegar"
        />
        <StatTile
          label="Con alerta de fecha"
          value={conAlerta}
          icon={AlertTriangle}
          accent={conAlerta > 0 ? 'critical' : 'good'}
          hint="Llegarían tarde o están vencidas"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filtro === f.value}
              onClick={() => setFiltro(f.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                filtro === f.value ? 'bg-navy text-white' : 'bg-navy/5 text-navy/70 hover:bg-navy/10',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          aria-label="Buscar OC"
          placeholder="Buscar por N° de OC, proveedor o SKU"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="lg:max-w-xs"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-navy/10 bg-white">
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : error ? (
          <p className="px-4 py-6 text-center text-sm text-red-600">{error}</p>
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="px-4 py-3 font-medium">N° OC</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Requerida</th>
                <th className="px-4 py-3 font-medium">Confirmada prov.</th>
                <th className="px-4 py-3 font-medium">Recepción</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy/50">
                    {ordenes.length === 0
                      ? 'Aún no hay órdenes de compra. Crea la primera con "+ Nueva OC".'
                      : 'Ninguna OC coincide con el filtro.'}
                  </td>
                </tr>
              )}
              {visibles.map((o) => {
                const alerta = alertaFecha(o);
                const avance = avanceRecepcion(o);
                return (
                  <tr key={o.id} className="border-t border-navy/5 hover:bg-navy/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/compras/${o.id}`} className="font-semibold text-navy hover:text-sky">
                        {o.numero}
                      </Link>
                      <p className="text-xs text-navy/45">
                        {o.lineas.length} {o.lineas.length === 1 ? 'línea' : 'líneas'}
                        {o.incoterm ? ` · ${o.incoterm}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-navy/80">{o.proveedor?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-navy/70">{formatDate(o.fechaRequerida)}</td>
                    <td className="px-4 py-3">
                      <span className="text-navy/70">{formatDate(o.fechaConfirmadaProveedor)}</span>
                      {alerta && (
                        <p
                          className={cn(
                            'mt-0.5 flex items-center gap-1 text-xs font-medium',
                            alerta.nivel === 'rojo' ? 'text-red-600' : 'text-[#8A5A12]',
                          )}
                        >
                          <AlertTriangle size={12} aria-hidden /> {alerta.texto}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex w-32 items-center gap-2">
                        <ProgressBar value={avance} label={`Recepción de ${o.numero}`} />
                        <span className="w-9 text-right text-xs tabular-nums text-navy/60">
                          {Math.round(avance * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy/80">
                      {formatMoney(totalOc(o), o.moneda)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoOcBadge estado={o.estado} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
