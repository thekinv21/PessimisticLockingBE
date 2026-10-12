import {
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  Post,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ZodSerializerInterceptor } from 'nestjs-zod';

import { PageDto } from '@/shared/dto';
import { ApiResponseInterceptor } from '@/shared/interceptors';

import { UserDto } from '@/module/user/dto/response';

import { Endpoint } from './EndpointDecorator';

const CREATED_AT = new Date('2026-01-02T03:04:05.000Z');

const row = {
  id: 'clh3am8hi0000qwer1234abcd',
  fullName: 'Test User',
  email: 'test@example.com',
  avatar: null,
  isActive: true,
  roles: [],
  createdAt: CREATED_AT,
  password: 'must-not-leak',
  tokenVersion: 7,
};

@Controller('/test')
class TestController {
  @Get('/one')
  @Endpoint({ summary: 'one', type: UserDto })
  one() {
    return row;
  }

  @Get('/list')
  @Endpoint({ summary: 'list', type: UserDto, isArray: true })
  list() {
    return [row];
  }

  @Get('/page')
  @Endpoint({ summary: 'page', type: UserDto, isPaginated: true })
  page() {
    return PageDto.of([row], 5, { offset: 0, limit: 1 });
  }

  @Post('/action')
  @Endpoint({ summary: 'action' })
  action() {}

  @Post('/create')
  @Endpoint({ summary: 'create', status: HttpStatus.CREATED })
  create() {}
}

describe('Endpoint serialization (HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.enableVersioning();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(() => app.close());

  const get = async (path: string) => {
    const response = await fetch(`${baseUrl}/v1/test${path}`);

    return { status: response.status, body: await response.json() };
  };

  it('strips fields missing from the DTO and encodes dates', async () => {
    const { status, body } = await get('/one');

    expect(status).toBe(200);
    expect(body.data.password).toBeUndefined();
    expect(body.data.tokenVersion).toBeUndefined();
    expect(body.data.createdAt).toBe(CREATED_AT.toISOString());
  });

  it('serializes every item of an array', async () => {
    const { body } = await get('/list');

    expect(body.data).toHaveLength(1);
    expect(body.data[0].password).toBeUndefined();
  });

  it('serializes page items and keeps the meta', async () => {
    const { body } = await get('/page');

    expect(body.data[0].password).toBeUndefined();
    expect(body.meta).toMatchObject({ total: 5, totalPages: 5, hasNext: true });
  });

  it('applies the documented status code', async () => {
    const action = await fetch(`${baseUrl}/v1/test/action`, { method: 'POST' });
    const create = await fetch(`${baseUrl}/v1/test/create`, { method: 'POST' });

    expect(action.status).toBe(200);
    expect((await action.json()).statusCode).toBe(200);
    expect(create.status).toBe(201);
  });
});
