import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/db';
import jwt from 'jsonwebtoken';

describe('Meetings API Integration Tests', () => {
  let token: string;
  let userId: string;

  const testUser = {
    email: 'meetingowner@example.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv' // dummy hash
  };

  beforeEach(async () => {
    // Seed user
    const user = await prisma.user.create({
      data: {
        email: testUser.email,
        passwordHash: testUser.passwordHash
      }
    });
    userId = user.id;

    // Generate token
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-123456';
    token = jwt.sign({ userId: user.id, email: user.email }, secret);
  });

  const getHeaders = () => ({
    Authorization: `Bearer ${token}`
  });

  it('should successfully create a new meeting with transcript segments', async () => {
    const meetingPayload = {
      title: 'Sprint Backlog review',
      participants: ['alice@company.com', 'bob@company.com'],
      meetingDate: '2026-06-05T12:00:00.000Z',
      transcript: [
        { timestamp: '00:10', speaker: 'Alice', text: 'We should launch next Friday.' },
        { timestamp: '00:20', speaker: 'Bob', text: 'Sounds good to me.' }
      ]
    };

    const res = await request(app)
      .post('/api/meetings')
      .set(getHeaders())
      .send(meetingPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.title).toBe(meetingPayload.title);
    expect(res.body.data.participants).toEqual(meetingPayload.participants);
    expect(res.body.data.transcript).toHaveLength(2);

    // Confirm transcript segments exist in DB
    const segments = await prisma.transcriptSegment.findMany({
      where: { meetingId: res.body.data.id }
    });
    expect(segments).toHaveLength(2);
  });

  it('should retrieve a meeting by ID', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Sprint Planning',
        meetingDate: new Date('2026-06-05T10:00:00Z'),
        participants: ['alice@company.com'], // Pass array directly
        ownerId: userId
      }
    });

    const res = await request(app)
      .get(`/api/meetings/${meeting.id}`)
      .set(getHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(meeting.title);
    expect(res.body.data.participants).toEqual(['alice@company.com']);
  });

  it('should filter meetings by participantEmail', async () => {
    // Create Meeting 1 with Alice
    await prisma.meeting.create({
      data: {
        title: 'Alice Meeting',
        meetingDate: new Date(),
        participants: ['alice@test.com'], // Pass array directly
        ownerId: userId
      }
    });

    // Create Meeting 2 with Bob
    await prisma.meeting.create({
      data: {
        title: 'Bob Meeting',
        meetingDate: new Date(),
        participants: ['bob@test.com'], // Pass array directly
        ownerId: userId
      }
    });

    // Query for Alice
    const resAlice = await request(app)
      .get('/api/meetings?participantEmail=alice@test.com')
      .set(getHeaders());

    expect(resAlice.status).toBe(200);
    expect(resAlice.body.data.meetings).toHaveLength(1);
    expect(resAlice.body.data.meetings[0].title).toBe('Alice Meeting');

    // Query for Bob
    const resBob = await request(app)
      .get('/api/meetings?participantEmail=bob@test.com')
      .set(getHeaders());

    expect(resBob.status).toBe(200);
    expect(resBob.body.data.meetings).toHaveLength(1);
    expect(resBob.body.data.meetings[0].title).toBe('Bob Meeting');
  });

  it('should filter meetings by date range', async () => {
    // Create yesterday meeting
    await prisma.meeting.create({
      data: {
        title: 'Past Meeting',
        meetingDate: new Date('2026-06-04T10:00:00Z'),
        participants: ['charlie@test.com'], // Pass array directly
        ownerId: userId
      }
    });

    // Create next week meeting
    await prisma.meeting.create({
      data: {
        title: 'Future Meeting',
        meetingDate: new Date('2026-06-12T10:00:00Z'),
        participants: ['charlie@test.com'], // Pass array directly
        ownerId: userId
      }
    });

    // Query for date range around yesterday
    const resPast = await request(app)
      .get('/api/meetings?startDate=2026-06-03T00:00:00Z&endDate=2026-06-05T00:00:00Z')
      .set(getHeaders());

    expect(resPast.status).toBe(200);
    expect(resPast.body.data.meetings).toHaveLength(1);
    expect(resPast.body.data.meetings[0].title).toBe('Past Meeting');
  });

  it('should delete a meeting and return its id', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Meeting To Delete',
        meetingDate: new Date('2026-06-05T10:00:00Z'),
        participants: ['alice@company.com'],
        ownerId: userId
      }
    });

    const res = await request(app)
      .delete(`/api/meetings/${meeting.id}`)
      .set(getHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(meeting.id);

    const deleted = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(deleted).toBeNull();
  });

  it('should cascade delete transcript segments and analysis on meeting delete', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Meeting With Children',
        meetingDate: new Date('2026-06-05T10:00:00Z'),
        participants: ['bob@company.com'],
        ownerId: userId,
        transcript: {
          create: [{ timestamp: '00:10', speaker: 'Bob', text: 'Hello world.' }]
        }
      }
    });

    await request(app)
      .delete(`/api/meetings/${meeting.id}`)
      .set(getHeaders())
      .expect(200);

    const segments = await prisma.transcriptSegment.findMany({ where: { meetingId: meeting.id } });
    expect(segments).toHaveLength(0);
  });

  it('should return 404 when deleting a meeting that does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .delete(`/api/meetings/${fakeId}`)
      .set(getHeaders());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when deleting a meeting owned by another user', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'other@example.com', passwordHash: 'x' }
    });
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Other User Meeting',
        meetingDate: new Date(),
        participants: ['other@example.com'],
        ownerId: otherUser.id
      }
    });

    const res = await request(app)
      .delete(`/api/meetings/${meeting.id}`)
      .set(getHeaders());

    expect(res.status).toBe(404);
  });

  it('should update meeting title, date, and participants before analysis', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Old Title',
        meetingDate: new Date('2026-06-05T10:00:00Z'),
        participants: ['alice@company.com'],
        ownerId: userId
      }
    });

    const res = await request(app)
      .patch(`/api/meetings/${meeting.id}`)
      .set(getHeaders())
      .send({
        title: 'New Title',
        meetingDate: '2026-06-10T09:00:00.000Z',
        participants: ['bob@company.com', 'carol@company.com']
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('New Title');
    expect(res.body.data.meetingDate).toBe('2026-06-10T09:00:00.000Z');
    expect(res.body.data.participants).toEqual(['bob@company.com', 'carol@company.com']);
  });

  it('should allow partial update (title only)', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Original Title',
        meetingDate: new Date('2026-06-05T10:00:00Z'),
        participants: ['alice@company.com'],
        ownerId: userId
      }
    });

    const res = await request(app)
      .patch(`/api/meetings/${meeting.id}`)
      .set(getHeaders())
      .send({ title: 'Updated Title Only' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title Only');
    expect(res.body.data.participants).toEqual(['alice@company.com']); // unchanged
  });

  it('should return 400 when trying to update a meeting that has already been analyzed', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Analyzed Meeting',
        meetingDate: new Date('2026-06-05T10:00:00Z'),
        participants: ['alice@company.com'],
        ownerId: userId,
        analysis: {
          create: {
            summary: [],
            decisions: [],
            followUps: []
          }
        }
      }
    });

    const res = await request(app)
      .patch(`/api/meetings/${meeting.id}`)
      .set(getHeaders())
      .send({ title: 'Should Fail' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when patch body is empty', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Some Meeting',
        meetingDate: new Date(),
        participants: ['alice@company.com'],
        ownerId: userId
      }
    });

    const res = await request(app)
      .patch(`/api/meetings/${meeting.id}`)
      .set(getHeaders())
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 404 when patching a meeting owned by another user', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'patchother@example.com', passwordHash: 'x' }
    });
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Not Mine',
        meetingDate: new Date(),
        participants: ['other@example.com'],
        ownerId: otherUser.id
      }
    });

    const res = await request(app)
      .patch(`/api/meetings/${meeting.id}`)
      .set(getHeaders())
      .send({ title: 'Stolen' });

    expect(res.status).toBe(404);
  });
});

