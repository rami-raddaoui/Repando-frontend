import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';
import { ApiResponse, MessageDto, MatchingDto, SendMessageRequest } from '../models/models';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth';

export interface ReclamationRequest { objet: string; message: string; }
export interface ReclamationDto {
  id: string; matchingId: string; signalantNom: string; sujetNom: string;
  objet: string; message: string; statut: string; reponseAdmin?: string;
  reponduAt?: string; createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MessagerieService {
  private hub?: signalR.HubConnection;
  private _messages$ = new BehaviorSubject<MessageDto[]>([]);
  readonly messages$ = this._messages$.asObservable();

  private _unreadCount$ = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this._unreadCount$.asObservable();

  // Conversation closed signal (matchingId + reason)
  private _convClosed$ = new BehaviorSubject<{ matchingId: string; reason: string; message: string } | null>(null);
  readonly convClosed$ = this._convClosed$.asObservable();

  // Prise en charge events
  private _priseEnChargeProposee$ = new BehaviorSubject<string | null>(null);
  readonly priseEnChargeProposee$ = this._priseEnChargeProposee$.asObservable();

  private _priseEnChargeConfirmee$ = new BehaviorSubject<string | null>(null);
  readonly priseEnChargeConfirmee$ = this._priseEnChargeConfirmee$.asObservable();

  // Read receipt signal
  private _messagesRead$ = new BehaviorSubject<{ matchingId: string; readByUserId: string } | null>(null);
  readonly messagesRead$ = this._messagesRead$.asObservable();

  // Recent conversations for navbar bubble
  private _recentConvs$ = new BehaviorSubject<MatchingDto[]>([]);
  readonly recentConvs$ = this._recentConvs$.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  /** GET /api/messages/matching/{matchingId} */
  getMessages(matchingId: string): Observable<MessageDto[]> {
    return this.http.get<ApiResponse<MessageDto[]>>(
      `${environment.apiUrl}/messages/matching/${matchingId}`
    ).pipe(map(r => r.data ?? []));
  }

  /** POST /api/messages/matching/{matchingId} */
  sendMessage(matchingId: string, req: SendMessageRequest): Observable<MessageDto> {
    return this.http.post<ApiResponse<MessageDto>>(
      `${environment.apiUrl}/messages/matching/${matchingId}`, req
    ).pipe(map(r => r.data!));
  }

  /** GET /api/messages/unread-count */
  getUnreadCount(): Observable<number> {
    return this.http.get<ApiResponse<number>>(
      `${environment.apiUrl}/messages/unread-count`
    ).pipe(map(r => r.data ?? 0));
  }

  /** POST /api/matchings/{id}/valider-prise-en-charge */
  validerPriseEnCharge(matchingId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/matchings/${matchingId}/valider-prise-en-charge`, {}
    ).pipe(map(() => void 0));
  }

  /** POST /api/matchings/{id}/confirmer-prise-en-charge */
  confirmerPriseEnCharge(matchingId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/matchings/${matchingId}/confirmer-prise-en-charge`, {}
    ).pipe(map(() => void 0));
  }

  /** POST /api/reclamations/matching/{matchingId} */
  creerReclamation(matchingId: string, req: ReclamationRequest): Observable<void> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/reclamations/matching/${matchingId}`, req
    ).pipe(map(() => void 0));
  }

  /** GET /api/reclamations/mes-reclamations */
  getMesReclamations(): Observable<ReclamationDto[]> {
    return this.http.get<ApiResponse<ReclamationDto[]>>(
      `${environment.apiUrl}/reclamations/mes-reclamations`
    ).pipe(map(r => r.data ?? []));
  }

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
        this._messages$.next([...this._messages$.value, msg]);
      }
    });

    this.hub.on('ConversationClosed', (data: any) => {
      this._convClosed$.next(data);
      // Append system message locally if in this conversation
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
    });

    this.hub.on('PriseEnChargeProposee', (data: any) => {
      this._priseEnChargeProposee$.next(data.matchingId);
    });

    this.hub.on('PriseEnChargeConfirmee', (data: any) => {
      this._priseEnChargeConfirmee$.next(data.matchingId);
    });

    this.hub.on('MessagesRead', (data: any) => {
      if (data.matchingId === matchingId) {
        const updated = this._messages$.value.map(m =>
          !m.isRead ? { ...m, isRead: true } : m
        );
        this._messages$.next(updated);
        this._messagesRead$.next(data);
      }
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

  setMessages(msgs: MessageDto[]): void {
    this._messages$.next(msgs);
  }

  setRecentConvs(matchings: MatchingDto[]): void {
    this._recentConvs$.next(matchings.slice(0, 5));
    // Update unread count
    const unread = matchings.filter(m => m.hasUnreadMessages).length;
    this._unreadCount$.next(unread);
  }
}
