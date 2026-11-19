# SUTL — Guía para presentar el avance

Esta guía sirve para **levantar todo, entrar con cada tipo de usuario y mostrar los flujos de principio a fin**. Cada flujo dice qué cuenta usar, qué hacer y qué debería verse. Todo corre en tu computador, con el sistema real (no es una maqueta).

## 1. Levantar y apagar

Abre PowerShell en la carpeta del proyecto:

```powershell
.\scripts\levantar-demo.ps1      # levanta bases de datos, correo, backend, frontend y datos de ejemplo
.\scripts\detener-demo.ps1       # apaga todo (los datos se conservan)
```

La primera vez tarda unos minutos (compila el frontend). Cuando termina muestra las direcciones:

| Qué | Dirección |
|---|---|
| Aplicación | http://localhost:3002 |
| Correos que envía el sistema (bandeja de prueba) | http://localhost:8025 |
| Documentación de la API (Swagger) | http://localhost:3001/api/docs |

Si cambias código y quieres recompilar la pantalla: `.\scripts\levantar-demo.ps1 -Reconstruir`.
Si solo quieres volver a cargar los casos de ejemplo: `cd backend` y luego `npm run demo:preparar` (no duplica nada).

## 2. Cuentas de la presentación

Todas con la clave **`Demo2026!`** (salvo el super administrador).

| Rol | Correo | Qué ve |
|---|---|---|
| Administrador de la empresa | `admin@demo-transportes.com` | Todo: operación, usuarios, configuración, bitácora |
| Operador | `operador@demo-transportes.com` | La operación diaria, sin administración |
| Proveedor (portal) | `proveedor@demo-transportes.com` | Solo SUS órdenes de compra, con conversación |
| Cliente final (portal) | `cliente@demo-transportes.com` | Solo SUS envíos, documentos compartidos y entrega |
| Analista de SUTL | `analista@sutl.dev` | Trabaja en empresas cliente con permiso |
| Super administrador | `admin@sutl.dev` / `SutlAdmin2026!` | Panel de empresas y permisos |

Consejo: abre **dos navegadores (o uno normal y uno privado)** para ver a la empresa y a su cliente/proveedor al mismo tiempo.

## 3. Flujos para mostrar

### Flujo 1 — La torre de control (administrador)
1. Entra como **admin** → **Resumen**: SKU en riesgo, órdenes atrasadas, embarques por llegar, tareas del día.
2. **Riesgo de abastecimiento**: semáforo por producto (rojo = se queda sin stock antes de que llegue la reposición) con la acción recomendada.
3. **Excepciones**: lo atrasado o en rojo abre una excepción con plazo; **Tareas**: cada excepción abre una tarea (se asigna sola si definiste un responsable en Configuración).
4. **Bitácora de seguridad**: quién hizo qué y cuándo.

### Flujo 2 — Orden de compra con el proveedor (el corazón del producto)
1. **Proveedor** (`proveedor@…`) → **Mis órdenes de compra** → abre `OC-DEMO-PROV-01` (emitida). Pone la **fecha de despacho comprometida** y pulsa **Confirmar orden**. Puede escribir un mensaje a la empresa.
2. **Admin** → **Órdenes de compra** → `OC-DEMO-PROV-01` ya aparece confirmada, con la fecha que prometió el proveedor. Revisa el correo del aviso en http://localhost:8025.
3. **Proveedor** → abre `OC-DEMO-PROV-02` (confirmada) → tarjeta **Registrar un despacho**: transporte *Marítimo*, origen `Shanghái`, destino `Guayaquil`, guía `BL-PRUEBA-001`, fecha de salida de hoy, cantidad `12000` en la primera línea → **Registrar despacho**. Queda «Despachada» con su embarque y su código de seguimiento. Puede registrar el resto en una segunda salida.
4. **Admin** → **Envíos**: el embarque nuevo aparece creado por el proveedor; la orden queda «Despachada».

### Flujo 3 — Seguimiento en vivo y mapa (lo que ve el cliente del cliente)
1. Abre en una ventana **sin sesión**: `http://localhost:3002/tracking/<código>` (el código del envío del cliente se imprime al final de `levantar-demo`; también está en **Envíos**). Se ve el recorrido en un mapa y el indicador «En vivo».
2. En otra ventana, **admin** → **Envíos** → abre ese envío → **Registrar evento de tracking**: estado *En tránsito*, ubicación `Canal de Panamá`, latitud `9.08`, longitud `-79.68` → **Agregar evento**.
3. Mira la ventana pública: **se actualiza sola**, sin recargar, y el mapa suma el punto.
4. En **Configuración de la operación → Marca del seguimiento público** cambia el nombre comercial y el color: la página pública los toma (vista previa incluida).

### Flujo 4 — Entrega con firma y recepción de la orden
1. **Admin** → **Envíos** → el envío con guía `GUIA-DEMO-ENTREGA` → tarjeta **Prueba de entrega**.
2. Escribe **Quién recibió**: `Luis Mora`; en el recuadro, **firma con el mouse o el dedo**; marca *Recibir en las órdenes de compra la carga de este envío* si tiene carga ligada → **Registrar entrega**.
3. El envío pasa a **Entregado**, la constancia muestra la firma y el evento queda en el seguimiento.
4. **Cliente final** (`cliente@…`) → **Mis envíos**: ve la constancia y la firma de SU envío (y ninguno ajeno).

### Flujo 5 — Documentos: compartir, vencimientos y avisos
1. **Admin** → **Envíos** → el envío del cliente → **Documentos del envío**: checklist con lo exigido por la empresa (aprobar / rechazar con motivo) y la tarjeta **Documentos compartidos** (casillas *Cliente* y *Proveedores*: por defecto todo es interno).
2. **Cliente final** → ese envío → **Documentos**: ve solo lo que se le compartió y puede **subir los suyos** (quedan en revisión).
3. Para mostrar los **avisos de vencimiento** (la factura de ejemplo vence en 6 días y la lista de empaque ya venció): en `backend` ejecuta `npm run demo:rondas`. Abre http://localhost:8025: llegó **un solo correo** al administrador con los documentos vencidos y por vencer. Si lo ejecutas otra vez no repite el aviso.

### Flujo 6 — Analítica, metas y Excel
1. **Admin** → **Analítica de abastecimiento**: OTIF (a tiempo y completas), lead time, atraso de las órdenes abiertas, cumplimiento de la fecha prometida y detalle por proveedor.
2. **Configuración de la operación → Metas de la analítica**: cambia la meta de OTIF (p. ej. 95 %) y el umbral de atención; los colores verde/ámbar/rojo se recalculan para esa empresa.
3. **Exportar a Excel**: descarga un `.xlsx` real de cuatro hojas (Resumen, Proveedores, Tendencia, Atraso de OC abiertas).

### Flujo 7 — Seguridad: segundo factor obligatorio
1. **Admin** → **Seguridad de la cuenta** → *Activar segundo factor*: aparece un **código QR** (escanéalo con Google Authenticator o Microsoft Authenticator) y los códigos de recuperación.
2. **Configuración → Seguridad de los accesos** → marca *Exigir la app de autenticación a todos los administradores*. Un administrador sin segundo factor queda **bloqueado en todo el sistema salvo en la pantalla para activarlo**.
3. Para el personal de SUTL (analistas y super administradores) el segundo factor es obligatorio en producción.

### Flujo 8 — Analista de SUTL en una empresa cliente
1. Entra como **analista** (`analista@sutl.dev`). En la barra superior elige la empresa «Transportes Demo S.A.».
2. Trabaja con el permiso que le dio el super administrador (aquí, de gestión); cada ingreso queda en la bitácora de la empresa.
3. **Super administrador** → **Accesos de analistas**: otorga o revoca permisos (solo lectura por defecto, revocable al instante).

### Flujo 9 — Responsables y reglas por empresa
1. **Configuración de la operación** muestra que cada empresa trabaja distinto: perfil de industria, tolerancia de recepción, plazos de excepciones, **responsable por tipo de excepción**, documentos exigidos, avisos por correo.
2. Asigna el responsable de *OC atrasada*; la próxima excepción de ese tipo abre su tarea **ya asignada** a esa persona (mira **Tareas**).

## 4. Ejemplos para correr por la API (sin pantalla)

Reemplaza `$TOKEN` por el `accessToken` del primer paso. Funciona en PowerShell (usa `curl.exe`).

```powershell
# 1) Iniciar sesión
curl.exe -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"admin@demo-transportes.com\",\"password\":\"Demo2026!\"}'

# 2) Crear un envío
curl.exe -s -X POST http://localhost:3001/api/shipments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{\"tipo\":\"importacion\",\"modo\":\"maritimo\",\"remitenteNombre\":\"Proveedor X\",\"destinatarioNombre\":\"Planta Y\",\"origen\":\"Shanghai\",\"destino\":\"Guayaquil\"}'

# 3) Registrar un movimiento con coordenadas (usa el id del envío creado)
curl.exe -s -X POST http://localhost:3001/api/tracking-events -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{\"shipmentId\":\"ID_DEL_ENVIO\",\"estado\":\"en_transito\",\"ubicacion\":\"Callao\",\"lat\":-12.05,\"lng\":-77.15}'

# 4) Consultar el seguimiento PÚBLICO (sin sesión)
curl.exe -s http://localhost:3001/api/shipments/tracking/SUTL-XXXXXXXX

# 5) Listar órdenes de compra y la analítica
curl.exe -s http://localhost:3001/api/purchase-orders -H "Authorization: Bearer $TOKEN"
curl.exe -s http://localhost:3001/api/analytics/resumen -H "Authorization: Bearer $TOKEN"
```

La API pública para integrar con el sistema de un cliente (claves y webhooks por empresa) está en **Integraciones** y documentada en Swagger.

## 5. Qué decir de cada módulo (resumen para la conversación)

- **Seguimiento (tracking):** código de guía, estados, eventos con ubicación y mapa propio, página pública con la marca de cada empresa, tiempo real sin recargar y entre varias réplicas del servidor.
- **Supply Control:** órdenes de compra, recepción parcial y por entrega, cobertura de inventario, riesgo con semáforo, excepciones con plazo y escalamiento, tareas con responsable, torre de control.
- **Portales:** el proveedor confirma y despacha; el cliente final sigue lo suyo, comparte documentos y conversa.
- **Documentos:** checklist por operación, versiones, vencimientos con aviso por correo, compartir por casilla.
- **Analítica:** OTIF, lead time, aging y cumplimiento con metas por empresa y exportación a Excel.
- **Seguridad y multiempresa:** cada consulta filtra por empresa, roles con denegación por defecto para externos, segundo factor (con QR) obligatorio por política, bitácora, límites de peticiones, cifrado de secretos. Hay una red de pruebas que revisa que ninguna respuesta de la API devuelva contraseñas ni secretos.
- **Calidad:** cobertura de pruebas del 93,9 % de líneas (unitarias + punta a punta) y pruebas de navegador contra el sistema real.

## 6. Si algo no responde

| Síntoma | Qué hacer |
|---|---|
| «No se pudo conectar» al entrar | Revisa que el backend esté arriba: abre http://localhost:3001/api/docs. Si no, `.\scripts\levantar-demo.ps1`. |
| Docker no abre | Ábrelo a mano (Docker Desktop) y vuelve a correr el script. |
| Puerto 3001 o 3002 ocupado | `.\scripts\detener-demo.ps1` y vuelve a levantar. |
| No llegan correos a Mailpit | Mailpit es solo una bandeja de prueba: http://localhost:8025; revisa que el contenedor `sutl_mailpit` esté corriendo (`docker ps`). |
| Quiero empezar de cero | `.\scripts\detener-demo.ps1 -BorrarDatos` y luego `.\scripts\levantar-demo.ps1`. |
| Registros de lo que pasó | Carpeta `.demo-logs` (backend y frontend). |
