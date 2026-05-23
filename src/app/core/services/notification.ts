import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../models/models';
import { environment } from '../../../environments/environment';

export interface NotificationDto {
  id: string;
  type: string;
  titre: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<NotificationDto[]> {
    return this.http.get<ApiResponse<NotificationDto[]>>(
      `${environment.apiUrl}/notifications`
    ).pipe(map(r => r.data ?? []));
  }

  markRead(id: string): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/notifications/${id}/lu`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/notifications/lu-all`, {});
  }
}
