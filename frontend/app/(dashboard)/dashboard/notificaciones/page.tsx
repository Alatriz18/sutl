'use client';

import { Mail, Smartphone, MessageSquare, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { DemoBanner } from '@/components/ui/demo-banner';
import { Card } from '@/components/ui/card';

interface NotificacionDemo {
  id: string;
  canal: 'email' | 'push' | 'sms';
  asunto: string;
  destinatario: string;
  estado: 'enviado' | 'pendiente' | 'fallido';
  fecha: string;
}

const CANAL_ICON = { email: Mail, push: Smartphone, sms: MessageSquare } as const;
const CANAL_LABEL = { email: 'Email', push: 'Push', sms: 'SMS' } as const;

const ESTADO_ICON = { enviado: CheckCircle2, pendiente: Clock, fallido: XCircle } as const;
const ESTADO_COLOR = {
  enviado: 'text-[#0ca30c]',
  pendiente: 'text-[#a86a00]',
  fallido: 'text-[#d03b3b]',
} as const;

const NOTIFICACIONES_DEMO: NotificacionDemo[] = [
  { id: '1', canal: 'email', asunto: 'Tu envío SUTL-DEMO-0001 cambió a "En tránsito"', destinatario: 'juan.perez@example.com', estado: 'enviado', fecha: '2026-07-13 09:12' },
  { id: '2', canal: 'push', asunto: 'Envío SUTL-DEMO-0002 llegó a aduana', destinatario: 'App móvil — Admin Demo', estado: 'enviado', fecha: '2026-07-06 14:40' },
  { id: '3', canal: 'sms', asunto: 'Alerta: SUTL-DEMO-0004 con incidencia', destinatario: '+593 9 9xxx xxxx', estado: 'fallido', fecha: '2026-06-22 08:05' },
  { id: '4', canal: 'email', asunto: 'Confirmación de entrega SUTL-DEMO-0006', destinatario: 'importaciones@continental.ec', estado: 'enviado', fecha: '2026-05-30 17:20' },
  { id: '5', canal: 'email', asunto: 'Recordatorio: documentos pendientes SUTL-DEMO-0009', destinatario: 'admin@demo-transportes.com', estado: 'pendiente', fecha: '2026-07-14 10:00' },
];

export default function NotificacionesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Notificaciones</h1>
      <p className="mt-1 text-navy/60">Email (SES), push (FCM/APNs) y SMS (Twilio).</p>

      <DemoBanner>
        La tabla <code>notifications</code> ya existe en la base de datos. Falta conectar los
        proveedores reales (Amazon SES, Firebase Cloud Messaging, Twilio) — este listado es de
        ejemplo para mostrar cómo se vería el historial de envíos.
      </DemoBanner>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-navy/60">Enviadas (30 días)</p>
          <p className="mt-1 text-2xl font-bold text-navy">128</p>
        </Card>
        <Card>
          <p className="text-sm text-navy/60">Tasa de entrega</p>
          <p className="mt-1 text-2xl font-bold text-[#0ca30c]">96.1%</p>
        </Card>
        <Card>
          <p className="text-sm text-navy/60">Fallidas</p>
          <p className="mt-1 text-2xl font-bold text-[#d03b3b]">5</p>
        </Card>
      </div>

      <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="px-4 py-3 font-medium">Canal</th>
              <th className="px-4 py-3 font-medium">Asunto</th>
              <th className="px-4 py-3 font-medium">Destinatario</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICACIONES_DEMO.map((n) => {
              const CanalIcon = CANAL_ICON[n.canal];
              const EstadoIcon = ESTADO_ICON[n.estado];
              return (
                <tr key={n.id} className="border-t border-navy/5">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-navy/70">
                      <CanalIcon size={15} />
                      {CANAL_LABEL[n.canal]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy">{n.asunto}</td>
                  <td className="px-4 py-3 text-navy/60">{n.destinatario}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${ESTADO_COLOR[n.estado]}`}>
                      <EstadoIcon size={14} />
                      {n.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy/50">{n.fecha}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
