import { EVENTOS_WEBHOOK, firmarEntrega, verificarFirma } from './webhook-events';

describe('firma de webhooks', () => {
  const secreto = 'whsec_prueba';
  const cuerpo = '{"id":"1","evento":"envio.creado"}';
  const t = 1_800_000_000;
  const ahora = t * 1000;

  it('una firma recién creada se verifica', () => {
    expect(verificarFirma(secreto, firmarEntrega(secreto, t, cuerpo), cuerpo, 300, ahora)).toBe(true);
  });

  it('la firma depende del secreto, del cuerpo y de la marca de tiempo', () => {
    const f = firmarEntrega(secreto, t, cuerpo);
    expect(verificarFirma('whsec_otro', f, cuerpo, 300, ahora)).toBe(false);
    expect(verificarFirma(secreto, f, cuerpo + ' ', 300, ahora)).toBe(false);
    expect(verificarFirma(secreto, f.replace(`t=${t}`, `t=${t + 1}`), cuerpo, 300, ahora)).toBe(false);
  });

  it('rechaza una entrega repetida fuera de la tolerancia (replay)', () => {
    const f = firmarEntrega(secreto, t, cuerpo);
    expect(verificarFirma(secreto, f, cuerpo, 300, ahora + 299_000)).toBe(true);
    expect(verificarFirma(secreto, f, cuerpo, 300, ahora + 301_000)).toBe(false);
    expect(verificarFirma(secreto, f, cuerpo, 300, ahora - 301_000)).toBe(false);
  });

  it.each(['', 'basura', 't=abc,v1=00', `t=${t}`, `t=${t},v1=`, `t=${t},v1=zz`, `v1=00,t=`])('cabecera mal formada "%s" no verifica', (c) => {
    expect(verificarFirma(secreto, c, cuerpo, 300, ahora)).toBe(false);
  });

  it('el formato es t=<segundos>,v1=<hex de 64 caracteres>', () => {
    expect(firmarEntrega(secreto, t, cuerpo)).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
  });

  it('los eventos publicados son los del contrato', () => {
    expect([...EVENTOS_WEBHOOK]).toEqual(['envio.creado', 'envio.estado_cambiado', 'orden_compra.estado_cambiado', 'riesgo.semaforo_cambiado']);
  });
});
