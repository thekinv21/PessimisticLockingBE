import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { Request } from 'express';

import type { TJwtPayload } from '../types';

export const CurrentUser = createParamDecorator(
  (field: keyof TJwtPayload | undefined, ctx: ExecutionContext) => {
    const { user } = ctx
      .switchToHttp()
      .getRequest<Request & { user?: TJwtPayload }>();

    return field ? user?.[field] : user;
  },
);
