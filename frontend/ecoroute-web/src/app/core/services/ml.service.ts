import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MlRouteArea {
  area_id: number;
  area_name: string;
  predicted_waste_kg: number;
  p10_kg: number;
  p50_kg: number;
  p90_kg: number;
}

export interface MlRoute {
  vehicle_id: number;
  vehicle_name: string;
  capacity_kg: number;
  maximum_distance_km: number;
  collection_start: string;
  collection_end: string;
  road_accessibility: string;
  area_restrictions: string;
  load_kg: number;
  areas: MlRouteArea[];
  distance_km: number;
  remaining_capacity_kg: number;
  distance_exceeded: boolean;
}

export interface MlRoutesResponse {
  status: string;
  mode: string;
  routes: MlRoute[];
  unassigned: unknown[];
}

@Injectable({
  providedIn: 'root'
})
export class MlService {

  private http = inject(HttpClient);

  private apiUrl = 'https://ecoroute-api.runasp.net/api/ml';

  getP90Routes(): Observable<MlRoutesResponse> {
    return this.http.get<MlRoutesResponse>(
      `${this.apiUrl}/routes/p90`
    );
  }

  getRoutes(): Observable<MlRoutesResponse> {
    return this.http.get<MlRoutesResponse>(
      `${this.apiUrl}/routes`
    );
  }

  getRoadRoute(
    coordinates: string
    ) {
    return this.http.get<any>(
        `https://ecoroute-api.runasp.net/api/map/route`,
        {
        params: {
            coordinates
        }
        }
    );
    }
}