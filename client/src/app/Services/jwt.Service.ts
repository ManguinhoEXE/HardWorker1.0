import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DecodedToken } from '../Interfaces/auth.interface';

@Injectable({
    providedIn: 'root'
})
export class JwtService {

    /**
     * ==================== 2. PROPIEDADES ====================
     */
    private readonly isBrowser: boolean;

    private readonly roleClaims = [
        'role',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
    ];

    private readonly userIdClaims = [
        'sub',
        'userId',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
    ];

    private readonly usernameClaims = [
        'username',
        'name',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    ];

    private readonly possibleTokenNames = [
        'token',
        'authToken',
        'jwtToken',
        'auth-token',
        '.AspNetCore.Application.Token'
    ];

    /**
     * ==================== 3. CICLO DE VIDA ====================
     */
    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    /**
     * ==================== 4. OBTENCIÓN Y DECODIFICACIÓN DE TOKENS ====================
     */

    getTokenFromCookies(): string | null {
        if (!this.isBrowser) {
            return null;
        }

        for (const tokenName of this.possibleTokenNames) {
            const cookieValue = this.getCookieValue(tokenName);
            if (cookieValue) {
                return cookieValue;
            }
        }

        return null;
    }

    private getCookieValue(name: string): string | null {
        if (!this.isBrowser) {
            return null;
        }

        const cookieName = `${name}=`;
        const cookies = document.cookie.split(';');

        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(cookieName)) {
                const value = cookie.substring(cookieName.length);
                return value || null;
            }
        }

        return null;
    }

    decodeToken(token: string): DecodedToken | null {
        if (!token || typeof token !== 'string') {
            return null;
        }

        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Token JWT inválido: debe tener 3 partes');
            }

            const payload = parts[1];
            if (!payload) {
                throw new Error('Payload del token JWT está vacío');
            }

            const decodedPayload = this.base64UrlDecode(payload);
            const parsedPayload = JSON.parse(decodedPayload);

            if (typeof parsedPayload !== 'object' || parsedPayload === null) {
                throw new Error('Payload del token JWT no es un objeto válido');
            }

            return parsedPayload as DecodedToken;
        } catch (error) {
            console.error('Error decodificando token JWT:', error);
            return null;
        }
    }

    private base64UrlDecode(str: string): string {
        if (!str) {
            throw new Error('String base64url está vacío');
        }

        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

        while (base64.length % 4) {
            base64 += '=';
        }

        try {
            return atob(base64);
        } catch (error) {
            console.error('Error decodificando base64:', error);
            throw new Error('Error decodificando base64url: ' + (error as Error).message);
        }
    }

    /**
     * ==================== 5. VALIDACIÓN DE TOKENS ====================
     */

    isTokenValid(token: string): boolean {
        if (!token) {
            return false;
        }

        const decodedToken = this.decodeToken(token);
        return decodedToken ? this.isTokenNotExpired(decodedToken) : false;
    }

    isTokenNotExpired(decodedToken: DecodedToken): boolean {
        if (!decodedToken.exp) {
            console.warn('Token sin fecha de expiración detectado');
            return false;
        }

        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        const isValid = decodedToken.exp > currentTimeInSeconds;

        if (!isValid) {
            console.warn('Token expirado detectado');
        }

        return isValid;
    }
    
    isAuthenticated(): boolean {
        const token = this.getTokenFromCookies();
        return token ? this.isTokenValid(token) : false;
    }

    /**
     * ==================== 6. EXTRACCIÓN DE CLAIMS ====================
     */

    getClaim<T>(token: string, claimName: string): T | null {
        const decodedToken = this.decodeToken(token);
        if (!decodedToken || !claimName) {
            return null;
        }

        const claimValue = decodedToken[claimName];
        return claimValue !== undefined ? (claimValue as T) : null;
    }

    getRoleFromToken(token: string): string | null {
        const decodedToken = this.decodeToken(token);
        if (!decodedToken) {
            return null;
        }

        return this.extractClaimFromToken(decodedToken, this.roleClaims, 'string');
    }

    getUserIdFromToken(token: string): string | number | null {
        const decodedToken = this.decodeToken(token);
        if (!decodedToken) {
            return null;
        }

        return this.extractClaimFromToken(decodedToken, this.userIdClaims);
    }

    getUsernameFromToken(token: string): string | null {
        const decodedToken = this.decodeToken(token);
        if (!decodedToken) {
            return null;
        }

        return this.extractClaimFromToken(decodedToken, this.usernameClaims, 'string');
    }

    private extractClaimFromToken(
        decodedToken: DecodedToken, 
        claimNames: string[], 
        expectedType?: string
    ): any {
        for (const claim of claimNames) {
            const value = decodedToken[claim];
            if (value !== undefined && value !== null) {
                if (expectedType && typeof value !== expectedType) {
                    continue;
                }
                return value;
            }
        }
        return null;
    }

    /**
     * ==================== 7. VERIFICACIÓN DE ROLES ====================
     */

    hasRole(token: string, role: string): boolean {
        if (!token || !role) {
            return false;
        }

        const tokenRole = this.getRoleFromToken(token);
        return tokenRole === role;
    }


    isAdmin(token: string): boolean {
        return this.hasRole(token, 'Admin');
    }

    /**
     * ==================== 8. GESTIÓN DE FECHAS Y EXPIRACIÓN ====================
     */

    getTokenExpirationDate(token: string): Date | null {
        const decodedToken = this.decodeToken(token);
        if (!decodedToken?.exp) {
            return null;
        }

        return new Date(decodedToken.exp * 1000);
    }

    getTimeUntilExpiry(token: string): number | null {
        const expirationDate = this.getTokenExpirationDate(token);
        if (!expirationDate) {
            return null;
        }

        const timeLeft = Math.floor((expirationDate.getTime() - Date.now()) / 1000);
        return Math.max(0, timeLeft);
    }

    willExpireSoon(token: string, minutesThreshold: number = 5): boolean {
        const timeLeft = this.getTimeUntilExpiry(token);
        if (timeLeft === null) {
            return false;
        }

        const thresholdInSeconds = minutesThreshold * 60;
        return timeLeft <= thresholdInSeconds;
    }


    getTokenInfo(token: string): any {
        if (!token) {
            return { error: 'No token provided' };
        }

        try {
            const decodedToken = this.decodeToken(token);
            if (!decodedToken) {
                return { error: 'Invalid token' };
            }

            const expirationDate = this.getTokenExpirationDate(token);
            const isValid = this.isTokenNotExpired(decodedToken);

            return {
                isValid,
                expirationDate,
                role: this.getRoleFromToken(token),
                userId: this.getUserIdFromToken(token),
                username: this.getUsernameFromToken(token),
                issuedAt: decodedToken.iat ? new Date(decodedToken.iat * 1000) : null,
                timeUntilExpiry: expirationDate ?
                    Math.max(0, Math.floor((expirationDate.getTime() - Date.now()) / 1000)) : null,
                allClaims: decodedToken
            };
        } catch (error) {
            console.error('Error obteniendo información del token:', error);
            return { error: 'Error decoding token' };
        }
    }
}