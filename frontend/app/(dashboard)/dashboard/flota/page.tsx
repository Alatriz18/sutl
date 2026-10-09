'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Truck, UserRound, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatKg } from '@/lib/format';
import { Driver, EstadoVehiculo, Vehicle } from '@/types';

const ESTADO_COLOR: Record<EstadoVehiculo, string> = {
  disponible: 'bg-emerald-100 text-emerald-700',
  en_ruta: 'bg-sky/10 text-sky',
  mantenimiento: 'bg-[#fab219]/20 text-[#a86a00]',
  inactivo: 'bg-slate-100 text-slate-700',
};

export default function FlotaPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingDriver, setSavingDriver] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ placa: '', tipo: '', capacidadKg: '' });
  const [driverForm, setDriverForm] = useState({ nombre: '', licencia: '', telefono: '' });

  async function cargar() {
    setLoading(true);
    const [vRes, dRes] = await Promise.all([
      api.get<Vehicle[]>('/vehicles'),
      api.get<Driver[]>('/drivers'),
    ]);
    setVehicles(vRes.data);
    setDrivers(dRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleCreateVehicle(e: FormEvent) {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      await api.post('/vehicles', {
        ...vehicleForm,
        capacidadKg: vehicleForm.capacidadKg ? Number(vehicleForm.capacidadKg) : undefined,
      });
      setVehicleForm({ placa: '', tipo: '', capacidadKg: '' });
      toast.success('Vehículo creado correctamente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear el vehículo.'));
    } finally {
      setSavingVehicle(false);
    }
  }

  async function handleCreateDriver(e: FormEvent) {
    e.preventDefault();
    setSavingDriver(true);
    try {
      await api.post('/drivers', { ...driverForm, telefono: driverForm.telefono || undefined });
      setDriverForm({ nombre: '', licencia: '', telefono: '' });
      toast.success('Chofer registrado correctamente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar el chofer.'));
    } finally {
      setSavingDriver(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Flota y choferes</h1>
      <p className="mt-1 text-navy/60">Vehículos, choferes y asignación a envíos terrestres.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TableSkeleton rows={1} cols={2} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {vehicles.length === 0 && (
                <p className="text-sm text-navy/50">Aún no hay vehículos registrados.</p>
              )}
              {vehicles.map((v) => {
                const asignacionActiva = v.asignaciones?.[0];
                return (
                  <Card key={v.id}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-navy">{v.placa}</p>
                        <p className="text-xs uppercase tracking-wide text-navy/40">{v.tipo}</p>
                      </div>
                      <span className="rounded-md bg-navy/10 p-2 text-navy">
                        <Truck size={18} />
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-navy/70">
                      <UserRound size={14} className="text-navy/40" />
                      {asignacionActiva?.driver?.nombre ?? 'Sin asignar'}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-navy/60">
                      <Wrench size={14} className="text-navy/40" />
                      Capacidad: {formatKg(v.capacidadKg)}
                    </div>
                    <span
                      className={cn(
                        'mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        ESTADO_COLOR[v.estado],
                      )}
                    >
                      {v.estado.replace('_', ' ')}
                    </span>
                  </Card>
                );
              })}
            </div>
          )}

          <CardTitle className="mb-3 mt-8">Choferes</CardTitle>
          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={2} cols={3} />
            ) : (
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-navy/5 text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Licencia</th>
                    <th className="px-4 py-3 font-medium">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-navy/50">
                        Aún no hay choferes registrados.
                      </td>
                    </tr>
                  )}
                  {drivers.map((d) => (
                    <tr key={d.id} className="border-t border-navy/5">
                      <td className="px-4 py-3 font-medium text-navy">{d.nombre}</td>
                      <td className="px-4 py-3 text-navy/60">{d.licencia}</td>
                      <td className="px-4 py-3 text-navy/60">{d.telefono ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>Nuevo vehículo</CardTitle>
            <form onSubmit={handleCreateVehicle} className="mt-3 flex flex-col gap-3">
              <Input
                placeholder="Placa"
                required
                value={vehicleForm.placa}
                onChange={(e) => setVehicleForm((f) => ({ ...f, placa: e.target.value }))}
              />
              <Input
                placeholder="Tipo (ej. Camión 3.5T)"
                required
                value={vehicleForm.tipo}
                onChange={(e) => setVehicleForm((f) => ({ ...f, tipo: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Capacidad (kg, opcional)"
                value={vehicleForm.capacidadKg}
                onChange={(e) => setVehicleForm((f) => ({ ...f, capacidadKg: e.target.value }))}
              />
              <Button type="submit" disabled={savingVehicle}>
                {savingVehicle ? 'Creando...' : 'Crear vehículo'}
              </Button>
            </form>
          </Card>

          <Card>
            <CardTitle>Nuevo chofer</CardTitle>
            <form onSubmit={handleCreateDriver} className="mt-3 flex flex-col gap-3">
              <Input
                placeholder="Nombre"
                required
                value={driverForm.nombre}
                onChange={(e) => setDriverForm((f) => ({ ...f, nombre: e.target.value }))}
              />
              <Input
                placeholder="Licencia"
                required
                value={driverForm.licencia}
                onChange={(e) => setDriverForm((f) => ({ ...f, licencia: e.target.value }))}
              />
              <Input
                placeholder="Teléfono (opcional)"
                value={driverForm.telefono}
                onChange={(e) => setDriverForm((f) => ({ ...f, telefono: e.target.value }))}
              />
              <Button type="submit" disabled={savingDriver}>
                {savingDriver ? 'Guardando...' : 'Registrar chofer'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
