import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createMeeting,
  getMeeting,
  listMeetings,
  deleteMeeting,
  updateMeeting,
  createMeetingSchema,
  listMeetingsSchema,
  getMeetingSchema,
  deleteMeetingSchema,
  updateMeetingSchema,
  transcribeMeetingAudio
} from '../controllers/meeting.controller';
import { analyzeMeeting, analyzeMeetingSchema } from '../controllers/analyze.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { analyzeLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

// Secure all routes in this module
router.use(authMiddleware);

// Configure multer storage for audio uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp3', '.wav', '.m4a', '.mp4'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, M4A, and MP4 files are allowed.'));
    }
  }
});

/**
 * @openapi
 * /api/meetings/transcribe:
 *   post:
 *     summary: Transcribe meeting audio file using Groq Whisper API
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Audio file transcribed successfully
 *       400:
 *         description: Invalid input parameters or file formats
 *       401:
 *         description: Unauthorized
 */
router.post('/transcribe', upload.single('audio'), transcribeMeetingAudio);

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
 * /api/meetings/{id}:
 *   delete:
 *     summary: Delete a meeting and all its related data
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
 *         description: UUID of meeting to delete
 *     responses:
 *       200:
 *         description: Meeting deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Meeting not found
 */
router.delete('/:id', validate(deleteMeetingSchema), deleteMeeting);

/**
 * @openapi
 * /api/meetings/{id}:
 *   patch:
 *     summary: Update a meeting's title, date, or participants (only before analysis)
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
 *         description: UUID of meeting to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Sprint Planning
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 example: ["alice@example.com", "carol@example.com"]
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-05-21T10:00:00Z
 *     responses:
 *       200:
 *         description: Meeting updated successfully
 *       400:
 *         description: Validation error or meeting already analyzed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Meeting not found
 */
router.patch('/:id', validate(updateMeetingSchema), updateMeeting);

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
router.post('/:id/analyze', analyzeLimiter, validate(analyzeMeetingSchema), analyzeMeeting);

export default router;
