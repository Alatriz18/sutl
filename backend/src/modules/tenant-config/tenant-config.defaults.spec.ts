import { PERFILES, combinarAjustes, resolverConfig, sanitizarAjustes } from './tenant-config.defaults';

describe('tenant-config.defaults', () => {
  it('sin ajustes, la configuración efectiva es la del perfil', () => {
    expect(resolverConfig('manufactura', {})).toEqual(PERFILES.manufactura.config);
  });

  it('un perfil desconocido cae al perfil general', () => {
    expect(resolverConfig('no-existe', {})).toEqual(PERFILES.general.config);
  });

  it('los ajustes del tenant ganan sobre el perfil, campo por campo', () => {
    const config = resolverConfig('manufactura', { compras: { diasAlertaAnticipada: 3 } });
    expect(config.compras.diasAlertaAnticipada).toBe(3);
    expect(config.compras.toleranciaSobreRecepcionPct).toBe(5);
    expect(config.inventario.recepcionActualizaInventario).toBe('automatico');
  });

  it('descarta del JSON guardado claves desconocidas y tipos incorrectos', () => {
    expect(
      sanitizarAjustes({
        compras: { diasAlertaAnticipada: '30', toleranciaSobreRecepcionPct: 2, extra: true },
        inventario: { recepcionActualizaInventario: 'borrar_todo' },
        desconocida: { x: 1 },
      }),
    ).toEqual({ compras: { toleranciaSobreRecepcionPct: 2 } });
    expect(sanitizarAjustes(null)).toEqual({});
    expect(sanitizarAjustes([1, 2])).toEqual({});
  });

  it('combinarAjustes conserva los existentes y aplica los nuevos', () => {
    expect(
      combinarAjustes(
        { compras: { diasAlertaAnticipada: 3 } },
        { compras: { exigirFechaConfirmacion: false }, inventario: { recepcionActualizaInventario: 'nunca' } },
      ),
    ).toEqual({
      compras: { diasAlertaAnticipada: 3, exigirFechaConfirmacion: false },
      inventario: { recepcionActualizaInventario: 'nunca' },
    });
  });

  describe('metas de OTIF de la analítica', () => {
    it('todos los perfiles traen meta 90 % y atención 70 %', () => {
      for (const p of Object.values(PERFILES)) expect(p.config.analitica).toEqual({ metaOtifPct: 90, umbralAtencionOtifPct: 70 });
    });

    it('los ajustes de la empresa ganan sobre el perfil', () => {
      expect(resolverConfig('general', { analitica: { metaOtifPct: 95 } }).analitica).toEqual({ metaOtifPct: 95, umbralAtencionOtifPct: 70 });
    });

    it('descarta del JSON guardado valores fuera de 1 a 100 o con tipo incorrecto', () => {
      expect(sanitizarAjustes({ analitica: { metaOtifPct: 0, umbralAtencionOtifPct: 101 } })).toEqual({});
      expect(sanitizarAjustes({ analitica: { metaOtifPct: '95', umbralAtencionOtifPct: Infinity } })).toEqual({});
      expect(sanitizarAjustes({ analitica: { metaOtifPct: 85.5 } })).toEqual({ analitica: { metaOtifPct: 85.5 } });
    });
  });

  describe('seguridad', () => {
    it('por defecto no se exige el segundo factor a los administradores, en ningún perfil', () => {
      for (const p of Object.values(PERFILES)) expect(p.config.seguridad).toEqual({ exigirMfaAdministradores: false });
    });

    it('acepta la exigencia y descarta valores que no son booleanos', () => {
      expect(resolverConfig('general', { seguridad: { exigirMfaAdministradores: true } }).seguridad.exigirMfaAdministradores).toBe(true);
      expect(sanitizarAjustes({ seguridad: { exigirMfaAdministradores: 'true' } })).toEqual({});
    });
  });

  describe('marca de la página pública', () => {
    it('por defecto no cambia nada y muestra «Con tecnología de SUTL»', () => {
      expect(resolverConfig('general', {}).marca).toEqual({ nombreComercial: '', colorPrimario: '', logoUrl: '', mensaje: '', mostrarSutl: true });
    });

    it('acepta una marca bien formada', () => {
      const marca = { nombreComercial: 'Transportes Andes', colorPrimario: '#1A7A4C', logoUrl: 'https://cdn.andes.com/logo.png', mensaje: 'Gracias por confiar en nosotros', mostrarSutl: false };
      expect(resolverConfig('general', { marca }).marca).toEqual(marca);
    });

    it('descarta al leer un color, un logo o textos mal formados (se muestran a terceros)', () => {
      const r = resolverConfig('general', {
        marca: { colorPrimario: 'rojo', logoUrl: 'javascript:alert(1)', nombreComercial: 'x'.repeat(61), mensaje: 'y'.repeat(281), mostrarSutl: false },
      }).marca;
      expect(r).toEqual({ nombreComercial: '', colorPrimario: '', logoUrl: '', mensaje: '', mostrarSutl: false });
    });

    it('no acepta logos que no sean https ni con comillas o espacios', () => {
      for (const logoUrl of ['http://x.com/a.png', 'data:image/png;base64,AAA', 'https://x.com/a b.png', 'https://x.com/a".png', '//x.com/a.png']) {
        expect(resolverConfig('general', { marca: { logoUrl } }).marca.logoUrl).toBe('');
      }
    });

    it('un valor vacío vuelve al comportamiento por defecto', () => {
      expect(combinarAjustes({ marca: { colorPrimario: '#112233' } }, { marca: { colorPrimario: '' } }).marca?.colorPrimario).toBe('');
    });
  });
});
