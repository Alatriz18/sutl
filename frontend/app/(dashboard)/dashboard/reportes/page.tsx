'use client';

import { FileSpreadsheet, FileText, Download, BarChart3 } from 'lucide-react';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

interface ReporteDemo {
  id: string;
  tipo: string;
  formato: 'PDF' | 'Excel' | 'CSV';
  generadoPor: string;
  fecha: string;
}

const FORMATO_ICON = { PDF: FileText, Excel: FileSpreadsheet, CSV: FileSpreadsheet } as const;

const REPORTES_DEMO: ReporteDemo[] = [
  { id: '1', tipo: 'Envíos por estado — julio 2026', formato: 'PDF', generadoPor: 'Admin Demo', fecha: '2026-07-14' },
  { id: '2', tipo: 'KPIs logísticos — Q2 2026', formato: 'Excel', generadoPor: 'Admin Demo', fecha: '2026-07-01' },
  { id: '3', tipo: 'Envíos por naviera — semestral', formato: 'CSV', generadoPor: 'Operador Demo', fecha: '2026-06-15' },
  { id: '4', tipo: 'Incidencias registradas — junio 2026', formato: 'PDF', generadoPor: 'Admin Demo', fecha: '2026-06-01' },
];

const REPORTES_DISPONIBLES = [
  { nombre: 'Envíos por estado', descripcion: 'Distribución de envíos por estado en un rango de fechas.' },
  { nombre: 'KPIs logísticos', descripcion: 'Tiempos de tránsito, retrasos e indicadores por naviera.' },
  { nombre: 'Envíos por cliente', descripcion: 'Volumen de envíos agrupado por destinatario/remitente.' },
];

export default function ReportesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Reportes</h1>
      <p className="mt-1 text-navy/60">Exportación de analytics y KPIs logísticos.</p>

      <DemoBanner>
        La tabla <code>reports</code> ya existe en la base de datos. El motor de generación
        (PDF/Excel/CSV) todavía no está implementado — esta pantalla muestra cómo se vería el
        historial y el generador una vez conectado.
      </DemoBanner>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {REPORTES_DISPONIBLES.map((r) => (
          <Card key={r.nombre}>
            <span className="mb-2 inline-flex rounded-md bg-sky/10 p-2 text-sky">
              <BarChart3 size={18} />
            </span>
            <p className="font-medium text-navy">{r.nombre}</p>
            <p className="mt-1 text-sm text-navy/60">{r.descripcion}</p>
            <Button disabled className="mt-3 w-full opacity-60" variant="secondary">
              Generar
            </Button>
          </Card>
        ))}
      </div>

      <CardTitle className="mb-3">Historial de reportes</CardTitle>
      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 font-medium">Reporte</th>
              <th className="px-4 py-3 font-medium">Formato</th>
              <th className="px-4 py-3 font-medium">Generado por</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {REPORTES_DEMO.map((r) => {
              const Icon = FORMATO_ICON[r.formato];
              return (
                <tr key={r.id} className="border-t border-navy/5">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-navy">
                      <Icon size={16} className="text-navy/40" />
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy/60">{r.formato}</td>
                  <td className="px-4 py-3 text-navy/60">{r.generadoPor}</td>
                  <td className="px-4 py-3 text-navy/50">{r.fecha}</td>
                  <td className="px-4 py-3 text-right">
                    <button disabled className="text-navy/30" title="Descarga deshabilitada (demo)">
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
