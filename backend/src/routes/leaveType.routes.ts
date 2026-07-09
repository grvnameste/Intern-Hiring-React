import { Router } from 'express';
import { getLeaveTypes, getLeaveType, createLeaveType, updateLeaveType, deleteLeaveType } from '../controllers/leaveType.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Employees and Managers can view leave types
router.get('/', getLeaveTypes);
router.get('/:id', getLeaveType);

// Only ADMIN can manage leave types
router.use(authorize('ADMIN'));

router.post('/', createLeaveType);
router.put('/:id', updateLeaveType);
router.delete('/:id', deleteLeaveType);

export default router;
