import { Router } from 'express';
import { getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment } from '../controllers/department.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Employees and Managers can view departments
router.get('/', getDepartments);
router.get('/:id', getDepartment);

// Only ADMIN can manage departments
router.use(authorize('ADMIN'));

router.post('/', createDepartment);
router.put('/:id', updateDepartment);
router.delete('/:id', deleteDepartment);

export default router;
