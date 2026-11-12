import { LeadsService } from './leads.service';

type Mock = jest.Mock;

describe('LeadsService', () => {
  const inboxOriginal = process.env.CONTACT_INBOX_EMAIL;
  let prisma: { lead: { findFirst: Mock; create: Mock; update: Mock; findMany: Mock } };
  let email: { disponible: boolean; enviar: Mock };
  let service: LeadsService;
  const dto = { nombre: '  Ana Pérez ', empresa: ' Plásticos del Litoral ', email: '  ANA@Empresa.COM ', telefono: ' +593 99 123 4567 ', mensaje: ' Quiero un diagnóstico ' };

  beforeEach(() => {
    process.env.CONTACT_INBOX_EMAIL = 'ventas@svk.test';
    prisma = { lead: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'l1' }), update: jest.fn(), findMany: jest.fn() } };
    email = { disponible: true, enviar: jest.fn().mockResolvedValue(undefined) };
    service = new LeadsService(prisma as never, email as never);
  });

  afterAll(() => {
    if (inboxOriginal === undefined) delete process.env.CONTACT_INBOX_EMAIL;
    else process.env.CONTACT_INBOX_EMAIL = inboxOriginal;
  });

  it('guarda el contacto normalizado y avisa al correo de ventas', async () => {
    await service.registrar(dto);
    expect(prisma.lead.create.mock.calls[0][0].data).toEqual({
      nombre: 'Ana Pérez', empresa: 'Plásticos del Litoral', email: 'ana@empresa.com', telefono: '+593 99 123 4567', mensaje: 'Quiero un diagnóstico',
    });
    const mail = email.enviar.mock.calls[0][0];
    expect(mail.destino).toBe('ventas@svk.test');
    expect(mail.asunto).toBe('Nuevo contacto SUTL: Plásticos del Litoral');
    expect(mail.mensaje).toContain('Ana Pérez');
    expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { notificado: true } });
  });

  it('un bot que llena el campo trampa se descarta sin guardar ni avisar', async () => {
    await service.registrar({ ...dto, sitioWeb: 'http://spam.com' });
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('el mismo correo en las últimas 24 h no vuelve a guardarse ni a avisar', async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: 'viejo' });
    await service.registrar(dto);
    expect(prisma.lead.findFirst.mock.calls[0][0].where.email).toBe('ana@empresa.com');
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('sin correo de ventas configurado el contacto igual se guarda', async () => {
    delete process.env.CONTACT_INBOX_EMAIL;
    await service.registrar(dto);
    expect(prisma.lead.create).toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it('si el correo falla el contacto no se pierde y no se marca como avisado', async () => {
    email.enviar.mockRejectedValue(new Error('SMTP caído'));
    await expect(service.registrar(dto)).resolves.toBeUndefined();
    expect(prisma.lead.create).toHaveBeenCalled();
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it('teléfono y mensaje vacíos se guardan como null', async () => {
    await service.registrar({ ...dto, telefono: '  ', mensaje: undefined });
    expect(prisma.lead.create.mock.calls[0][0].data).toMatchObject({ telefono: null, mensaje: null });
    expect(email.enviar.mock.calls[0][0].mensaje).toContain('(sin mensaje)');
  });
});
