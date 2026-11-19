// Prepara el escenario de PRESENTACIÓN de SUTL contra el backend en marcha, usando la API real (no toca la base
// directamente). Es idempotente: se puede correr varias veces y no duplica lo que ya existe.
//
//   node scripts/preparar-demo.mjs            (backend en http://localhost:3001)
//   API=http://localhost:3001/api node scripts/preparar-demo.mjs
//
// Requiere haber corrido antes la semilla (npm run seed): usa a la empresa «Transportes Demo S.A.».

const API = process.env.API ?? 'http://localhost:3001/api';
const CLAVE = 'Demo2026!';
const SUPER = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };
const ADMIN = { email: 'admin@demo-transportes.com', password: CLAVE };

export const CUENTAS = {
  proveedor: 'proveedor@demo-transportes.com',
  cliente: 'cliente@demo-transportes.com',
  analista: 'analista@sutl.dev',
};

async function llamar(token, metodo, ruta, cuerpo, formulario) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(formulario ? {} : { 'Content-Type': 'application/json' }) },
    body: formulario ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
  });
  const texto = await r.text();
  let body = {};
  try {
    body = texto ? JSON.parse(texto) : {};
  } catch {
    body = { texto };
  }
  return { status: r.status, body };
}

async function ingresar({ email, password }) {
  const r = await llamar(null, 'POST', '/auth/login', { email, password });
  if (r.status !== 200 || !r.body.accessToken) throw new Error(`No se pudo entrar como ${email} (${r.status}). ¿Corriste la semilla y el backend está arriba?`);
  return r.body.accessToken;
}

const paso = (m) => console.log(`  • ${m}`);
const en = (dias) => new Date(Date.now() + dias * 86_400_000).toISOString();

async function main() {
  console.log(`\nPreparando el escenario de presentación en ${API}\n`);
  const sa = await ingresar(SUPER);
  const admin = await ingresar(ADMIN);

  // ---- Personas ----
  const usuarios = (await llamar(admin, 'GET', '/users')).body;
  const lista = Array.isArray(usuarios) ? usuarios : usuarios.data ?? [];
  const existe = (email) => lista.find((u) => u.email === email);

  const socios = (await llamar(admin, 'GET', '/partners')).body;
  const proveedorSocio = (Array.isArray(socios) ? socios : socios.data ?? []).find((p) => p.tipo === 'proveedor' && /Ningbo/i.test(p.nombre));
  if (!proveedorSocio) throw new Error('No encontré al proveedor de ejemplo (Ningbo Polymer). Corre primero: npm run seed');

  if (!existe(CUENTAS.proveedor)) {
    const r = await llamar(admin, 'POST', '/users', { email: CUENTAS.proveedor, password: CLAVE, nombre: 'Chen Hao (proveedor)', rol: 'proveedor', partnerId: proveedorSocio.id });
    paso(`Usuario proveedor: ${CUENTAS.proveedor} (${r.status})`);
  } else paso(`Usuario proveedor ya existía: ${CUENTAS.proveedor}`);

  if (!existe(CUENTAS.cliente)) {
    const r = await llamar(admin, 'POST', '/users', { email: CUENTAS.cliente, password: CLAVE, nombre: 'Importadora Andina (cliente final)', rol: 'cliente_final' });
    paso(`Usuario cliente final: ${CUENTAS.cliente} (${r.status})`);
  } else paso(`Usuario cliente final ya existía: ${CUENTAS.cliente}`);

  // El analista de SUTL vive en la empresa de SVK Solutions y trabaja en la demo con permiso de gestión.
  const usuariosSa = (await llamar(sa, 'GET', '/users')).body;
  const listaSa = Array.isArray(usuariosSa) ? usuariosSa : usuariosSa.data ?? [];
  let analista = listaSa.find((u) => u.email === CUENTAS.analista);
  if (!analista) {
    const r = await llamar(sa, 'POST', '/users', { email: CUENTAS.analista, password: CLAVE, nombre: 'Ana Analista (SUTL)', rol: 'analista_sutl' });
    analista = r.body;
    paso(`Usuario analista de SUTL: ${CUENTAS.analista} (${r.status})`);
  } else paso(`Usuario analista ya existía: ${CUENTAS.analista}`);
  const demoTenantId = (await llamar(admin, 'GET', '/tenant-config')).status === 200 ? lista[0]?.tenantId : undefined;
  if (analista?.id && demoTenantId) {
    const g = await llamar(sa, 'POST', '/analyst-grants', { analystId: analista.id, tenantId: demoTenantId, soloLectura: false });
    paso(`Permiso del analista sobre la empresa demo (${g.status === 201 ? 'otorgado' : 'ya existía'})`);
  }

  // ---- Órdenes de compra para el flujo del proveedor ----
  const ordenes = (await llamar(admin, 'GET', '/purchase-orders')).body;
  const ordenesLista = Array.isArray(ordenes) ? ordenes : ordenes.data ?? [];
  async function ordenDemo(numero, sku, estadoFinal) {
    if (ordenesLista.some((o) => o.numero === numero)) return paso(`Orden ${numero} ya existía`);
    const oc = await llamar(admin, 'POST', '/purchase-orders', {
      numero,
      proveedorId: proveedorSocio.id,
      incoterm: 'FOB',
      moneda: 'USD',
      fechaRequerida: en(20),
      lineas: [
        { sku, descripcion: 'Resina polipropileno (demo)', cantidad: 20000, unidad: 'kg', precioUnitario: 1.35 },
        { sku: `${sku}-B`, descripcion: 'Pigmento azul (demo)', cantidad: 500, unidad: 'kg', precioUnitario: 8.9 },
      ],
    });
    if (oc.status !== 201) return paso(`No se pudo crear ${numero}: ${JSON.stringify(oc.body)}`);
    await llamar(admin, 'POST', `/purchase-orders/${oc.body.id}/transicion`, { estado: 'emitida' });
    if (estadoFinal === 'confirmada') await llamar(admin, 'POST', `/purchase-orders/${oc.body.id}/transicion`, { estado: 'confirmada', fechaConfirmadaProveedor: en(5) });
    paso(`Orden ${numero} creada (${estadoFinal})`);
  }
  await ordenDemo('OC-DEMO-PROV-01', 'DEMO-RES-01', 'emitida'); // el proveedor la CONFIRMA
  await ordenDemo('OC-DEMO-PROV-02', 'DEMO-RES-02', 'confirmada'); // el proveedor registra el DESPACHO

  // ---- Envío del cliente final, con recorrido en el mapa ----
  const envios = (await llamar(admin, 'GET', '/shipments')).body;
  const enviosLista = Array.isArray(envios) ? envios : envios.data ?? [];
  let envioCliente = enviosLista.find((e) => e.destinatarioEmail === CUENTAS.cliente && e.origen === 'Shanghái');
  if (!envioCliente) {
    const r = await llamar(admin, 'POST', '/shipments', {
      tipo: 'importacion', modo: 'maritimo', remitenteNombre: 'Ningbo Polymer Materials Co.', destinatarioNombre: 'Importadora Andina S.A.',
      destinatarioEmail: CUENTAS.cliente, origen: 'Shanghái', destino: 'Guayaquil', puertoOrigen: 'CNSHA', puertoDestino: 'ECGYE',
      referenciaDocumento: 'BL-DEMO-778899', fechaEstimadaSalida: en(-20), fechaEstimadaLlegada: en(12),
    });
    envioCliente = r.body;
    const puntos = [
      ['creado', 'Shanghái, China', 'Orden recibida por el transportista', 31.23, 121.47],
      ['en_transito', 'Océano Pacífico', 'Zarpó rumbo a Guayaquil', 20.0, 160.0],
      ['en_transito', 'Cerca de Hawái', 'Navegando, sin novedades', 21.3, -157.8],
      ['en_transito', 'Pacífico oriental', 'A cuatro días del puerto', 5.0, -100.0],
    ];
    for (const [estado, ubicacion, descripcion, lat, lng] of puntos) {
      await llamar(admin, 'POST', '/tracking-events', { shipmentId: envioCliente.id, estado, ubicacion, descripcion, lat, lng });
    }
    paso(`Envío del cliente ${envioCliente.codigoGuia} creado con 4 movimientos y recorrido en el mapa`);

    // Documentos: uno por vencer (para el aviso), uno vencido y uno compartido con el cliente.
    const subir = async (tipo, vence, nombre) => {
      const f = new FormData();
      f.append('shipmentId', envioCliente.id);
      f.append('tipo', tipo);
      if (vence) f.append('fechaVencimiento', vence);
      f.append('file', new Blob([`%PDF-1.4 ${nombre}`], { type: 'application/pdf' }), nombre);
      return llamar(admin, 'POST', '/documents', undefined, f);
    };
    const factura = await subir('factura', en(6), 'factura-demo.pdf');
    await subir('packing_list', en(-2), 'lista-empaque-demo.pdf');
    if (factura.body.id) {
      await llamar(admin, 'PATCH', `/documents/${factura.body.id}/compartir`, { visibleCliente: true });
      await llamar(admin, 'PATCH', `/documents/${factura.body.id}/revision`, { estado: 'aprobado' });
    }
    paso('Documentos: factura (vence en 6 días, compartida con el cliente), lista de empaque (vencida)');
  } else paso(`Envío del cliente ya existía (${envioCliente.codigoGuia})`);

  // ---- Envío listo para la prueba de entrega ----
  let envioPod = enviosLista.find((e) => e.referenciaDocumento === 'GUIA-DEMO-ENTREGA');
  if (!envioPod) {
    const r = await llamar(admin, 'POST', '/shipments', {
      tipo: 'importacion', modo: 'terrestre', remitenteNombre: 'Bodega Quito', destinatarioNombre: 'Importadora Andina S.A.',
      destinatarioEmail: CUENTAS.cliente, origen: 'Quito', destino: 'Cuenca', referenciaDocumento: 'GUIA-DEMO-ENTREGA', fechaEstimadaLlegada: en(1),
    });
    envioPod = r.body;
    await llamar(admin, 'POST', '/tracking-events', { shipmentId: envioPod.id, estado: 'en_transito', ubicacion: 'Riobamba', descripcion: 'En ruta', lat: -1.67, lng: -78.65 });
    paso(`Envío listo para registrar la entrega con firma: ${envioPod.codigoGuia}`);
  } else paso(`Envío para la entrega ya existía (${envioPod.codigoGuia})`);

  // ---- Rondas automáticas para que las pantallas ya tengan datos ----
  await llamar(admin, 'POST', '/supply-risk/evaluar');
  await llamar(admin, 'POST', '/exceptions/evaluar');
  paso('Riesgo y excepciones evaluados');

  console.log(`
Listo. Cuentas (todas con la clave ${CLAVE}, salvo el super administrador):
  Administrador de la empresa : ${ADMIN.email}
  Operador                    : operador@demo-transportes.com
  Proveedor (portal)          : ${CUENTAS.proveedor}
  Cliente final (portal)      : ${CUENTAS.cliente}
  Analista de SUTL            : ${CUENTAS.analista}
  Super administrador         : ${SUPER.email} / ${SUPER.password}

Código de seguimiento público del cliente : ${envioCliente.codigoGuia}  →  http://localhost:3002/tracking/${envioCliente.codigoGuia}
Envío para registrar la entrega            : ${envioPod.codigoGuia}
`);
}

main().catch((e) => {
  console.error(`\nNo se pudo preparar el escenario: ${e.message}\n`);
  process.exit(1);
});
