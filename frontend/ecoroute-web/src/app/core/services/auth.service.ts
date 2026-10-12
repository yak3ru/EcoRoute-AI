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
  requiresTwoFactor?: false;
  userId: number;
  fullName: string;
  email: string;
  username: string;
  role: string;
  isOnboardingComplete: boolean;
}

export interface OnboardingStatusResponse {
  isOnboardingComplete: boolean;
}

export interface AreaImportRow {
  areaName: string;
  populationDensity: number;
  latitude: number;
  longitude: number;
}

export interface AreaImportResponse {
  message: string;
  importedCount: number;
  areas: {
    areaId: number;
    areaName: string;
    populationDensity: number;
    latitude: number;
    longitude: number;
    isActive: boolean;
    createdAt: string;
  }[];
}


export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  challengeId: string;
  maskedEmail: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export type LoginResponse = AuthResponse | TwoFactorRequiredResponse;

export interface PendingTwoFactor {
  challengeId: string;
  maskedEmail: string;
  resendAvailableAt: number;
}

export interface ResendCodeResponse {
  message: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export function isTwoFactorRequired(
  response: LoginResponse
): response is TwoFactorRequiredResponse {
  return response.requiresTwoFactor === true;
}


export interface HistoricalWasteImportRow {
  areaName: string;
  collectionDate: string;
  wasteType: string;
  weightKg: number;
  status: string;
}

export interface HistoricalWasteImportResponse {
  message: string;
  importedCount: number;
}


export interface VehicleRequest {
  vehicleName: string;
  capacityKg: number;
  maximumRouteDistanceKm: number;
  collectionStartTime: string;
  collectionEndTime: string;
  status: string;
}

export interface VehicleResponse {
  vehicle: {
    vehicleId: number;
    userId: number;
    vehicleName: string;
    capacityKg: number;
    status: string;
    isActive: boolean;
    createdAt: string;
  };
  routingConstraint: {
    constraintId: number;
    vehicleId: number;
    vehicleCapacityKg: number;
    maximumRouteDistanceKm: number;
    collectionStartTime: string;
    collectionEndTime: string;
  };
}

export interface VehicleListItem {
  vehicleId: number;
  userId: number;
  vehicleName: string;
  capacityKg: number;
  status: string;
  isActive: boolean;
  createdAt: string;
  maximumRouteDistanceKm: number;
  collectionStartTime: string;
  collectionEndTime: string;
}


export interface FinalizeOnboardingArea {
  areaName: string;
  populationDensity: number;
  latitude: number;
  longitude: number;
}

export interface FinalizeOnboardingWasteRecord {
  areaName: string;
  collectionDate: string;
  wasteType: string;
  weightKg: number;
  status: string;
}

export interface FinalizeOnboardingTruck {
  vehicleName: string;
  capacityKg: number;
  maximumRouteDistanceKm: number;
  collectionStartTime: string;
  collectionEndTime: string;
}

export interface FinalizeOnboardingRequest {
  areas: FinalizeOnboardingArea[];
  wasteRecords: FinalizeOnboardingWasteRecord[];
  trucks: FinalizeOnboardingTruck[];
}




@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly tokenKey = 'ecoroute_token';
  private readonly userKey = 'ecoroute_user';
  private readonly twoFactorKey = 'ecoroute_2fa';

  constructor(
    private http: HttpClient,
    private api: ApiService
  ) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.api.getBaseUrl()}/Auth/login`,
        request,
        { withCredentials: true } // SENDS THE TRUSTED DEVICE COOKIE
      )
      .pipe(
        tap(response => {
          // 2FA NEEDED: DON'T SAVE A TOKEN YET

          if (isTwoFactorRequired(response)) {
            this.savePendingTwoFactor(response);
            return;
          }

          this.clearPendingTwoFactor();
          this.saveSession(response);
        })
      );
  }

  verifyTwoFactor(code: string): Observable<AuthResponse> {
    const pending = this.getPendingTwoFactor();

    return this.http
      .post<AuthResponse>(
        `${this.api.getBaseUrl()}/Auth/verify-two-factor`,
        { challengeId: pending?.challengeId ?? '', code },
        { withCredentials: true } // RECEIVES THE TRUSTED DEVICE COOKIE
      )
      .pipe(
        tap(response => {
          this.saveSession(response);
          this.clearPendingTwoFactor();
        })
      );
  }

  resendTwoFactorCode(): Observable<ResendCodeResponse> {
    const pending = this.getPendingTwoFactor();

    return this.http
      .post<ResendCodeResponse>(
        `${this.api.getBaseUrl()}/Auth/resend-two-factor-code`,
        { challengeId: pending?.challengeId ?? '' }
      )
      .pipe(
        tap(response => {
          this.setResendAvailableIn(response.resendAvailableInSeconds);
        })
      );
  }

  // PENDING 2FA (sessionStorage SO IT SURVIVES A REFRESH)

  getPendingTwoFactor(): PendingTwoFactor | null {
    const value = sessionStorage.getItem(this.twoFactorKey);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  setResendAvailableIn(seconds: number): void {
    const pending = this.getPendingTwoFactor();

    if (!pending) {
      return;
    }

    pending.resendAvailableAt = Date.now() + seconds * 1000;
    sessionStorage.setItem(this.twoFactorKey, JSON.stringify(pending));
  }

  clearPendingTwoFactor(): void {
    sessionStorage.removeItem(this.twoFactorKey);
  }

  private savePendingTwoFactor(response: TwoFactorRequiredResponse): void {
    const pending: PendingTwoFactor = {
      challengeId: response.challengeId,
      maskedEmail: response.maskedEmail,
      resendAvailableAt: Date.now() + response.resendAvailableInSeconds * 1000
    };

    sessionStorage.setItem(this.twoFactorKey, JSON.stringify(pending));
  }

  
private saveSession(response: AuthResponse): void {
  localStorage.setItem(
    this.userKey,
    JSON.stringify({
      userId: response.userId,
      fullName: response.fullName,
      email: response.email,
      username: response.username,
      role: response.role,
      isOnboardingComplete: response.isOnboardingComplete
    })
  );
}

getOnboardingStatus(): Observable<OnboardingStatusResponse> {
  return this.http.get<OnboardingStatusResponse>(
    `${this.api.getBaseUrl()}/Onboarding/status`,
    { withCredentials: true }
  );
}

importAreas(areas: AreaImportRow[]): Observable<AreaImportResponse> {
  return this.http.post<AreaImportResponse>(
    `${this.api.getBaseUrl()}/Areas/import`,
    {
      areas: areas.map(area => ({
        areaName: area.areaName,
        populationDensity: area.populationDensity,
        latitude: area.latitude,
        longitude: area.longitude
      }))
    },
    { withCredentials: true }
  );
}


importHistoricalWaste(
  records: HistoricalWasteImportRow[]
): Observable<HistoricalWasteImportResponse> {
  return this.http.post<HistoricalWasteImportResponse>(
    `${this.api.getBaseUrl()}/Waste/import-historical`,
    { records },
    { withCredentials: true }
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


completeOnboarding(): Observable<{ message: string; isOnboardingComplete: boolean }> {
  return this.http.post<{
    message: string;
    isOnboardingComplete: boolean;
  }>(
    `${this.api.getBaseUrl()}/Onboarding/complete`,
    {},
    { withCredentials: true }
  );
}


  clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
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
    return !!this.getUser();
  }


getVehicles(): Observable<VehicleListItem[]> {
  return this.http.get<VehicleListItem[]>(
    `${this.api.getBaseUrl()}/Vehicles`,
    { withCredentials: true }
  );
}

createVehicle(
  request: VehicleRequest
): Observable<VehicleResponse> {
  return this.http.post<VehicleResponse>(
    `${this.api.getBaseUrl()}/Vehicles/with-constraints`,
    request,
    { withCredentials: true }
  );
}

updateVehicle(
  vehicleId: number,
  request: VehicleRequest
): Observable<VehicleResponse> {
  return this.http.put<VehicleResponse>(
    `${this.api.getBaseUrl()}/Vehicles/${vehicleId}/with-constraints`,
    request,
    { withCredentials: true }
  );
}

deleteVehicle(vehicleId: number): Observable<{ message: string }> {
  return this.http.delete<{ message: string }>(
    `${this.api.getBaseUrl()}/Vehicles/${vehicleId}`,
    { withCredentials: true }
  );
}


finalizeOnboarding(payload: FinalizeOnboardingRequest) {
  return this.http.post<{
    message: string;
    importedAreas: number;
    importedWasteRecords: number;
    importedTrucks: number;
  }>(
    `${this.api.getBaseUrl()}/Onboarding/finalize`,
    payload,
    { withCredentials: true }
  );
}


}
