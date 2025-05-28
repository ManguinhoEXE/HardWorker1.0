import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { BehaviorSubject } from 'rxjs';


@Injectable
    ({
        providedIn: 'root'
    })

export class hourService {
    private apiurl = 'http://localhost:5072/api/HoursUser';

    totalAccepted$ = new BehaviorSubject<number>(0);

    constructor(private http: HttpClient) { }

    addHour(hours: number, description: String, ): Observable<any> {
        // Crear un objeto HoursUser con las propiedades necesarias
        const hoursUser = { hours: hours, description: description };

        return this.http.post(`${this.apiurl}/addhour`, hoursUser, { withCredentials: true });
    }

    getHours(): Observable<any> {
        return this.http.get(`${this.apiurl}/gethours`, { withCredentials: true });
    }

    acceptRequest(id: number): Observable<any> {
        return this.http.patch(`${this.apiurl}/accept/${id}`, {}, { withCredentials: true });
    }

    rejectRequest(id: number): Observable<any> {
        return this.http.patch(`${this.apiurl}/reject/${id}`, {}, { withCredentials: true });
    }

    getAcceptedHours(): Observable<{
        totalAcceptedHours: number;
        entries: { id: number; hours: number; currentHour: string }[];
    }> {
        return this.http.get<{
            totalAcceptedHours: number;
            entries: { id: number; hours: number; currentHour: string }[];
        }>(
            `${this.apiurl}/acceptedhours`,
            { withCredentials: true }
        );
    }

    refreshTotal(): void {
        this.getAcceptedHours().subscribe({
            next: res => this.totalAccepted$.next(res.totalAcceptedHours),
            error: err => console.error('Error refrescando total horas:', err)
        });
    }

}