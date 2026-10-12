import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'argon2';
import 'dotenv/config';

import { Role, SEED_OWNER_EMAIL, SEED_PASSWORD } from '@/shared/constants';

import { PrismaClient } from './generated/prisma/client';

/**
 * Development seed: creates every role and one test user per role.
 * Idempotent; re-running resets the test users' password and roles.
 */

const ROLES = [
  { name: Role.OWNER, description: 'Full access to everything' },
  { name: Role.ADMIN, description: 'Manages users and roles' },
  { name: Role.MANAGER, description: 'Manager' },
  { name: Role.USER, description: 'Default role for registered users' },
];

const USERS = [
  { fullName: 'Owner User', email: SEED_OWNER_EMAIL, role: Role.OWNER },
  { fullName: 'Admin User', email: 'admin@example.com', role: Role.ADMIN },
  { fullName: 'Second Admin', email: 'admin2@example.com', role: Role.ADMIN },
  {
    fullName: 'Manager User',
    email: 'manager@example.com',
    role: Role.MANAGER,
  },
  { fullName: 'Regular User', email: 'user@example.com', role: Role.USER },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed test users in production');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const roleIds = new Map<string, string>();

    for (const { name, description } of ROLES) {
      const { id } = await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description },
      });

      roleIds.set(name, id);
    }

    const password = await hash(SEED_PASSWORD);

    for (const { fullName, email, role } of USERS) {
      const roleId = roleIds.get(role)!;

      await prisma.user.upsert({
        where: { email },
        update: {
          password,
          isActive: true,
          roles: { deleteMany: {}, create: [{ roleId }] },
        },
        create: { fullName, email, password, roles: { create: [{ roleId }] } },
      });
    }

    console.table(
      USERS.map(({ email, role }) => ({
        email,
        role,
        password: SEED_PASSWORD,
      })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
