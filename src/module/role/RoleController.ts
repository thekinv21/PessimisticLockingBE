import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Role } from '@/shared/constants';
import { Endpoint } from '@/shared/decorators';
import {
  FindIsActiveQueryDto,
  IdParamDto,
  PageDto,
  QueryDto,
} from '@/shared/dto';
import type { TCurrentUser } from '@/shared/types';

import { Auth, CurrentUser, PreAuthorize } from '@/module/auth/decorators';

import { CreateRoleDto, UpdateRoleDto } from './dto/request';
import { RoleDto } from './dto/response';
import { RoleService } from './RoleService';

/**
 * Static routes (/all) are declared before /:id so they are matched first.
 */

@Controller('/roles')
@Auth()
@PreAuthorize(Role.OWNER, Role.ADMIN)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @Endpoint({
    summary: 'Get roles with pagination',
    description:
      'This operation will retrieve roles with pagination support and an optional search term.',
    type: RoleDto,
    isPaginated: true,
  })
  async findByPagination(@Query() query: QueryDto): Promise<PageDto<RoleDto>> {
    return this.roleService.findByPagination(query);
  }

  @Get('/all')
  @Endpoint({
    summary: 'Get all roles',
    description: 'This operation will retrieve all roles in the system.',
    type: RoleDto,
    isArray: true,
  })
  async findAll(@Query() query: FindIsActiveQueryDto): Promise<RoleDto[]> {
    return this.roleService.findAll(query.isActive);
  }

  @Get('/:id')
  @Endpoint({
    summary: 'Get role by unique identifier',
    description:
      'This operation will retrieve a role based on its unique identifier.',
    type: RoleDto,
  })
  async findByUnique(@Param() { id }: IdParamDto): Promise<RoleDto> {
    return this.roleService.findByUnique(id);
  }

  @Post()
  @Endpoint({
    summary: 'Create a new role',
    description:
      'This operation will create a new role in the system. You need to provide a unique name and a description for the role.',
    status: HttpStatus.CREATED,
  })
  async create(@Body() body: CreateRoleDto): Promise<void> {
    await this.roleService.create(body);
  }

  @Patch('/:id')
  @Endpoint({
    summary: 'Update an existing role',
    description:
      "This operation will update the details of an existing role. You can modify the role's description and active status; the name cannot change.",
  })
  async update(
    @Param() { id }: IdParamDto,
    @Body() body: UpdateRoleDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.roleService.update(id, body, actor);
  }

  @Patch('/:id/toggle')
  @Endpoint({
    summary: 'Toggle role active status',
    description:
      'This operation will toggle the active status of the role. If the role is currently active, it will be deactivated, and vice versa.',
  })
  async toggle(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.roleService.toggle(id, actor);
  }

  @Delete('/:id')
  @Endpoint({
    summary: 'Delete a role',
    description:
      'This operation will permanently delete the role from the system. Use with caution.',
  })
  async delete(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.roleService.delete(id, actor);
  }
}
