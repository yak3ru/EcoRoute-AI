import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private readonly baseUrl = 'https://eco-route-ai-yuwx-zeta.vercel.app/api';

  getBaseUrl(): string {
    return this.baseUrl;
  }
}