/**
 * Seed de desenvolvimento: cria um ADMIN e um USER de exemplo, cada um com tarefas.
 * Executar com: npm run db:seed
 */
import { PrismaClient, Role, TaskPriority, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('Admin@12345', rounds),
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      name: 'Usuario Demo',
      email: 'user@example.com',
      passwordHash: await bcrypt.hash('User@12345', rounds),
      role: Role.USER,
    },
  });

  const existing = await prisma.task.count({ where: { ownerId: user.id } });
  if (existing === 0) {
    await prisma.task.createMany({
      data: [
        {
          title: 'Configurar pipeline de CI',
          description: 'Rodar lint, typecheck e testes a cada push.',
          status: TaskStatus.PENDING,
          priority: TaskPriority.HIGH,
          ownerId: user.id,
        },
        {
          title: 'Revisar indices do banco',
          description: 'Validar planos de execucao das consultas mais usadas.',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.MEDIUM,
          ownerId: user.id,
        },
        {
          title: 'Documentar endpoints no Swagger',
          status: TaskStatus.DONE,
          priority: TaskPriority.LOW,
          ownerId: user.id,
        },
      ],
    });
  }

  console.log('Seed concluido:');
  console.log(`  ADMIN -> ${admin.email} / Admin@12345`);
  console.log(`  USER  -> ${user.email} / User@12345`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
