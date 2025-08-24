import { Injectable, PLATFORM_ID, Inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, BehaviorSubject, tap } from "rxjs";
import { isPlatformBrowser } from "@angular/common";
import { UserService } from './user.service';
import { JwtService } from './jwt.Service';
import { UserLoginResponse, CurrentUserResponse } from "../Interfaces/index";
import { EditUserRequest } from "../Interfaces/auth.interface";



@Injectable({
    providedIn: 'root'
})
export class AuthService {

    /**
     * ==================== 2. PROPIEDADES ====================
     */

    private readonly apiUrl = 'http://localhost:5072/api/auth';
    private readonly isBrowser: boolean;

    private currentUserRole = new BehaviorSubject<string | null>(null);
    public currentUserRole$ = this.currentUserRole.asObservable();
    private currentUserId = new BehaviorSubject<number | null>(null);
    public currentUserId$ = this.currentUserId.asObservable();
    private currentUserName = new BehaviorSubject<string | null>(null);
    public currentUserName$ = this.currentUserName.asObservable();

    /**
     * ==================== 3. CICLO DE VIDA ====================
     */
    constructor(
        private http: HttpClient,
        @Inject(PLATFORM_ID) private platformId: Object,
        private userService: UserService,
        private jwtService: JwtService
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);

        if (this.isBrowser) {
            this.initializeFromToken();
        }
    }

    /**
     * ==================== 4. GESTIÓN DE SESIÓN ====================
     */

    private initializeFromToken(): void {
        const token = this.jwtService.getTokenFromCookies();
        if (token && this.jwtService.isTokenValid(token)) {
            this.updateUserStateFromToken(token);
            this.verifyCurrentUserSession();
        } else {
            this.clearUserSession();
        }
    }

    private updateUserStateFromToken(token: string): void {
        const role = this.jwtService.getRoleFromToken(token);
        const userId = this.jwtService.getUserIdFromToken(token);
        const username = this.jwtService.getUsernameFromToken(token);

        if (role) this.currentUserRole.next(role);
        if (userId) this.currentUserId.next(Number(userId));
        if (username) this.currentUserName.next(username);
    }

    private updateUserStateFromResponse(response: CurrentUserResponse): void {
        this.currentUserRole.next(response.role);
        this.currentUserId.next(response.id);
        this.currentUserName.next(`${response.firstName} ${response.lastName}`);
    }

    private verifyCurrentUserSession(): void {
        if (!this.isBrowser) return;

        this.userService.getUser().subscribe({
            next: (response: CurrentUserResponse) => {
                if (response?.role) {
                    this.updateUserStateFromResponse(response);
                } else {
                    this.clearUserSession();
                }
            },
            error: (err) => {
                console.error('Error verificando sesión:', err);
            }
        });
    }

    private clearUserSession(): void {
        this.currentUserRole.next(null);
        this.currentUserId.next(null);
        this.currentUserName.next(null);
    }

    /**
     * ==================== 5. AUTENTICACIÓN ====================
     */

    register(username: string, password: string, firstName: string, lastName: string, token: string | null): Observable<any> {
        return this.http.post(`${this.apiUrl}/registro`, {
            username,
            password,
            firstName,
            lastName
        }, {
            withCredentials: true
        });
    }

    login(username: string, password: string): Observable<UserLoginResponse> {
        return this.http.post<UserLoginResponse>(`${this.apiUrl}/iniciarsesion`,
            { username, password },
            { withCredentials: true }
        ).pipe(
            tap({
                next: (response: UserLoginResponse) => {
                    if (response?.user?.role) {
                        this.updateUserStateFromResponse({
                            id: response.user.id,
                            firstName: response.user.firstName,
                            lastName: response.user.lastName,
                            profileImage: null,
                            role: response.user.role
                        });
                    } else {
                        this.clearUserSession();
                    }
                },
                error: (error) => {
                    console.error('Error de login:', error);
                    this.clearUserSession();
                }
            })
        );
    }

    logout(): Observable<any> {
        return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).pipe(
            tap(() => {
                this.clearUserSession();
            })
        );
    }

    deleteUser(userId: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/eliminar/${userId}`, { withCredentials: true });
    }

    editUser(userId: number, userData: EditUserRequest): Observable<any> {
        console.log(`PUT Request to: ${this.apiUrl}/editar/${userId}`);
        console.log('Data being sent:', userData);

        return this.http.put(`${this.apiUrl}/editar/${userId}`, userData, {
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json'
            }
        }).pipe(
            tap({
                next: (response) => {
                    console.log(' Edit Response:', response);
                },
                error: (error) => {
                    console.error('Edit Error:', error);
                    console.error('Error details:', {
                        status: error.status,
                        statusText: error.statusText,
                        url: error.url,
                        message: error.message
                    });
                }
            })
        );
    }

    /**
     * ==================== 6. VERIFICACIÓN DE ESTADO ====================
     */

    isAdmin(): boolean {
        if (this.currentUserRole.value === 'Admin') {
            return true;
        }
        return this.checkAdminFromToken();
    }

    isAuthenticated(): boolean {
        return this.jwtService.isAuthenticated();
    }

    private checkAdminFromToken(): boolean {
        const token = this.jwtService.getTokenFromCookies();
        if (token) {
            const isAdmin = this.jwtService.isAdmin(token);

            if (isAdmin && !this.currentUserRole.value) {
                this.currentUserRole.next('Admin');
            }

            return isAdmin;
        }
        return false;
    }

    /**
     * ==================== 7. GETTERS DE ESTADO ====================
     */

    getCurrentUserRole(): string | null {
        if (this.currentUserRole.value) {
            return this.currentUserRole.value;
        }

        return this.getRoleFromTokenAndUpdate();
    }

    getCurrentUserId(): number | null {
        return this.currentUserId.value;
    }

    getCurrentUserName(): string | null {
        return this.currentUserName.value;
    }

    private getRoleFromTokenAndUpdate(): string | null {
        const token = this.jwtService.getTokenFromCookies();
        if (token) {
            const role = this.jwtService.getRoleFromToken(token);
            if (role && !this.currentUserRole.value) {
                this.currentUserRole.next(role);
            }
            return role;
        }
        return null;
    }

    /**
     * ==================== 8. UTILIDADES ====================
     */

    willTokenExpireSoon(minutesThreshold: number = 5): boolean {
        const token = this.jwtService.getTokenFromCookies();
        return token ? this.jwtService.willExpireSoon(token, minutesThreshold) : false;
    }

    getTokenInfo(): any {
        const token = this.jwtService.getTokenFromCookies();
        return token ? this.jwtService.getTokenInfo(token) : { message: 'No token found' };
    }

    verifySession(): Observable<CurrentUserResponse> {
        return this.userService.getUser().pipe(
            tap((response: CurrentUserResponse) => {
                if (response?.role) {
                    this.updateUserStateFromResponse(response);
                }
            })
        );
    }
}