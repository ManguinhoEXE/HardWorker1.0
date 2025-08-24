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

    addRequest(compensatory: CompensatoryRequest): Observable<any> {
        return this.http.post(`${this.apiUrl}/addrequest`, compensatory, this.httpOptions);
    }

    getRequests(): Observable<CompensatoryRequest[]> {
        return this.http.get<CompensatoryRequest[]>(`${this.apiUrl}/getrequests`, this.httpOptions);
    }

    getAllRequests(): Observable<CompensatoryRequest[]> {
        return this.http.get<CompensatoryRequest[]>(`${this.apiUrl}/getallrequests`, this.httpOptions);
    }

    /**
     * ==================== 5. GESTIÓN ADMINISTRATIVA ====================
     */

    acceptRequestComp(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/accept/${id}`, {}, this.httpOptions);
    }

    rejectRequestComp(id: number): Observable<any> {
        return this.http.patch(`${this.apiUrl}/reject/${id}`, {}, this.httpOptions);
    }

    getAllHistory(): Observable<any> {
        return this.http.get(`${this.apiUrl}/getallhistory`, this.httpOptions);
    }

    /**
     * ==================== 6. ESTADÍSTICAS ====================
     */

    getGlobalStatistics(): Observable<GlobalStatistics> {
        return this.http.get<GlobalStatistics>(`${this.apiUrl}/global-statistics`, this.httpOptions);
    }
    
    getAvailableHours(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/available-hours`, { withCredentials: true });
    }
}