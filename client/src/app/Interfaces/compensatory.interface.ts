export interface CompensatoryRequest {
    id?: number;
    reason: string;
    from: string | Date;
    to: string | Date;
    status?: string;
    userId?: number;
    currentHour?: string;
    firstName?: string;
    lastName?: string;
}

export interface AdminCompensatoryRequest {
    id: number;
    firstName: string;
    lastName: string;
    reason: string;
    from: Date | string;
    to: Date | string;
    status: string;
    dynamicStatus: string;
    currentHour: Date | string;
    userId: number;
    hoursRequested: number;
    userFullName: string;
    isActive: boolean;
    isPending: boolean;
    isExpired: boolean;
    requestDate: string;
    timeRange: string;
}

export interface GlobalStatistics {
    userStatistics: {
        totalUsers: number;
        adminUsers: number;
        regularUsers: number;
    };
    hourStatistics: {
        totalHoursAvailable: number;
        totalHourRequests: number;
        acceptedHourRequests: number;
        pendingHourRequests: number;
        rejectedHourRequests: number;
    };
    compensatoryStatistics: {
        totalCompensatoryRequests: number;
        acceptedCompensatories: number;
        pendingCompensatories: number;
        rejectedCompensatories: number;
        activeCompensatories: number;
        finishedCompensatories: number;
        totalHoursInCompensatories: number;
        activeHours: number;
    };
}