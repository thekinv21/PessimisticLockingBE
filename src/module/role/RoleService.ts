import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PROTECTED_ROLES, Role } from '@/shared/constants';
import { PageDto, QueryDto } from '@/shared/dto';
import { PrismaService } from '@/shared/prisma';
import type { TCurrentUser } from '@/shared/types';

import { CreateRoleDto, UpdateRoleDto } from './dto/request';
import { RoleDto } from './dto/response';

type TActor = Pick<TCurrentUser, 'sub' | 'roles'>;

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param isActive Optional filter to retrieve only active or inactive roles
   * @returns This operation will retrieve the list of RoleDto
   */

  async findAll(isActive?: boolean): Promise<RoleDto[]> {
    return this.prisma.role.findMany({
      where: { isActive },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * @param query QueryDto containing pagination parameters
   * @returns This operation will retrieve a page of RoleDto. The search term
   * matches the role name and sortBy orders by the role name.
   */

  async findByPagination(query: QueryDto): Promise<PageDto<RoleDto>> {
    const { offset, limit, searchTerm, sortBy, isActive } = query;

    const where = {
      isActive,
      ...(searchTerm && {
        name: { contains: searchTerm, mode: 'insensitive' as const },
      }),
    };

    const [roles, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        orderBy: sortBy ? { name: sortBy } : { createdAt: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.role.count({ where }),
    ]);

    return PageDto.of(roles, total, { offset, limit });
  }

  /**
   * @param id Unique identifier of the role
   * @returns This operation will retrieve a single RoleDto based on the
   * provided unique identifier
   */

  async findByUnique(id: string): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) throw new NotFoundException('Role not found');

    return role;
  }

  /**
   * @param body Role creation data
   * @returns void
   */

  async create(body: CreateRoleDto): Promise<void> {
    const existingRole = await this.prisma.role.findUnique({
      where: { name: body.name },
    });

    if (existingRole) {
      throw new ConflictException('Role already exists!');
    }

    await this.prisma.role.create({ data: body });
  }

  /**
   * @param id Unique identifier of the role
   * @param body Role update data
   * @param actor The signed-in user performing the operation
   * @returns void
   * @description Only OWNER may deactivate a protected role.
   */

  async update(
    id: string,
    { description, isActive }: UpdateRoleDto,
    actor: TActor,
  ): Promise<void> {
    const existing: RoleDto = await this.findByUnique(id);

    if (isActive === false) this.assertNotProtected(existing, actor);

    await this.prisma.role.update({
      where: { id },
      data: { description, isActive },
    });
  }

  /**
   * @param id Unique identifier of the role
   * @param actor The signed-in user performing the operation
   * @returns void
   * @description Only OWNER may deactivate a protected role.
   */

  async toggle(id: string, actor: TActor): Promise<void> {
    const existing = await this.findByUnique(id);

    if (existing.isActive) this.assertNotProtected(existing, actor);

    await this.prisma.role.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  /**
   * @param id Unique identifier of the role
   * @param actor The signed-in user performing the operation
   * @returns void
   * @description This operation will permanently delete the role from the
   * system. Use with caution. Only OWNER may delete a protected role.
   */

  async delete(id: string, actor: TActor): Promise<void> {
    const existing = await this.findByUnique(id);

    this.assertNotProtected(existing, actor);

    const assignedUserCount: number = await this.prisma.userRoles.count({
      where: { roleId: id },
    });

    if (assignedUserCount > 0) {
      throw new ConflictException(
        `This role assigned to ${assignedUserCount} user(s). Can't delete!`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
  }

  /**
   * @description Throws when a non-owner targets a role the system depends on
   * (OWNER, ADMIN, USER). Disabling one would lock every admin out or break
   * registration.
   */

  private assertNotProtected({ name }: RoleDto, actor: TActor): void {
    if (actor.roles.includes(Role.OWNER)) return;

    if (PROTECTED_ROLES.includes(name)) {
      throw new ForbiddenException(
        `The ${name} role is protected and cannot be deactivated or deleted.`,
      );
    }
  }
}
