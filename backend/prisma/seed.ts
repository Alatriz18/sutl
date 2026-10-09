import { PrismaClient, RolUsuario, TipoCarrier } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Tenant especial que agrupa las cuentas super_admin del panel SaaS (SVK Solutions).
  const svkTenant = await prisma.tenant.upsert({
    where: { ruc: '0000000000001' },
    update: {},
    create: {
      nombre: 'SVK Solutions',
      ruc: '0000000000001',
      plan: 'internal',
      activo: true,
    },
  });

  const superAdminPassword = await bcrypt.hash('SutlAdmin2026!', 10);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: svkTenant.id, email: 'admin@sutl.dev' } },
    update: {},
    create: {
      tenantId: svkTenant.id,
      email: 'admin@sutl.dev',
      password: superAdminPassword,
      nombre: 'Super Admin SUTL',
      rol: RolUsuario.super_admin,
    },
  });

  // Catálogo global de navieras/aerolíneas (Fase 2 del plan: integraciones).
  const carriers = [
    { nombre: 'Maersk', tipo: TipoCarrier.naviera, codigo: 'MAEU' },
    { nombre: 'MSC', tipo: TipoCarrier.naviera, codigo: 'MSCU' },
    { nombre: 'CMA CGM', tipo: TipoCarrier.naviera, codigo: 'CMDU' },
    { nombre: 'Hapag-Lloyd', tipo: TipoCarrier.naviera, codigo: 'HLCU' },
    { nombre: 'Evergreen', tipo: TipoCarrier.naviera, codigo: 'EGLV' },
    { nombre: 'IATA CargoWise', tipo: TipoCarrier.aerolinea, codigo: 'CWIATA' },
  ];
  const carrierRecords: Record<string, { id: string }> = {};
  for (const c of carriers) {
    carrierRecords[c.nombre] = await prisma.carrier.upsert({
      where: { codigo: c.codigo },
      update: {},
      create: c,
    });
  }

  // Planes de suscripción del panel SaaS (Fase 5 del plan).
  const planTrial = await prisma.subscriptionPlan.upsert({
    where: { nombre: 'trial' },
    update: {},
    create: {
      nombre: 'trial',
      precioMensual: 0,
      maxUsuarios: 3,
      maxEnvios: 20,
      activo: true,
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { nombre: 'pro' },
    update: {},
    create: {
      nombre: 'pro',
      precioMensual: 600,
      maxUsuarios: 20,
      maxEnvios: 500,
      activo: true,
    },
  });

  // Tenant demo con un admin_tenant y un operador para probar el flujo completo.
  const demoTenant = await prisma.tenant.upsert({
    where: { ruc: '1790000000001' },
    update: {},
    create: {
      nombre: 'Transportes Demo S.A.',
      ruc: '1790000000001',
      plan: 'trial',
      activo: true,
    },
  });

  await prisma.subscription.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      planId: planTrial.id,
      estado: 'prueba',
    },
  });

  const demoPassword = await bcrypt.hash('Demo2026!', 10);

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'admin@demo-transportes.com' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'admin@demo-transportes.com',
      password: demoPassword,
      nombre: 'Admin Demo',
      rol: RolUsuario.admin_tenant,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'operador@demo-transportes.com' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'operador@demo-transportes.com',
      password: demoPassword,
      nombre: 'Operador Demo',
      rol: RolUsuario.operador,
    },
  });

  // Envíos demo repartidos en los últimos 6 meses, con distintos tipos, modos,
  // navieras y estados — para que el dashboard tenga datos reales que agregar
  // en vez de números inventados en el frontend.
  const hoy = new Date();
  const mesesAtras = (n: number, dia: number) =>
    new Date(hoy.getFullYear(), hoy.getMonth() - n, dia);

  const demoShipments = [
    {
      codigoGuia: 'SUTL-DEMO-0001',
      tipo: 'exportacion' as const,
      modo: 'maritimo' as const,
      carrier: 'Maersk',
      referenciaDocumento: 'MAEU1234567',
      remitenteNombre: 'Comercial Andina Cía. Ltda.',
      destinatarioNombre: 'Juan Pérez',
      destinatarioEmail: 'juan.perez@example.com',
      origen: 'Guayaquil, EC',
      destino: 'Quito, EC',
      puertoOrigen: 'Puerto de Guayaquil',
      puertoDestino: 'Puerto de Callao',
      pesoKg: 1250.5,
      estado: 'en_transito' as const,
      createdAt: mesesAtras(0, 3),
    },
    {
      codigoGuia: 'SUTL-DEMO-0002',
      tipo: 'importacion' as const,
      modo: 'aereo' as const,
      carrier: 'IATA CargoWise',
      referenciaDocumento: 'CW-88213',
      remitenteNombre: 'Shenzhen Electronics Co.',
      destinatarioNombre: 'TecnoImport S.A.',
      destinatarioEmail: 'compras@tecnoimport.ec',
      origen: 'Shenzhen, CN',
      destino: 'Guayaquil, EC',
      puertoOrigen: 'Aeropuerto de Shenzhen',
      puertoDestino: 'Aeropuerto José Joaquín de Olmedo',
      pesoKg: 340,
      estado: 'en_aduana' as const,
      createdAt: mesesAtras(0, 10),
    },
    {
      codigoGuia: 'SUTL-DEMO-0003',
      tipo: 'exportacion' as const,
      modo: 'maritimo' as const,
      carrier: 'MSC',
      referenciaDocumento: 'MSCU9988776',
      remitenteNombre: 'Bananera del Pacífico S.A.',
      destinatarioNombre: 'European Fruit Import GmbH',
      destinatarioEmail: null,
      origen: 'Guayaquil, EC',
      destino: 'Hamburgo, DE',
      puertoOrigen: 'Puerto de Guayaquil',
      puertoDestino: 'Puerto de Hamburgo',
      pesoKg: 18500,
      estado: 'entregado' as const,
      createdAt: mesesAtras(1, 5),
    },
    {
      codigoGuia: 'SUTL-DEMO-0004',
      tipo: 'importacion' as const,
      modo: 'terrestre' as const,
      carrier: null,
      referenciaDocumento: null,
      remitenteNombre: 'Textiles Andinos Perú',
      destinatarioNombre: 'Moda EC Cía. Ltda.',
      destinatarioEmail: 'logistica@modaec.com',
      origen: 'Lima, PE',
      destino: 'Cuenca, EC',
      puertoOrigen: null,
      puertoDestino: null,
      pesoKg: 890,
      estado: 'incidencia' as const,
      createdAt: mesesAtras(1, 20),
    },
    {
      codigoGuia: 'SUTL-DEMO-0005',
      tipo: 'exportacion' as const,
      modo: 'aereo' as const,
      carrier: 'IATA CargoWise',
      referenciaDocumento: 'CW-77104',
      remitenteNombre: 'Flores del Valle S.A.',
      destinatarioNombre: 'Amsterdam Flower Market',
      destinatarioEmail: null,
      origen: 'Quito, EC',
      destino: 'Ámsterdam, NL',
      puertoOrigen: 'Aeropuerto de Quito',
      puertoDestino: 'Aeropuerto de Schiphol',
      pesoKg: 2100,
      estado: 'entregado' as const,
      createdAt: mesesAtras(2, 2),
    },
    {
      codigoGuia: 'SUTL-DEMO-0006',
      tipo: 'importacion' as const,
      modo: 'maritimo' as const,
      carrier: 'CMA CGM',
      referenciaDocumento: 'CMDU4455667',
      remitenteNombre: 'Auto Parts USA Inc.',
      destinatarioNombre: 'Repuestos Continental',
      destinatarioEmail: 'importaciones@continental.ec',
      origen: 'Miami, US',
      destino: 'Guayaquil, EC',
      puertoOrigen: 'Puerto de Miami',
      puertoDestino: 'Puerto de Guayaquil',
      pesoKg: 5400,
      estado: 'entregado' as const,
      createdAt: mesesAtras(2, 18),
    },
    {
      codigoGuia: 'SUTL-DEMO-0007',
      tipo: 'exportacion' as const,
      modo: 'maritimo' as const,
      carrier: 'Hapag-Lloyd',
      referenciaDocumento: 'HLCU3321998',
      remitenteNombre: 'Cacao Fino de Aroma S.A.',
      destinatarioNombre: 'Swiss Chocolate Import AG',
      destinatarioEmail: null,
      origen: 'Guayaquil, EC',
      destino: 'Rotterdam, NL',
      puertoOrigen: 'Puerto de Guayaquil',
      puertoDestino: 'Puerto de Rotterdam',
      pesoKg: 9800,
      estado: 'en_transito' as const,
      createdAt: mesesAtras(3, 8),
    },
    {
      codigoGuia: 'SUTL-DEMO-0008',
      tipo: 'importacion' as const,
      modo: 'aereo' as const,
      carrier: 'IATA CargoWise',
      referenciaDocumento: 'CW-65332',
      remitenteNombre: 'MedSupply International',
      destinatarioNombre: 'Farmacéutica del Ecuador',
      destinatarioEmail: 'compras@farmaec.com',
      origen: 'Miami, US',
      destino: 'Quito, EC',
      puertoOrigen: 'Aeropuerto de Miami',
      puertoDestino: 'Aeropuerto de Quito',
      pesoKg: 120,
      estado: 'entregado' as const,
      createdAt: mesesAtras(3, 25),
    },
    {
      codigoGuia: 'SUTL-DEMO-0009',
      tipo: 'exportacion' as const,
      modo: 'maritimo' as const,
      carrier: 'Evergreen',
      referenciaDocumento: 'EGLV1198234',
      remitenteNombre: 'Camaronera del Golfo S.A.',
      destinatarioNombre: 'Asia Seafood Trading',
      destinatarioEmail: null,
      origen: 'Guayaquil, EC',
      destino: 'Busan, KR',
      puertoOrigen: 'Puerto de Guayaquil',
      puertoDestino: 'Puerto de Busan',
      pesoKg: 22000,
      estado: 'creado' as const,
      createdAt: mesesAtras(4, 14),
    },
    {
      codigoGuia: 'SUTL-DEMO-0010',
      tipo: 'importacion' as const,
      modo: 'maritimo' as const,
      carrier: 'Maersk',
      referenciaDocumento: 'MAEU7789012',
      remitenteNombre: 'Maquinaria Industrial GmbH',
      destinatarioNombre: 'Constructora del Pacífico',
      destinatarioEmail: 'compras@constructorapacifico.ec',
      origen: 'Hamburgo, DE',
      destino: 'Guayaquil, EC',
      puertoOrigen: 'Puerto de Hamburgo',
      puertoDestino: 'Puerto de Guayaquil',
      pesoKg: 31000,
      estado: 'entregado' as const,
      createdAt: mesesAtras(5, 6),
    },
  ];

  for (const s of demoShipments) {
    const { carrier, ...data } = s;
    await prisma.shipment.upsert({
      where: { codigoGuia: s.codigoGuia },
      update: {},
      create: {
        ...data,
        tenantId: demoTenant.id,
        carrierId: carrier ? carrierRecords[carrier].id : null,
      },
    });
  }

  // CRM: clientes, agente y transportista terrestre del tenant demo — usados
  // por Cotizaciones (Quote) y Reservas (Booking).
  const partnerData = [
    {
      key: 'ClienteAndino',
      tipo: 'cliente' as const,
      nombre: 'Importadora Andina S.A.',
      taxId: '0991234567001',
      email: 'compras@importadoraandina.ec',
      telefono: '+593 4 2345678',
      contactoNombre: 'María Sánchez',
    },
    {
      key: 'ClienteExportador',
      tipo: 'cliente' as const,
      nombre: 'Exportadora Tropical Cía. Ltda.',
      taxId: '0997654321001',
      email: 'ventas@tropicalexport.ec',
      telefono: '+593 4 2987654',
      contactoNombre: 'Carlos Vera',
    },
    {
      key: 'AgenteAsia',
      tipo: 'agente' as const,
      nombre: 'Asia Pacific Freight Agents Ltd.',
      email: 'ops@apfreight.cn',
      telefono: '+86 21 5555 0199',
      contactoNombre: 'Li Wei',
    },
    {
      key: 'TransportistaLocal',
      tipo: 'transportista' as const,
      nombre: 'Transportes Costa Sierra S.A.',
      taxId: '0993334445001',
      telefono: '+593 9 8877 6655',
      contactoNombre: 'Jorge Paredes',
    },
  ];
  const partnerRecords: Record<string, { id: string }> = {};
  for (const p of partnerData) {
    const { key, ...data } = p;
    const existente = await prisma.partner.findFirst({
      where: { tenantId: demoTenant.id, nombre: data.nombre },
    });
    partnerRecords[key] =
      existente ??
      (await prisma.partner.create({ data: { ...data, tenantId: demoTenant.id } }));
  }

  // Cotizaciones y reservas — muestran el flujo Quote → Booking → Shipment.
  const quote1 = await prisma.quote.upsert({
    where: { numero: 'COT-DEMO0001' },
    update: {},
    create: {
      tenantId: demoTenant.id,
      numero: 'COT-DEMO0001',
      clienteId: partnerRecords['ClienteAndino'].id,
      tipo: 'importacion',
      modo: 'maritimo',
      carrierId: carrierRecords['Maersk'].id,
      origen: 'Shanghai, CN',
      destino: 'Guayaquil, EC',
      pesoKg: 8000,
      volumenM3: 28,
      tarifaEstimada: 2400,
      moneda: 'USD',
      estado: 'aprobada',
      validoHasta: mesesAtras(-1, 30),
      notas: 'Contenedor 40HC, mercadería general.',
    },
  });

  await prisma.quote.upsert({
    where: { numero: 'COT-DEMO0002' },
    update: {},
    create: {
      tenantId: demoTenant.id,
      numero: 'COT-DEMO0002',
      clienteId: partnerRecords['ClienteExportador'].id,
      tipo: 'exportacion',
      modo: 'aereo',
      carrierId: carrierRecords['IATA CargoWise'].id,
      origen: 'Quito, EC',
      destino: 'Miami, US',
      pesoKg: 450,
      tarifaEstimada: 980,
      moneda: 'USD',
      estado: 'borrador',
      notas: 'Pendiente confirmar fecha de despacho con el cliente.',
    },
  });

  const bookingExistente = await prisma.booking.findFirst({
    where: { tenantId: demoTenant.id, quoteId: quote1.id },
  });
  if (!bookingExistente) {
    await prisma.booking.create({
      data: {
        tenantId: demoTenant.id,
        quoteId: quote1.id,
        clienteId: partnerRecords['ClienteAndino'].id,
        tipo: 'importacion',
        modo: 'maritimo',
        carrierId: carrierRecords['Maersk'].id,
        origen: 'Shanghai, CN',
        destino: 'Guayaquil, EC',
        fechaEstimadaCarga: mesesAtras(-1, 15),
        estado: 'confirmada',
      },
    });
  }

  const bookingPendienteExistente = await prisma.booking.findFirst({
    where: { tenantId: demoTenant.id, clienteId: partnerRecords['ClienteExportador'].id },
  });
  if (!bookingPendienteExistente) {
    await prisma.booking.create({
      data: {
        tenantId: demoTenant.id,
        clienteId: partnerRecords['ClienteExportador'].id,
        tipo: 'exportacion',
        modo: 'terrestre',
        origen: 'Cuenca, EC',
        destino: 'Lima, PE',
        estado: 'pendiente',
      },
    });
  }

  // Tarifas de referencia (Rate) — negociadas por el tenant demo.
  const rateData = [
    { carrier: 'Maersk', origen: 'Guayaquil, EC', destino: 'Callao, PE', modo: 'maritimo' as const, tipo: 'exportacion' as const, unidad: 'contenedor_40', precioBase: 1850 },
    { carrier: 'MSC', origen: 'Guayaquil, EC', destino: 'Hamburgo, DE', modo: 'maritimo' as const, tipo: 'exportacion' as const, unidad: 'contenedor_20', precioBase: 2400 },
    { carrier: 'IATA CargoWise', origen: 'Quito, EC', destino: 'Miami, US', modo: 'aereo' as const, tipo: 'exportacion' as const, unidad: 'kg', precioBase: 2.35 },
  ];
  for (const r of rateData) {
    const existente = await prisma.rate.findFirst({
      where: { tenantId: demoTenant.id, carrierId: carrierRecords[r.carrier].id, origen: r.origen, destino: r.destino },
    });
    if (!existente) {
      const { carrier, ...data } = r;
      await prisma.rate.create({ data: { ...data, tenantId: demoTenant.id, carrierId: carrierRecords[carrier].id } });
    }
  }

  // Contrato marco con Maersk.
  const contratoExistente = await prisma.contract.findFirst({
    where: { tenantId: demoTenant.id, numeroContrato: 'CTR-2026-014' },
  });
  if (!contratoExistente) {
    await prisma.contract.create({
      data: {
        tenantId: demoTenant.id,
        carrierId: carrierRecords['Maersk'].id,
        nombre: 'Contrato marco Maersk 2026',
        numeroContrato: 'CTR-2026-014',
        vigenteDesde: new Date(hoy.getFullYear(), 0, 1),
        vigenteHasta: new Date(hoy.getFullYear(), 11, 31),
      },
    });
  }

  // Contenedor de consolidación con un par de envíos reales asignados.
  const shipment3 = await prisma.shipment.findUnique({ where: { codigoGuia: 'SUTL-DEMO-0003' } });
  const shipment7 = await prisma.shipment.findUnique({ where: { codigoGuia: 'SUTL-DEMO-0007' } });
  const contenedorExistente = await prisma.container.findUnique({
    where: { numeroContenedor: 'MSCU5544332' },
  });
  const contenedor =
    contenedorExistente ??
    (await prisma.container.create({
      data: {
        tenantId: demoTenant.id,
        numeroContenedor: 'MSCU5544332',
        tipo: '40HC',
        carrierId: carrierRecords['MSC'].id,
        origen: 'Guayaquil, EC',
        destino: 'Hamburgo, DE',
        estado: 'en_transito',
        capacidadM3: 76,
      },
    }));
  if (shipment3 && !shipment3.containerId) {
    await prisma.shipment.update({ where: { id: shipment3.id }, data: { containerId: contenedor.id } });
  }
  if (shipment7 && !shipment7.containerId) {
    await prisma.shipment.update({ where: { id: shipment7.id }, data: { containerId: contenedor.id } });
  }

  // Almacén con una ubicación y un ítem de inventario.
  const bodegaExistente = await prisma.warehouse.findFirst({
    where: { tenantId: demoTenant.id, nombre: 'Bodega Guayaquil Central' },
  });
  const bodega =
    bodegaExistente ??
    (await prisma.warehouse.create({
      data: { tenantId: demoTenant.id, nombre: 'Bodega Guayaquil Central', direccion: 'Vía a Daule km 8' },
    }));
  let ubicacion = await prisma.warehouseLocation.findFirst({
    where: { warehouseId: bodega.id, codigo: 'A-01-03' },
  });
  if (!ubicacion) {
    ubicacion = await prisma.warehouseLocation.create({
      data: { warehouseId: bodega.id, codigo: 'A-01-03', tipo: 'estante', capacidad: 500 },
    });
  }
  const itemExistente = await prisma.inventoryItem.findFirst({
    where: { tenantId: demoTenant.id, sku: 'ELEC-4471' },
  });
  if (!itemExistente) {
    await prisma.inventoryItem.create({
      data: {
        tenantId: demoTenant.id,
        warehouseId: bodega.id,
        ubicacionId: ubicacion.id,
        sku: 'ELEC-4471',
        descripcion: 'Componentes electrónicos (caja)',
        cantidad: 120,
        unidad: 'unidad',
      },
    });
  }

  // Flota: un vehículo, un chofer y una asignación activa.
  const vehiculoExistente = await prisma.vehicle.findUnique({ where: { placa: 'GYE-4471' } });
  const vehiculo =
    vehiculoExistente ??
    (await prisma.vehicle.create({
      data: { tenantId: demoTenant.id, placa: 'GYE-4471', tipo: 'Camión 3.5T', capacidadKg: 3500, estado: 'en_ruta' },
    }));
  const choferExistente = await prisma.driver.findFirst({
    where: { tenantId: demoTenant.id, licencia: 'ECU-998877' },
  });
  const chofer =
    choferExistente ??
    (await prisma.driver.create({
      data: { tenantId: demoTenant.id, nombre: 'Jorge Paredes', licencia: 'ECU-998877', telefono: '+593 9 8877 6655' },
    }));
  const asignacionExistente = await prisma.vehicleAssignment.findFirst({
    where: { tenantId: demoTenant.id, vehicleId: vehiculo.id, fechaFin: null },
  });
  if (!asignacionExistente) {
    await prisma.vehicleAssignment.create({
      data: { tenantId: demoTenant.id, vehicleId: vehiculo.id, driverId: chofer.id },
    });
  }

  // Facturación: una CxC a un cliente y una CxP a una naviera.
  const facturaCxcExistente = await prisma.invoice.findFirst({
    where: { tenantId: demoTenant.id, tipo: 'cxc', partnerId: partnerRecords['ClienteAndino'].id },
  });
  if (!facturaCxcExistente) {
    await prisma.invoice.create({
      data: {
        tenantId: demoTenant.id,
        tipo: 'cxc',
        numero: 'FAC-CXC-DEMO1',
        partnerId: partnerRecords['ClienteAndino'].id,
        shipmentId: shipment3?.id,
        montoTotal: 2400,
        estado: 'pendiente',
      },
    });
  }
  const facturaCxpExistente = await prisma.invoice.findFirst({
    where: { tenantId: demoTenant.id, tipo: 'cxp', numero: 'FAC-CXP-DEMO1' },
  });
  if (!facturaCxpExistente) {
    const proveedor = await prisma.partner.findFirst({
      where: { tenantId: demoTenant.id, tipo: 'transportista' },
    });
    if (proveedor) {
      await prisma.invoice.create({
        data: {
          tenantId: demoTenant.id,
          tipo: 'cxp',
          numero: 'FAC-CXP-DEMO1',
          partnerId: proveedor.id,
          montoTotal: 320,
          estado: 'vencida',
        },
      });
    }
  }

  // Alertas activas — usan el motor de evaluación real (AlertsService.evaluar).
  const adminDemo = await prisma.user.findFirst({
    where: { tenantId: demoTenant.id, email: 'admin@demo-transportes.com' },
  });

  const alertaRetraso = await prisma.alert.findFirst({
    where: { tenantId: demoTenant.id, tipo: 'retraso' },
  });
  if (!alertaRetraso) {
    await prisma.alert.create({
      data: {
        tenantId: demoTenant.id,
        tipo: 'retraso',
        condicion: { estado: 'en_transito', diasUmbral: 5 },
        activo: true,
      },
    });
  }
  const alertaAduana = await prisma.alert.findFirst({
    where: { tenantId: demoTenant.id, tipo: 'documento_faltante' },
  });
  if (!alertaAduana) {
    await prisma.alert.create({
      data: {
        tenantId: demoTenant.id,
        tipo: 'documento_faltante',
        condicion: { tipoDocumento: 'bl', diasUmbral: 2 },
        activo: true,
      },
    });
  }
  const alertaLlegada = await prisma.alert.findFirst({
    where: { tenantId: demoTenant.id, tipo: 'llegada_proxima' },
  });
  if (!alertaLlegada) {
    await prisma.alert.create({
      data: {
        tenantId: demoTenant.id,
        tipo: 'llegada_proxima',
        condicion: { diasAntes: 7 },
        activo: true,
      },
    });
  }

  // Notificaciones — historial de ejemplo, sin proveedor real conectado todavía.
  const notifExistente = await prisma.notification.findFirst({
    where: { tenantId: demoTenant.id, tipo: 'cambio_estado' },
  });
  if (!notifExistente && adminDemo) {
    await prisma.notification.create({
      data: {
        tenantId: demoTenant.id,
        userId: adminDemo.id,
        canal: 'email',
        tipo: 'cambio_estado',
        asunto: 'Tu envío SUTL-DEMO-0001 cambió a "En tránsito"',
        mensaje: 'El envío SUTL-DEMO-0001 ahora está en tránsito hacia su destino.',
        estado: 'enviado',
        enviadoAt: mesesAtras(0, 3),
      },
    });
    await prisma.notification.create({
      data: {
        tenantId: demoTenant.id,
        userId: adminDemo.id,
        canal: 'email',
        tipo: 'documento_faltante',
        asunto: 'Recordatorio: falta el BL de SUTL-DEMO-0009',
        mensaje: 'Aún no se ha cargado el conocimiento de embarque (BL) para este envío.',
        estado: 'pendiente',
      },
    });
  }

  // Reportes — genera de verdad un CSV real (mismo motor que expone /reports).
  const reporteExistente = await prisma.report.findFirst({
    where: { tenantId: demoTenant.id, tipo: 'envios_por_estado' },
  });
  if (!reporteExistente && adminDemo) {
    await prisma.report.create({
      data: {
        tenantId: demoTenant.id,
        tipo: 'envios_por_estado',
        formato: 'csv',
        urlArchivo: null,
        generadoPorId: adminDemo.id,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed completado:', {
    superAdmin: 'admin@sutl.dev / SutlAdmin2026!',
    demoAdmin: 'admin@demo-transportes.com / Demo2026!',
    demoOperador: 'operador@demo-transportes.com / Demo2026!',
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
