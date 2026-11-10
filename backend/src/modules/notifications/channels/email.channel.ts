import { Injectable, Logger } from '@nestjs/common';
import { Transporter, createTransport } from 'nodemailer';
import { CanalEnvio, EMAIL_RE, ErrorDefinitivo, MensajeSaliente } from './channel';

// Correo por SMTP (SES, SendGrid, Mailgun, Google Workspace… todos lo hablan).
// En desarrollo apunta a Mailpit (docker compose): ahí se ve el correo real
// sin enviarlo a nadie. Variables: SMTP_HOST, SMTP_PORT, SMTP_SECURE,
// SMTP_USER, SMTP_PASS, SMTP_FROM.
@Injectable()
export class EmailChannel implements CanalEnvio {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: Transporter | null = null;

  get disponible() {
    return !!process.env.SMTP_HOST && !!process.env.SMTP_FROM;
  }

  private obtener(): Transporter {
    if (!this.transporter) {
      const user = process.env.SMTP_USER;
      this.transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        ...(user ? { auth: { user, pass: process.env.SMTP_PASS ?? '' } } : {}),
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }
    return this.transporter;
  }

  async enviar(m: MensajeSaliente): Promise<void> {
    if (!this.disponible) throw new ErrorDefinitivo('El correo no está configurado en el servidor (falta SMTP_HOST/SMTP_FROM).');
    if (!EMAIL_RE.test(m.destino)) throw new ErrorDefinitivo('El correo de destino no es válido.');
    // nodemailer rechaza saltos de línea en cabeceras (inyección de cabeceras),
    // pero el asunto se normaliza igual.
    const asunto = m.asunto.replace(/[\r\n]+/g, ' ').slice(0, 200);
    await this.obtener().sendMail({
      from: process.env.SMTP_FROM,
      to: m.destino,
      subject: asunto,
      text: m.mensaje,
    });
    this.logger.log(`Correo enviado (${asunto.slice(0, 40)})`);
  }
}
