'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CAMPOS_POLITICAS } from '@/lib/import-campos';
import { useTenantConfig } from '@/lib/tenant-config';
import { CsvImportWizard, ResultadoImportacion } from '@/components/import/csv-import-wizard';

interface RespuestaImportacionPoliticas {
  simular: boolean;
  resumen: { total: number; aplicadas: number; validas: number; conErrores: number };
  filas: { fila: number; sku: string | null; estado: 'ok' | 'error'; mensajes: string[] }[];
}

export default function ImportarPoliticasPage() {
  const { config } = useTenantConfig();
  // Las existencias del ERP solo se aceptan si el inventario vive en otro sistema.
  const campos = useMemo(
    () => CAMPOS_POLITICAS.filter((c) => c.key !== 'existenciasExternas' || config.inventario.recepcionActualizaInventario === 'nunca'),
    [config.inventario.recepcionActualizaInventario],
  );

  async function evaluar(filas: Record<string, unknown>[], simular: boolean): Promise<ResultadoImportacion> {
    const { data } = await api.post<RespuestaImportacionPoliticas>('/inventory-policies/importar', { filas, simular });
    const r = data.resumen;
    return {
      resumen: [
        { label: simular ? 'Filas válidas' : 'SKUs aplicados', valor: simular ? r.validas : r.aplicadas, tono: 'ok' },
        { label: 'Con errores', valor: r.conErrores, tono: r.conErrores ? 'error' : undefined },
      ],
      // Solo las filas con problema: listar miles de filas válidas no aporta.
      items: data.filas
        .filter((f) => f.estado === 'error')
        .map((f) => ({ id: `fila-${f.fila}`, titulo: f.sku ? `${f.sku}` : `Fila ${f.fila}`, estado: 'error' as const, mensajes: f.mensajes })),
      errores: [],
      importables: r.validas,
    };
  }

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard/cobertura" className="text-sm text-sky hover:underline">
        ← Cobertura de inventario
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-navy">Importar parámetros por SKU</h1>
      <p className="mt-1 text-navy/60">
        Carga el consumo diario, el stock de seguridad y el lead time de tus SKUs. Si el SKU ya tiene parámetros, se reemplazan por los del archivo; un mismo SKU no puede
        aparecer dos veces en el archivo.
        {config.inventario.recepcionActualizaInventario === 'nunca' &&
          ' Como tu inventario vive en otro sistema, también puedes cargar las existencias que reporta tu ERP.'}
      </p>
      <div className="mt-6">
        <CsvImportWizard
          tipo="politicas_inventario"
          campos={campos}
          plantilla="plantilla-parametros-sku.csv"
          evaluar={evaluar}
          textoImportar={(r) => `Aplicar ${r.importables} SKU${r.importables === 1 ? '' : 's'}`}
          textoExito={(r) => `Se aplicaron los parámetros de ${r.resumen[0].valor} SKU${r.resumen[0].valor === 1 ? '' : 's'}.`}
          destinoHref="/dashboard/cobertura"
          destinoLabel="Ver cobertura"
        />
      </div>
    </div>
  );
}
