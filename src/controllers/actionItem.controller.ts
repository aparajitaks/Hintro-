import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { sendSuccess } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';
import { z } from 'zod';

export const createActionItemSchema = {
  body: z.object({
    task: z.string().min(1, 'Task description is required'),
    assignee: z.string().email('Invalid assignee email format'),
    dueDate: z.string().datetime('Invalid ISO date format for dueDate'),
    meetingId: z.string().uuid('Invalid meetingId format'),
    citations: z.array(
      z.object({
        timestamp: z.string().regex(/^(?:\d{1,2}:)?\d{2}:\d{2}$/, 'Timestamp format must be MM:SS or HH:MM:SS')
      })
    ).optional().default([])
  })
};

export const updateStatusSchema = {
  params: z.object({
    id: z.string().uuid('Invalid action item ID format')
  }),
  body: z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED'], {
      errorMap: () => ({ message: 'Status must be one of PENDING, IN_PROGRESS, COMPLETED' })
    })
  })
};

export const listActionItemsSchema = {
  query: z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
    assignee: z.string().email('Invalid assignee email format').optional(),
    meetingId: z.string().uuid('Invalid meeting ID format').optional()
  })
};

export async function createActionItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { task, assignee, dueDate, meetingId, citations } = req.body;
    const userId = req.user!.userId;

    // Check meeting existence and ownership
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, ownerId: userId },
      include: { transcript: true }
    });

    if (!meeting) {
      throw new NotFoundError('Associated meeting not found or not owned by you');
    }

    // Validate citations if any were provided manually
    if (citations && citations.length > 0) {
      const validTimestamps = new Set(meeting.transcript.map(s => s.timestamp));
      for (const cit of citations) {
        if (!validTimestamps.has(cit.timestamp)) {
          throw new ValidationError(`Citation timestamp "${cit.timestamp}" does not exist in the meeting transcript.`);
        }
      }
    }

    const actionItem = await prisma.actionItem.create({
      data: {
        task,
        assignee: assignee.toLowerCase().trim(),
        dueDate: new Date(dueDate),
        meetingId,
        citations: citations, // Pass directly as native JSON
        status: 'PENDING',
        creatorId: userId
      }
    });

    sendSuccess(res, actionItem, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status: targetStatus } = req.body;
    const userId = req.user!.userId;

    // Find the item and verify ownership of the meeting it belongs to
    const item = await prisma.actionItem.findFirst({
      where: {
        id,
        meeting: {
          ownerId: userId
        }
      }
    });

    if (!item) {
      throw new NotFoundError('Action item not found or associated meeting not owned by you');
    }

    const currentStatus = item.status;

    // Enforce strict linear transition checking: PENDING -> IN_PROGRESS -> COMPLETED
    if (currentStatus !== targetStatus) {
      const isAllowedTransition =
        (currentStatus === 'PENDING' && targetStatus === 'IN_PROGRESS') ||
        (currentStatus === 'IN_PROGRESS' && targetStatus === 'COMPLETED');

      if (!isAllowedTransition) {
        throw new ValidationError(
          `Invalid status transition from "${currentStatus}" to "${targetStatus}". Transitions must strictly proceed: PENDING -> IN_PROGRESS -> COMPLETED.`
        );
      }
    }

    const updatedItem = await prisma.actionItem.update({
      where: { id },
      data: { status: targetStatus }
    });

    sendSuccess(res, updatedItem);
  } catch (error) {
    next(error);
  }
}

export async function listActionItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, assignee, meetingId } = req.query as any;
    const userId = req.user!.userId;

    // Scope queries to the user's owned meetings
    const where: any = {
      meeting: {
        ownerId: userId
      }
    };

    if (status) {
      where.status = status;
    }
    if (assignee) {
      where.assignee = assignee.toLowerCase().trim();
    }
    if (meetingId) {
      where.meetingId = meetingId;
    }

    const items = await prisma.actionItem.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    sendSuccess(res, items);
  } catch (error) {
    next(error);
  }
}

export async function getOverdueActionItems(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    // Retrieve active (not completed) items past their dueDate
    const items = await prisma.actionItem.findMany({
      where: {
        status: {
          not: 'COMPLETED'
        },
        dueDate: {
          lt: new Date()
        },
        meeting: {
          ownerId: userId
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    sendSuccess(res, items);
  } catch (error) {
    next(error);
  }
}
