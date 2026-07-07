import { Router } from 'express';
import {
  createUser,
  getMe,
  getUsers,
  updateUser,
} from '../controllers/users.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/users/me — any authenticated role (must be registered before /:id)
router.get('/me', getMe);

// POST /api/users — Admin only
router.post('/', authorize(['Admin']), createUser);

// GET /api/users — Admin only, paginated + filtered
router.get('/', authorize(['Admin']), getUsers);

// PUT /api/users/:id — Admin only
router.put('/:id', authorize(['Admin']), updateUser);

export default router;
