export type ModalType = 'success' | 'error' | 'info';

export interface RequestData {
    from: string;
    to: string;
    reason: string;
    status: string;
    currentHour: string;
    hoursRequested?: number;
}