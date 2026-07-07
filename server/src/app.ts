import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './utils/errors.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true, // allow cookies
  }),
);
app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// ── Global Error Handler ──────────────────────────────────────────────────────
// Must be defined LAST and have all 4 parameters for Express to treat it as an error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Unexpected errors
  console.error('[Unhandled error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
