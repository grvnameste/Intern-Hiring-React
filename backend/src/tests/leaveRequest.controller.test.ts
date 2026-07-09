import { Request, Response, NextFunction } from 'express';
import { applyLeave, cancelLeave, processLeaveRequest } from '../controllers/leaveRequest.controller';
import { mockPrismaClient } from './setup';
import { notificationService } from '../utils/notification.service';
import { LeaveStatus } from '@prisma/client';

jest.mock('../utils/auditLogger');
jest.mock('../utils/notification.service', () => ({
  notificationService: {
    createNotification: jest.fn(),
  },
}));

describe('LeaveRequest Controller', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = { 
      user: { id: 'user1', role: 'EMPLOYEE', managerId: 'manager1' },
      body: {},
      params: {},
      query: {}
    } as unknown as Request;
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    jest.clearAllMocks();
  });

  describe('applyLeave', () => {
    it('should return 400 if start date is in the past', async () => {
      mockRequest.body = {
        leaveTypeId: '123e4567-e89b-12d3-a456-426614174000',
        startDate: '2000-01-01T00:00:00.000Z',
        endDate: '2000-01-05T00:00:00.000Z',
        reason: 'Past leave',
      };

      await applyLeave(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Start date cannot be in the past' });
    });
  });

  describe('cancelLeave', () => {
    it('should return 400 if leave is not pending', async () => {
      mockRequest.params = { id: 'req1' };
      const mockLeaveReq = {
        id: 'req1',
        userId: 'user1',
        leaveTypeId: 'type1',
        startDate: new Date(),
        endDate: new Date(),
        status: LeaveStatus.APPROVED,
        reason: 'Vacation',
        attachmentUrl: null,
        managerId: 'manager1',
        managerComment: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      (mockPrismaClient.leaveRequest.findUnique as jest.Mock).mockResolvedValue(mockLeaveReq);

      await cancelLeave(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Only pending requests can be cancelled' });
    });

    it('should cancel pending leave', async () => {
      mockRequest.params = { id: 'req1' };
      const mockLeaveReq = {
        id: 'req1',
        userId: 'user1',
        leaveTypeId: 'type1',
        startDate: new Date(),
        endDate: new Date(),
        status: LeaveStatus.PENDING,
        reason: 'Vacation',
        attachmentUrl: null,
        managerId: 'manager1',
        managerComment: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      (mockPrismaClient.leaveRequest.findUnique as jest.Mock).mockResolvedValue(mockLeaveReq);

      await cancelLeave(mockRequest, mockResponse, nextFunction);

      expect(mockPrismaClient.leaveRequest.update).toHaveBeenCalledWith({
        where: { id: 'req1' },
        data: { status: 'CANCELLED' }
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, message: 'Leave request cancelled successfully' });
    });
  });

  describe('processLeaveRequest', () => {
    it('should approve leave and notify employee', async () => {
      mockRequest.params = { id: 'req1' };
      mockRequest.body = { status: 'APPROVED', managerComment: 'OK' };
      
      const mockLeaveReq = {
        id: 'req1',
        userId: 'emp1',
        leaveTypeId: 'type1',
        startDate: new Date('2030-01-01T00:00:00.000Z'),
        endDate: new Date('2030-01-05T00:00:00.000Z'),
        status: LeaveStatus.PENDING,
        reason: 'Vacation',
        attachmentUrl: null,
        managerId: 'user1', // Since user1 is the manager processing it
        managerComment: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // We'll just mock the transaction to return our mocked leave request
      (mockPrismaClient.$transaction as jest.Mock).mockImplementationOnce(async () => mockLeaveReq);

      await processLeaveRequest(mockRequest, mockResponse, nextFunction);

      expect(notificationService.createNotification).toHaveBeenCalledWith('emp1', 'Leave Request Approved', expect.any(String), 'LEAVE_APPROVED', 'req1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });
});
