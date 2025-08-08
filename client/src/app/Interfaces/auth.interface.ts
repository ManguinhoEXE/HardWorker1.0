export interface UserLoginResponse {
    message: string;
    user: {
        id: number;
        username: string;
        firstName: string;
        lastName: string;
        role: string;
    };
}

export interface CurrentUserResponse {
    id: number;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
    role: string;
}

export interface DecodedToken {
    role?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    [key: string]: any;
}