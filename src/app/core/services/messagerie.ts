import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';
import { ApiResponse, MessageDto, SendMessageRequest } from '../models/models';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth';

@Injectable({ providedIn: 'root' })
export class MessagerieService {
  private hub?: signalR.HubConnection;
  private _messages$ = new BehaviorSubject<MessageDto[]>([]);
  readonly messages$ = this._messages$.asObservable();

  private _unreadCount$ = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this._unreadCount$.asObservable();

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

  /** Connexion SignalR au hub /hubs/chat — token via query string */
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
}
