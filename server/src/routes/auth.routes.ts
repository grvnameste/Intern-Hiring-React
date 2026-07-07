import { Router } from 'express';
import { login, logout } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// POST /api/auth/login — public
router.post('/login', login);

// POST /api/auth/logout — authenticated
router.post('/logout', authenticate, logout);

export default router;
