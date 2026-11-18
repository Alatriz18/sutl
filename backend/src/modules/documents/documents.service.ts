import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantConfigService } from '../tenant-config/tenant-config.service';
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, DocumentoVersion, estadoDelItem, evaluarChecklist, ultimasVersiones } from './checklist';
import { CreateDocumentDto } from './dto/create-document.dto';
import { RevisarDocumentDto } from './dto/revisar-document.dto';

const DIA_MS = 86_400_000;
const MAX_ENVIOS = 500;

const SELECT_VERSION = {
  id: true,
  tipo: true,
  version: true,
  estado: true,
  fechaVencimiento: true,
  motivoRechazo: true,
  nombreArchivo: true,
} as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly audit: AuditService,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
      include: { shipment: true, subidoPor: { select: { id: true, nombre: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }
    return document;
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
  ) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: dto.shipmentId, tenantId },
    });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado para este tenant');
    }

    // Si ya existe un documento del mismo tipo para este envío, la nueva
    // carga se registra como la siguiente versión (no se pisa el archivo).
    const anterior = await this.prisma.document.findFirst({
      where: { tenantId, shipmentId: dto.shipmentId, tipo: dto.tipo },
      orderBy: { version: 'desc' },
    });

    const creado = await this.prisma.document.create({
      data: {
        tenantId,
        shipmentId: dto.shipmentId,
        tipo: dto.tipo,
        nombreArchivo: file.originalname,
        urlArchivo: `/uploads/${tenantId}/${file.filename}`,
        version: anterior ? anterior.version + 1 : 1,
        subidoPorId: userId,
        fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : null,
      },
      include: { shipment: true, subidoPor: { select: { id: true, nombre: true, email: true } } },
    });
    await this.audit.registrar({
      tenantId,
      userId,
      accion: 'documento.subido',
      entidad: 'documento',
      entidadId: creado.id,
      metadata: { tipo: creado.tipo, version: creado.version, envio: creado.shipment.codigoGuia },
    });
    return creado;
  }

  // Estado de los documentos exigidos para un envío (según la configuración de la empresa).
  async checklist(tenantId: string, shipmentId: string, hoy = new Date()) {
    const envio = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, tenantId },
      select: { id: true, codigoGuia: true, tipo: true, modo: true },
    });
    if (!envio) throw new NotFoundException('Envío no encontrado');
    const [cfg, documentos] = await Promise.all([
      this.tenantConfig.getEfectiva(tenantId),
      this.prisma.document.findMany({ where: { tenantId, shipmentId }, select: SELECT_VERSION }),
    ]);
    return { envio, ...evaluarChecklist(envio, documentos as DocumentoVersion[], cfg.documentos, hoy) };
  }

  // Aprueba o rechaza la versión vigente de un documento. Rechazar exige un motivo.
  async revisar(tenantId: string, userId: string, id: string, dto: RevisarDocumentDto) {
    const motivo = dto.motivoRechazo?.trim();
    if (dto.estado === 'rechazado' && !motivo) {
      throw new BadRequestException('Indica el motivo del rechazo');
    }
    const doc = await this.findOne(tenantId, id);
    const ultima = await this.prisma.document.findFirst({
      where: { tenantId, shipmentId: doc.shipmentId, tipo: doc.tipo },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    // Revisar una versión vieja no tiene sentido: ya se subió una más nueva.
    if (ultima && ultima.version !== doc.version) {
      throw new ConflictException('Ya existe una versión más reciente de este documento');
    }
    const { count } = await this.prisma.document.updateMany({
      where: { id, tenantId },
      data: {
        estado: dto.estado,
        motivoRechazo: dto.estado === 'rechazado' ? motivo : null,
        revisadoPorId: userId,
        revisadoAt: new Date(),
      },
    });
    if (count === 0) throw new NotFoundException('Documento no encontrado');
    await this.audit.registrar({
      tenantId,
      userId,
      accion: dto.estado === 'aprobado' ? 'documento.aprobado' : 'documento.rechazado',
      entidad: 'documento',
      entidadId: id,
      metadata: { tipo: doc.tipo, version: doc.version, ...(motivo ? { motivo } : {}) },
    });
    return this.findOne(tenantId, id);
  }

  // Envíos activos cuya llegada se acerca (o ya pasó) y todavía no tienen
  // completos sus documentos. Alimenta las excepciones «documento faltante».
  async enviosConDocumentosPendientes(tenantId: string, hoy = new Date()) {
    const cfg = (await this.tenantConfig.getEfectiva(tenantId)).documentos;
    const limite = new Date(hoy.getTime() + cfg.diasAntesEtaFaltante * DIA_MS);
    const envios = await this.prisma.shipment.findMany({
      where: { tenantId, estado: { not: 'entregado' }, fechaEstimadaLlegada: { not: null, lte: limite } },
      select: {
        id: true,
        codigoGuia: true,
        tipo: true,
        modo: true,
        fechaEstimadaLlegada: true,
        documentos: { select: SELECT_VERSION },
      },
      orderBy: { fechaEstimadaLlegada: 'asc' },
      take: MAX_ENVIOS,
    });
    const out: { shipmentId: string; codigoGuia: string; fechaEstimadaLlegada: Date; detalle: string; urgente: boolean }[] = [];
    for (const e of envios) {
      const r = evaluarChecklist(e, e.documentos as DocumentoVersion[], cfg, hoy);
      if (r.completo) continue;
      const eta = e.fechaEstimadaLlegada as Date;
      const yaLlego = eta.getTime() < hoy.getTime();
      const lista = r.problemas.map((p) => `${ETIQUETA_TIPO[p.tipo]} (${ETIQUETA_ESTADO[p.estado]})`).join(', ');
      out.push({
        shipmentId: e.id,
        codigoGuia: e.codigoGuia,
        fechaEstimadaLlegada: eta,
        detalle: `El envío ${e.codigoGuia} ${yaLlego ? 'ya debió llegar' : 'está por llegar'} y su documentación no está completa: ${lista}.`,
        // Con la llegada a 2 días o menos (o pasada) deja de ser moderado.
        urgente: eta.getTime() - hoy.getTime() <= 2 * DIA_MS,
      });
    }
    return out;
  }

  // Documentos aprobados o pendientes que vencen pronto (o ya vencieron) en envíos activos.
  async proximosVencimientos(tenantId: string, hoy = new Date()) {
    const cfg = (await this.tenantConfig.getEfectiva(tenantId)).documentos;
    const limite = new Date(hoy.getTime() + cfg.diasAvisoVencimiento * DIA_MS);
    const candidatos = await this.prisma.document.findMany({
      where: { tenantId, fechaVencimiento: { not: null, lte: limite }, shipment: { estado: { not: 'entregado' } } },
      select: { ...SELECT_VERSION, shipmentId: true, shipment: { select: { codigoGuia: true } } },
      orderBy: { fechaVencimiento: 'asc' },
      take: MAX_ENVIOS,
    });
    // Solo la versión vigente de cada tipo por envío: las anteriores ya fueron reemplazadas.
    const vigentes = await this.prisma.document.findMany({
      where: { tenantId, shipmentId: { in: [...new Set(candidatos.map((c) => c.shipmentId))] } },
      select: { ...SELECT_VERSION, shipmentId: true },
    });
    const agrupados = new Map<string, DocumentoVersion[]>();
    for (const v of vigentes) {
      const lista = agrupados.get(v.shipmentId) ?? [];
      lista.push(v as DocumentoVersion);
      agrupados.set(v.shipmentId, lista);
    }
    const porEnvio = new Map([...agrupados].map(([id, docs]) => [id, ultimasVersiones(docs)]));
    return candidatos
      .filter((c) => porEnvio.get(c.shipmentId)?.get(c.tipo)?.id === c.id && c.estado !== 'rechazado')
      .map((c) => ({
        id: c.id,
        shipmentId: c.shipmentId,
        codigoGuia: c.shipment.codigoGuia,
        tipo: c.tipo,
        fechaVencimiento: c.fechaVencimiento as Date,
        ...estadoDelItem(c as DocumentoVersion, cfg.diasAvisoVencimiento, hoy),
      }));
  }
}
