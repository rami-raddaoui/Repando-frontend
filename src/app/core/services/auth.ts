import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
  ApiResponse, AuthResponse, LoginRequest,
  RegisterRequest, UserDto, UserRole
} from '../models/models';
import { environment } from '../../../environments/environment';

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

  /** POST /api/auth/login */
  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(
      `${environment.apiUrl}/auth/login`, payload
    ).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur de connexion');
        return res.data;
      }),
      tap(data => this.storeSession(data))
    );
  }

  /** POST /api/auth/register (client ou réparateur selon le champ role) */
  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(
      `${environment.apiUrl}/auth/register`, payload
    ).pipe(
      map(res => {
        if (!res.success || !res.data) throw new Error(res.error ?? 'Erreur d\'inscription');
        return res.data;
      }),
      tap(data => this.storeSession(data))
    );
  }

  /** GET /api/auth/me — profil utilisateur connecté */
  me(): Observable<UserDto> {
    return this.http.get<ApiResponse<UserDto>>(`${environment.apiUrl}/auth/me`).pipe(
      map(res => res.data!)
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

  private storeSession(data: AuthResponse): void {
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
