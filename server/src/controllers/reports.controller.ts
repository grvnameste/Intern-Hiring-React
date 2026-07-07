import type { Request, Response, NextFunction } from 'express';
import {
  getLeaveSummary,
  getLeaveBalanceReport,
  getLeaveCalendarReport,
} from '../services/report.service.js';
import { BadRequestError } from '../utils/errors.js';

// GET /api/reports/leave-summary — Admin only
export async function getLeaveSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params: {
      department?: string;
      from?: string;
      to?: string;
    } = {};

    if (typeof req.query['department'] === 'string') params.department = req.query['department'];
    if (typeof req.query['from'] === 'string') params.from = req.query['from'];
    if (typeof req.query['to'] === 'string') params.to = req.query['to'];

    const summary = await getLeaveSummary(params);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/leave-balance — Admin only
export async function getLeaveBalanceHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const report = await getLeaveBalanceReport();
    res.json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/leave-calendar
export async function getLeaveCalendarHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const role = req.user?.role;
    const userId = req.user?.userId;
    let teamId = typeof req.query['teamId'] === 'string' ? req.query['teamId'] : undefined;

    if (role === 'Manager') {
      teamId = userId;
    }

    const report = await getLeaveCalendarReport(teamId);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/export — Admin only
export async function exportReportHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const type = req.query['type'];
    const format = req.query['format'];

    if (format !== 'csv') {
      throw new BadRequestError('Only CSV format is supported for export');
    }

    if (type === 'summary') {
      const params: {
        department?: string;
        from?: string;
        to?: string;
      } = {};

      if (typeof req.query['department'] === 'string') params.department = req.query['department'];
      if (typeof req.query['from'] === 'string') params.from = req.query['from'];
      if (typeof req.query['to'] === 'string') params.to = req.query['to'];

      const summary = await getLeaveSummary(params);

      let csv = 'Category,Item,Approved Days\n';
      for (const [key, value] of Object.entries(summary.byType)) {
        csv += `Leave Type,"${key}",${value}\n`;
      }
      for (const [key, value] of Object.entries(summary.byDepartment)) {
        csv += `Department,"${key}",${value}\n`;
      }
      for (const [key, value] of Object.entries(summary.byEmployee)) {
        csv += `Employee,"${key}",${value}\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="leave-summary.csv"');
      res.status(200).send(csv);
      return;
    } else if (type === 'balance') {
      const balances = await getLeaveBalanceReport();

      let csv = 'User ID,Name,Department,Leave Type,Remaining Balance\n';
      for (const user of balances) {
        for (const bal of user.balances) {
          csv += `"${user.userId}","${user.name}","${user.department}","${bal.leaveType}",${bal.remaining}\n`;
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="leave-balances.csv"');
      res.status(200).send(csv);
      return;
    } else {
      throw new BadRequestError('Invalid report type. Supported types are: summary, balance');
    }
  } catch (err) {
    next(err);
  }
}
