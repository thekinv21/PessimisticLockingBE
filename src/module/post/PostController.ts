import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { LOCK_TOKEN_HEADER } from '@/shared/constants';
import { Endpoint } from '@/shared/decorators';
import { IntIdParamDto, PageDto, QueryDto } from '@/shared/dto';
import type { TCurrentUser } from '@/shared/types';

import { Auth, CurrentUser } from '@/module/auth/decorators';

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
  @Endpoint({ summary: 'Create a post', status: HttpStatus.CREATED })
  async create(
    @Body() dto: CreatePostDto,
    @CurrentUser() actor: TCurrentUser,
  ): Promise<void> {
    await this.postService.create(dto, actor);
  }

  @Put('/:id')
  @Endpoint({
    summary: 'Update a post',
    description:
      'Send the token from `lock:acquire` in the X-Lock-Token header. ' +
      'Rejected with 423 Locked while another tab holds the edit lock and ' +
      '428 Precondition Required when the caller does not hold it.',
  })
  async update(
    @Param() { id }: IntIdParamDto,
    @Body() dto: UpdatePostDto,
    @CurrentUser() actor: TCurrentUser,
    @Headers(LOCK_TOKEN_HEADER) lockToken?: string,
  ): Promise<void> {
    await this.postService.update(id, dto, actor, lockToken);
  }

  @Delete('/:id')
  @Endpoint({
    summary: 'Delete a post',
    description:
      'Rejected with 423 Locked while another tab holds the edit lock, ' +
      'unless its token is sent in the X-Lock-Token header.',
  })
  async delete(
    @Param() { id }: IntIdParamDto,
    @CurrentUser() actor: TCurrentUser,
    @Headers(LOCK_TOKEN_HEADER) lockToken?: string,
  ): Promise<void> {
    await this.postService.delete(id, actor, lockToken);
  }
}
