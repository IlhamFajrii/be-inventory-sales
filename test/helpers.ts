import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createApp() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = mod.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function login(app: INestApplication, who: 'admin' | 'staf') {
  const creds = {
    admin: { email: 'admin@demo.test', password: 'Admin123!demo' },
    staf: { email: 'staf@demo.test', password: 'Staf123!demo' },
  }[who];
  const res = await request(app.getHttpServer()).post('/auth/login').send(creds).expect(200);
  return `Bearer ${res.body.accessToken as string}`;
}
