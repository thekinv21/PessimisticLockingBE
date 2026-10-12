import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { Role } from '@/shared/constants';
import { Endpoint } from '@/shared/decorators';
import { IntIdParamDto, PageDto, QueryDto } from '@/shared/dto';
import type { TCurrentUser } from '@/shared/types';

import { Auth, CurrentUser, PreAuthorize } from '@/module/auth/decorators';

import { CreatePostDto, UpdatePostDto } from './dto/request';
import { PostDto } from './dto/response';
import { PostService } from './PostService';

@Controller('/posts')
@Auth()
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @Endpoint({
    summary: 'Find posts with pagination',
    type: PostDto,
    isPaginated: true,
  })
  async findByPagination(@Query() query: QueryDto): Promise<PageDto<PostDto>> {
    return this.postService.findByPagination(query);
  }

  @Get('/:id')
  @Endpoint({ summary: 'Find a post by id', type: PostDto })
  async findByUnique(@Param() { id }: IntIdParamDto): Promise<PostDto> {
    return this.postService.findByUnique(id);
  }

  @Post()
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({ summary: 'Create a post', status: HttpStatus.CREATED })
  async create(
    @Body() dto: CreatePostDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.postService.create(dto, actor);
  }

  @Put('/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Update a post',
    description:
      'Rejected with 423 Locked while another user holds the edit lock.',
  })
  async update(
    @Param() { id }: IntIdParamDto,
    @Body() dto: UpdatePostDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.postService.update(id, dto, actor);
  }

  @Delete('/:id')
  @PreAuthorize(Role.OWNER, Role.ADMIN)
  @Endpoint({
    summary: 'Delete a post',
    description:
      'Rejected with 423 Locked while another user holds the edit lock.',
  })
  async delete(
    @Param() { id }: IntIdParamDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.postService.delete(id, actor);
  }
}
