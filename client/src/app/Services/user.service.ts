import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserData, User, UploadImageResponse, UserDashboard } from "../Interfaces/index";



@Injectable({
    providedIn: 'root',
})
export class UserService {

    /**
     * ==================== 2. PROPIEDADES ====================
     */
    private readonly apiUrl = 'http://localhost:5072/api/user';
    private readonly httpOptions = { withCredentials: true };

    /**
     * ==================== 3. CICLO DE VIDA ====================
     */
    constructor(private http: HttpClient) { }

    /**
     * ==================== 4. GESTIÓN DE DATOS DE USUARIO ====================
     */

    getUser(): Observable<UserData> {
        return this.http.get<UserData>(`${this.apiUrl}/getdata`, this.httpOptions);
    }

    getAllUsers(): Observable<User[]> {
        return this.http.get<User[]>(`${this.apiUrl}/all-users`, this.httpOptions);
    }

    getUserDashboard(userId: number): Observable<UserDashboard> {
        return this.http.get<UserDashboard>(`${this.apiUrl}/user-dashboard/${userId}`, this.httpOptions);
    }

    /**
     * ==================== 5. GESTIÓN DE PERFIL ====================
     */

    uploadProfileImage(formData: FormData): Observable<UploadImageResponse> {
        return this.http.post<UploadImageResponse>(`${this.apiUrl}/update-img-profile`, formData, this.httpOptions);
    }
}