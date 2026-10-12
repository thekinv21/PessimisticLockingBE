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
import { Auth, CurrentUser, Endpoint, PreAuthorize } from '@/shared/decorators';
import {
  FindIsActiveQueryDto,
  IdParamDto,
  PageDto,
  QueryDto,
} from '@/shared/dto';
import type { TJwtPayload } from '@/shared/types';

import { CreateUserDto, UpdateUserDto } from './dto/request';
import { UserDto } from './dto/response';
import { UserService } from './UserService';

@Controller('/users')
@Auth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/find-all')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Find all users',
    description: 'Returns all users, optionally filtered by active status.',
    type: UserDto,
    isArray: true,
  })
  async findAll(
    @Query() query: FindIsActiveQueryDto,
    @CurrentUser() actor: TJwtPayload,
  ): Promise<UserDto[] | undefined> {
    return this.userService.findAll(query, actor);
  }

  @Get('/find-by-pagination')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Find users with pagination',
    description: 'Returns a page of users with pagination meta.',
    type: UserDto,
    isPaginated: true,
  })
  async findByPagination(
    @Query() query: QueryDto,
    @CurrentUser() actor: TJwtPayload,
  ): Promise<PageDto<UserDto> | undefined> {
    return this.userService.findByPagination(query, actor);
  }

  @Get('/find-by-unique/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Find a user by id',
    type: UserDto,
  })
  async findByUnique(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TJwtPayload,
  ): Promise<UserDto | undefined> {
    return this.userService.findByUnique(id, actor);
  }

  @Get('/me')
  @Endpoint({
    summary: 'Get current user profile',
    type: UserDto,
  })
  async findUserProfile(
    @CurrentUser() actor: TJwtPayload,
  ): Promise<UserDto | undefined> {
    return this.userService.findByUnique(actor.sub, actor);
  }

  @Post()
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Create a user',
    status: HttpStatus.CREATED,
  })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: TJwtPayload,
  ): Promise<void> {
    await this.userService.create(dto, actor);
  }

  @Put()
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({ summary: 'Update a user' })
  async update(
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: TJwtPayload,
  ): Promise<void> {
    await this.userService.update(dto, actor);
  }

  @Patch('/toggle/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Toggle user active status',
    description: 'Switches the user between active and inactive.',
  })
  async toggle(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TJwtPayload,
  ): Promise<void> {
    await this.userService.toggle(id, actor);
  }

  @Delete('/delete/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({ summary: 'Delete a user' })
  async delete(
    @Param() { id }: IdParamDto,
    @CurrentUser() actor: TJwtPayload,
  ): Promise<void> {
    await this.userService.delete(id, actor);
  }
}
