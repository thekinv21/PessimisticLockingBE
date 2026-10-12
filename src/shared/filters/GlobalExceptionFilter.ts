import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';

import { Prisma } from '@/prisma/generated/client';

import type { TApiErrorDetail, TApiErrorResponse } from '../types';

const VALIDATION_MESSAGE = 'Validation failed';
const INTERNAL_MESSAGE = 'Internal server error';

/**
 * Prisma errors caused by the request rather than the server, e.g. a
 * concurrent insert hitting a unique constraint.
 */

const PRISMA_ERRORS: Record<string, () => HttpException> = {
  P2002: () => new ConflictException('Resource already exists'),
  P2003: () =>
    new ConflictException('Referenced resource is missing or still in use'),
  P2025: () => new NotFoundException('Resource not found'),
};

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name);

  catch(rawException: unknown, host: ArgumentsHost): void {
    const exception = this.mapPrismaError(rawException);
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const { message, errors } = this.extractMessage(exception);

    const body: TApiErrorResponse = {
      path: request.url,
      timestamp: new Date().toISOString(),
      success: false,
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      ...(errors && { errors }),
    };

    response.status(statusCode).json(body);
  }

  private mapPrismaError(exception: unknown): unknown {
    if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
      return exception;
    }

    return PRISMA_ERRORS[exception.code]?.() ?? exception;
  }

  private extractMessage(exception: unknown): {
    message: string;
    errors?: TApiErrorDetail[];
  } {
    if (!(exception instanceof HttpException)) {
      return { message: INTERNAL_MESSAGE };
    }

    const res = exception.getResponse();

    if (typeof res === 'string') return { message: res };

    const raw = (res as { message?: unknown }).message;

    if (Array.isArray(raw)) {
      return {
        message: VALIDATION_MESSAGE,
        errors: raw.map((item: unknown) =>
          typeof item === 'string'
            ? { message: item }
            : (item as TApiErrorDetail),
        ),
      };
    }

    return { message: typeof raw === 'string' ? raw : exception.message };
  }
}
