import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { sendSuccess } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';
import { z } from 'zod';
import fs from 'fs';
import { AIService } from '../services/ai.service';
import { logger } from '../utils/logger';

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

export const deleteMeetingSchema = {
  params: z.object({
    id: z.string().uuid('Invalid meeting ID format')
  })
};

export const updateMeetingSchema = {
  params: z.object({
    id: z.string().uuid('Invalid meeting ID format')
  }),
  body: z.object({
    title: z.string().min(1, 'Meeting title cannot be empty').optional(),
    participants: z.array(z.string().email('Invalid participant email')).min(1, 'At least one participant is required').optional(),
    meetingDate: z.string().datetime('Invalid ISO date format').optional()
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  )
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
        analysis: true,
        actionItems: true
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

export async function transcribeMeetingAudio(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new ValidationError('Please upload an audio file.');
    }

    const filePath = req.file.path;

    try {
      const segments = await AIService.transcribeAudio(filePath);
      
      // Delete temporary file from uploads/
      fs.unlink(filePath, (err) => {
        if (err) logger.error('Failed to delete temp file', { filePath, error: err.message });
      });

      sendSuccess(res, segments);
    } catch (err) {
      // Clean up file if transcription failed
      fs.unlink(filePath, () => {});
      throw err;
    }
  } catch (error) {
    next(error);
  }
}

export async function deleteMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId: userId }
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    await prisma.meeting.delete({ where: { id } });

    sendSuccess(res, { id });
  } catch (error) {
    next(error);
  }
}

export async function updateMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId: userId },
      include: { analysis: true }
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    if (meeting.analysis) {
      throw new ValidationError('Cannot update a meeting that has already been analyzed');
    }

    const { title, participants, meetingDate } = req.body;

    const data: Record<string, any> = {};
    if (title !== undefined) data.title = title;
    if (meetingDate !== undefined) data.meetingDate = new Date(meetingDate);
    if (participants !== undefined) {
      data.participants = participants.map((email: string) => email.toLowerCase().trim());
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data,
      include: {
        transcript: { orderBy: { timestamp: 'asc' } },
        analysis: true,
        actionItems: true
      }
    });

    sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

