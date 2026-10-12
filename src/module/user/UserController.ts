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
import { Auth, Endpoint, PreAuthorize } from '@/shared/decorators';
import {
  FindIsActiveQueryDto,
  IdParamDto,
  PageDto,
  QueryDto,
} from '@/shared/dto';

import { CreateUserDto, UpdateUserDto } from './dto/request';
import { UserDto } from './dto/response';
import { UserService } from './UserService';

@Controller('/users')
@Auth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/find-all')
  @PreAuthorize(Role.ADMIN)
  @Endpoint({
    summary: 'Find all users',
    description: 'Returns all users, optionally filtered by active status.',
    type: UserDto,
    isArray: true,
  })
  async findAll(
    @Query() query: FindIsActiveQueryDto,
  ): Promise<UserDto[] | undefined> {
    return this.userService.findAll(query);
  }

  @Get('/find-by-pagination')
  @PreAuthorize(Role.ADMIN)
  @Endpoint({
    summary: 'Find users with pagination',
    description: 'Returns a page of users with pagination meta.',
    type: UserDto,
    isPaginated: true,
  })
  async findByPagination(
    @Query() query: QueryDto,
  ): Promise<PageDto<UserDto> | undefined> {
    return this.userService.findByPagination(query);
  }

  @Get('/find-by-unique/:id')
  @PreAuthorize(Role.ADMIN)
  @Endpoint({
    summary: 'Find a user by id',
    type: UserDto,
  })
  async findByUnique(
    @Param() { id }: IdParamDto,
  ): Promise<UserDto | undefined> {
    return this.userService.findByUnique(id);
  }

  @Post()
  @PreAuthorize(Role.ADMIN)
  @Endpoint({
    summary: 'Create a user',
    status: HttpStatus.CREATED,
  })
  async create(@Body() dto: CreateUserDto): Promise<void> {
    await this.userService.create(dto);
  }

  @Put()
  @PreAuthorize(Role.ADMIN)
  @Endpoint({ summary: 'Update a user' })
  async update(@Body() dto: UpdateUserDto): Promise<void> {
    await this.userService.update(dto);
  }

  @Patch('/toggle/:id')
  @PreAuthorize(Role.ADMIN)
  @Endpoint({
    summary: 'Toggle user active status',
    description: 'Switches the user between active and inactive.',
  })
  async toggle(@Param() { id }: IdParamDto): Promise<void> {
    await this.userService.toggle(id);
  }

  @Delete('/delete/:id')
  @PreAuthorize(Role.ADMIN)
  @Endpoint({ summary: 'Delete a user' })
  async delete(@Param() { id }: IdParamDto): Promise<void> {
    await this.userService.delete(id);
  }
}
