import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/db';

describe('Authentication API Integration Tests', () => {
  const registerUrl = '/api/auth/register';
  const loginUrl = '/api/auth/login';

  const testUser = {
    email: 'testauth@example.com',
    password: 'password123'
  };

  it('should successfully register a new user', async () => {
    const res = await request(app)
      .post(registerUrl)
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(testUser.email);
    expect(res.body).toHaveProperty('traceId');

    // Confirm stored in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: testUser.email }
    });
    expect(dbUser).not.toBeNull();
  });

  it('should fail to register if email is already taken', async () => {
    // Register once
    await request(app).post(registerUrl).send(testUser);

    // Register twice
    const res = await request(app).post(registerUrl).send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should fail registration with invalid input schema (Zod validation)', async () => {
    const res = await request(app)
      .post(registerUrl)
      .send({
        email: 'invalid-email',
        password: '123' // too short
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('email');
    expect(res.body.error.message).toContain('password');
  });

  it('should login successfully with correct credentials and return a JWT token', async () => {
    // Register user first
    await request(app).post(registerUrl).send(testUser);

    const res = await request(app)
      .post(loginUrl)
      .send(testUser);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it('should reject login attempt with incorrect credentials', async () => {
    // Register user first
    await request(app).post(registerUrl).send(testUser);

    const res = await request(app)
      .post(loginUrl)
      .send({
        email: testUser.email,
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
