import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { hash } from 'argon2';

import { Role, RoleRank } from '@/shared/constants';
import { FindIsActiveQueryDto, PageDto, QueryDto } from '@/shared/dto';
import { PrismaService } from '@/shared/prisma';
import { TCurrentUser } from '@/shared/types';

import type { Prisma } from '../../../prisma/generated/prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto/request';
import { UserDto } from './dto/response';

type TActor = Pick<TCurrentUser, 'sub' | 'roles'>;

type TCreateAccount = Omit<CreateUserDto, 'roles'> & {
  roleIds: string[];
  assignedBy?: string;
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param query Optional isActive filter
   * @param actor The signed-in user; excluded from the list. OWNER users are
   * hidden from non-owners
   * @returns This operation will retrieve the list of UserDto
   */

  async findAll(
    { isActive }: FindIsActiveQueryDto,
    actor: TActor,
  ): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive, id: { not: actor.sub }, ...this.visibleTo(actor) },
      include: {
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
      omit: {
        password: true,
        tokenVersion: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => ({
      ...user,
      roles: user.roles.map(({ role }) => role),
    }));
  }

  /**
   * @param query QueryDto containing pagination parameters. The search term
   * matches first name, last name and email; sortBy orders by email.
   * @param actor The signed-in user; excluded from the list. OWNER users are
   * hidden from non-owners
   * @returns This operation will retrieve a page of UserDto
   */

  async findByPagination(
    query: QueryDto,
    actor: TActor,
  ): Promise<PageDto<UserDto>> {
    const { offset, limit, searchTerm, sortBy, isActive } = query;

    const where = {
      isActive,
      id: { not: actor.sub },
      ...this.visibleTo(actor),
      ...(searchTerm && {
        OR: [
          { fullName: { contains: searchTerm, mode: 'insensitive' as const } },
          { email: { contains: searchTerm, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          roles: { select: { role: { select: { id: true, name: true } } } },
        },
        omit: {
          password: true,
          tokenVersion: true,
        },
        orderBy: sortBy ? { email: sortBy } : { createdAt: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return PageDto.of(
      users.map((user) => ({
        ...user,
        roles: user.roles.map(({ role }) => role),
      })),
      total,
      { offset, limit },
    );
  }

  /**
   * @param id Unique identifier of the user
   * @param actor The signed-in user; an OWNER user is reported as not found
   * to non-owners
   * @returns This operation will retrieve a single UserDto
   */

  async findByUnique(id: string, actor: TActor): Promise<UserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, ...this.visibleTo(actor) },
      include: {
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
      omit: {
        password: true,
        tokenVersion: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      ...user,
      roles: user.roles.map(({ role }) => role),
    };
  }

  /**
   * @param dto User creation data
   * @param actor The signed-in user performing the operation
   * @returns void
   * @description The actor may only assign roles ranked below their own.
   */

  async create(dto: CreateUserDto, actor: TActor): Promise<void> {
    const { roles, ...data } = dto;

    await this.assertCanAssignRoles(actor, roles);

    await this.createAccount({
      ...data,
      roleIds: roles.map(({ id }) => id),
      assignedBy: actor.sub,
    });
  }

  /**
   * @param data Account data with the role ids to assign
   * @returns void
   * @description Performs no authorization checks; callers decide the roles.
   */

  async createAccount(data: TCreateAccount): Promise<void> {
    const { fullName, email, avatar, isActive, password, roleIds, assignedBy } =
      data;

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) throw new ConflictException('Email already in use!');

    await this.prisma.user.create({
      data: {
        fullName,
        email,
        password: await hash(password),
        isActive,
        avatar,
        roles: {
          create: [...new Set(roleIds)].map((roleId) => ({
            roleId,
            assignedBy,
          })),
        },
      },
    });
  }

  /**
   * @param dto User update data. When roles is provided, the user's roles
   * are replaced with the given set.
   * @param actor The signed-in user performing the operation
   * @returns void
   * @description Bumps tokenVersion, revoking the user's tokens. Only OWNER
   * may change their own roles or deactivate themselves.
   */

  async update(dto: UpdateUserDto, actor: TActor): Promise<void> {
    const { id, fullName, email, avatar, isActive, roles } = dto;

    if (id === actor.sub && !this.isOwner(actor)) {
      if (roles || isActive === false) {
        throw new ForbiddenException(
          'You cannot change your own roles or deactivate your own account.',
        );
      }

      await this.findByUnique(id, actor);
    } else {
      await this.assertCanManage(actor, id);
    }

    if (roles) await this.assertCanAssignRoles(actor, roles);

    if (email) {
      const taken = await this.prisma.user.findFirst({
        where: { email, id: { not: id } },
        select: { id: true },
      });

      if (taken) throw new ConflictException('Email already in use!');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        fullName,
        email,
        avatar,
        isActive,
        tokenVersion: { increment: 1 },
        roles: roles && {
          deleteMany: {},
          create: roles.map(({ id: roleId }) => ({
            roleId,
            assignedBy: actor.sub,
          })),
        },
      },
    });
  }

  /**
   * @param id Unique identifier of the user
   * @param actor The signed-in user performing the operation
   * @returns void
   */

  async toggle(id: string, actor: TActor): Promise<void> {
    this.assertNotSelf(id, actor);

    const existing = await this.assertCanManage(actor, id);

    const { count } = await this.prisma.user.updateMany({
      where: { id, isActive: existing.isActive },
      data: { isActive: !existing.isActive, tokenVersion: { increment: 1 } },
    });

    if (!count) {
      throw new ConflictException('User was modified concurrently, retry');
    }
  }

  /**
   * @param id Unique identifier of the user
   * @param actor The signed-in user performing the operation
   * @returns void
   * @description This operation will permanently delete the user; their role
   * assignments are removed by the database cascade.
   */

  async delete(id: string, actor: TActor): Promise<void> {
    this.assertNotSelf(id, actor);

    await this.assertCanManage(actor, id);

    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * @description Throws when a non-owner targets their own account.
   */

  private assertNotSelf(id: string, actor: TActor): void {
    if (id === actor.sub && !this.isOwner(actor)) {
      throw new ForbiddenException(
        'You cannot deactivate or delete your own account.',
      );
    }
  }

  /**
   * @returns The target user
   * @description OWNER may manage anyone; everyone else may only manage users
   * whose highest role (active or not) ranks below their own. OWNER users are
   * reported as not found to non-owners, so their existence is not revealed.
   */

  private async assertCanManage(actor: TActor, targetId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, ...this.visibleTo(actor) },
      select: {
        isActive: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });

    if (!target) throw new NotFoundException('User not found');

    const targetRank = this.highestRank(
      target.roles.map(({ role }) => role.name),
    );

    if (!this.isOwner(actor) && targetRank >= this.highestRank(actor.roles)) {
      throw new ForbiddenException(
        'You cannot manage a user with an equal or higher role.',
      );
    }

    return target;
  }

  /**
   * @description Verifies the roles exist and that the actor outranks every
   * one of them. OWNER may assign any role.
   */

  private async assertCanAssignRoles(
    actor: TActor,
    roles: CreateUserDto['roles'],
  ): Promise<void> {
    const ids = roles.map(({ id }) => id);

    const existing = await this.prisma.role.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });

    const existingIds = new Set(existing.map(({ id }) => id));
    const missing = ids.filter((id) => !existingIds.has(id));

    if (missing.length) {
      throw new BadRequestException(`Roles not found: ${missing.join(', ')}`);
    }

    if (this.isOwner(actor)) return;

    const actorRank = this.highestRank(actor.roles);
    const forbidden = existing.filter(
      ({ name }) => (RoleRank[name] ?? 0) >= actorRank,
    );

    if (forbidden.length) {
      throw new ForbiddenException(
        `You cannot assign roles: ${forbidden.map(({ name }) => name).join(', ')}`,
      );
    }
  }

  /**
   * @description Where-clause that hides users holding the OWNER role (active
   * or not) from everyone except owners.
   */

  private visibleTo(actor: TActor): Prisma.UserWhereInput {
    if (this.isOwner(actor)) return {};

    return { roles: { none: { role: { name: Role.OWNER } } } };
  }

  private isOwner(actor: TActor): boolean {
    return actor.roles.includes(Role.OWNER);
  }

  private highestRank(roleNames: string[]): number {
    return Math.max(0, ...roleNames.map((name) => RoleRank[name] ?? 0));
  }
}
