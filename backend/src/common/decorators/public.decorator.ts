import { SetMetadata } from '@nestjs/common';

// Marca un endpoint como accesible sin JWT (ej. portal público de tracking, login, register).
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
