'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { FileText, Download, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { extractApiError, formatDate } from '@/lib/format';
import { Shipment, SutlDocument, TipoDocumento } from '@/types';

const TIPOS: TipoDocumento[] = ['bl', 'awb', 'factura', 'pedimento', 'packing_list', 'otro'];

const TIPO_LABEL: Record<TipoDocumento, string> = {
  bl: 'BL',
  awb: 'AWB',
  factura: 'Factura',
  pedimento: 'Pedimento',
  packing_list: 'Packing List',
  otro: 'Otro',
};

const TIPO_COLOR: Record<TipoDocumento, string> = {
  bl: 'bg-blue-100 text-blue-700',
  awb: 'bg-violet-100 text-violet-700',
  factura: 'bg-emerald-100 text-emerald-700',
  pedimento: 'bg-amber-100 text-amber-700',
  packing_list: 'bg-slate-100 text-slate-700',
  otro: 'bg-slate-100 text-slate-700',
};

export default function DocumentosPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<SutlDocument[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [form, setForm] = useState({ shipmentId: '', tipo: 'bl' as TipoDocumento });

  async function cargar() {
    setLoading(true);
    const [dRes, sRes] = await Promise.all([
      api.get<SutlDocument[]>('/documents'),
      api.get<Shipment[]>('/shipments'),
    ]);
    setDocuments(dRes.data);
    setShipments(sRes.data);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Selecciona un archivo primero.');
      return;
    }
    if (!form.shipmentId) {
      toast.error('Selecciona a qué envío pertenece el documento.');
      return;
    }

    const body = new FormData();
    body.append('shipmentId', form.shipmentId);
    body.append('tipo', form.tipo);
    body.append('file', file);

    setUploading(true);
    try {
      await api.post('/documents', body);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Documento subido correctamente.');
      await cargar();
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo subir el documento.'));
    } finally {
      setUploading(false);
    }
  }

  async function descargar(doc: SutlDocument) {
    setDescargando(doc.id);
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nombreArchivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo descargar el documento.'));
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Documentos</h1>
      <p className="mt-1 text-navy/60">BL, AWB, facturas y pedimentos por envío.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
            {loading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
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
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-navy/50">
                        Aún no hay documentos subidos.
                      </td>
                    </tr>
                  )}
                  {documents.map((d) => (
                    <tr key={d.id} className="border-t border-navy/5">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-navy">
                          <FileText size={16} className="text-navy/40" />
                          {d.nombreArchivo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_COLOR[d.tipo]}`}>
                          {TIPO_LABEL[d.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sky">{d.shipment?.codigoGuia ?? '—'}</td>
                      <td className="px-4 py-3 text-navy/60">v{d.version}</td>
                      <td className="px-4 py-3 text-navy/60">{d.subidoPor?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-navy/60">{formatDate(d.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={descargando === d.id}
                          onClick={() => descargar(d)}
                          className="text-navy/50 hover:text-navy disabled:opacity-40"
                          title="Descargar"
                        >
                          <Download size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <Card>
          <CardTitle>Subir documento</CardTitle>
          <form onSubmit={handleUpload} className="mt-3 flex flex-col gap-3">
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              required
              value={form.shipmentId}
              onChange={(e) => setForm((f) => ({ ...f, shipmentId: e.target.value }))}
            >
              <option value="">Envío...</option>
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigoGuia}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoDocumento }))}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.doc,.docx"
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-navy/10 file:px-3 file:py-1.5 file:text-navy"
            />
            <p className="text-xs text-navy/40">PDF, imágenes, Word o Excel — máx. 10 MB.</p>
            <Button type="submit" disabled={uploading}>
              <Upload size={16} />
              {uploading ? 'Subiendo...' : 'Subir documento'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
