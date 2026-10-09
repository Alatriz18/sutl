'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, FileWarning, PlaneTakeoff } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { Alert, AlertaEvaluada, EstadoEnvio, TipoAlerta, TipoDocumento } from '@/types';

const TIPO_ICON: Record<TipoAlerta, typeof AlertTriangle> = {
  retraso: Clock,
  documento_faltante: FileWarning,
  llegada_proxima: PlaneTakeoff,
  cambio_estado: AlertTriangle,
  personalizada: AlertTriangle,
};

const TIPO_LABEL: Record<TipoAlerta, string> = {
  retraso: 'Retraso en un estado',
  documento_faltante: 'Documento faltante',
  llegada_proxima: 'Llegada próxima',
  cambio_estado: 'Cambio de estado',
  personalizada: 'Personalizada',
};

function describirCondicion(alerta: Alert): string {
  const c = alerta.condicion as Record<string, unknown>;
  if (alerta.tipo === 'retraso') {
    return `Envíos en "${c.estado}" hace más de ${c.diasUmbral} día(s)`;
  }
  if (alerta.tipo === 'documento_faltante') {
    return `Sin documento "${c.tipoDocumento}" ${c.diasUmbral} día(s) después de creado`;
  }
  if (alerta.tipo === 'llegada_proxima') {
    return `Llegada estimada en los próximos ${c.diasAntes} día(s)`;
  }
  return 'Sin evaluación automática';
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40',
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

const ESTADOS: EstadoEnvio[] = ['creado', 'en_transito', 'en_aduana', 'entregado', 'incidencia'];
const TIPOS_DOC: TipoDocumento[] = ['bl', 'awb', 'factura', 'pedimento', 'packing_list'];

export default function AlertasPage() {
  const toast = useToast();
  const [alertas, setAlertas] = useState<Alert[]>([]);
  const [evaluadas, setEvaluadas] = useState<AlertaEvaluada[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<TipoAlerta>('retraso');
  const [estado, setEstado] = useState<EstadoEnvio>('en_transito');
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('bl');
  const [diasUmbral, setDiasUmbral] = useState('5');
  const [diasAntes, setDiasAntes] = useState('7');

  async function cargar() {
    setLoading(true);
    const [aRes, eRes] = await Promise.all([
      api.get<Alert[]>('/alerts'),
      api.get<AlertaEvaluada[]>('/alerts/evaluar'),
    ]);
    setAlertas(aRes.data);
    setEvaluadas(eRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function toggleActivo(a: Alert) {
    setBusyId(a.id);
    try {
      await api.patch(`/alerts/${a.id}`, { activo: !a.activo });
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar la alerta.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const condicion =
        tipo === 'retraso'
          ? { estado, diasUmbral: Number(diasUmbral) }
          : tipo === 'documento_faltante'
            ? { tipoDocumento, diasUmbral: Number(diasUmbral) }
            : { diasAntes: Number(diasAntes) };

      await api.post('/alerts', { tipo, condicion });
      toast.success('Regla de alerta creada.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la alerta.'));
    } finally {
      setSaving(false);
    }
  }

  const totalDisparadas = evaluadas.reduce((acc, e) => acc + e.disparados.length, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Alertas</h1>
      <p className="mt-1 text-navy/60">
        Reglas evaluadas en tiempo real contra tus envíos actuales — sin cron todavía, se calculan
        al cargar esta página.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {totalDisparadas > 0 && (
            <Card className="mb-4 border-[#d03b3b]/30 bg-[#d03b3b]/5">
              <p className="text-sm font-medium text-[#d03b3b]">
                {totalDisparadas} envío(s) disparando alguna alerta ahora mismo
              </p>
            </Card>
          )}

          {loading ? (
            <TableSkeleton rows={3} cols={2} />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {alertas.length === 0 && (
                <p className="text-sm text-navy/50">Aún no hay reglas de alerta.</p>
              )}
              {alertas.map((a) => {
                const Icon = TIPO_ICON[a.tipo];
                const ev = evaluadas.find((e) => e.alerta.id === a.id);
                return (
                  <Card key={a.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 rounded-md bg-navy/10 p-2 text-navy">
                          <Icon size={18} />
                        </span>
                        <div>
                          <p className="font-medium text-navy">{TIPO_LABEL[a.tipo]}</p>
                          <p className="mt-0.5 text-sm text-navy/60">{describirCondicion(a)}</p>
                        </div>
                      </div>
                      <Toggle checked={a.activo} disabled={busyId === a.id} onChange={() => toggleActivo(a)} />
                    </div>
                    {ev && ev.disparados.length > 0 && (
                      <div className="mt-3 border-t border-navy/5 pt-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#d03b3b]">
                          Disparada por {ev.disparados.length} envío(s)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ev.disparados.slice(0, 8).map((s) => (
                            <Link
                              key={s.id}
                              href={`/dashboard/shipments/${s.id}`}
                              className="rounded-full bg-[#d03b3b]/10 px-2 py-0.5 text-xs font-medium text-[#d03b3b] hover:underline"
                            >
                              {s.codigoGuia}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Card>
          <CardTitle>Nueva regla</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAlerta)}
            >
              <option value="retraso">Retraso en un estado</option>
              <option value="documento_faltante">Documento faltante</option>
              <option value="llegada_proxima">Llegada próxima</option>
            </select>

            {tipo === 'retraso' && (
              <>
                <select
                  className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoEnvio)}
                >
                  {ESTADOS.map((es) => (
                    <option key={es} value={es}>
                      {es}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  placeholder="Días de umbral"
                  value={diasUmbral}
                  onChange={(e) => setDiasUmbral(e.target.value)}
                />
              </>
            )}

            {tipo === 'documento_faltante' && (
              <>
                <select
                  className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
                >
                  {TIPOS_DOC.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  placeholder="Días desde creado"
                  value={diasUmbral}
                  onChange={(e) => setDiasUmbral(e.target.value)}
                />
              </>
            )}

            {tipo === 'llegada_proxima' && (
              <Input
                type="number"
                min={1}
                placeholder="Días antes de la llegada"
                value={diasAntes}
                onChange={(e) => setDiasAntes(e.target.value)}
              />
            )}

            <Button type="submit" disabled={saving}>
              {saving ? 'Creando...' : 'Crear regla'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
