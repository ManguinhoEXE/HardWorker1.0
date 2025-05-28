import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';


@Injectable({
    providedIn: 'root',
})

export class UserService {

    constructor(private http: HttpClient) { }

    getUser(): Observable<any> {
        return this.http.get('http://localhost:5072/api/user/getdata', { withCredentials: true });
    }

    uploadProfileImage(formData: FormData): Observable<any> {
        return this.http.post('http://localhost:5072/api/user/update-img-profile', formData, { withCredentials: true });
    }
}