import { Controller } from '@nestjs/common';

import { Auth } from '@/module/auth/decorators';

import { PostService } from './PostService';

@Controller('/posts')
@Auth()
export class PostController {
  constructor(private readonly postService: PostService) {}
}
