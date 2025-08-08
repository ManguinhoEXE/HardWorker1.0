import { Injectable, PLATFORM_ID, Inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, BehaviorSubject, tap } from "rxjs";
import { isPlatformBrowser } from "@angular/common";
import { UserService } from './user.service';
import { JwtService } from './jwt.Service';
import { UserLoginResponse, CurrentUserResponse } from "../Interfaces/index";



@Injectable({
    providedIn: 'root'
})
export class AuthService {

    /**
     * ==================== 2. PROPIEDADES ====================
     */

    // 2.1 Configuración del servicio
    private readonly apiUrl = 'http://localhost:5072/api/auth';
    private readonly isBrowser: boolean;

    // 2.2 Estado de la sesión con BehaviorSubjects
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
        
        // Inicializar estado desde token si existe
        if (this.isBrowser) {
            this.initializeFromToken();
        }
    }

    /**
     * ==================== 4. GESTIÓN DE SESIÓN ====================
     */

    /**
     * Inicializa el estado del usuario desde el token en las cookies
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

    /**
     * Actualiza el estado del usuario desde el token JWT
     */
    private updateUserStateFromToken(token: string): void {
        const role = this.jwtService.getRoleFromToken(token);
        const userId = this.jwtService.getUserIdFromToken(token);
        const username = this.jwtService.getUsernameFromToken(token);

        if (role) this.currentUserRole.next(role);
        if (userId) this.currentUserId.next(Number(userId));
        if (username) this.currentUserName.next(username);
    }

    /**
     * Actualiza el estado del usuario desde la respuesta del backend
     */
    private updateUserStateFromResponse(response: CurrentUserResponse): void {
        this.currentUserRole.next(response.role);
        this.currentUserId.next(response.id);
        this.currentUserName.next(`${response.firstName} ${response.lastName}`);
    }

    /**
     * Verifica la sesión actual con el backend
     */
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
                // Mantener sesión basada en token si falla el backend
            }
        });
    }

    /**
     * Limpia el estado de la sesión
     */
    private clearUserSession(): void {
        this.currentUserRole.next(null);
        this.currentUserId.next(null);
        this.currentUserName.next(null);
    }

    /**
     * ==================== 5. AUTENTICACIÓN ====================
     */

    /**
     * Registro de nuevo usuario
     */
    register(username: string, password: string, firstName: string, lastName: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/registro`, { 
            username, 
            password, 
            firstName, 
            lastName 
        });
    }

    /**
     * Iniciar sesión
     */
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

    /**
     * Cerrar sesión
     */
    logout(): Observable<any> {
        return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).pipe(
            tap(() => {
                this.clearUserSession();
            })
        );
    }

    /**
     * ==================== 6. VERIFICACIÓN DE ESTADO ====================
     */

    /**
     * Verifica si el usuario es administrador
     */
    isAdmin(): boolean {
        // Verificar estado actual primero
        if (this.currentUserRole.value === 'Admin') {
            return true;
        }

        // Verificar desde token como respaldo
        return this.checkAdminFromToken();
    }

    /**
     * Verifica si el usuario está autenticado
     */
    isAuthenticated(): boolean {
        return this.jwtService.isAuthenticated();
    }

    /**
     * Verifica admin desde token y actualiza estado si es necesario
     */
    private checkAdminFromToken(): boolean {
        const token = this.jwtService.getTokenFromCookies();
        if (token) {
            const isAdmin = this.jwtService.isAdmin(token);
            
            // Actualizar estado si encontramos admin en token
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

    /**
     * Obtiene el rol actual del usuario
     */
    getCurrentUserRole(): string | null {
        // Verificar estado actual primero
        if (this.currentUserRole.value) {
            return this.currentUserRole.value;
        }

        // Verificar desde token como respaldo
        return this.getRoleFromTokenAndUpdate();
    }

    /**
     * Obtiene el ID del usuario actual
     */
    getCurrentUserId(): number | null {
        return this.currentUserId.value;
    }

    /**
     * Obtiene el nombre del usuario actual
     */
    getCurrentUserName(): string | null {
        return this.currentUserName.value;
    }

    /**
     * Obtiene rol desde token y actualiza estado si es necesario
     */
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

    /**
     * Verifica si el token expirará pronto
     */
    willTokenExpireSoon(minutesThreshold: number = 5): boolean {
        const token = this.jwtService.getTokenFromCookies();
        return token ? this.jwtService.willExpireSoon(token, minutesThreshold) : false;
    }

    /**
     * Obtiene información del token para debugging
     */
    getTokenInfo(): any {
        const token = this.jwtService.getTokenFromCookies();
        return token ? this.jwtService.getTokenInfo(token) : { message: 'No token found' };
    }

    /**
     * Método público para verificar sesión desde backend (usado en componentes)
     */
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