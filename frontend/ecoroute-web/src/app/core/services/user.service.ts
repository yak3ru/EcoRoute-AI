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
}