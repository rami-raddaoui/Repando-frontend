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
  isClosed = false;   // conversation fermée
  awaitingClientConfirm = false;  // réparateur a proposé prise en charge

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
    this.loadMatchings();

    const matchingId = this.route.snapshot.paramMap.get('matchingId');
    if (matchingId) this.openConversation(matchingId);

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
          this.loadMatchings();
        }
      }),

      this.messagerieService.priseEnChargeConfirmee$.subscribe(mid => {
        if (mid && mid === this.activeMatchingId) {
          this.awaitingClientConfirm = false;
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
          this.activeMatching = m.find(x => x.id === this.activeMatchingId) ?? null;
          this.isClosed = this.isConvClosed(this.activeMatching?.statut ?? '');
          this.awaitingClientConfirm = this.activeMatching?.statut === 'ACCEPTE' &&
            !!(this.activeMatching as any)?.awaitingConfirm;
        }
      },
      error: () => {}
    });
  }

  openConversation(matchingId: string): void {
    if (this.activeMatchingId === matchingId) return;
    this.messagerieService.disconnectHub();
    this.activeMatchingId = matchingId;
    this.activeMatching = this.matchings.find(m => m.id === matchingId) ?? null;
    this.isClosed = this.isConvClosed(this.activeMatching?.statut ?? '');
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
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.activeMatchingId || this.isClosed) return;
    const text = this.newMessage;
    this.newMessage = '';
    this.messagerieService.sendMessage(this.activeMatchingId, {
      contenu: text,
      type: TypeMessage.TEXTE
    }).subscribe();
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
        this.actionSuccess = 'Proposition envoyée au client !';
        this.awaitingClientConfirm = true;
        setTimeout(() => this.actionSuccess = '', 4000);
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
        this.actionSuccess = '🎉 Réparation confirmée ! Les autres conversations sont clôturées.';
        this.awaitingClientConfirm = false;
        this.loadMatchings();
        setTimeout(() => this.actionSuccess = '', 5000);
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
