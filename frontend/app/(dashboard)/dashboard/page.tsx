'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Package, Truck, CheckCircle2, AlertTriangle, Plane, Ship } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardTitle } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { EstadoBadge } from '@/components/ui/badge';
import { CATEGORICAL, CHART_INK, STATUS } from '@/lib/chart-colors';
import { Carrier, EstadoEnvio, Shipment } from '@/types';

const ESTADO_LABELS: Record<EstadoEnvio, string> = {
  creado: 'Creado',
  en_transito: 'En tránsito',
  en_aduana: 'En aduana',
  entregado: 'Entregado',
  incidencia: 'Incidencia',
};

const ESTADO_COLORS: Record<EstadoEnvio, string> = {
  creado: CHART_INK.muted,
  en_transito: CATEGORICAL[0],
  en_aduana: STATUS.warning,
  entregado: STATUS.good,
  incidencia: STATUS.critical,
};

const MODO_LABELS = { maritimo: 'Marítimo', aereo: 'Aéreo', terrestre: 'Terrestre' } as const;

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Shipment[]>('/shipments'), api.get<Carrier[]>('/carriers')])
      .then(([shipRes, carRes]) => {
        setShipments(shipRes.data);
        setCarriers(carRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => ({
      total: shipments.length,
      enTransito: shipments.filter((s) => s.estado === 'en_transito').length,
      entregados: shipments.filter((s) => s.estado === 'entregado').length,
      incidencias: shipments.filter((s) => s.estado === 'incidencia').length,
    }),
    [shipments],
  );

  const porEstado = useMemo(() => {
    const ordenados: EstadoEnvio[] = ['creado', 'en_transito', 'en_aduana', 'entregado', 'incidencia'];
    return ordenados.map((estado) => ({
      estado,
      label: ESTADO_LABELS[estado],
      cantidad: shipments.filter((s) => s.estado === estado).length,
    }));
  }, [shipments]);

  const porTipo = useMemo(() => {
    const importacion = shipments.filter((s) => s.tipo === 'importacion').length;
    const exportacion = shipments.filter((s) => s.tipo === 'exportacion').length;
    return [
      { name: 'Exportación', value: exportacion, color: CATEGORICAL[0] },
      { name: 'Importación', value: importacion, color: CATEGORICAL[1] },
    ].filter((d) => d.value > 0);
  }, [shipments]);

  const tendenciaMensual = useMemo(() => {
    const meses: { key: string; label: string }[] = [];
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('es-EC', { month: 'short' }),
      });
    }
    return meses.map(({ key, label }) => {
      const cantidad = shipments.filter((s) => {
        const created = new Date(s.createdAt);
        return `${created.getFullYear()}-${created.getMonth()}` === key;
      }).length;
      return { mes: label, envios: cantidad };
    });
  }, [shipments]);

  const topNavieras = useMemo(() => {
    return carriers
      .map((c) => ({
        nombre: c.nombre,
        cantidad: shipments.filter((s) => s.carrierId === c.id).length,
      }))
      .filter((c) => c.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);
  }, [carriers, shipments]);

  const recientes = useMemo(
    () =>
      [...shipments]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [shipments],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Resumen</h1>
      <p className="mt-1 text-navy/60">Bienvenido, {user?.email}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Envíos totales" value={loading ? '—' : stats.total} icon={Package} accent="navy" />
        <StatTile
          label="En tránsito"
          value={loading ? '—' : stats.enTransito}
          icon={Truck}
          accent="sky"
        />
        <StatTile
          label="Entregados"
          value={loading ? '—' : stats.entregados}
          icon={CheckCircle2}
          accent="good"
        />
        <StatTile
          label="Incidencias"
          value={loading ? '—' : stats.incidencias}
          icon={AlertTriangle}
          accent="critical"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Envíos por estado</CardTitle>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porEstado} barSize={36}>
                <CartesianGrid vertical={false} stroke={CHART_INK.gridline} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                  axisLine={{ stroke: CHART_INK.baseline }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(11,11,11,0.04)' }}
                  contentStyle={{ borderRadius: 8, borderColor: CHART_INK.gridline, fontSize: 13 }}
                />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                  {porEstado.map((d) => (
                    <Cell key={d.estado} fill={ESTADO_COLORS[d.estado]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Tendencia mensual de envíos</CardTitle>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tendenciaMensual}>
                <CartesianGrid vertical={false} stroke={CHART_INK.gridline} />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                  axisLine={{ stroke: CHART_INK.baseline }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: CHART_INK.gridline, fontSize: 13 }} />
                <Line
                  type="monotone"
                  dataKey="envios"
                  stroke={CATEGORICAL[0]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CATEGORICAL[0] }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Envíos por tipo</CardTitle>
          <div className="mt-4 h-64">
            {porTipo.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-navy/40">
                Sin datos todavía
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porTipo}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {porTipo.map((d) => (
                      <Cell key={d.name} fill={d.color} stroke={CHART_INK.surface} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={32}
                    formatter={(value) => <span className="text-sm text-navy/70">{value}</span>}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: CHART_INK.gridline, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Envíos por naviera / aerolínea</CardTitle>
          <div className="mt-4 h-64">
            {topNavieras.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-navy/40">
                Aún no hay envíos con naviera asignada
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topNavieras} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid horizontal={false} stroke={CHART_INK.gridline} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fill: CHART_INK.secondary, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: CHART_INK.gridline, fontSize: 13 }} />
                  <Bar dataKey="cantidad" fill={CATEGORICAL[0]} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardTitle className="mb-3">Envíos recientes</CardTitle>
          <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Guía</th>
                  <th className="px-4 py-2.5 font-medium">Modo</th>
                  <th className="px-4 py-2.5 font-medium">Destino</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((s) => (
                  <tr key={s.id} className="border-t border-navy/5">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/shipments/${s.id}`}
                        className="font-medium text-sky hover:underline"
                      >
                        {s.codigoGuia}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-navy/70">
                      <span className="inline-flex items-center gap-1">
                        {s.modo === 'aereo' ? <Plane size={14} /> : <Ship size={14} />}
                        {MODO_LABELS[s.modo]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-navy/70">{s.destino}</td>
                    <td className="px-4 py-2.5">
                      <EstadoBadge estado={s.estado} />
                    </td>
                  </tr>
                ))}
                {recientes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-navy/50">
                      Aún no hay envíos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <CardTitle className="mb-3">Accesos rápidos</CardTitle>
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard/shipments/nuevo"
              className="rounded-md bg-navy px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-navy/90"
            >
              + Nuevo envío
            </Link>
            <Link
              href="/dashboard/shipments"
              className="rounded-md border border-navy/20 px-4 py-2.5 text-center text-sm font-medium text-navy hover:bg-navy/5"
            >
              Ver todos los envíos
            </Link>
            <Link
              href="/dashboard/navieras"
              className="rounded-md border border-navy/20 px-4 py-2.5 text-center text-sm font-medium text-navy hover:bg-navy/5"
            >
              Ver navieras y aerolíneas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
