import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CANAL_EMAIL, CanalEnvio } from '../notifications/channels/channel';
import { CreateLeadDto } from './dto/create-lead.dto';

const DIA_MS = 86_400_000;

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(CANAL_EMAIL) private readonly email?: CanalEnvio,
  ) {}

  // Siempre responde igual (haya guardado, repetido o descartado un bot): quien
  // llama no puede deducir nada del servidor.
  async registrar(dto: CreateLeadDto): Promise<void> {
    // Trampa para bots: el campo "sitioWeb" está oculto para personas.
    if (dto.sitioWeb) return;

    const email = dto.email.trim().toLowerCase();
    // El mismo correo no llena la bandeja: una solicitud por día.
    const repetido = await this.prisma.lead.findFirst({
      where: { email, createdAt: { gte: new Date(Date.now() - DIA_MS) } },
      select: { id: true },
    });
    if (repetido) return;

    const lead = await this.prisma.lead.create({
      data: {
        nombre: dto.nombre.trim(),
        empresa: dto.empresa.trim(),
        email,
        telefono: dto.telefono?.trim() || null,
        mensaje: dto.mensaje?.trim() || null,
      },
    });
    await this.avisar(lead.id, dto);
  }

  // El contacto ya está guardado: si el correo falla no se pierde nada, solo
  // queda sin avisar (y se ve en el listado).
  private async avisar(id: string, dto: CreateLeadDto) {
    const destino = process.env.CONTACT_INBOX_EMAIL;
    if (!destino || !this.email?.disponible) {
      this.logger.warn('Contacto nuevo guardado, pero no hay CONTACT_INBOX_EMAIL o correo configurado para avisar.');
      return;
    }
    try {
      await this.email.enviar({
        destino,
        asunto: `Nuevo contacto SUTL: ${dto.empresa.trim()}`.slice(0, 200),
        mensaje: [
          'Alguien pidió un diagnóstico desde la landing.',
          '',
          `Nombre: ${dto.nombre.trim()}`,
          `Empresa: ${dto.empresa.trim()}`,
          `Correo: ${dto.email.trim()}`,
          `Teléfono: ${dto.telefono?.trim() || '—'}`,
          '',
          dto.mensaje?.trim() || '(sin mensaje)',
        ].join('\n'),
      });
      await this.prisma.lead.update({ where: { id }, data: { notificado: true } });
    } catch (e) {
      this.logger.error(`No se pudo avisar del contacto ${id}: ${(e as Error).message}`);
    }
  }

  listar() {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
