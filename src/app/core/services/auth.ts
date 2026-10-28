import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
  ApiResponse, AuthResponse, LoginRequest,
  RegisterRequest, UserDto, UserRole, UpdateProfileRequest,
  TypeAppareil, TypeIntervention, TypePanne
} from '../models/models';
import { environment } from '../../../environments/environment';
import { DemandeService } from './demande';

/** Resolve a relative static path to an absolute URL */
export function resolveStaticUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${environment.staticUrl}${path}`;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'repando_token';
  private readonly USER_KEY  = 'repando_user';
  private readonly DRAFT_KEY = 'repando_demande_draft';

  private _currentUser = signal<AuthResponse | null>(this.loadUser());
  readonly currentUser  = this._currentUser.asReadonly();
  readonly isLoggedIn   = computed(() => !!this._currentUser());
  readonly isClient     = computed(() => this._currentUser()?.role === UserRole.CLIENT);
  readonly isReparateur = computed(() => this._currentUser()?.role === UserRole.REPARATEUR);
  readonly isAdmin      = computed(() => this._currentUser()?.role === UserRole.ADMIN);

  /** Vrai si l'admin navigue en mode surveillance (impersonation) */
  readonly isImpersonating = computed(() =>
    typeof window !== 'undefined' && !!sessionStorage.getItem('repando_admin_token')
  );

  constructor(private http: HttpClient, private router: Router, private demandeService: DemandeService) {}

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(
      `${environment.apiUrl}/auth/login`, payload
    ).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur de connexion');
        return { ...res.data, avatarUrl: resolveStaticUrl(res.data.avatarUrl) };
      }),
      tap(data => {
        this.storeSession(data);
        this.flushPendingDraftForLoggedClient(data.role);
      })
    );
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/reset-password`, { token, newPassword });
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {    return this.http.post<ApiResponse<AuthResponse>>(
      `${environment.apiUrl}/auth/register`, payload
    ).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur d\'inscription');
        return { ...res.data, avatarUrl: resolveStaticUrl(res.data.avatarUrl) };
      }),
      tap(data => {
        this.storeSession(data);
        this.flushPendingDraftForLoggedClient(data.role);
      })
    );
  }

  me(): Observable<UserDto> {
    return this.http.get<ApiResponse<UserDto>>(`${environment.apiUrl}/auth/me`).pipe(
      map(res => res.data!)
    );
  }

  updateProfile(payload: UpdateProfileRequest): Observable<UserDto> {
    return this.http.patch<ApiResponse<UserDto>>(
      `${environment.apiUrl}/auth/profile`, payload
    ).pipe(
      map(res => res.data!),
      tap(user => {
        const current = this._currentUser();
        if (current) {
          const updated: AuthResponse = {
            ...current,
            prenom: user.prenom,
            nom: user.nom,
            avatarUrl: resolveStaticUrl(user.avatarUrl)
          };
          this.storeSession(updated);
        }
      })
    );
  }

  uploadAvatar(dataUrl: string): Observable<string> {
    return this.http.post<ApiResponse<string>>(
      `${environment.apiUrl}/auth/avatar`, { dataUrl }
    ).pipe(
      map(res => res.data!),
      tap(avatarPath => {
        const resolvedUrl = resolveStaticUrl(avatarPath)!;
        const current = this._currentUser();
        if (current) this.storeSession({ ...current, avatarUrl: resolvedUrl });
      })
    );
  }

  removeAvatar(): Observable<void> {
    return this.http.delete<ApiResponse<void>>(
      `${environment.apiUrl}/auth/avatar`
    ).pipe(
      map(() => void 0),
      tap(() => {
        const current = this._currentUser();
        if (current) this.storeSession({ ...current, avatarUrl: undefined });
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/connexion']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  storeSession(data: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, data.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data));
    this._currentUser.set(data);
  }

  private loadUser(): AuthResponse | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  checkContact(payload: { email?: string; telephone?: string }): Observable<{ emailExists: boolean; telephoneExists: boolean }> {
    return this.http.post<ApiResponse<{ emailExists: boolean; telephoneExists: boolean }>>(
      `${environment.apiUrl}/auth/check-contact`, payload
    ).pipe(
      map(res => res.data ?? { emailExists: false, telephoneExists: false })
    );
  }

  sendDraftReminder(payload: { email: string; deviceName?: string; brand?: string; url?: string }): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/auth/draft-reminder`, payload
    ).pipe(map(() => void 0));
  }

  private flushPendingDraftForLoggedClient(role: UserRole): void {
    if (role !== UserRole.CLIENT || typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(this.DRAFT_KEY);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw);
      if (!draft) return;

      const photoUrls = Array.isArray(draft.photoPreviews)
        ? draft.photoPreviews.map((p: any) => p?.url).filter(Boolean)
        : Array.isArray(draft.photoUrls)
          ? draft.photoUrls.filter(Boolean)
          : [];

      const payload = {
        typeAppareil: draft.typeAppareil ?? TypeAppareil.AUTRE,
        marque: draft.marque ?? '',
        modele: draft.modele ?? '',
        typePanne: draft.typePanne ?? TypePanne.AUTRE,
        description: draft.description ?? '',
        photoUrls,
        adresse: draft.adresse ?? '',
        ville: draft.ville ?? 'Paris',
        codePostal: draft.codePostal ?? '',
        latitude: draft.latitude ?? undefined,
        longitude: draft.longitude ?? undefined,
        typeIntervention: draft.typeIntervention ?? TypeIntervention.INDIFFERENT,
      };

      this.demandeService.create(payload).subscribe({
        next: () => {
          window.localStorage.removeItem(this.DRAFT_KEY);
        },
        error: () => {
          // Keep draft as a fallback so the user can retry later without losing context.
        }
      });
    } catch {
      window.localStorage.removeItem(this.DRAFT_KEY);
    }
  }
}
