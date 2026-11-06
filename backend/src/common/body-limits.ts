import { INestApplication } from '@nestjs/common';
import { json } from 'express';

// Las importaciones masivas (Excel/CSV) envían miles de filas en un solo JSON
// y superan el límite por defecto de Express (100 kb). Solo estas rutas
// aceptan hasta 5 MB; el resto de la API conserva el límite por defecto.
// Debe llamarse antes de app.init()/listen(): este parser queda antes que el
// de Nest y, al leer el cuerpo primero, el parser por defecto lo omite.
export const RUTAS_IMPORTACION = ['/api/purchase-orders/importar', '/api/inventory-policies/importar'];
export const LIMITE_IMPORTACION = '5mb';

export function configurarLimitesImportacion(app: INestApplication) {
  const parser = json({ limit: LIMITE_IMPORTACION });
  // OJO: Nest decide si ya hay un parser JSON mirando el NOMBRE de la función
  // del middleware ("jsonParser", que es como se llama el de Express). Si se
  // montara directo, Nest creería que el parser global ya está aplicado y no
  // lo registraría: el resto de la API dejaría de leer el cuerpo. Por eso se
  // envuelve en una función anónima.
  app.use(RUTAS_IMPORTACION, (req: unknown, res: unknown, next: unknown) =>
    (parser as unknown as (a: unknown, b: unknown, c: unknown) => void)(req, res, next),
  );
}
