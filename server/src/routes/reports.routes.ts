import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getLeaveSummaryHandler,
  getLeaveBalanceHandler,
  getLeaveCalendarHandler,
  exportReportHandler,
} from '../controllers/reports.controller.js';

const router = Router();

router.use(authenticate);

router.get('/leave-summary', authorize(['Admin']), getLeaveSummaryHandler);

router.get('/leave-balance', authorize(['Admin']), getLeaveBalanceHandler);

router.get('/leave-calendar', authorize(['Admin', 'Manager']), getLeaveCalendarHandler);
router.get('/export', authorize(['Admin']), exportReportHandler);

export default router;
