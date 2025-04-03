import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";


@Injectable
    ({
        providedIn: 'root'
    })

export class hourService {
    private apiurl = 'http://localhost:5072/api/HoursUser';

    constructor(private http: HttpClient) { }

    addHour(hours: number): Observable<any> {
        // Crear un objeto HoursUser con las propiedades necesarias
        const hoursUser = { hours: hours };

        return this.http.post(`${this.apiurl}/addhour`, hoursUser, { withCredentials: true });
    }

    getHours(): Observable<any> {
        return this.http.get(`${this.apiurl}/gethours`, { withCredentials: true });
    }

}