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
});
