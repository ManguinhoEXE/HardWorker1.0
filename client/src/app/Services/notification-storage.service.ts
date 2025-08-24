import { Injectable } from '@angular/core';

export interface PendingNotification {
    id: string;
    targetUserId: number;
    type: string;
    title: string;
    message: string;
    data: any;
    timestamp: Date;
    isRead: boolean;
    fromUserId?: number;
}

@Injectable({
    providedIn: 'root'
})
export class NotificationStorageService {
    private readonly STORAGE_PREFIX = 'hardworker_notifications_user_';
    private readonly MAX_NOTIFICATIONS = 50;

    constructor() { }


    saveNotificationForUser(userId: number, notification: any): void {
        try {
            const storageKey = this.getStorageKey(userId);
            const existingNotifications = this.getNotificationsForUser(userId);

            const newNotification = {
                ...notification,
                targetUserId: userId,
                timestamp: new Date(),
                isRead: false
            };

            const isDuplicate = existingNotifications.some(n =>
                n.id === newNotification.id && n.type === newNotification.type
            );

            if (isDuplicate) {
                console.log(` Notificación duplicada ignorada para usuario ${userId}`);
                return;
            }

            const updatedNotifications = [newNotification, ...existingNotifications];

            const limitedNotifications = updatedNotifications.slice(0, this.MAX_NOTIFICATIONS);

            localStorage.setItem(storageKey, JSON.stringify(limitedNotifications));
            console.log(` Notificación guardada para usuario ${userId}:`, notification.type);

        } catch (error) {
            console.error(' Error guardando notificación:', error);
        }
    }

    getNotificationsForUser(userId: number): any[] {
        try {
            const storageKey = this.getStorageKey(userId);
            const stored = localStorage.getItem(storageKey);

            if (!stored) return [];

            const notifications = JSON.parse(stored);

            return notifications.map((n: any) => ({
                ...n,
                timestamp: new Date(n.timestamp)
            }));

        } catch (error) {
            console.error('Error obteniendo notificaciones:', error);
            return [];
        }
    }


    distributeNotificationToTargets(notificationData: any): void {
        try {
            console.log(' [NotificationStorage] Iniciando distribución:', notificationData);

            if (notificationData.targetUserIds && Array.isArray(notificationData.targetUserIds)) {
                console.log(' [NotificationStorage] Usando targetUserIds:', notificationData.targetUserIds);
                notificationData.targetUserIds.forEach((userId: number) => {
                    console.log(` [NotificationStorage] Guardando para usuario ${userId}`);
                    this.saveNotificationForUser(userId, notificationData);
                });
            }
            else if (notificationData.targetRole) {
                if (notificationData.targetRole === 'Admin') {
                    console.log(' [NotificationStorage] Distribuyendo a Admin role');
                    const adminIds = this.getKnownAdminIds();
                    console.log(' [NotificationStorage] Admin IDs conocidos:', adminIds);
                    adminIds.forEach(adminId => {
                        console.log(` [NotificationStorage] Guardando para admin ${adminId}`);
                        this.saveNotificationForUser(adminId, notificationData);
                    });
                } else if (notificationData.targetRole === 'User') {
                    console.log(' [NotificationStorage] Distribuyendo a User role');
                    // Para usuarios específicos, usar el userId del dato
                    if (notificationData.userId) {
                        console.log(` [NotificationStorage] Guardando para usuario ${notificationData.userId}`);
                        this.saveNotificationForUser(notificationData.userId, notificationData);
                    }
                }
            }
            else {
                console.log('[NotificationStorage] Usando lógica de fallback');
                switch (notificationData.type) {
                    case 'compRequest':
                    case 'hoursRequest':
                        const adminIds = this.getKnownAdminIds();
                        console.log(' [NotificationStorage] Fallback - Admin IDs:', adminIds);
                        adminIds.forEach(adminId => {
                            console.log(` [NotificationStorage] Fallback - Guardando para admin ${adminId}`);
                            this.saveNotificationForUser(adminId, notificationData);
                        });
                        break;
                    case 'compAccepted':
                    case 'compRejected':
                    case 'hoursAccepted':
                    case 'hoursRejected':
                        if (notificationData.userId || notificationData.fromUserId) {
                            const targetUserId = notificationData.userId || notificationData.fromUserId;
                            console.log(`👤 [NotificationStorage] Fallback - Guardando para usuario ${targetUserId}`);
                            this.saveNotificationForUser(targetUserId, notificationData);
                        }
                        break;
                }
            }

            console.log(' [NotificationStorage] Distribución completada');

        } catch (error) {
            console.error(' [NotificationStorage] Error distribuyendo notificación:', error);
        }
    }

    private getKnownAdminIds(): number[] {
        return [3];
    }


    private getStorageKey(userId: number): string {
        return `${this.STORAGE_PREFIX}${userId}`;
    }


    markAsRead(userId: number, notificationId: string): void {
        try {
            const notifications = this.getNotificationsForUser(userId);
            const updated = notifications.map((n: any) =>
                (n.id === parseInt(notificationId) || n.data?.id === parseInt(notificationId))
                    ? { ...n, isRead: true }
                    : n
            );

            const storageKey = this.getStorageKey(userId);
            localStorage.setItem(storageKey, JSON.stringify(updated));

            console.log(` [NotificationStorage] Notificación ${notificationId} marcada como leída`);

        } catch (error) {
            console.error(' [NotificationStorage] Error marcando como leída:', error);
        }
    }


    cleanOldNotifications(userId: number, daysOld: number = 30): void {
        try {
            const notifications = this.getNotificationsForUser(userId);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysOld);

            const filtered = notifications.filter((n: any) => new Date(n.timestamp) > cutoff);

            const storageKey = this.getStorageKey(userId);
            localStorage.setItem(storageKey, JSON.stringify(filtered));

            console.log(`Limpiadas notificaciones viejas para usuario ${userId}`);

        } catch (error) {
            console.error('Error limpiando notificaciones viejas:', error);
        }
    }

    cleanReadNotifications(userId: number): void {
        try {
            const notifications = this.getNotificationsForUser(userId);

            const unreadNotifications = notifications.filter((n: any) => !n.isRead);

            const storageKey = this.getStorageKey(userId);
            localStorage.setItem(storageKey, JSON.stringify(unreadNotifications));

            const removedCount = notifications.length - unreadNotifications.length;
            console.log(`[NotificationStorage] ${removedCount} notificaciones leídas eliminadas para usuario ${userId}`);

        } catch (error) {
            console.error('[NotificationStorage] Error limpiando notificaciones leídas:', error);
        }
    }

    getUnreadNotificationsForUser(userId: number): any[] {
        try {
            const allNotifications = this.getNotificationsForUser(userId);
            return allNotifications.filter((n: any) => !n.isRead);
        } catch (error) {
            console.error('[NotificationStorage] Error obteniendo notificaciones no leídas:', error);
            return [];
        }
    }
}