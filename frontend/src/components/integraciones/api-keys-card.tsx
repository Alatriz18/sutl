'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Key, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDateTime } from '@/lib/format';
import { ApiKey } from '@/types';
import { SecretoUnaVez } from './secreto-una-vez';

// Claves de la API pública v1 (solo lectura). Contrato real: backend/src/modules/api-keys.
export function ApiKeysCard() {
  const toast = useToast();
  const [claves, setClaves] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [nueva, setNueva] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api
      .get<ApiKey[]>('/api-keys')
      .then((r) => setClaves(r.data))
      .catch((e) => setError(extractApiError(e, 'No se pudieron cargar las API keys.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await api.post<ApiKey>('/api-keys', { nombre: nombre.trim() });
      setNueva(r.data.llave ?? null);
      setNombre('');
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la API key.'));
    } finally {
      setGuardando(false);
    }
  }

  async function revocar(id: string) {
    try {
      await api.delete(`/api-keys/${id}`);
      toast.success('API key revocada: deja de funcionar de inmediato.');
      setConfirmando(null);
      cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo revocar la API key.'));
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Key size={16} className="text-navy/50" aria-hidden />
        <CardTitle className="!mb-0">API keys</CardTitle>
      </div>
      <p className="mt-1 text-sm text-navy/60">
        Para que tu ERP u otro sistema <strong>consulte</strong> tus envíos, órdenes de compra y riesgo de abastecimiento (solo lectura). Se envía en la cabecera <code className="text-xs">X-API-Key</code> a <code className="text-xs">/api/v1/…</code>.
      </p>

      {nueva && <SecretoUnaVez titulo="Tu nueva API key" valor={nueva} onCerrar={() => setNueva(null)} />}

      <div className="mt-4 flex flex-col gap-2">
        {error && <p className="text-sm text-[#B3362B]">{error}</p>}
        {claves && claves.length === 0 && <p className="text-sm text-navy/40">Aún no hay API keys.</p>}
        {claves?.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 rounded-md border border-navy/10 px-3 py-2.5">
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${k.revocadaAt ? 'text-navy/40 line-through' : 'text-navy'}`}>{k.nombre}</p>
              <p className="text-xs text-navy/50">
                <code>{k.prefijo}…</code>
                {' · '}
                {k.revocadaAt ? `revocada ${formatDateTime(k.revocadaAt)}` : k.ultimoUsoAt ? `último uso ${formatDateTime(k.ultimoUsoAt)}` : 'sin usar todavía'}
              </p>
            </div>
            {!k.revocadaAt &&
              (confirmando === k.id ? (
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <button onClick={() => revocar(k.id)} className="font-medium text-[#B3362B] hover:underline">
                    Sí, revocar
                  </button>
                  <button onClick={() => setConfirmando(null)} className="text-navy/50 hover:underline">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmando(k.id)}
                  className="shrink-0 text-navy/40 hover:text-[#B3362B]"
                  aria-label={`Revocar la API key ${k.nombre}`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              ))}
          </div>
        ))}
      </div>

      <form onSubmit={crear} className="mt-4 flex gap-2">
        <Input
          aria-label="Nombre de la integración"
          placeholder="Nombre de la integración (ej. ERP interno)"
          required
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Button type="submit" disabled={guardando} className="shrink-0">
          {guardando ? '...' : 'Generar'}
        </Button>
      </form>
    </Card>
  );
}
