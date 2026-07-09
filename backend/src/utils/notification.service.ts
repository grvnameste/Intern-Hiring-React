import crypto from 'crypto';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  type?: string;
  relatedId?: string;
}

// In-memory store for notifications (Temporary solution as per requirements)
// In production, this should be a DB table.
const notificationsMap = new Map<string, Notification[]>();

export const notificationService = {
  createNotification: (userId: string, title: string, message: string, type?: string, relatedId?: string): Notification | null => {
    const userNotifications = notificationsMap.get(userId) || [];

    if (type && relatedId) {
      // Prevent duplicate unread notifications for the same event
      const isDuplicate = userNotifications.some(
        n => !n.isRead && n.type === type && n.relatedId === relatedId
      );
      if (isDuplicate) return null;
    }

    const notification: Notification = {
      id: crypto.randomUUID(),
      userId,
      title,
      message,
      isRead: false,
      createdAt: new Date(),
      type,
      relatedId
    };

    userNotifications.push(notification);
    // Sort descending by date
    userNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    notificationsMap.set(userId, userNotifications);

    return notification;
  },

  getUserNotifications: (userId: string): Notification[] => {
    return notificationsMap.get(userId) || [];
  },

  markAsRead: (userId: string, notificationId: string): Notification | null => {
    const userNotifications = notificationsMap.get(userId) || [];
    const notification = userNotifications.find((n) => n.id === notificationId);
    
    if (notification) {
      notification.isRead = true;
      return notification;
    }
    
    return null;
  },

  markAllAsRead: (userId: string): void => {
    const userNotifications = notificationsMap.get(userId) || [];
    userNotifications.forEach(n => n.isRead = true);
  }
};
