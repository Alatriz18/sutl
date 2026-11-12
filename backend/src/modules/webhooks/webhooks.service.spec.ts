import { randomBytes } from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { cifrar } from '../../common/crypto';
import { ErrorDefinitivo } from '../notifications/channels/channel';
import { verificarFirma } from './webhook-events';
import { WebhooksService } from './webhooks.service';

type Mock = jest.Mock;

describe('WebhooksService', () => {
  const claveOriginal = process.env.ENCRYPTION_KEY;
  const privadasOriginal = process.env.WEBHOOKS_ALLOW_PRIVATE;
  const secreto = 'whsec_unitario';
  let prisma: {
    webhookEndpoint: { count: Mock; create: Mock; findMany: Mock; findFirst: Mock; updateMany: Mock; deleteMany: Mock };
    webhookDelivery: { create: Mock; findFirst: Mock; findMany: Mock; updateMany: Mock };
  };
  let cola: { add: Mock };
  let service: WebhooksService;
  let fetchMock: jest.SpyInstance;

  const entrega = (extra: Record<string, unknown> = {}, endpoint: Record<string, unknown> = {}) => ({
    id: 'd1',
    tenantId: 't1',
    evento: 'envio.creado',
    estado: 'pendiente',
    payload: { codigoGuia: 'SUTL-1' },
    createdAt: new Date('2026-11-12T10:00:00Z'),
    endpoint: { id: 'e1', url: 'https://8.8.8.8/hook', activo: true, secretCifrado: cifrar(secreto), ...endpoint },
    ...extra,
  });
  const respuesta = (status: number) => ({ status, body: { cancel: jest.fn().mockResolvedValue(undefined) } }) as unknown as Response;
  const ultimoEstado = () => prisma.webhookDelivery.updateMany.mock.calls.map((c) => c[0].data).filter((d) => d.estado).pop();

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.WEBHOOKS_ALLOW_PRIVATE = 'false';
    prisma = {
      webhookEndpoint: { count: jest.fn(), create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
      webhookDelivery: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    cola = { add: jest.fn().mockResolvedValue(undefined) };
    service = new WebhooksService(prisma as never, cola as never);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = claveOriginal;
    process.env.WEBHOOKS_ALLOW_PRIVATE = privadasOriginal;
  });

  describe('crear', () => {
    it('devuelve el secreto una vez y guarda solo la versión cifrada', async () => {
      prisma.webhookEndpoint.count.mockResolvedValue(0);
      prisma.webhookEndpoint.create.mockImplementation(({ data }) => Promise.resolve({ id: 'e1', url: data.url }));
      const r = await service.crear('t1', { url: 'https://8.8.8.8/hook', eventos: ['envio.creado'] });
      expect(r.secreto).toMatch(/^whsec_/);
      const data = prisma.webhookEndpoint.create.mock.calls[0][0].data;
      expect(data.tenantId).toBe('t1');
      expect(data.secretCifrado).not.toContain(r.secreto);
      expect(data.secretCifrado.startsWith('v1:')).toBe(true);
    });

    it.each(['http://8.8.8.8/hook', 'https://127.0.0.1/hook', 'https://169.254.169.254/x', 'https://u:p@8.8.8.8/', 'nada'])('rechaza la URL %s', async (url) => {
      await expect(service.crear('t1', { url, eventos: ['envio.creado'] })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.webhookEndpoint.create).not.toHaveBeenCalled();
    });

    it('limita a 10 por empresa', async () => {
      prisma.webhookEndpoint.count.mockResolvedValue(10);
      await expect(service.crear('t1', { url: 'https://8.8.8.8/hook', eventos: ['envio.creado'] })).rejects.toThrow(/máximo de 10/);
    });
  });

  describe('gestión por empresa', () => {
    it('actualizar, eliminar, probar y ver entregas filtran por la empresa y dan 404 si no es suya', async () => {
      prisma.webhookEndpoint.updateMany.mockResolvedValue({ count: 0 });
      prisma.webhookEndpoint.deleteMany.mockResolvedValue({ count: 0 });
      prisma.webhookEndpoint.findFirst.mockResolvedValue(null);
      await expect(service.actualizar('t1', 'e1', { activo: false })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.eliminar('t1', 'e1')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.probar('t1', 'e1')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.entregas('t1', 'e1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.webhookEndpoint.updateMany.mock.calls[0][0].where).toEqual({ id: 'e1', tenantId: 't1' });
      expect(prisma.webhookEndpoint.deleteMany.mock.calls[0][0].where).toEqual({ id: 'e1', tenantId: 't1' });
      expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    });

    it('listar nunca selecciona el secreto', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);
      await service.listar('t1');
      expect(prisma.webhookEndpoint.findMany.mock.calls[0][0].select).not.toHaveProperty('secretCifrado');
    });
  });

  describe('emitir', () => {
    it('crea una entrega por cada webhook activo suscrito y la encola con el tenantId', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
      prisma.webhookDelivery.create.mockResolvedValueOnce({ id: 'd1' }).mockResolvedValueOnce({ id: 'd2' });
      await service.emitir('t1', 'envio.creado', { codigoGuia: 'X' });
      expect(prisma.webhookEndpoint.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', activo: true, eventos: { has: 'envio.creado' } });
      expect(cola.add).toHaveBeenCalledWith('entregar', { tenantId: 't1', deliveryId: 'd1' });
      expect(cola.add).toHaveBeenCalledWith('entregar', { tenantId: 't1', deliveryId: 'd2' });
    });

    it('nunca lanza: un fallo de base no rompe la operación que lo originó', async () => {
      prisma.webhookEndpoint.findMany.mockRejectedValue(new Error('db caída'));
      await expect(service.emitir('t1', 'envio.creado', {})).resolves.toBeUndefined();
    });
  });

  describe('entregar', () => {
    it('éxito 2xx: queda entregada y la petición va firmada y sin seguir redirecciones', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega());
      fetchMock.mockResolvedValue(respuesta(204));
      await service.entregar('t1', 'd1', false);
      expect(ultimoEstado()).toMatchObject({ estado: 'entregado', ultimoStatus: 204, error: null });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
      expect(url).toBe('https://8.8.8.8/hook');
      expect(init.redirect).toBe('manual');
      expect(init.method).toBe('POST');
      expect(init.headers['X-SUTL-Event']).toBe('envio.creado');
      expect(verificarFirma(secreto, init.headers['X-SUTL-Signature'], init.body as string)).toBe(true);
      // El cuerpo no lleva el tenantId.
      expect(init.body as string).not.toContain('t1');
      expect(JSON.parse(init.body as string)).toMatchObject({ id: 'd1', evento: 'envio.creado', datos: { codigoGuia: 'SUTL-1' } });
    });

    it('busca la entrega filtrando por la empresa del trabajo', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(null);
      await service.entregar('t1', 'd1', false);
      expect(prisma.webhookDelivery.findFirst.mock.calls[0][0].where).toEqual({ id: 'd1', tenantId: 't1' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('una entrega ya entregada no se vuelve a enviar (idempotente)', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega({ estado: 'entregado' }));
      await service.entregar('t1', 'd1', false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('un no-2xx antes del último intento queda pendiente y relanza; en el último, fallida', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega());
      fetchMock.mockResolvedValue(respuesta(500));
      await expect(service.entregar('t1', 'd1', false)).rejects.toThrow('500');
      expect(ultimoEstado()).toMatchObject({ estado: 'pendiente', ultimoStatus: 500 });
      await expect(service.entregar('t1', 'd1', true)).rejects.toThrow();
      expect(ultimoEstado()).toMatchObject({ estado: 'fallido', ultimoStatus: 500 });
    });

    it('una redirección cuenta como fallo (no se sigue)', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega());
      fetchMock.mockResolvedValue(respuesta(302));
      await expect(service.entregar('t1', 'd1', true)).rejects.toThrow('302');
      expect(ultimoEstado()).toMatchObject({ estado: 'fallido', ultimoStatus: 302 });
    });

    it('un error de red o de tiempo se registra sin detalles internos', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega());
      fetchMock.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:443'), { name: 'Error' }));
      await expect(service.entregar('t1', 'd1', true)).rejects.toThrow();
      const e = ultimoEstado();
      expect(e.estado).toBe('fallido');
      expect(e.error).toBe('No se pudo conectar: error de red');
      expect(e.error).not.toContain('10.0.0.5');
    });

    it('si la URL dejó de ser segura falla sin llamar al destino y como definitivo', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega({}, { url: 'https://10.0.0.5/hook' }));
      await expect(service.entregar('t1', 'd1', false)).rejects.toBeInstanceOf(ErrorDefinitivo);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(ultimoEstado()).toMatchObject({ estado: 'fallido' });
    });

    it('un webhook desactivado falla como definitivo, salvo la entrega de prueba', async () => {
      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega({}, { activo: false }));
      await expect(service.entregar('t1', 'd1', false)).rejects.toBeInstanceOf(ErrorDefinitivo);
      expect(fetchMock).not.toHaveBeenCalled();

      prisma.webhookDelivery.findFirst.mockResolvedValue(entrega({ evento: 'webhook.prueba' }, { activo: false }));
      fetchMock.mockResolvedValue(respuesta(200));
      await service.entregar('t1', 'd1', false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
