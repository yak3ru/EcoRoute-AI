import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private readonly baseUrl = 'http://localhost:5276/api';

  getBaseUrl(): string {
    return this.baseUrl;
  }
}