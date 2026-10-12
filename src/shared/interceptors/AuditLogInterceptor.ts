import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { mergeMap, Observable } from 'rxjs';

import { AUDIT_FIELDS } from '../constants';
import { PrismaService } from '../prisma';

type TAuditRef = { record: Record<string, unknown>; field: string; id: string };

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        const refs = this.collect(result);

        if (!refs.length) return result;

        const users = await this.prisma.user.findMany({
          where: { id: { in: refs.map(({ id }) => id) } },
          select: { id: true, fullName: true },
        });

        const names = new Map(users.map((user) => [user.id, user.fullName]));

        refs.forEach(({ record, field, id }) => {
          record[field] = names.get(id) ?? id;
        });

        return result;
      }),
    );
  }

  private collect(value: unknown): TAuditRef[] {
    if (Array.isArray(value))
      return value.flatMap((item) => this.collect(item));

    if (!value || typeof value !== 'object' || value instanceof Date) return [];

    const record = value as Record<string, unknown>;

    return Object.entries(record).flatMap(([field, fieldValue]) => {
      if (!AUDIT_FIELDS.has(field)) return this.collect(fieldValue);

      return typeof fieldValue === 'string'
        ? [{ record, field, id: fieldValue }]
        : [];
    });
  }
}
