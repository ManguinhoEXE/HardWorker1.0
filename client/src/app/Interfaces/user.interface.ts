export interface User {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    role: string;
}

export interface UserData {
    profileImage: null;
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    profileimage: string | null;
    role: string;
}

export interface UserSummary extends User {
    totalHoursRequests: number;
    totalCompensatoryRequests: number;
    pendingHoursRequests: number;
    pendingCompensatoryRequests: number;
    availableHours: number;
    lastActivity: string;
}

export interface UserDashboard {
    user: User;
    totalHours: number;
    pendingRequests: number;
    acceptedRequests: number;
    rejectedRequests: number;
}

export interface UploadImageResponse {
    message: string;
    profileimage: string;
}