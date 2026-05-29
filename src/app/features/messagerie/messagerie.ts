import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MessagerieService, ReclamationDto } from '../../core/services/messagerie';
import { DemandeService } from '../../core/services/demande';
import { AuthService } from '../../core/services/auth';
import { MessageDto, MatchingDto, TypeMessage } from '../../core/models/models';

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './messagerie.html',
  styleUrl: './messagerie.scss'
})
export class MessagerieComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  matchings: MatchingDto[] = [];
  messages: MessageDto[] = [];
  activeMatchingId: string | null = null;
  activeMatching: MatchingDto | null = null;
  newMessage = '';
  loading = false;
  isClosed = false;
  awaitingClientConfirm = false;   // réparateur a envoyé demande, client pas encore confirmé
  confirmedByClient = false;       // client a confirmé la prise en charge

  readonly TypeMessage = TypeMessage;

  // ── Signalement ──────────────────────────────────────────────
  showSignalModal = false;
  signalObjet = '';
  signalMessage = '';
  signalLoading = false;
  signalSuccess = '';
  signalError = '';

  // ── Validation prise en charge ───────────────────────────────
  actionLoading = false;
  actionSuccess = '';
  actionError = '';

  // ── Mes réclamations ─────────────────────────────────────────
  showReclamations = false;
  reclamations: ReclamationDto[] = [];
  reclamationsLoading = false;

  private subs: Subscription[] = [];
  private shouldScrollDown = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    public messagerieService: MessagerieService,
    private demandeService: DemandeService,
  ) {}

  ngOnInit(): void {
    const matchingIdFromUrl = this.route.snapshot.paramMap.get('matchingId');

    // Load matchings first, then open conversation from URL (so activeMatching is populated)
    this.demandeService.getMyMatchings().subscribe({
      next: m => {
        this.matchings = m;
        this.messagerieService.setRecentConvs(m);
        if (matchingIdFromUrl) {
          this.openConversation(matchingIdFromUrl);
        }
      },
      error: () => {
        if (matchingIdFromUrl) this.openConversation(matchingIdFromUrl);
      }
    });

    this.subs.push(
      this.messagerieService.messages$.subscribe(msgs => {
        this.messages = msgs;
        this.shouldScrollDown = true;
      }),

      this.messagerieService.convClosed$.subscribe(ev => {
        if (ev && this.activeMatchingId === ev.matchingId) {
          this.isClosed = true;
          // Refresh matching statut
          this.loadMatchings();
        }
      }),

      this.messagerieService.priseEnChargeProposee$.subscribe(mid => {
        if (mid && mid === this.activeMatchingId) {
          this.awaitingClientConfirm = true;
          // Update the activeMatching object too so the banner stays after loadMatchings
          if (this.activeMatching) {
            this.activeMatching = { ...this.activeMatching, awaitingClientConfirm: true };
          }
          this.loadMatchings();
        }
      }),

      this.messagerieService.priseEnChargeConfirmee$.subscribe(mid => {
        if (mid && mid === this.activeMatchingId) {
          this.awaitingClientConfirm = false;
          this.confirmedByClient = true;
          if (this.activeMatching) {
            this.activeMatching = { ...this.activeMatching, awaitingClientConfirm: false, confirmedByClient: true };
            this.matchings = this.matchings.map(m =>
              m.id === mid ? { ...m, awaitingClientConfirm: false, confirmedByClient: true } : m
            );
          }
          this.loadMatchings();
        }
      })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollDown) {
      this.scrollToBottom();
      this.shouldScrollDown = false;
    }
  }

  ngOnDestroy(): void {
    this.messagerieService.disconnectHub();
    this.subs.forEach(s => s.unsubscribe());
  }

  loadMatchings(): void {
    this.demandeService.getMyMatchings().subscribe({
      next: m => {
        this.matchings = m;
        this.messagerieService.setRecentConvs(m);
        if (this.activeMatchingId) {
          const found = m.find(x => x.id === this.activeMatchingId) ?? null;
          this.activeMatching = found;
          this.isClosed = this.isConvClosed(found?.statut ?? '');
          this.awaitingClientConfirm = found?.awaitingClientConfirm ?? false;
          this.confirmedByClient = found?.confirmedByClient ?? false;
        }
      },
      error: () => {}
    });
  }

  openConversation(matchingId: string): void {
    if (this.activeMatchingId === matchingId) return;
    this.messagerieService.disconnectHub();
    this.activeMatchingId = matchingId;
    // Set from current list (may be stale), loadMatchings below will refresh
    const found = this.matchings.find(m => m.id === matchingId) ?? null;
    this.activeMatching = found;
    this.isClosed = this.isConvClosed(found?.statut ?? '');
    this.awaitingClientConfirm = found?.awaitingClientConfirm ?? false;
    this.confirmedByClient = found?.confirmedByClient ?? false;
    this.loading = true;
    this.actionSuccess = '';
    this.actionError = '';

    this.messagerieService.getMessages(matchingId).subscribe({
      next: msgs => {
        this.messagerieService.setMessages(msgs);
        this.loading = false;
        this.shouldScrollDown = true;
      },
      error: () => this.loading = false
    });

    this.messagerieService.connectHub(matchingId);

    if (this.auth.isReparateur()) {
      this.demandeService.marquerVu(matchingId).subscribe();
    }

    // Refresh matchings to get latest awaitingClientConfirm from backend
    this.loadMatchings();
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.activeMatchingId || this.isClosed) return;
    const text = this.newMessage.trim();
    this.newMessage = '';
    const matchingId = this.activeMatchingId;
    this.messagerieService.sendMessage(matchingId, {
      contenu: text,
      type: TypeMessage.TEXTE
    }).subscribe({
      next: (msg) => {
        // Optimistically add message if not already present (in case SignalR echoes it back too)
        const current = this.messagerieService.getMessagesSnapshot();
        if (!current.find(m => m.id === msg.id)) {
          this.messagerieService.appendMessage(msg);
        }
      },
      error: () => {}
    });
  }

  isOwn(msg: MessageDto): boolean {
    return msg.senderId === this.auth.currentUser()?.userId;
  }

  isConvClosed(statut: string): boolean {
    return ['ANNULE', 'REFUSE', 'EXPIRE', 'CLOTURE'].includes(statut);
  }

  getClosedReason(statut: string): string {
    switch (statut) {
      case 'ANNULE': return '❌ Cette conversation est clôturée.';
      case 'REFUSE': return '❌ Cette conversation est clôturée.';
      case 'CLOTURE': return '✅ Réparation clôturée.';
      default: return '🔒 Cette conversation est fermée.';
    }
  }

  // ── Prise en charge ──────────────────────────────────────────
  validerPriseEnCharge(): void {
    if (!this.activeMatchingId) return;
    this.actionLoading = true;
    this.messagerieService.validerPriseEnCharge(this.activeMatchingId).subscribe({
      next: () => {
        this.actionLoading = false;
        this.actionSuccess = '✅ Demande envoyée au client ! En attente de sa confirmation.';
        this.awaitingClientConfirm = true;
        // Persist locally so a subsequent loadMatchings() won't override before backend reloads
        if (this.activeMatching) {
          this.activeMatching = { ...this.activeMatching, awaitingClientConfirm: true };
          this.matchings = this.matchings.map(m =>
            m.id === this.activeMatchingId ? { ...m, awaitingClientConfirm: true } : m
          );
        }
        setTimeout(() => this.actionSuccess = '', 5000);
      },
      error: (e) => { this.actionLoading = false; this.actionError = e?.error?.error ?? 'Erreur'; }
    });
  }

  confirmerPriseEnCharge(): void {
    if (!this.activeMatchingId) return;
    this.actionLoading = true;
    this.messagerieService.confirmerPriseEnCharge(this.activeMatchingId).subscribe({
      next: () => {
        this.actionLoading = false;
        this.awaitingClientConfirm = false;
        this.confirmedByClient = true;
        if (this.activeMatching) {
          this.activeMatching = { ...this.activeMatching, awaitingClientConfirm: false, confirmedByClient: true };
          this.matchings = this.matchings.map(m =>
            m.id === this.activeMatchingId ? { ...m, awaitingClientConfirm: false, confirmedByClient: true } : m
          );
        }
        this.loadMatchings();
      },
      error: (e) => { this.actionLoading = false; this.actionError = e?.error?.error ?? 'Erreur'; }
    });
  }

  // ── Signalement ──────────────────────────────────────────────
  openSignal(): void {
    this.showSignalModal = true;
    this.signalObjet = '';
    this.signalMessage = '';
    this.signalSuccess = '';
    this.signalError = '';
  }
  closeSignal(): void { this.showSignalModal = false; }

  submitSignal(): void {
    if (!this.signalObjet.trim() || !this.signalMessage.trim() || !this.activeMatchingId) return;
    this.signalLoading = true;
    this.messagerieService.creerReclamation(this.activeMatchingId, {
      objet: this.signalObjet,
      message: this.signalMessage
    }).subscribe({
      next: () => {
        this.signalLoading = false;
        this.signalSuccess = '✅ Signalement enregistré. L\'équipe Repando va l\'examiner sous 24h.';
        setTimeout(() => this.closeSignal(), 3000);
      },
      error: () => { this.signalLoading = false; this.signalError = 'Erreur lors de l\'envoi.'; }
    });
  }

  // ── Mes réclamations ─────────────────────────────────────────
  openReclamations(): void {
    this.showReclamations = true;
    this.reclamationsLoading = true;
    this.messagerieService.getMesReclamations().subscribe({
      next: r => { this.reclamations = r; this.reclamationsLoading = false; },
      error: () => { this.reclamationsLoading = false; }
    });
  }
  closeReclamations(): void { this.showReclamations = false; }

  private scrollToBottom(): void {
    this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }
}
