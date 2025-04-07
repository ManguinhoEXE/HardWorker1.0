import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CompensatoryService {
    private apiUrl = 'http://localhost:5072/api/Compensatory';

    constructor(private http: HttpClient) { }

    // Método para enviar una solicitud de compensatorio
    addRequest(compensatory: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/addrequest`, compensatory, { withCredentials: true });
    }

    //Metodo para obtener las solicitudes de compensatorio
    getRequests(): Observable<any> {
        return this.http.get(`${this.apiUrl}/getrequests`, { withCredentials: true });
    }
}