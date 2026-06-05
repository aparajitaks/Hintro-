import cron from 'node-cron';
import { prisma } from '../utils/db';
import { ResendService } from '../services/resend.service';
import { logger } from '../utils/logger';

/**
 * Checks for overdue action items, enforces idempotency limits,
 * and sends email reminder notifications.
 */
export async function processOverdueReminders() {
  logger.info('Cron Job: Starting overdue reminder scan');

  try {
    // 1. Fetch overdue action items
    const overdueItems = await prisma.actionItem.findMany({
      where: {
        status: { not: 'COMPLETED' },
        dueDate: { lt: new Date() }
      },
      include: {
        meeting: true
      }
    });

    logger.info(`Cron Job: Identified ${overdueItems.length} overdue action items.`);

    const todayStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    for (const item of overdueItems) {
      const idempotencyKey = `${item.id}:${todayStr}`;

      // Check if a reminder history entry already exists for today
      let history = await prisma.reminderHistory.findUnique({
        where: { idempotencyKey }
      });

      // Block if already sent
      if (history && history.status === 'SENT') {
        logger.info(`Reminder already sent for ActionItem ${item.id} today. Skipping.`);
        continue;
      }

      // Block if currently sending (IN_PROGRESS), with 5-minute timeout crash recovery
      if (history && history.status === 'IN_PROGRESS') {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (history.updatedAt > fiveMinutesAgo) {
          logger.info(`Reminder for ActionItem ${item.id} is currently sending (IN_PROGRESS). Skipping.`);
          continue;
        } else {
          logger.warn(`Reminder for ActionItem ${item.id} was stuck in IN_PROGRESS. Retrying as crashed job.`);
        }
      }

      // Block if failed and reached maximum retry threshold of 3 attempts
      if (history && history.status === 'FAILED' && history.retryCount >= 3) {
        logger.info(`Reminder for ActionItem ${item.id} reached maximum fail retries for today. Skipping.`);
        continue;
      }

      // Initial state: PENDING (meaning queued for execution)
      if (!history) {
        history = await prisma.reminderHistory.create({
          data: {
            actionItemId: item.id,
            status: 'PENDING',
            idempotencyKey,
            retryCount: 0
          }
        });
      } else {
        history = await prisma.reminderHistory.update({
          where: { id: history.id },
          data: {
            status: 'PENDING'
          }
        });
      }

      logger.info(`Reminder queued as PENDING for ActionItem ${item.id}`);

      // Transition immediately to IN_PROGRESS RIGHT BEFORE invoking the email API
      history = await prisma.reminderHistory.update({
        where: { id: history.id },
        data: {
          status: 'IN_PROGRESS',
          lastAttemptedAt: new Date()
        }
      });

      try {
        // Dispatch the email using Resend
        await ResendService.sendOverdueReminder(
          item.assignee,
          item.task,
          item.dueDate,
          item.meeting.title
        );

        // Transition to SENT on success
        await prisma.reminderHistory.update({
          where: { id: history.id },
          data: {
            status: 'SENT',
            errorDetails: null
          }
        });
        logger.info(`Reminder SENT successfully for ActionItem ${item.id}`);

      } catch (error: any) {
        const nextRetryCount = history.retryCount + 1;
        logger.error(`Failed to send reminder for ActionItem ${item.id}. Incrementing retry to ${nextRetryCount}`, {
          error: error.message
        });

        // Transition to FAILED and record error logs
        await prisma.reminderHistory.update({
          where: { id: history.id },
          data: {
            status: 'FAILED',
            retryCount: nextRetryCount,
            errorDetails: error.message || 'Unknown API send failure'
          }
        });
      }
    }
  } catch (err: any) {
    logger.error('Cron Job failed during process execution', { error: err.message });
  }
}

/**
 * Schedules the reminder cron task.
 */
export function startReminderJob() {
  const cronExpression = process.env.REMINDER_CRON || '*/5 * * * *';
  logger.info(`Cron Job: Initializing scheduler with expression "${cronExpression}"`);
  
  cron.schedule(cronExpression, async () => {
    await processOverdueReminders();
  });
}
