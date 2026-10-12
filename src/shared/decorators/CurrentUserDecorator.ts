import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { Request } from 'express';

import type { TCurrentUser } from '../types';

export const CurrentUser = createParamDecorator(
  (field: keyof TCurrentUser | undefined, ctx: ExecutionContext) => {
    const { user } = ctx
      .switchToHttp()
      .getRequest<Request & { user?: TCurrentUser }>();

    return field ? user?.[field] : user;
  },
);
