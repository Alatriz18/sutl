'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CAMPOS_OC } from '@/lib/import-campos';
import { CsvImportWizard, ResultadoImportacion } from '@/components/import/csv-import-wizard';

interface RespuestaImportacionOc {
  simular: boolean;
  resumen: { filas: number; ordenes: number; nuevas: number; omitidas: number; conErrores: number; filasConErrores: number; proveedoresACrear: number };
  ordenes: { numero: string; estado: 'nueva' | 'omitida' | 'error'; lineas: number; proveedor: string | null; mensajes: string[] }[];
  errores: { fila: number; numero: string | null; mensajes: string[] }[];
}

export default function ImportarOcPage() {
  const [crearProveedores, setCrearProveedores] = useState(false);

  async function evaluar(filas: Record<string, unknown>[], simular: boolean): Promise<ResultadoImportacion> {
    const { data } = await api.post<RespuestaImportacionOc>('/purchase-orders/importar', { filas, simular, crearProveedores });
    const r = data.resumen;
    return {
      resumen: [
        { label: simular ? 'OCs nuevas' : 'OCs importadas', valor: r.nuevas, tono: 'ok' },
        { label: 'Ya existían (se omiten)', valor: r.omitidas, tono: r.omitidas ? 'aviso' : undefined },
        { label: 'Con errores', valor: r.conErrores, tono: r.conErrores ? 'error' : undefined },
        ...(r.proveedoresACrear > 0
          ? [{ label: simular ? 'Proveedores a crear' : 'Proveedores creados', valor: r.proveedoresACrear, tono: 'aviso' as const }]
          : []),
      ],
      items: data.ordenes.map((o) => ({
        id: o.numero,
        titulo: `${o.numero} · ${o.lineas} línea${o.lineas === 1 ? '' : 's'}${o.proveedor ? ` · ${o.proveedor}` : ''}`,
        estado: o.estado === 'nueva' ? 'ok' : o.estado,
        mensajes: o.mensajes,
      })),
      errores: data.errores,
      importables: r.nuevas,
    };
  }

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard/compras" className="text-sm text-sky hover:underline">
        ← Órdenes de compra
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-navy">Importar órdenes de compra</h1>
      <p className="mt-1 text-navy/60">
        Carga las OCs que ya tienes en tu ERP o en Excel. Cada fila es una línea de OC; las filas con el mismo N° de OC forman una sola orden y los datos de cabecera
        (proveedor, fechas…) se leen de la primera fila. Las OCs se crean en borrador y las que ya existen se omiten, así que puedes repetir la carga sin duplicar.
      </p>
      <div className="mt-6">
        <CsvImportWizard
          tipo="ordenes_compra"
          campos={CAMPOS_OC}
          plantilla="plantilla-ordenes-de-compra.csv"
          evaluar={evaluar}
          opcionesClave={String(crearProveedores)}
          opciones={
            <label className="flex items-start gap-2 text-sm text-navy">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-navy/30 text-sky focus:ring-sky"
                checked={crearProveedores}
                onChange={(e) => setCrearProveedores(e.target.checked)}
              />
              <span>
                Crear los proveedores que no existan
                <span className="block text-xs text-navy/50">
                  Sin esto, una OC cuyo proveedor no está en Contactos se rechaza. Un proveedor nuevo solo se crea si su OC se importa.
                </span>
              </span>
            </label>
          }
          textoImportar={(r) => `Importar ${r.importables} OC${r.importables === 1 ? '' : 's'}`}
          textoExito={(r) => `Se importaron ${r.importables} OC${r.importables === 1 ? '' : 's'} en borrador.`}
          destinoHref="/dashboard/compras"
          destinoLabel="Ver órdenes de compra"
        />
      </div>
    </div>
  );
}
