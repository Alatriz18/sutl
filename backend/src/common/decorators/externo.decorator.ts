import { SetMetadata } from '@nestjs/common';

export const EXTERNO_KEY = 'accesoExterno';

// Marca un controlador o ruta como utilizable por usuarios externos (proveedor).
// Un proveedor NO entra a ninguna ruta que no esté marcada así o que no lo
// nombre en @Roles: es el único rol con acceso denegado por defecto.
export const Externo = () => SetMetadata(EXTERNO_KEY, true);
