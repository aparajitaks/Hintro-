import { processOverdueReminders } from '../src/jobs/reminder.job';
import { ResendService } from '../src/services/resend.service';
import { prisma } from '../src/utils/db';

describe('Overdue Reminder Job Integration Tests', () => {
  let userId: string;
  let meetingId: string;
  let actionItemId: string;

  beforeEach(async () => {
    // Seed user
    const user = await prisma.user.create({
      data: {
        email: 'scheduler@example.com',
        passwordHash: 'dummy-hash'
      }
    });
    userId = user.id;

    // Seed meeting
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Overdue Standup',
        meetingDate: new Date(),
        participants: ['assignee@test.com'], // Pass array directly
        ownerId: userId
      }
    });
    meetingId = meeting.id;

    // Seed overdue action item (dueDate is 1 hour ago)
    const overdueItem = await prisma.actionItem.create({
      data: {
        task: 'Fix critical production bug',
        assignee: 'assignee@test.com',
        status: 'PENDING',
        dueDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        meetingId,
        citations: [], // Pass array directly
        creatorId: userId
      }
    });
    actionItemId = overdueItem.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should send reminder and log status as SENT on first execution', async () => {
    const sendSpy = jest.spyOn(ResendService, 'sendOverdueReminder');

    await processOverdueReminders();

    // Verify Resend was invoked
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // Verify DB entry
    const todayStr = new Date().toISOString().split('T')[0];
    const expectedKey = `${actionItemId}:${todayStr}`;

    const history = await prisma.reminderHistory.findUnique({
      where: { idempotencyKey: expectedKey }
    });

    expect(history).not.toBeNull();
    expect(history!.status).toBe('SENT');
    expect(history!.retryCount).toBe(0);
  });

  it('should skip sending and respect idempotency if a reminder was already SENT today', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const expectedKey = `${actionItemId}:${todayStr}`;

    // Seed a SENT record beforehand
    await prisma.reminderHistory.create({
      data: {
        actionItemId,
        status: 'SENT',
        idempotencyKey: expectedKey
      }
    });

    const sendSpy = jest.spyOn(ResendService, 'sendOverdueReminder');

    await processOverdueReminders();

    // Should NOT send again
    expect(sendSpy).toHaveBeenCalledTimes(0);
  });

  it('should skip sending if a reminder is currently IN_PROGRESS (lock window)', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const expectedKey = `${actionItemId}:${todayStr}`;

    // Seed an IN_PROGRESS record updated just now
    await prisma.reminderHistory.create({
      data: {
        actionItemId,
        status: 'IN_PROGRESS',
        idempotencyKey: expectedKey,
        updatedAt: new Date()
      }
    });

    const sendSpy = jest.spyOn(ResendService, 'sendOverdueReminder');

    await processOverdueReminders();

    // Should NOT send
    expect(sendSpy).toHaveBeenCalledTimes(0);
  });

  it('should recover and retry if a reminder was stuck in IN_PROGRESS (older than 5 minutes)', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const expectedKey = `${actionItemId}:${todayStr}`;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Seed stuck IN_PROGRESS record
    const stuckHistory = await prisma.reminderHistory.create({
      data: {
        actionItemId,
        status: 'IN_PROGRESS',
        idempotencyKey: expectedKey,
        updatedAt: tenMinutesAgo,
        createdAt: tenMinutesAgo
      }
    });

    // We must manually overwrite updatedAt because Prisma updates it on creation
    await prisma.reminderHistory.update({
      where: { id: stuckHistory.id },
      data: { updatedAt: tenMinutesAgo }
    });

    const sendSpy = jest.spyOn(ResendService, 'sendOverdueReminder');

    await processOverdueReminders();

    // Should trigger retry send
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const updatedHistory = await prisma.reminderHistory.findUnique({
      where: { idempotencyKey: expectedKey }
    });
    expect(updatedHistory!.status).toBe('SENT');
  });

  it('should transition through PENDING and IN_PROGRESS states correctly and capture failures', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const expectedKey = `${actionItemId}:${todayStr}`;

    // Force Resend API to fail to test failure updates
    jest.spyOn(ResendService, 'sendOverdueReminder').mockRejectedValueOnce(new Error('Resend Service Outage'));

    await processOverdueReminders();

    const history = await prisma.reminderHistory.findUnique({
      where: { idempotencyKey: expectedKey }
    });

    expect(history).not.toBeNull();
    expect(history!.status).toBe('FAILED');
    expect(history!.retryCount).toBe(1);
    expect(history!.errorDetails).toBe('Resend Service Outage');
  });
});
