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
});
