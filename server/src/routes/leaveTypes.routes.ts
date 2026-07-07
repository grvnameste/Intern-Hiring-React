import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { getLeaveTypes, createLeaveType } from '../controllers/leaveTypes.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getLeaveTypes);
router.post('/', authorize(['Admin']), createLeaveType);

export default router;
