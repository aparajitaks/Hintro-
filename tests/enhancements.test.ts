import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/db';
import jwt from 'jsonwebtoken';

describe('API Enhancements & Security Integration Tests', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    // Seed user
    const user = await prisma.user.create({
      data: {
        email: 'enhancements_test@example.com',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv'
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

  describe('Audio Transcription API', () => {
    it('should reject transcription request if no file is provided', async () => {
      const res = await request(app)
        .post('/api/meetings/transcribe')
        .set(getHeaders());

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Please upload an audio file');
    });

    it('should reject transcription if not authenticated', async () => {
      const res = await request(app)
        .post('/api/meetings/transcribe');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('API Rate Limiting', () => {
    it('should trigger auth rate limiting when hitting login repeatedly', async () => {
      // The authLimiter permits max 10 requests per 15 mins.
      // We will make 11 login attempts. The 11th should return 429.
      const loginPayload = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      // Disable logging during rate limit spamming to keep logs clean
      const originalError = console.error;
      console.error = jest.fn();

      try {
        for (let i = 0; i < 10; i++) {
          await request(app)
            .post('/api/auth/login')
            .send(loginPayload);
        }

        const resRateLimited = await request(app)
          .post('/api/auth/login')
          .send(loginPayload);

        expect(resRateLimited.status).toBe(429);
        expect(resRateLimited.body.success).toBe(false);
        expect(resRateLimited.body.error.code).toBe('TOO_MANY_REQUESTS');
        expect(resRateLimited.body.error.message).toContain('Too many authentication attempts');
      } finally {
        console.error = originalError;
      }
    });
  });
});
