import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompensatoryRequest, GlobalStatistics } from '../Interfaces/index';


@Injectable({
    providedIn: 'root',
})
export class CompensatoryService {

    /**
     * ==================== 2. PROPIEDADES ====================
     */
    private readonly apiUrl = 'http://localhost:5072/api/Compensatory';
    private readonly httpOptions = { withCredentials: true };

    /**
     * ==================== 3. CICLO DE VIDA ====================
     */
    constructor(private http: HttpClient) { }

    /**
     * ==================== 4. GESTIÓN DE SOLICITUDES ====================
     */

    /**
     * Crea una nueva solicitud de compensatorio
     */
    addRequest(compensatory: CompensatoryRequest): Observable<any> {
        return this.http.post(`${this.apiUrl}/addrequest`, compensatory, this.httpOptions);
    }

    /**
     * Obtiene las solicitudes del usuario actual
     */
    getRequests(): Observable<CompensatoryRequest[]> {
        return this.http.get<CompensatoryRequest[]>(`${this.apiUrl}/getrequests`, this.httpOptions);
    }

    /**
     * Obtiene todas las solicitudes (para usuarios regulares)
     */
    getAllRequests(): Observable<CompensatoryRequest[]> {
        return this.http.get<CompensatoryRequest[]>(`${this.apiUrl}/getallrequests`, this.httpOptions);
    }

    /**
     * ==================== 5. GESTIÓN ADMINISTRATIVA ====================
     */

    /**
     * Acepta una solicitud de compensatorio (solo administradores)
     */
    acceptRequestComp(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/accept/${id}`, {}, this.httpOptions);
    }

    /**
     * Rechaza una solicitud de compensatorio (solo administradores)
     */
    rejectRequestComp(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/reject/${id}`, {}, this.httpOptions);
    }

    /**
     * Obtiene el historial completo de todas las solicitudes (solo administradores)
     */
    getAllHistory(): Observable<any> {
        return this.http.get(`${this.apiUrl}/getallhistory`, this.httpOptions);
    }

    /**
     * ==================== 6. ESTADÍSTICAS ====================
     */

    /**
     * Obtiene estadísticas globales del sistema (solo administradores)
     */
    getGlobalStatistics(): Observable<GlobalStatistics> {
        return this.http.get<GlobalStatistics>(`${this.apiUrl}/global-statistics`, this.httpOptions);
    }
}