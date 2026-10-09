'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Download, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDate } from '@/lib/format';
import { Report } from '@/types';

const FORMATO_ICON: Record<string, typeof FileText> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  csv: FileSpreadsheet,
};

const REPORTES_DISPONIBLES = [
  { tipo: 'envios_por_estado', nombre: 'Envíos por estado', descripcion: 'Distribución de envíos por estado.' },
  { tipo: 'envios_por_naviera', nombre: 'Envíos por naviera', descripcion: 'Volumen de envíos agrupado por naviera/aerolínea.' },
  { tipo: 'envios_por_cliente', nombre: 'Envíos por cliente', descripcion: 'Volumen de envíos agrupado por destinatario.' },
];

export default function ReportesPage() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    const res = await api.get<Report[]>('/reports');
    setReports(res.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function generar(tipo: string) {
    setGenerando(tipo);
    try {
      await api.post('/reports', { tipo, formato: 'csv' });
      toast.success('Reporte CSV generado.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el reporte.'));
    } finally {
      setGenerando(null);
    }
  }

  async function descargar(r: Report) {
    setDescargando(r.id);
    try {
      const res = await api.get(`/reports/${r.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${r.tipo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo descargar el reporte.'));
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Reportes</h1>
      <p className="mt-1 text-navy/60">Exportación de analytics y KPIs logísticos.</p>

      <DemoBanner>
        El CSV se genera de verdad (agregando tus envíos actuales). PDF y Excel todavía no tienen
        generador conectado — el registro se crea igual, pero sin archivo descargable.
      </DemoBanner>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {REPORTES_DISPONIBLES.map((r) => (
          <Card key={r.tipo}>
            <span className="mb-2 inline-flex rounded-md bg-sky/10 p-2 text-sky">
              <BarChart3 size={18} />
            </span>
            <p className="font-medium text-navy">{r.nombre}</p>
            <p className="mt-1 text-sm text-navy/60">{r.descripcion}</p>
            <Button
              className="mt-3 w-full"
              variant="secondary"
              disabled={generando === r.tipo}
              onClick={() => generar(r.tipo)}
            >
              {generando === r.tipo ? 'Generando...' : 'Generar CSV'}
            </Button>
          </Card>
        ))}
      </div>

      <CardTitle className="mb-3">Historial de reportes</CardTitle>
      <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
        {loading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
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
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-navy/50">
                    Aún no hay reportes generados.
                  </td>
                </tr>
              )}
              {reports.map((r) => {
                const Icon = FORMATO_ICON[r.formato] ?? FileText;
                return (
                  <tr key={r.id} className="border-t border-navy/5">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-navy">
                        <Icon size={16} className="text-navy/40" />
                        {r.tipo.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy/60 uppercase">{r.formato}</td>
                    <td className="px-4 py-3 text-navy/60">{r.generadoPor?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-navy/50">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.urlArchivo ? (
                        <button
                          disabled={descargando === r.id}
                          onClick={() => descargar(r)}
                          className="text-navy/50 hover:text-navy disabled:opacity-40"
                          title="Descargar"
                        >
                          <Download size={16} />
                        </button>
                      ) : (
                        <span className="text-xs text-navy/30">sin archivo</span>
                      )}
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
