import { CustomDecorator, SetMetadata } from '@nestjs/common';

import { Role } from '../constants';

export type TRoleName = (typeof Role)[keyof typeof Role];

export const ROLES_KEY = 'roles';

export const PreAuthorize = (...roles: TRoleName[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
