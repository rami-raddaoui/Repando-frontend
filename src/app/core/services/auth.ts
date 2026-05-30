import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
  ApiResponse, AuthResponse, LoginRequest,
  RegisterRequest, UserDto, UserRole, UpdateProfileRequest
} from '../models/models';
import { environment } from '../../../environments/environment';

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

  private _currentUser = signal<AuthResponse | null>(this.loadUser());
  readonly currentUser  = this._currentUser.asReadonly();
  readonly isLoggedIn   = computed(() => !!this._currentUser());
  readonly isClient     = computed(() => this._currentUser()?.role === UserRole.CLIENT);
  readonly isReparateur = computed(() => this._currentUser()?.role === UserRole.REPARATEUR);
  readonly isAdmin      = computed(() => this._currentUser()?.role === UserRole.ADMIN);

  constructor(private http: HttpClient, private router: Router) {}

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(
      `${environment.apiUrl}/auth/login`, payload
    ).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur de connexion');
        return { ...res.data, avatarUrl: resolveStaticUrl(res.data.avatarUrl) };
      }),
      tap(data => this.storeSession(data))
    );
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(
      `${environment.apiUrl}/auth/register`, payload
    ).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur d\'inscription');
        return { ...res.data, avatarUrl: resolveStaticUrl(res.data.avatarUrl) };
      }),
      tap(data => this.storeSession(data))
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
}
