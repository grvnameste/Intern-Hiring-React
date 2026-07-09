import { Router } from 'express';
import { getDashboardStats, getLeaveTrends, getAllBalances, getLeaveSummary, getLeaveCalendar, logReportExport } from '../controllers/report.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Only ADMIN can view global reports
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/trends', getLeaveTrends);
router.get('/balances', getAllBalances);
router.get('/calendar', getLeaveCalendar);
router.get('/summary', getLeaveSummary);
router.post('/export', logReportExport);

export default router;
