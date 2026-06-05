import { CitationValidator } from '../src/services/citationValidator';
import { analysisResponseSchema } from '../src/services/ai.service';
import { prisma } from '../src/utils/db';

describe('Citation Validation Service Tests', () => {
  let meetingId: string;
  let userId: string;

  beforeEach(async () => {
    // Set up dummy user
    const user = await prisma.user.create({
      data: {
        email: 'validator@example.com',
        passwordHash: 'dummy-hash'
      }
    });
    userId = user.id;

    // Create a meeting with segments at 00:10 and 00:20
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Validation Demo',
        meetingDate: new Date(),
        participants: JSON.stringify([]),
        ownerId: userId
      }
    });
    meetingId = meeting.id;

    await prisma.transcriptSegment.createMany({
      data: [
        { meetingId, timestamp: '00:10', speaker: 'Alice', text: 'First point.' },
        { meetingId, timestamp: '00:20', speaker: 'Bob', text: 'Second point.' }
      ]
    });
  });

  it('should pass validation when AI payload matches schema and citations are in DB', async () => {
    const validPayload = {
      summary: [
        { text: 'Alice said something.', citations: [{ timestamp: '00:10' }] }
      ],
      decisions: [
        { text: 'Decision was made.', citations: [{ timestamp: '00:20' }] }
      ],
      followUps: [
        { text: 'Follow up.', citations: [{ timestamp: '00:10' }] }
      ],
      actionItems: [
        { task: 'Clean code', assignee: 'Bob', citations: [{ timestamp: '00:20' }] }
      ]
    };

    // 1. Zod structure check
    const zodResult = analysisResponseSchema.safeParse(validPayload);
    expect(zodResult.success).toBe(true);

    // 2. DB citation check
    const dbResult = await CitationValidator.validate(meetingId, validPayload);
    expect(dbResult.isValid).toBe(true);
    expect(dbResult.invalidTimestamps).toHaveLength(0);
    expect(dbResult.cleanedData.summary[0].citations).toHaveLength(1);
  });

  it('should fail validation when a citation timestamp does not exist in the DB (hallucinated citation)', async () => {
    const hallucinatedPayload = {
      summary: [
        { text: 'Hallucinated info.', citations: [{ timestamp: '00:30' }] } // 00:30 is not in DB!
      ],
      decisions: [],
      followUps: [],
      actionItems: []
    };

    const dbResult = await CitationValidator.validate(meetingId, hallucinatedPayload);
    expect(dbResult.isValid).toBe(false);
    expect(dbResult.invalidTimestamps).toContain('00:30');
    expect(dbResult.cleanedData.summary[0].citations).toHaveLength(0); // stripped out
  });

  it('should fail Zod parsing if AI payload structure is malformed', async () => {
    const malformedPayload = {
      summary: [
        { text: 'Missing citations array' } // citations key is missing!
      ],
      decisions: [],
      followUps: [],
      actionItems: []
    };

    const zodResult = analysisResponseSchema.safeParse(malformedPayload);
    expect(zodResult.success).toBe(false);
  });
});
