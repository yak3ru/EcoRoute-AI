import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private readonly baseUrl = 'https://ecoroute-api.runasp.net/api';

  getBaseUrl(): string {
    return this.baseUrl;
  }
}