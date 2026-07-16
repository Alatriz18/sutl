'use client';

import { FileText, Download, Upload } from 'lucide-react';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Button } from '@/components/ui/button';

interface DocumentoDemo {
  id: string;
  nombreArchivo: string;
  tipo: 'BL' | 'AWB' | 'Factura' | 'Pedimento' | 'Packing List';
  envio: string;
  version: number;
  subidoPor: string;
  fecha: string;
}

const DOCUMENTOS_DEMO: DocumentoDemo[] = [
  { id: '1', nombreArchivo: 'BL_MAEU1234567.pdf', tipo: 'BL', envio: 'SUTL-DEMO-0001', version: 2, subidoPor: 'Admin Demo', fecha: '2026-07-10' },
  { id: '2', nombreArchivo: 'Factura_Comercial_0002.pdf', tipo: 'Factura', envio: 'SUTL-DEMO-0002', version: 1, subidoPor: 'Operador Demo', fecha: '2026-07-06' },
  { id: '3', nombreArchivo: 'AWB_CW77104.pdf', tipo: 'AWB', envio: 'SUTL-DEMO-0005', version: 1, subidoPor: 'Admin Demo', fecha: '2026-05-14' },
  { id: '4', nombreArchivo: 'Pedimento_0004.pdf', tipo: 'Pedimento', envio: 'SUTL-DEMO-0004', version: 3, subidoPor: 'Operador Demo', fecha: '2026-06-22' },
  { id: '5', nombreArchivo: 'PackingList_0006.xlsx', tipo: 'Packing List', envio: 'SUTL-DEMO-0006', version: 1, subidoPor: 'Admin Demo', fecha: '2026-05-30' },
];

const TIPO_COLOR: Record<DocumentoDemo['tipo'], string> = {
  BL: 'bg-blue-100 text-blue-700',
  AWB: 'bg-violet-100 text-violet-700',
  Factura: 'bg-emerald-100 text-emerald-700',
  Pedimento: 'bg-amber-100 text-amber-700',
  'Packing List': 'bg-slate-100 text-slate-700',
};

export default function DocumentosPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Documentos</h1>
          <p className="mt-1 text-navy/60">BL, AWB, facturas y pedimentos por envío.</p>
        </div>
        <Button disabled className="opacity-60">
          <Upload size={16} />
          Subir documento
        </Button>
      </div>

      <DemoBanner>
        Módulo de documentos: la tabla <code>documents</code> ya existe en la base de datos, pero
        el upload real a S3 y esta lista todavía no tienen API — estos son datos de ejemplo para
        previsualizar la interfaz.
      </DemoBanner>

      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 font-medium">Archivo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Envío</th>
              <th className="px-4 py-3 font-medium">Versión</th>
              <th className="px-4 py-3 font-medium">Subido por</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {DOCUMENTOS_DEMO.map((d) => (
              <tr key={d.id} className="border-t border-navy/5">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-navy">
                    <FileText size={16} className="text-navy/40" />
                    {d.nombreArchivo}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_COLOR[d.tipo]}`}>
                    {d.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-sky">{d.envio}</td>
                <td className="px-4 py-3 text-navy/60">v{d.version}</td>
                <td className="px-4 py-3 text-navy/60">{d.subidoPor}</td>
                <td className="px-4 py-3 text-navy/60">{d.fecha}</td>
                <td className="px-4 py-3 text-right">
                  <button disabled className="text-navy/30" title="Descarga deshabilitada (demo)">
                    <Download size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
