export interface Notification {
    id: number;
    firstName: string;
    lastName: string;
    type: 'hoursRequest' | 'hoursAccepted' | 'hoursRejected' | 'compRequest' | 'compAccepted' | 'compRejected';
    hours?: number;
    description?: string;
    from?: string;
    to?: string;
    reason?: string;
    acceptedDate?: string;
    rejectedDate?: string;
    isRead?: boolean;
    timestamp?: Date;
}