import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// Errores del parser de Express (cuerpo demasiado grande, JSON mal formado…)
// no son HttpException pero traen su propio código 4xx: se respetan en vez de
// convertirlos en un 500.
const MENSAJES_4XX: Record<number, string> = {
  400: 'Solicitud inválida',
  413: 'El cuerpo de la petición es demasiado grande',
  415: 'Tipo de contenido no soportado',
};

function estado4xxDelParser(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const e = exception as { status?: unknown; statusCode?: unknown };
  const status = e.status ?? e.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : { statusCode: status, ...(body as Record<string, unknown>) },
      );
      return;
    }

    const status4xx = estado4xxDelParser(exception);
    if (status4xx) {
      response.status(status4xx).json({
        statusCode: status4xx,
        message: MENSAJES_4XX[status4xx] ?? MENSAJES_4XX[400],
      });
      return;
    }

    // Error inesperado: el cliente no ve el detalle, pero queda en el log del
    // servidor para poder diagnosticarlo.
    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor' });
  }
}
