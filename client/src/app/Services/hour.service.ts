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

    // Estado reactivo para el total de horas aceptadas
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

    /**
     * Crea una nueva solicitud de horas
     */
    addHour(hours: number, description: string): Observable<any> {
        const hoursUser: HourRequest = { hours, description };
        return this.http.post(`${this.apiUrl}/addhour`, hoursUser, this.httpOptions);
    }

    /**
     * Obtiene las solicitudes de horas del usuario actual
     */
    getHours(): Observable<HourRequest[]> {
        return this.http.get<HourRequest[]>(`${this.apiUrl}/gethours`, this.httpOptions);
    }

    /**
     * Obtiene las horas aceptadas del usuario actual
     */
    getAcceptedHours(): Observable<AcceptedHoursResponse> {
        return this.http.get<AcceptedHoursResponse>(`${this.apiUrl}/acceptedhours`, this.httpOptions);
    }

    /**
     * ==================== 5. GESTIÓN ADMINISTRATIVA ====================
     */

    /**
     * Acepta una solicitud de horas (solo administradores)
     */
    acceptRequest(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/accept/${id}`, {}, this.httpOptions);
    }

    /**
     * Rechaza una solicitud de horas (solo administradores)
     */
    rejectRequest(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/reject/${id}`, {}, this.httpOptions);
    }

    /**
     * ==================== 6. UTILIDADES ====================
     */

    /**
     * Actualiza el total de horas aceptadas en el BehaviorSubject
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