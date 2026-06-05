import { Resend } from 'resend';
import { logger } from '../utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

export class ResendService {
  /**
   * Dispatches an overdue reminder email via Resend.
   * Falls back to console output if keys are missing/mocked.
   * 
   * @param email Recipient email address
   * @param task Task description
   * @param dueDate Due date of task
   * @param meetingTitle Title of associated meeting
   * @returns boolean representing success
   */
  static async sendOverdueReminder(
    email: string,
    task: string,
    dueDate: Date,
    meetingTitle: string
  ): Promise<boolean> {
    const sender = process.env.SENDER_EMAIL || 'onboarding@resend.dev';
    const recipient = email.trim();

    const isApiKeyMock = 
      !process.env.RESEND_API_KEY || 
      process.env.RESEND_API_KEY === 'mock-key-if-not-provided' || 
      process.env.RESEND_API_KEY.startsWith('your-') ||
      process.env.RESEND_API_KEY.includes('key');

    if (isApiKeyMock) {
      logger.info('[MOCKED EMAIL DISPATCH]', {
        from: sender,
        to: recipient,
        subject: `Overdue Action Item: ${task}`,
        body: `Reminder: ${task}\nAssigned To: ${recipient}\nDue Date: ${dueDate.toISOString()}\nMeeting: ${meetingTitle}`
      });
      return true;
    }

    try {
      logger.info('Dispatching email notification via Resend', { recipient, task });
      
      const { data, error } = await resend.emails.send({
        from: sender,
        to: recipient,
        subject: `Overdue Action Item: ${task}`,
        text: `Reminder: ${task}\n\nAssigned To: ${recipient}\nDue Date: ${dueDate.toISOString()}\nMeeting: ${meetingTitle}\n\nPlease resolve this task and update its status.`,
      });

      if (error) {
        logger.error('Resend API returned sending error', { error });
        throw new Error(error.message);
      }

      logger.info('Email successfully sent', { messageId: data?.id });
      return true;
    } catch (err: any) {
      logger.error('Resend Service sending failed', { error: err.message });
      throw err;
    }
  }
}
