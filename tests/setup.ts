import dotenv from 'dotenv';
import path from 'path';

// Force load test environment configurations
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

import { prisma } from '../src/utils/db';

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Delete all records in dependent order to enforce schema constraints
  await prisma.reminderHistory.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.transcriptSegment.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
