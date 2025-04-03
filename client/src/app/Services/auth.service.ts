
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";


@Injectable
    ({
        providedIn: 'root'
    })

export class AuthService {
    private apiUrl = 'http://localhost:5072/api/auth';

    constructor(private http: HttpClient) { }

    register(username: string, password: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/registro`, { username, password });
    }

    login(username: string, password: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/iniciarsesion`, 
        { username, password }, 
        { withCredentials: true } 
        ).pipe(
            tap(
                response => console.log('Login successful', response),
                error => console.error('Login error', error) // Log the error
            )
        );
    }
}