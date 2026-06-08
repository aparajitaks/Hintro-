import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { sendSuccess } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { AIService } from './../services/ai.service';
import { z } from 'zod';

export const analyzeMeetingSchema = {
  params: z.object({
    id: z.string().uuid('Invalid meeting ID format')
  })
};

export async function analyzeMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // 1. Fetch meeting and segments
    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId: userId },
      include: {
        transcript: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      }
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found or not owned by you');
    }

    if (meeting.transcript.length === 0) {
      throw new Error('Cannot analyze a meeting with an empty transcript');
    }

    // 2. Perform AI transcript analysis with two-layer grounding validation
    const analysisResult = await AIService.analyzeTranscript(
      meeting.id,
      meeting.title,
      meeting.transcript,
      Array.isArray(meeting.participants) ? (meeting.participants as string[]) : []
    );

    // 3. Save findings in transaction
    const savedData = await prisma.$transaction(async (tx) => {
      // Clean up previous analyses and generated action items for this meeting to prevent duplicates
      await tx.analysis.deleteMany({
        where: { meetingId: meeting.id }
      });

      await tx.actionItem.deleteMany({
        where: { meetingId: meeting.id }
      });

      // Insert Analysis
      const analysis = await tx.analysis.create({
        data: {
          meetingId: meeting.id,
          summary: analysisResult.summary, // Pass as native JSON
          decisions: analysisResult.decisions, // Pass as native JSON
          followUps: analysisResult.followUps // Pass as native JSON
        }
      });

      // Insert ActionItems (assign due dates 7 days in the future from meetingDate)
      const defaultDueDate = new Date(meeting.meetingDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      const actionItems = await Promise.all(
        analysisResult.actionItems.map((item) => {
          return tx.actionItem.create({
            data: {
              task: item.task,
              assignee: item.assignee.toLowerCase().trim(),
              citations: item.citations, // Pass as native JSON
              status: 'PENDING',
              dueDate: defaultDueDate,
              meetingId: meeting.id,
              creatorId: userId
            }
          });
        })
      );

      return { analysis, actionItems };
    });

    // Format output matching requirements
    const formattedPayload = {
      summary: analysisResult.summary,
      decisions: analysisResult.decisions,
      followUps: analysisResult.followUps,
      actionItems: savedData.actionItems.map((item) => ({
        id: item.id,
        task: item.task,
        assignee: item.assignee,
        status: item.status,
        dueDate: item.dueDate,
        citations: item.citations as any // Read directly as native JSON
      }))
    };

    sendSuccess(res, formattedPayload);
  } catch (error) {
    next(error);
  }
}
