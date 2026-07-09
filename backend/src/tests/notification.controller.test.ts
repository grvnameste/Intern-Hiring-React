import { Request, Response, NextFunction } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller';
import { notificationService } from '../utils/notification.service';

jest.mock('../utils/notification.service', () => ({
  notificationService: {
    getUserNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  },
}));

describe('Notification Controller', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let nextFunction: NextFunction = jest.fn() as unknown as NextFunction;

  beforeEach(() => {
    mockRequest = { user: { id: 'user1', role: 'EMPLOYEE' }, params: {} } as unknown as Request;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return user notifications', async () => {
      const mockNotification = {
        id: 'notif1',
        userId: 'user1',
        title: 'Test',
        message: 'Test msg',
        isRead: false,
        createdAt: new Date()
      };
      (notificationService.getUserNotifications as jest.Mock).mockReturnValue([mockNotification]);

      await getNotifications(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: [mockNotification] });
    });
  });

  describe('markAsRead', () => {
    it('should return 404 if notification not found', async () => {
      mockRequest.params = { id: 'notif1' };
      (notificationService.markAsRead as jest.Mock).mockReturnValue(null);

      await markAsRead(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: false, message: 'Notification not found' });
    });

    it('should mark notification as read', async () => {
      mockRequest.params = { id: 'notif1' };
      const mockNotification = {
        id: 'notif1',
        userId: 'user1',
        title: 'Test',
        message: 'Test msg',
        isRead: true,
        createdAt: new Date()
      };
      (notificationService.markAsRead as jest.Mock).mockReturnValue(mockNotification);

      await markAsRead(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockNotification });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      await markAllAsRead(mockRequest, mockResponse, nextFunction);

      expect(notificationService.markAllAsRead).toHaveBeenCalledWith('user1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, message: 'All notifications marked as read' });
    });
  });
});
