import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';
import { ApiResponse, MessageDto, MatchingDto, SendMessageRequest, TypeMessage } from '../models/models';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth';

export interface ReclamationRequest { objet: string; message: string; }
export interface ReclamationDto {
  id: string; matchingId: string; signalantNom: string; sujetNom: string;
  objet: string; message: string; statut: string; reponseAdmin?: string;
  reponduAt?: string; createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;      // 'PRISE_EN_CHARGE' | 'CONV_CLOSED' | 'NEW_MESSAGE' | 'CONFIRMED' | etc.
  titre: string;
  message: string;
  matchingId?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MessagerieService {
  // ── Per-conversation hub (messagerie page) ─────────────────
  private hub?: signalR.HubConnection;
  private _messages$ = new BehaviorSubject<MessageDto[]>([]);
  readonly messages$ = this._messages$.asObservable();

  // ── Global user hub (connected from navbar, always alive) ──
  private globalHub?: signalR.HubConnection;
  private _globalConnected = false;

  // ── Unread messages count ──────────────────────────────────
  private _unreadCount$ = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this._unreadCount$.asObservable();

  // ── App-level notifications (bell icon) ───────────────────
  private _notifications$ = new BehaviorSubject<AppNotification[]>([]);
  readonly notifications$ = this._notifications$.asObservable();
  private _notifCount$ = new BehaviorSubject<number>(0);
  readonly notifCount$ = this._notifCount$.asObservable();

  // ── Conversation-level events ──────────────────────────────
  private _convClosed$ = new BehaviorSubject<{ matchingId: string; reason: string; message: string } | null>(null);
  readonly convClosed$ = this._convClosed$.asObservable();

  private _priseEnChargeProposee$ = new BehaviorSubject<string | null>(null);
  readonly priseEnChargeProposee$ = this._priseEnChargeProposee$.asObservable();

  private _priseEnChargeConfirmee$ = new BehaviorSubject<string | null>(null);
  readonly priseEnChargeConfirmee$ = this._priseEnChargeConfirmee$.asObservable();

  private _messagesRead$ = new BehaviorSubject<{ matchingId: string; readByUserId: string } | null>(null);
  readonly messagesRead$ = this._messagesRead$.asObservable();

  // ── Recent convs for navbar bubble ────────────────────────
  private _recentConvs$ = new BehaviorSubject<MatchingDto[]>([]);
  readonly recentConvs$ = this._recentConvs$.asObservable();

  // ── Polling subscription ──────────────────────────────────
  private pollSub?: Subscription;

  constructor(private http: HttpClient, private auth: AuthService) {}

  // ═══════════════════════════════════════════════════════════
  // GLOBAL HUB — connect once at login, stay alive globally
  // ═══════════════════════════════════════════════════════════
  connectGlobalHub(): void {
    if (this._globalConnected || this.globalHub) return;
    const token = this.auth.getToken();
    if (!token) return;

    this.globalHub = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/chat`, {
        accessTokenFactory: () => this.auth.getToken() ?? ''
      })
      .withAutomaticReconnect()
      .build();

    // New message anywhere → refresh unread count + convs
    this.globalHub.on('ReceiveMessage', (msg: MessageDto) => {
      this.refreshConvs();
      // Push in-app notification if not on the messagerie page
      if (!window.location.pathname.includes('/messagerie')) {
        this.pushNotification({
          id: crypto.randomUUID(),
          type: 'NEW_MESSAGE',
          titre: '💬 Nouveau message',
          message: `Message de ${msg.senderNom}`,
          matchingId: msg.matchingId,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
    });

    // Prise en charge proposée → notify client
    this.globalHub.on('PriseEnChargeProposee', (data: any) => {
      this._priseEnChargeProposee$.next(data.matchingId);
      this.refreshConvs();
      this.pushNotification({
        id: crypto.randomUUID(),
        type: 'PRISE_EN_CHARGE',
        titre: '🔧 Demande de prise en charge',
        message: 'Un réparateur confirme la prise en charge — votre confirmation est requise.',
        matchingId: data.matchingId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    // Prise en charge confirmée → notify reparateur
    this.globalHub.on('PriseEnChargeConfirmee', (data: any) => {
      this._priseEnChargeConfirmee$.next(data.matchingId);
      this.refreshConvs();
      this.pushNotification({
        id: crypto.randomUUID(),
        type: 'CONFIRMED',
        titre: '✅ Prise en charge confirmée !',
        message: 'Le client a confirmé la réparation. Honorez votre engagement.',
        matchingId: data.matchingId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    // Mission acceptée par un réparateur → notify client
    this.globalHub.on('MissionAcceptee', (data: any) => {
      this.refreshConvs();
      this.pushNotification({
        id: crypto.randomUUID(),
        type: 'MISSION_ACCEPTEE',
        titre: '🎉 Réparateur disponible !',
        message: 'Un réparateur a accepté votre demande. Vous pouvez maintenant échanger.',
        matchingId: data.matching_id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    // Conversation fermée
    this.globalHub.on('ConversationClosed', (data: any) => {
      this._convClosed$.next(data);
      this.refreshConvs();
      this.pushNotification({
        id: crypto.randomUUID(),
        type: 'CONV_CLOSED',
        titre: '🔒 Conversation clôturée',
        message: data.message ?? 'Une conversation a été clôturée.',
        matchingId: data.matchingId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    // Messages lus → update convs + per-conv messages
    this.globalHub.on('MessagesRead', (data: any) => {
      // Update per-conv messages read state
      const updated = this._messages$.value.map(m =>
        m.matchingId === data.matchingId && !m.isRead ? { ...m, isRead: true } : m
      );
      this._messages$.next(updated);
      this._messagesRead$.next(data);
      // Clear unread badge for that conv
      const convs = this._recentConvs$.value.map(c =>
        c.id === data.matchingId ? { ...c, hasUnreadMessages: false } : c
      );
      this._recentConvs$.next(convs);
      this._unreadCount$.next(convs.filter(c => c.hasUnreadMessages).length);
    });

    this.globalHub.start()
      .then(() => { this._globalConnected = true; })
      .catch(console.error);

    // Poll every 30s for fresh unread count & convs (safety net)
    this.pollSub = interval(30_000).subscribe(() => this.refreshConvs());
  }

  disconnectGlobalHub(): void {
    this.pollSub?.unsubscribe();
    this.globalHub?.stop();
    this.globalHub = undefined;
    this._globalConnected = false;
  }

  /** Force-refresh unread counts and recent convs from API */
  refreshConvs(): void {
    // En mode impersonation le rôle est CLIENT/REPARATEUR, pas ADMIN — on peut rafraîchir
    // Bloquer uniquement pour l'admin pur (non impersonifié)
    if (!this.auth.isLoggedIn()) return;
    if (this.auth.isAdmin() && !this.auth.isImpersonating()) return;
    // X-Silent : pas de toast d'erreur pour ce polling silencieux
    this.http.get<ApiResponse<MatchingDto[]>>(`${environment.apiUrl}/matchings`,
      { headers: { 'X-Silent': '1' } })
      .pipe(map(r => r.data ?? []))
      .subscribe({ next: m => this.setRecentConvs(m), error: () => {} });
  }

  // ═══════════════════════════════════════════════════════════
  // PER-CONVERSATION HUB (messagerie page)
  // ═══════════════════════════════════════════════════════════
  /** Connexion SignalR au hub /hubs/chat */
  connectHub(matchingId: string): void {
    const token = this.auth.getToken();
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/chat`, {
        accessTokenFactory: () => token ?? ''
      })
      .withAutomaticReconnect()
      .build();

    this.hub.on('ReceiveMessage', (msg: MessageDto) => {
      if (msg.matchingId === matchingId) {
        const normalized = this.normalizeMsg(msg);
        const current = this._messages$.value;
        if (!current.find(m => m.id === normalized.id)) {
          this._messages$.next([...current, normalized]);
        } else {
          this._messages$.next(current.map(m => m.id === normalized.id ? { ...m, ...normalized } : m));
        }
      }
      // Always refresh navbar unread
      this.refreshConvs();
    });

    this.hub.on('ConversationClosed', (data: any) => {
      this._convClosed$.next(data);
      if (data.matchingId === matchingId) {
        const systemMsg: MessageDto = {
          id: crypto.randomUUID(),
          matchingId: data.matchingId,
          senderId: '',
          senderNom: 'Repando',
          senderIsReparateur: false,
          type: 'SYSTEME' as any,
          contenu: data.message,
          isRead: true,
          createdAt: new Date().toISOString()
        };
        this._messages$.next([...this._messages$.value, systemMsg]);
      }
      this.refreshConvs();
    });

    this.hub.on('PriseEnChargeProposee', (data: any) => {
      this._priseEnChargeProposee$.next(data.matchingId);
      this.refreshConvs();
    });

    this.hub.on('PriseEnChargeConfirmee', (data: any) => {
      this._priseEnChargeConfirmee$.next(data.matchingId);
      this.refreshConvs();
    });

    this.hub.on('MessagesRead', (data: any) => {
      if (data.matchingId === matchingId) {
        const updated = this._messages$.value.map(m =>
          !m.isRead ? { ...m, isRead: true } : m
        );
        this._messages$.next(updated);
        this._messagesRead$.next(data);
      }
      this.refreshConvs();
    });

    this.hub.start()
      .then(() => this.hub!.invoke('JoinMatching', matchingId))
      .catch(console.error);
  }

  disconnectHub(): void {
    this.hub?.stop();
    this._messages$.next([]);
    this.hub = undefined;
  }

  // ═══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  private pushNotification(notif: AppNotification): void {
    const current = this._notifications$.value;
    // Keep last 20, newest first
    const updated = [notif, ...current].slice(0, 20);
    this._notifications$.next(updated);
    this._notifCount$.next(updated.filter(n => !n.isRead).length);
  }

  markNotifRead(id: string): void {
    const updated = this._notifications$.value.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this._notifications$.next(updated);
    this._notifCount$.next(updated.filter(n => !n.isRead).length);
  }

  markAllNotifsRead(): void {
    const updated = this._notifications$.value.map(n => ({ ...n, isRead: true }));
    this._notifications$.next(updated);
    this._notifCount$.next(0);
  }

  clearNotifs(): void {
    this._notifications$.next([]);
    this._notifCount$.next(0);
  }

  // ═══════════════════════════════════════════════════════════
  // HTTP
  // ═══════════════════════════════════════════════════════════
  getMessages(matchingId: string): Observable<MessageDto[]> {
    // En mode impersonation admin : utiliser l'endpoint readonly (sans marquer comme lu)
    const endpoint = this.auth.isImpersonating()
      ? `${environment.apiUrl}/messages/matching/${matchingId}/readonly`
      : `${environment.apiUrl}/messages/matching/${matchingId}`;
    return this.http.get<ApiResponse<MessageDto[]>>(endpoint)
      .pipe(map(r => (r.data ?? []).map(m => this.normalizeMsg(m))));
  }

  sendMessage(matchingId: string, req: SendMessageRequest): Observable<MessageDto> {
    return this.http.post<ApiResponse<MessageDto>>(
      `${environment.apiUrl}/messages/matching/${matchingId}`, req
    ).pipe(map(r => this.normalizeMsg(r.data!)));
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<ApiResponse<number>>(
      `${environment.apiUrl}/messages/unread-count`,
      { headers: { 'X-Silent': '1' } }
    ).pipe(map(r => r.data ?? 0));
  }

  validerPriseEnCharge(matchingId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/matchings/${matchingId}/valider-prise-en-charge`, {}
    ).pipe(map(() => void 0));
  }

  confirmerPriseEnCharge(matchingId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/matchings/${matchingId}/confirmer-prise-en-charge`, {}
    ).pipe(map(() => void 0));
  }

  creerReclamation(matchingId: string, req: ReclamationRequest): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/reclamations/matching/${matchingId}`, req
    ).pipe(map(() => void 0));
  }

  getMesReclamations(): Observable<ReclamationDto[]> {
    return this.http.get<ApiResponse<ReclamationDto[]>>(
      `${environment.apiUrl}/reclamations/mes-reclamations`
    ).pipe(map(r => r.data ?? []));
  }

  setMessages(msgs: MessageDto[]): void {
    this._messages$.next(msgs.map(m => this.normalizeMsg(m)));
  }

  getMessagesSnapshot(): MessageDto[] {
    return this._messages$.value;
  }

  appendMessage(msg: MessageDto): void {
    const normalized = this.normalizeMsg(msg);
    const current = this._messages$.value;
    if (!current.find(m => m.id === normalized.id)) {
      this._messages$.next([...current, normalized]);
    }
  }

  /** Normalise le type d'un message (string → enum) pour garantir la comparaison dans le template */
  private normalizeMsg(msg: MessageDto): MessageDto {
    const typeStr = (msg.type as any as string).toUpperCase();
    const validTypes: string[] = Object.values(TypeMessage);
    const type = validTypes.includes(typeStr) ? (typeStr as TypeMessage) : TypeMessage.TEXTE;
    return { ...msg, type };
  }

  setRecentConvs(matchings: MatchingDto[]): void {
    this._recentConvs$.next(matchings.slice(0, 10));
    const unread = matchings.filter(m => m.hasUnreadMessages).length;
    this._unreadCount$.next(unread);
  }
}
