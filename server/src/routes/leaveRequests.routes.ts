import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  createLeaveRequestHandler,
  getLeaveRequestsHandler,
  updateLeaveRequestHandler,
} from '../controllers/leaveRequests.controller.js';

const router = Router();

router.use(authenticate);


router.get('/', getLeaveRequestsHandler);

router.post('/', createLeaveRequestHandler);

router.put('/:id', updateLeaveRequestHandler);

export default router;
