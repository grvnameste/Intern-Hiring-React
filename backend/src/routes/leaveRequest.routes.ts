import { Router } from 'express';
import { getLeaveRequests, applyLeave, processLeaveRequest, getLeaveBalances, getAttachment, cancelLeave } from '../controllers/leaveRequest.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Leave balances
router.get('/balances', getLeaveBalances);

// Leave requests
router.route('/')
  .get(getLeaveRequests) // Filter logic inside controller based on role
  .post(applyLeave);

// Process leave request (Managers and Admins)
router.patch('/:id/process', authorize('MANAGER', 'ADMIN'), processLeaveRequest);

// Cancel leave request
router.post('/:id/cancel', cancelLeave);

// View attachment
router.get('/:id/attachment', getAttachment);

export default router;
