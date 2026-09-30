import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../../environments/environment';

interface DemandeDraftData {
  typeAppareil?: string | null;
  marque?: string | null;
  modele?: string | null;
  typePanne?: string | null;
  description?: string | null;
  photoUrls?: string[] | null;
  adresse?: string | null;
  ville?: string | null;
  codePostal?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  typeIntervention?: string | null;
}

interface DemandeDraftDto {
  id: string;
  sessionId: string;
  userId?: string | null;
  email?: string | null;
  data: DemandeDraftData;
  convertedToDemande: boolean;
  demandeIdFinal?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GetOrCreateDraftResponse {
  draftId: string;
  sessionId: string;
  existingData?: DemandeDraftData | null;
  draftExists: boolean;
}

interface ApiResponseWrapper<T> {
  success: boolean;
  data?: T;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DemandeDraftService {
  private readonly API_URL = `${environment.apiUrl}/demandes/draft`;

  private sessionId: string;
  private draftId$ = new BehaviorSubject<string | null>(null);
  private draftData$ = new BehaviorSubject<DemandeDraftData | null>(null);
  private isDrafting$ = new BehaviorSubject<boolean>(false);
  private autoSaveInProgress$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Récupère ou crée une nouvelle session utilisateur
   */
  private getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('repando_session_id');
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem('repando_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Initialise le brouillon (crée ou récupère un existant)
   */
  initDraft(): Observable<GetOrCreateDraftResponse> {
    return this.http.post<ApiResponseWrapper<GetOrCreateDraftResponse>>(`${this.API_URL}/init`, {
      sessionId: this.sessionId
    }).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur brouillon');
        return res.data;
      }),
      tap(data => {
        this.draftId$.next(data.draftId);
        if (data.existingData) {
          this.draftData$.next(data.existingData);
        }
      })
    );
  }

  /**
   * Auto-sauvegarde le brouillon (debounced)
   */
  autosaveDraft(data: DemandeDraftData): Observable<DemandeDraftDto> {
    const draftId = this.draftId$.value;
    if (!draftId) {
      throw new Error('No draft ID available');
    }

    this.autoSaveInProgress$.next(true);
    this.draftData$.next(data);

    return this.http.put<ApiResponseWrapper<DemandeDraftDto>>(`${this.API_URL}/${draftId}`, {
      sessionId: this.sessionId,
      data
    }).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur sauvegarde');
        return res.data;
      }),
      tap(() => {
        this.autoSaveInProgress$.next(false);
      })
    );
  }

  /**
   * Récupère le brouillon actuel
   */
  getDraft(draftId: string): Observable<DemandeDraftDto> {
    return this.http.get<ApiResponseWrapper<DemandeDraftDto>>(`${this.API_URL}/${draftId}`, {
      params: { sessionId: this.sessionId }
    }).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Brouillon introuvable');
        return res.data;
      })
    );
  }

  /**
   * Convertit le brouillon en demande (nécessite authentication)
   */
  convertToRequest(draftId: string): Observable<any> {
    return this.http.post<ApiResponseWrapper<any>>(`${this.API_URL}/${draftId}/convert`, {
      sessionId: this.sessionId
    }).pipe(
      map(res => {
        if (!res.success) throw new Error(res.error ?? 'Erreur conversion');
        return res.data;
      })
    );
  }

  // ---- OBSERVABLES pour le template ----

  getDraftId$(): Observable<string | null> {
    return this.draftId$.asObservable();
  }

  getDraftData$(): Observable<DemandeDraftData | null> {
    return this.draftData$.asObservable();
  }

  getAutoSaveInProgress$(): Observable<boolean> {
    return this.autoSaveInProgress$.asObservable();
  }

  getIsDrafting$(): Observable<boolean> {
    return this.isDrafting$.asObservable();
  }

  /**
   * Récupère le sessionId (utile pour debug/logs)
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Sauvegarder le brouillon dans localStorage (backup local)
   */
  saveDraftLocal(data: DemandeDraftData): void {
    localStorage.setItem('repando_draft_backup', JSON.stringify(data));
  }

  /**
   * Récupérer le brouillon depuis localStorage
   */
  getDraftLocal(): DemandeDraftData | null {
    const backup = localStorage.getItem('repando_draft_backup');
    return backup ? JSON.parse(backup) : null;
  }

  /**
   * Nettoyer le brouillon local
   */
  clearDraftLocal(): void {
    localStorage.removeItem('repando_draft_backup');
  }

  /**
   * Définir manuellement l'ID du brouillon
   */
  setDraftId(id: string): void {
    this.draftId$.next(id);
  }
}


