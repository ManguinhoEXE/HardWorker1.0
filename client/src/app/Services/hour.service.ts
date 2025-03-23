import { Injectable } from "@angular/core";
import { HttpClient,HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";


@Injectable
({
    providedIn: 'root'
})

export class hourService {
    private apiurl = 'http://localhost:5072/api/HoursUser';

    constructor(private http: HttpClient) {}

    addHour(hours: number): Observable<any> {
        const token = localStorage.getItem('token');
        const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
        return this.http.post(`${this.apiurl}/addhour`, { hours }, { headers });
    }
    
}