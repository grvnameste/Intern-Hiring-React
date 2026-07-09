import request from 'supertest';
import app from '../app';

describe('Auth API', () => {
  it('should return 400 for invalid login credentials format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invalid-email', password: '123' });
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
