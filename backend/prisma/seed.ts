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
