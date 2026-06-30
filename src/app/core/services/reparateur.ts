import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse, ReparateurPublicDto, ReparateurDetailDto,
  PagedResult, TypeAppareil, TypeIntervention, CreateReparateurRequest
} from '../models/models';
import { environment } from '../../../environments/environment';

export interface SearchParams {
  typeAppareil: TypeAppareil;
  latitude?: number;
  longitude?: number;
  rayonKm?: number;
  typeIntervention?: TypeIntervention;
  noteMin?: number;
  dispoSeulement?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ReparateurService {
  private readonly base = `${environment.apiUrl}/reparateurs`;

  constructor(private http: HttpClient) {}

  /** GET /api/reparateurs/search */
  search(params: SearchParams): Observable<PagedResult<ReparateurPublicDto>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) p = p.set(k, String(v));
    });
    return this.http.get<ApiResponse<PagedResult<ReparateurPublicDto>>>(
      `${this.base}/search`, { params: p }
    ).pipe(map(r => r.data!));
  }

  /** GET /api/reparateurs/{id} */
  getById(id: string): Observable<ReparateurDetailDto> {
    return this.http.get<ApiResponse<ReparateurDetailDto>>(`${this.base}/${id}`)
      .pipe(map(r => r.data!));
  }

  /** GET /api/reparateurs/dashboard */
  getDashboard(): Observable<any> {
    return this.http.get<any>(`${this.base}/dashboard`).pipe(map(r => r));
  }

  /** POST /api/reparateurs/profile */
  createProfile(req: CreateReparateurRequest): Observable<string> {
    return this.http.post<ApiResponse<string>>(`${this.base}/profile`, req)
      .pipe(map(r => r.data!));
  }

  /** PATCH /api/reparateurs/disponibilite */
  updateDispo(estDisponible: boolean): Observable<void> {
    return this.http.patch<void>(`${this.base}/disponibilite`, estDisponible);
  }

  /** POST /api/reparateurs/rc-pro — upload attestation RC Pro (base64 DataUrl) */
  uploadRcPro(dataUrl: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(
      `${this.base}/rc-pro`, { dataUrl }
    );
  }
}
