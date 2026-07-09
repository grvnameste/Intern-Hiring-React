import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
app.set('trust proxy', 1);

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Parse JSON bodies
app.use(express.json());

// Request logging
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import leaveTypeRoutes from './routes/leaveType.routes';
import leaveRequestRoutes from './routes/leaveRequest.routes';
import reportRoutes from './routes/report.routes';
import departmentRoutes from './routes/department.routes';
import notificationRoutes from './routes/notification.routes';

// Setup routes here
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/leave-types', leaveTypeRoutes);
app.use('/api/v1/leave-requests', leaveRequestRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Error handling middleware
app.use(errorHandler);

export default app;
