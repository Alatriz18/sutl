import { Injectable } from '@nestjs/common';
import { CanalEnvio, ErrorDefinitivo, MensajeSaliente, TELEFONO_RE } from './channel';

// WhatsApp Cloud API (Meta). Variables: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID y,
// opcionalmente, WHATSAPP_API_VERSION (v21.0 por defecto) y WHATSAPP_API_URL
// (solo para apuntar a un simulador en desarrollo).
//
// Limitación de Meta: un mensaje de texto libre solo llega si el cliente
// escribió a la empresa en las últimas 24 h; para iniciar una conversación hay
// que usar una plantilla aprobada. Esta versión envía texto libre: las
// plantillas quedan como siguiente paso y dependen de la cuenta de Meta del cliente.
@Injectable()
export class WhatsAppChannel implements CanalEnvio {
  get disponible() {
    return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
  }

  async enviar(m: MensajeSaliente): Promise<void> {
    if (!this.disponible) throw new ErrorDefinitivo('WhatsApp no está configurado en el servidor (falta WHATSAPP_TOKEN/WHATSAPP_PHONE_ID).');
    if (!TELEFONO_RE.test(m.destino)) throw new ErrorDefinitivo('El teléfono debe estar en formato internacional, por ejemplo +593991234567.');

    const base = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com';
    const version = process.env.WHATSAPP_API_VERSION ?? 'v21.0';
    const url = `${base}/${version}/${encodeURIComponent(process.env.WHATSAPP_PHONE_ID!)}/messages`;
    const texto = `${m.asunto}\n\n${m.mensaje}`.slice(0, 4000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: m.destino.replace('+', ''),
        type: 'text',
        text: { body: texto, preview_url: false },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return;

    const detalle = await res
      .json()
      .then((j: { error?: { message?: string } }) => j.error?.message ?? '')
      .catch(() => '');
    const msg = `WhatsApp respondió ${res.status}${detalle ? `: ${detalle}` : ''}`;
    // 4xx (salvo 429) = la petición es inválida o la cuenta no autoriza: reintentar no ayuda.
    if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new ErrorDefinitivo(msg);
    throw new Error(msg);
  }
}
