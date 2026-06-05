import { Router } from 'express';
import {
  createMeeting,
  getMeeting,
  listMeetings,
  createMeetingSchema,
  listMeetingsSchema,
  getMeetingSchema
} from '../controllers/meeting.controller';
import { analyzeMeeting, analyzeMeetingSchema } from '../controllers/analyze.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

// Secure all routes in this module
router.use(authMiddleware);

/**
 * @openapi
 * /api/meetings:
 *   post:
 *     summary: Create a new meeting with transcript
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, participants, meetingDate, transcript]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Sprint Planning
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 example: ["alice@example.com", "bob@example.com"]
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-05-20T10:00:00Z
 *               transcript:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [timestamp, speaker, text]
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       example: "00:10"
 *                     speaker:
 *                       type: string
 *                       example: John
 *                     text:
 *                       type: string
 *                       example: We should launch next Friday.
 *     responses:
 *       201:
 *         description: Meeting and transcript segments created successfully
 *       400:
 *         description: Validation or request payload errors
 *       401:
 *         description: Unauthorized
 */
router.post('/', validate(createMeetingSchema), createMeeting);

/**
 * @openapi
 * /api/meetings:
 *   get:
 *     summary: Get a list of meetings with filtering and pagination
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: string
 *           default: "1"
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: "10"
 *         description: Maximum items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter meetings occurring on or after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter meetings occurring on or before this date
 *       - in: query
 *         name: participantEmail
 *         schema:
 *           type: string
 *           format: email
 *         description: Filter meetings including this participant email
 *     responses:
 *       200:
 *         description: List of meetings matching search criteria
 *       400:
 *         description: Query validation errors
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(listMeetingsSchema), listMeetings);

/**
 * @openapi
 * /api/meetings/{id}:
 *   get:
 *     summary: Retrieve a meeting by its ID
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of meeting to fetch
 *     responses:
 *       200:
 *         description: Meeting details, transcript segments, and analysis details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Meeting not found
 */
router.get('/:id', validate(getMeetingSchema), getMeeting);

/**
 * @openapi
 * /api/meetings/{id}/analyze:
 *   post:
 *     summary: Analyze transcript to generate insights and action items using Groq AI
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of meeting to analyze
 *     responses:
 *       200:
 *         description: Analysis complete, returns grounded insights and inserts PENDING action items
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Meeting not found
 */
router.post('/:id/analyze', validate(analyzeMeetingSchema), analyzeMeeting);

export default router;
