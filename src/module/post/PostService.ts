import { Injectable, NotFoundException } from '@nestjs/common';

import { LockResource } from '@/shared/constants';
import { PageDto, QueryDto } from '@/shared/dto';
import { PrismaService } from '@/shared/prisma';
import type { TCurrentUser } from '@/shared/types';

import { LockService } from '@/module/lock';

import { CreatePostDto, UpdatePostDto } from './dto/request';
import { PostDto } from './dto/response';

type TActor = Pick<TCurrentUser, 'sub'>;

@Injectable()
export class PostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lockService: LockService,
  ) {}

  /**
   * @param query QueryDto containing pagination parameters. The search term
   * matches the title; sortBy orders by the title.
   * @returns This operation will retrieve a page of PostDto
   */

  async findByPagination(query: QueryDto): Promise<PageDto<PostDto>> {
    const { offset, limit, searchTerm, sortBy } = query;

    const where = searchTerm
      ? { title: { contains: searchTerm, mode: 'insensitive' as const } }
      : {};

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: sortBy ? { title: sortBy } : { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return PageDto.of(posts, total, { offset, limit });
  }

  /**
   * @param id Unique identifier of the post
   * @returns This operation will retrieve a single PostDto
   */

  async findByUnique(id: number): Promise<PostDto> {
    const post = await this.prisma.post.findUnique({ where: { id } });

    if (!post) throw new NotFoundException('Post not found');

    return post;
  }

  /**
   * @param dto Post creation data
   * @param actor The signed-in user; becomes the author
   * @returns void
   */

  async create(dto: CreatePostDto, actor: TActor): Promise<void> {
    await this.prisma.post.create({
      data: {
        title: dto.title,
        description: dto.description,
        authorId: actor.sub,
        createdBy: actor.sub,
      },
    });
  }

  /**
   * @param id Unique identifier of the post
   * @param dto Post update data
   * @param actor The signed-in user performing the operation
   * @param lockToken Token of the edit lock held by the caller's tab
   * @returns void
   * @throws 423 Locked while another tab edits the post
   * @throws 428 Precondition Required when the caller does not hold the lock
   */

  async update(
    id: number,
    dto: UpdatePostDto,
    actor: TActor,
    lockToken?: string,
  ): Promise<void> {
    await this.lockService.guardWrite(
      { resource: LockResource.POST, id: String(id) },
      actor,
      lockToken,
      'updated',
      () =>
        this.prisma.post.update({
          where: { id },
          data: {
            title: dto.title,
            description: dto.description,
            updatedBy: actor.sub,
          },
        }),
    );
  }

  /**
   * @param id Unique identifier of the post
   * @param actor The signed-in user performing the operation
   * @param lockToken Token of the edit lock, when the caller's tab holds it
   * @returns void
   * @throws 423 Locked while another tab edits the post
   */

  async delete(id: number, actor: TActor, lockToken?: string): Promise<void> {
    await this.lockService.guardWrite(
      { resource: LockResource.POST, id: String(id) },
      actor,
      lockToken,
      'deleted',
      () => this.prisma.post.delete({ where: { id } }),
    );
  }
}
