export interface CompensatoryRequest {
    id?: number;
    reason: string;
    from: string | Date;
    to: string | Date;
    status?: string;
    userId?: number;
    currentHour?: string;
    // Agregar propiedades faltantes
    firstName?: string;
    lastName?: string;
}

export interface AdminCompensatoryRequest {
    id: number;
    firstName: string;
    lastName: string;
    reason: string;
    from: string;
    to: string;
    status: string;
    dynamicStatus: string;
    currentHour: string;
    userId: number;
    hoursRequested: number;
    userFullName: string;
    daysFromRequest: number;
    isActive: boolean;
    isPending: boolean;
    isExpired: boolean;
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