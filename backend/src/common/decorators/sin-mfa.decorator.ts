import { SetMetadata } from '@nestjs/common';

export const SIN_MFA_KEY = 'sinMfa';

// Rutas que una cuenta a la que se le exige el segundo factor puede usar ANTES de activarlo:
// justamente las que sirven para activarlo (y cerrar sesión). Todo lo demás se le bloquea.
export const SinMfa = () => SetMetadata(SIN_MFA_KEY, true);
