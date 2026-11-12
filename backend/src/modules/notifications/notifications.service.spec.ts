import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CanalEnvio, ErrorDefinitivo } from './channels/channel';
import { NotificationsService } from './notifications.service';

type Mock = jest.Mock;

describe('NotificationsService', () => {
  let prisma: {
    notification: { create: Mock; findFirst: Mock; findMany: Mock; updateMany: Mock };
    user: { findFirst: Mock };
  } & Record<string, unknown>;
  let email: CanalEnvio & { enviar: Mock };
  let whatsapp: CanalEnvio & { enviar: Mock };
  let cola: { add: Mock };
  let service: NotificationsService;

  const dto = { canal: 'email' as const, tipo: 'aviso', asunto: 'Hola', mensaje: 'Mensaje', destino: 'a@b.com' };
  const guardada = (extra: Record<string, unknown> = {}) => ({
    id: 'n1', tenantId: 't1', canal: 'email', asunto: 'Hola', mensaje: 'Mensaje', destino: 'a@b.com', estado: 'pendiente', ...extra,
  });

  beforeEach(() => {
    prisma = {
      notification: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { findFirst: jest.fn() },
      // assertTenantRefs usa estos modelos solo si hay referencias en el body.
      carrier: { count: jest.fn() },
    };
    email = { disponible: true, enviar: jest.fn().mockResolvedValue(undefined) } as never;
    whatsapp = { disponible: true, enviar: jest.fn().mockResolvedValue(undefined) } as never;
    cola = { add: jest.fn().mockResolvedValue(undefined) };
    prisma.notification.create.mockResolvedValue({ id: 'n1' });
    prisma.notification.findFirst.mockResolvedValue(guardada());
    service = new NotificationsService(prisma as never, email, whatsapp, cola as never);
  });

  describe('create', () => {
    it('push y SMS se rechazan (no tienen proveedor)', async () => {
      await expect(service.create('t1', { ...dto, canal: 'sms' })).rejects.toThrow(/todavía no está disponible/);
      await expect(service.create('t1', { ...dto, canal: 'push' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('un canal no configurado en el servidor se rechaza', async () => {
      (email as { disponible: boolean }).disponible = false;
      await expect(service.create('t1', dto)).rejects.toThrow(/no está configurado/);
    });

    it.each([
      ['correo inválido', { destino: 'no-es-correo' }],
      ['varios correos', { destino: 'a@b.com, c@d.com' }],
      ['whatsapp sin formato internacional', { canal: 'whatsapp' as const, destino: '0991234567' }],
      ['sin destino ni usuario', { destino: undefined }],
      ['whatsapp sin destino', { canal: 'whatsapp' as const, destino: undefined }],
    ])('rechaza %s', async (_n, extra) => {
      await expect(service.create('t1', { ...dto, ...extra })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('guarda con el tenant del token y encola el envío con su tenantId', async () => {
      await service.create('t1', dto);
      expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', destino: 'a@b.com', canal: 'email' });
      expect(cola.add).toHaveBeenCalledWith('enviar', { tenantId: 't1', notificationId: 'n1' });
    });

    it('sin cola envía en el momento', async () => {
      service = new NotificationsService(prisma as never, email, whatsapp, undefined);
      await service.create('t1', dto);
      expect(email.enviar).toHaveBeenCalledWith({ destino: 'a@b.com', asunto: 'Hola', mensaje: 'Mensaje' });
    });
  });

  describe('enviar', () => {
    const estadosEscritos = () => prisma.notification.updateMany.mock.calls.map((c) => c[0].data).filter((d) => d.estado);

    it('éxito: queda enviada y sin error', async () => {
      await service.enviar('t1', 'n1', false);
      expect(estadosEscritos().pop()).toMatchObject({ estado: 'enviado', error: null });
    });

    it('lee y escribe siempre filtrando por la empresa', async () => {
      await service.enviar('t1', 'n1', false);
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: 'n1', tenantId: 't1' } });
      for (const [arg] of prisma.notification.updateMany.mock.calls) expect(arg.where).toMatchObject({ id: 'n1', tenantId: 't1' });
    });

    it('si ya estaba enviada no vuelve a enviar (idempotente)', async () => {
      prisma.notification.findFirst.mockResolvedValue(guardada({ estado: 'enviado' }));
      await service.enviar('t1', 'n1', false);
      expect(email.enviar).not.toHaveBeenCalled();
    });

    it('si no existe (o es de otra empresa) no hace nada', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await service.enviar('t1', 'n1', false);
      expect(email.enviar).not.toHaveBeenCalled();
    });

    it('un fallo antes del último intento la deja pendiente y relanza para reintentar', async () => {
      email.enviar.mockRejectedValue(new Error('503'));
      await expect(service.enviar('t1', 'n1', false)).rejects.toThrow('503');
      expect(estadosEscritos().pop()).toMatchObject({ estado: 'pendiente', error: '503' });
    });

    it('un fallo en el último intento la deja fallida', async () => {
      email.enviar.mockRejectedValue(new Error('503'));
      await expect(service.enviar('t1', 'n1', true)).rejects.toThrow();
      expect(estadosEscritos().pop()).toMatchObject({ estado: 'fallido' });
    });

    it('un error definitivo la deja fallida de inmediato aunque queden intentos', async () => {
      email.enviar.mockRejectedValue(new ErrorDefinitivo('destino inválido'));
      await expect(service.enviar('t1', 'n1', false)).rejects.toBeInstanceOf(ErrorDefinitivo);
      expect(estadosEscritos().pop()).toMatchObject({ estado: 'fallido' });
    });

    it('guarda el error sin secretos', async () => {
      email.enviar.mockRejectedValue(new Error('auth falló con password=hunter2'));
      await expect(service.enviar('t1', 'n1', true)).rejects.toThrow();
      expect(JSON.stringify(estadosEscritos())).not.toContain('hunter2');
    });

    it('usa el canal de la notificación', async () => {
      prisma.notification.findFirst.mockResolvedValue(guardada({ canal: 'whatsapp', destino: '+593991234567' }));
      await service.enviar('t1', 'n1', false);
      expect(whatsapp.enviar).toHaveBeenCalled();
      expect(email.enviar).not.toHaveBeenCalled();
    });

    it('sin destino falla como definitivo', async () => {
      prisma.notification.findFirst.mockResolvedValue(guardada({ destino: null }));
      await expect(service.enviar('t1', 'n1', false)).rejects.toBeInstanceOf(ErrorDefinitivo);
    });
  });

  describe('reenviar', () => {
    it('solo reenvía las fallidas, de la misma empresa', async () => {
      prisma.notification.findFirst.mockResolvedValue(guardada({ estado: 'enviado' }));
      await expect(service.reenviar('t1', 'n1')).rejects.toBeInstanceOf(BadRequestException);
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.reenviar('t1', 'n1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('el paso a pendiente es atómico: si otro ya lo cambió, no se encola de nuevo', async () => {
      prisma.notification.findFirst.mockResolvedValue(guardada({ estado: 'fallido' }));
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.reenviar('t1', 'n1')).rejects.toBeInstanceOf(BadRequestException);
      expect(cola.add).not.toHaveBeenCalled();
    });

    it('una fallida vuelve a pendiente y se encola', async () => {
      prisma.notification.findFirst.mockResolvedValue(guardada({ estado: 'fallido' }));
      await service.reenviar('t1', 'n1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'n1', tenantId: 't1', estado: 'fallido' }, data: { estado: 'pendiente', error: null } });
      expect(cola.add).toHaveBeenCalledTimes(1);
    });
  });

  it('canales() informa qué está conectado', () => {
    (whatsapp as { disponible: boolean }).disponible = false;
    expect(service.canales()).toEqual({ email: true, whatsapp: false, push: false, sms: false });
  });
});
