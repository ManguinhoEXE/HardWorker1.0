import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, BehaviorSubject } from "rxjs";
import { HourRequest, AcceptedHoursResponse } from "../Interfaces/index";

@Injectable({
    providedIn: 'root'
})
export class hourService {

    /**
     * ==================== 2. PROPIEDADES ====================
     */
    private readonly apiUrl = 'http://localhost:5072/api/HoursUser';
    private readonly httpOptions = { withCredentials: true };

    public totalAccepted$ = new BehaviorSubject<number>(0);

    /**
     * ==================== 3. CICLO DE VIDA ====================
     */
    constructor(private http: HttpClient) {
        console.log('[HourService] Inicializado. SignalR será manejado por NavComponent.');
    }


    /**
     * ==================== 4. GESTIÓN DE SOLICITUDES ====================
     */

    addHour(hours: number, description: string): Observable<any> {
        const hoursUser: HourRequest = { hours, description };
        return this.http.post(`${this.apiUrl}/addhour`, hoursUser, this.httpOptions);
    }

    getHours(): Observable<HourRequest[]> {
        return this.http.get<HourRequest[]>(`${this.apiUrl}/gethours`, this.httpOptions);
    }

    getAcceptedHours(): Observable<AcceptedHoursResponse> {
        return this.http.get<AcceptedHoursResponse>(`${this.apiUrl}/acceptedhours`, this.httpOptions);
    }

    /**
     * ==================== 5. GESTIÓN ADMINISTRATIVA ====================
     */

    acceptRequest(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/accept/${id}`, {}, this.httpOptions);
    }

    rejectRequest(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/reject/${id}`, {}, this.httpOptions);
    }

    /**
     * ==================== 6. UTILIDADES ====================
     */

    refreshTotal(): void {
        this.getAcceptedHours().subscribe({
            next: (response) => this.totalAccepted$.next(response.totalAcceptedHours),
            error: (err) => console.error('Error refrescando total horas:', err)
        });
    }

    isSignalRConnected(): boolean {
        if (typeof window !== 'undefined' && (window as any).signalRConnection) {
            return (window as any).signalRConnection.state === 'Connected';
        }
        return false;
    }
}