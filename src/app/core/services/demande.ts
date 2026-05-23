import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse, DemandeDto, CreateDemandeRequest,
  MatchingDto, CreateMatchingRequest, SendDevisRequest
} from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DemandeService {
  private readonly base = `${environment.apiUrl}/demandes`;
  private readonly matchingsBase = `${environment.apiUrl}/matchings`;

  constructor(private http: HttpClient) {}

  /** POST /api/demandes — créer une demande (role CLIENT required) */
  create(req: CreateDemandeRequest): Observable<DemandeDto> {
    return this.http.post<ApiResponse<DemandeDto>>(this.base, req)
      .pipe(map(r => r.data!));
  }

  /** GET /api/demandes/mes-demandes */
  getMesDemandes(): Observable<DemandeDto[]> {
    return this.http.get<ApiResponse<DemandeDto[]>>(`${this.base}/mes-demandes`)
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/demandes/{id} */
  getById(id: string): Observable<DemandeDto> {
    return this.http.get<ApiResponse<DemandeDto>>(`${this.base}/${id}`)
      .pipe(map(r => r.data!));
  }

  /** DELETE /api/demandes/{id} — annuler */
  cancel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // ---- MATCHINGS ----

  /** POST /api/matchings — demander un devis à un réparateur */
  createMatching(req: CreateMatchingRequest): Observable<string> {
    return this.http.post<ApiResponse<string>>(this.matchingsBase, req)
      .pipe(map(r => r.data!));
  }

  /** GET /api/matchings — liste selon le rôle */
  getMyMatchings(): Observable<MatchingDto[]> {
    return this.http.get<ApiResponse<MatchingDto[]>>(this.matchingsBase)
      .pipe(map(r => r.data ?? []));
  }

  /** POST /api/matchings/{id}/accepter */
  acceptDevis(matchingId: string): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.matchingsBase}/${matchingId}/accepter`, {})
      .pipe(map(r => r.data));
  }

  /** POST /api/matchings/{id}/refuser */
  refuserDevis(matchingId: string): Observable<void> {
    return this.http.post<void>(`${this.matchingsBase}/${matchingId}/refuser`, {});
  }

  /** POST /api/matchings/{id}/devis — réparateur envoie un devis */
  sendDevis(matchingId: string, req: SendDevisRequest): Observable<void> {
    return this.http.post<void>(`${this.matchingsBase}/${matchingId}/devis`, req);
  }

  /** POST /api/matchings/{id}/vu */
  marquerVu(matchingId: string): Observable<void> {
    return this.http.post<void>(`${this.matchingsBase}/${matchingId}/vu`, {});
  }
}
