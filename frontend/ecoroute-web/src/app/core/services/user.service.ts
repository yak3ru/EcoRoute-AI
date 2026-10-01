import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface UserProfile {
  userId: number;
  fullName: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAccountRequest {
  fullName: string;
  email: string;
  username: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export type SessionStatus = 'Active' | 'LoggedOut' | 'Expired';

export interface UserSessionInfo {
  sessionId: number;
  device: string | null;
  browser: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  endedAt: string | null;
  status: SessionStatus;
  logoutReason: string | null;
  isCurrent: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private http: HttpClient,
    private api: ApiService
  ) {}

  getCurrentUser(): Observable<UserProfile> {
    return this.http.get<UserProfile>(
      `${this.api.getBaseUrl()}/Users/me`
    );
  }

  updateAccount(
    request: UpdateAccountRequest
  ): Observable<any> {
    return this.http.put(
      `${this.api.getBaseUrl()}/Users/account`,
      request
    );
  }

  changePassword(
    request: ChangePasswordRequest
  ): Observable<any> {
    return this.http.put(
      `${this.api.getBaseUrl()}/Users/password`,
      request
    );
  }

  deleteAccount(password: string): Observable<any> {
    return this.http.request('DELETE', `${this.api.getBaseUrl()}/Users/account`, {
        body: {
        password: password
        }
    });
    }

  // SESSIONS

  getSessions(): Observable<UserSessionInfo[]> {
    return this.http.get<UserSessionInfo[]>(
      `${this.api.getBaseUrl()}/Users/sessions`
    );
  }

  logoutSession(sessionId: number): Observable<any> {
    return this.http.post(
      `${this.api.getBaseUrl()}/Users/sessions/${sessionId}/logout`,
      {}
    );
  }

  logoutOtherSessions(): Observable<{ message: string; count: number }> {
    return this.http.post<{ message: string; count: number }>(
      `${this.api.getBaseUrl()}/Users/sessions/logout-others`,
      {}
    );
  }
}