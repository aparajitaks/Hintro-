import dotenv from 'dotenv';

// Load environment configurations from .env
dotenv.config();

import app from './app';
import { startReminderJob } from './jobs/reminder.job';
import { logger } from './utils/logger';
import { prisma } from './utils/db';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // 1. Establish database connection
    await prisma.$connect();
    logger.info('Database connection verified successfully.');

    // 2. Initialize scheduled cron job for overdue action items
    startReminderJob();

    // 3. Start the Express server listener
    app.listen(PORT, () => {
      logger.info(`Server successfully started on port ${PORT}`);
      logger.info(`OpenAPI Swagger documentation live at http://localhost:${PORT}/api-docs`);
    });
  } catch (error: any) {
    logger.error('Bootstrapping failed. Terminating process.', { error: error.message });
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
