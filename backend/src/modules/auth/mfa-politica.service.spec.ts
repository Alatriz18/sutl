import { RolUsuario } from '@prisma/client';
import { MfaPoliticaService, mfaExigido } from './mfa-politica.service';

describe('mfaExigido', () => {
  const todo = { administradoresDeLaEmpresa: true, personalSutl: true };
  const nada = { administradoresDeLaEmpresa: false, personalSutl: false };

  it('el administrador de empresa depende de la política de su empresa', () => {
    expect(mfaExigido(RolUsuario.admin_tenant, { ...nada, administradoresDeLaEmpresa: true })).toBe(true);
    expect(mfaExigido(RolUsuario.admin_tenant, { ...todo, administradoresDeLaEmpresa: false })).toBe(false);
  });

  it('el personal de SUTL depende de la política de la plataforma', () => {
    for (const rol of [RolUsuario.analista_sutl, RolUsuario.super_admin]) {
      expect(mfaExigido(rol, { ...nada, personalSutl: true })).toBe(true);
      expect(mfaExigido(rol, { ...todo, personalSutl: false })).toBe(false);
    }
  });

  it('operadores, clientes finales y proveedores nunca quedan obligados', () => {
    for (const rol of [RolUsuario.operador, RolUsuario.cliente_final, RolUsuario.proveedor]) {
      expect(mfaExigido(rol, todo)).toBe(false);
    }
  });
});

describe('MfaPoliticaService', () => {
  const crear = (env: Record<string, string | undefined>, exigeEmpresa = false) => {
    const config = { get: (k: string) => env[k] };
    const tenantConfig = { getEfectiva: jest.fn().mockResolvedValue({ seguridad: { exigirMfaAdministradores: exigeEmpresa } }) };
    return { servicio: new MfaPoliticaService(tenantConfig as never, config as never), tenantConfig };
  };

  it('el personal de SUTL es obligatorio en producción y opcional fuera de ella', () => {
    expect(crear({ NODE_ENV: 'production' }).servicio.personalSutlObligatorio()).toBe(true);
    expect(crear({ NODE_ENV: 'development' }).servicio.personalSutlObligatorio()).toBe(false);
    expect(crear({}).servicio.personalSutlObligatorio()).toBe(false);
  });

  it('la variable explícita manda sobre el entorno', () => {
    expect(crear({ NODE_ENV: 'production', MFA_OBLIGATORIO_PERSONAL_SUTL: 'false' }).servicio.personalSutlObligatorio()).toBe(false);
    expect(crear({ NODE_ENV: 'development', MFA_OBLIGATORIO_PERSONAL_SUTL: 'true' }).servicio.personalSutlObligatorio()).toBe(true);
  });

  it('solo lee la configuración de la empresa para administradores', async () => {
    const { servicio, tenantConfig } = crear({}, true);
    expect(await servicio.exigido({ tenantId: 't1', rol: RolUsuario.admin_tenant })).toBe(true);
    expect(tenantConfig.getEfectiva).toHaveBeenCalledWith('t1');
    tenantConfig.getEfectiva.mockClear();
    expect(await servicio.exigido({ tenantId: 't1', rol: RolUsuario.operador })).toBe(false);
    expect(tenantConfig.getEfectiva).not.toHaveBeenCalled();
  });
});
