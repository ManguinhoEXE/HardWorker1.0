
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";


@Injectable
({
    providedIn: 'root'
})

export class AuthService {
    private apiUrl = 'http://localhost:5072/api/auth';

    constructor(private http: HttpClient) {}

    register(username: string, password: string ): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/registro`, {username, password});
    }
}