export interface HourRequest {
    id?: number;
    hours: number;
    description: string;
    status?: string;
    userId?: number;
    currentHour?: string;
}

export interface AcceptedHoursResponse {
    totalAcceptedHours: number;
    entries: { id: number; hours: number; currentHour: string }[];
}