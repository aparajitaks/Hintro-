import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { sendSuccess } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { z } from 'zod';

export const createMeetingSchema = {
  body: z.object({
    title: z.string().min(1, 'Meeting title is required'),
    participants: z.array(z.string().email('Invalid participant email')).min(1, 'At least one participant is required'),
    meetingDate: z.string().datetime('Invalid ISO date format'),
    transcript: z.array(
      z.object({
        timestamp: z.string().regex(/^(?:\d{1,2}:)?\d{2}:\d{2}$/, 'Timestamp format must be MM:SS or HH:MM:SS'),
        speaker: z.string().min(1, 'Speaker name is required'),
        text: z.string().min(1, 'Transcript text is required')
      })
    ).min(1, 'Transcript cannot be empty')
  })
};

export const listMeetingsSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
    startDate: z.string().datetime('Invalid ISO date format for startDate').optional(),
    endDate: z.string().datetime('Invalid ISO date format for endDate').optional(),
    participantEmail: z.string().email('Invalid email format for participantEmail').optional()
  })
};

export const getMeetingSchema = {
  params: z.object({
    id: z.string().uuid('Invalid meeting ID format')
  })
};

export async function createMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, participants, meetingDate, transcript } = req.body;
    const userId = req.user!.userId;

    const normalizedParticipants = participants.map((email: string) => email.toLowerCase().trim());

    // Save in transactional block
    const meeting = await prisma.$transaction(async (tx) => {
      const m = await tx.meeting.create({
        data: {
          title,
          meetingDate: new Date(meetingDate),
          participants: normalizedParticipants, // Save as native JSON array
          ownerId: userId
        }
      });

      await tx.transcriptSegment.createMany({
        data: transcript.map((segment: any) => ({
          meetingId: m.id,
          timestamp: segment.timestamp,
          speaker: segment.speaker,
          text: segment.text
        }))
      });

      return m;
    });

    const completeMeeting = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: {
        transcript: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      }
    });

    sendSuccess(res, completeMeeting, 201);
  } catch (error) {
    next(error);
  }
}

export async function getMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId: userId },
      include: {
        transcript: {
          orderBy: {
            timestamp: 'asc'
          }
        },
        analysis: true
      }
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    sendSuccess(res, meeting);
  } catch (error) {
    next(error);
  }
}

export async function listMeetings(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, startDate, endDate, participantEmail } = req.query as any;
    const userId = req.user!.userId;

    const skip = (page - 1) * limit;

    const where: any = { ownerId: userId };

    if (participantEmail) {
      // Query PostgreSQL JSON column containing array using array_contains
      where.participants = {
        array_contains: participantEmail.toLowerCase().trim()
      };
    }

    if (startDate || endDate) {
      where.meetingDate = {};
      if (startDate) {
        where.meetingDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.meetingDate.lte = new Date(endDate);
      }
    }

    const [total, meetings] = await prisma.$transaction([
      prisma.meeting.count({ where }),
      prisma.meeting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { meetingDate: 'desc' },
        include: { analysis: true }
      })
    ]);

    sendSuccess(res, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      meetings
    });
  } catch (error) {
    next(error);
  }
}
