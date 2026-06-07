import { Router } from 'express';
import {
  createActionItem,
  updateStatus,
  listActionItems,
  getOverdueActionItems,
  createActionItemSchema,
  updateStatusSchema,
  listActionItemsSchema
} from '../controllers/actionItem.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { processOverdueReminders } from '../jobs/reminder.job';

const router = Router();

// Secure all routes in this module
router.use(authMiddleware);

/**
 * @openapi
 * /api/action-items:
 *   post:
 *     summary: Manually create a single action item
 *     tags: [Action Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [task, assignee, dueDate, meetingId]
 *             properties:
 *               task:
 *                 type: string
 *                 example: Prepare release notes
 *               assignee:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-05-25T12:00:00Z
 *               meetingId:
 *                 type: string
 *                 format: uuid
 *                 example: b865e927-4a1e-450f-90f7-51e9e38d7211
 *               citations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [timestamp]
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       example: "00:20"
 *     responses:
 *       201:
 *         description: Action item created successfully
 *       400:
 *         description: Validation or citation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', validate(createActionItemSchema), createActionItem);

/**
 * @openapi
 * /api/action-items:
 *   get:
 *     summary: List all action items with status, assignee, and meeting filtering
 *     tags: [Action Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED]
 *         description: Filter items by status
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *           format: email
 *         description: Filter items by assignee email
 *       - in: query
 *         name: meetingId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter items by associated meeting ID
 *     responses:
 *       200:
 *         description: Filtered list of action items
 *       400:
 *         description: Query validation errors
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(listActionItemsSchema), listActionItems);

/**
 * @openapi
 * /api/action-items/overdue:
 *   get:
 *     summary: Retrieve all overdue action items (status != COMPLETED and dueDate < now)
 *     tags: [Action Items]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue action items
 *       401:
 *         description: Unauthorized
 */
router.get('/overdue', getOverdueActionItems);

/**
 * @openapi
 * /api/action-items/{id}/status:
 *   patch:
 *     summary: Transition action item status (PENDING -> IN_PROGRESS -> COMPLETED)
 *     tags: [Action Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the action item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED]
 *                 example: IN_PROGRESS
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Validation error or illegal state transition
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Action item not found
 */
router.patch('/:id/status', validate(updateStatusSchema), updateStatus);

/**
 * @openapi
 * /api/action-items/trigger-reminders:
 *   post:
 *     summary: Manually trigger the scan of overdue action items and send reminders
 *     tags: [Action Items]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reminders scan triggered successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/trigger-reminders', async (req, res, next) => {
  try {
    await processOverdueReminders();
    res.status(200).json({
      traceId: req.headers['x-trace-id'] || 'trace-system',
      success: true,
      data: { message: 'Overdue reminder processing triggered successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
