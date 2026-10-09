'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { useToast } from '@/lib/toast-context';
import { extractApiError } from '@/lib/format';
import { Carrier, ModoTransporte, TipoEnvio } from '@/types';

export default function NuevoEnvioPage() {
  const router = useRouter();
  const toast = useToast();
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [form, setForm] = useState({
    tipo: 'exportacion' as TipoEnvio,
    modo: 'maritimo' as ModoTransporte,
    carrierId: '',
    referenciaDocumento: '',
    remitenteNombre: '',
    destinatarioNombre: '',
    destinatarioEmail: '',
    origen: '',
    destino: '',
    puertoOrigen: '',
    puertoDestino: '',
    pesoKg: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Carrier[]>('/carriers').then((res) => setCarriers(res.data));
  }, []);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/shipments', {
        ...form,
        carrierId: form.carrierId || undefined,
        destinatarioEmail: form.destinatarioEmail || undefined,
        referenciaDocumento: form.referenciaDocumento || undefined,
        puertoOrigen: form.puertoOrigen || undefined,
        puertoDestino: form.puertoDestino || undefined,
        pesoKg: form.pesoKg ? Number(form.pesoKg) : undefined,
      });
      toast.success(`Envío ${res.data.codigoGuia} creado correctamente.`);
      router.push(`/dashboard/shipments/${res.data.id}`);
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear el envío. Revisa los datos e intenta de nuevo.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-navy">Nuevo envío</h1>
      <Card>
        <CardTitle>Datos del envío</CardTitle>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.tipo}
                onChange={(e) => update('tipo', e.target.value)}
              >
                <option value="exportacion">Exportación</option>
                <option value="importacion">Importación</option>
              </select>
            </Field>
            <Field label="Modo de transporte">
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.modo}
                onChange={(e) => update('modo', e.target.value)}
              >
                <option value="maritimo">Marítimo</option>
                <option value="aereo">Aéreo</option>
                <option value="terrestre">Terrestre</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Naviera / aerolínea (opcional)">
              <select
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
                value={form.carrierId}
                onChange={(e) => update('carrierId', e.target.value)}
              >
                <option value="">Sin asignar</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Referencia (BL / AWB, opcional)">
              <Input
                value={form.referenciaDocumento}
                onChange={(e) => update('referenciaDocumento', e.target.value)}
                placeholder="Ej. MAEU1234567"
              />
            </Field>
          </div>

          <Field label="Remitente">
            <Input
              required
              value={form.remitenteNombre}
              onChange={(e) => update('remitenteNombre', e.target.value)}
            />
          </Field>
          <Field label="Destinatario">
            <Input
              required
              value={form.destinatarioNombre}
              onChange={(e) => update('destinatarioNombre', e.target.value)}
            />
          </Field>
          <Field label="Email del destinatario (opcional)">
            <Input
              type="email"
              value={form.destinatarioEmail}
              onChange={(e) => update('destinatarioEmail', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Origen">
              <Input
                required
                value={form.origen}
                onChange={(e) => update('origen', e.target.value)}
              />
            </Field>
            <Field label="Destino">
              <Input
                required
                value={form.destino}
                onChange={(e) => update('destino', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Puerto/Aeropuerto origen (opcional)">
              <Input
                value={form.puertoOrigen}
                onChange={(e) => update('puertoOrigen', e.target.value)}
              />
            </Field>
            <Field label="Puerto/Aeropuerto destino (opcional)">
              <Input
                value={form.puertoDestino}
                onChange={(e) => update('puertoDestino', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Peso (kg, opcional)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={form.pesoKg}
              onChange={(e) => update('pesoKg', e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Creando...' : 'Crear envío'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-navy">{label}</label>
      {children}
    </div>
  );
}
