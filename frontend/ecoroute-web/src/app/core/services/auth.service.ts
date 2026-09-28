import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, finalize } from 'rxjs';
import { ApiService } from './api.service';


export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthResponse {
  token: string;
  userId: number;
  fullName: string;
  email: string;
  username: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly tokenKey = 'ecoroute_token';
  private readonly userKey = 'ecoroute_user';

  constructor(
    private http: HttpClient,
    private api: ApiService
  ) {}

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.api.getBaseUrl()}/Auth/login`,
        request
      )
      .pipe(
        tap(response => {
          localStorage.setItem(this.tokenKey, response.token);

          localStorage.setItem(
            this.userKey,
            JSON.stringify({
              userId: response.userId,
              fullName: response.fullName,
              email: response.email,
              username: response.username,
              role: response.role
            })
          );
        })
      );
  }

  logout(): Observable<any> {
    return this.http
      .post(`${this.api.getBaseUrl()}/Auth/logout`, {})
      .pipe(
        finalize(() => {
          this.clearSession();
        })
      );
  }

  clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): any {
    const user = localStorage.getItem(this.userKey);

    if (!user) {
      return null;
    }

    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}