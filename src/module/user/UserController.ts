import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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

import { CreateUserDto, UpdateUserDto } from './dto/request';
import { UserDto } from './dto/response';
import { UserService } from './UserService';

@Controller('/users')
@Auth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Find users with pagination',
    description: 'Returns a page of users with pagination meta.',
    type: UserDto,
    isPaginated: true,
  })
  async findByPagination(
    @Query() query: QueryDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<PageDto<UserDto>> {
    return this.userService.findByPagination(query, actor);
  }

  @Get('/all')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Find all users',
    description: 'Returns all users, optionally filtered by active status.',
    type: UserDto,
    isArray: true,
  })
  async findAll(
    @Query() query: FindIsActiveQueryDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<UserDto[]> {
    return this.userService.findAll(query, actor);
  }

  @Get('/me')
  @Endpoint({
    summary: 'Get current user profile',
    type: UserDto,
  })
  async findUserProfile(@CurrentUser() actor: TCurrentUser): Promise<UserDto> {
    return this.userService.findByUnique(actor.sub, actor);
  }

  @Get('/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Find a user by id',
    type: UserDto,
  })
  async findByUnique(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<UserDto> {
    return this.userService.findByUnique(id, actor);
  }

  @Post()
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Create a user',
    status: HttpStatus.CREATED,
  })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.userService.create(dto, actor);
  }

  @Put('/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Update a user',
    description:
      'Only the given fields change. When roles is provided the roles are replaced.',
  })
  async update(
    @Param() { id }: IdParamDto,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.userService.update(id, dto, actor);
  }

  @Patch('/:id/toggle')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Toggle user active status',
    description: 'Switches the user between active and inactive.',
  })
  async toggle(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.userService.toggle(id, actor);
  }

  @Delete('/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({ summary: 'Delete a user' })
  async delete(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.userService.delete(id, actor);
  }
}
