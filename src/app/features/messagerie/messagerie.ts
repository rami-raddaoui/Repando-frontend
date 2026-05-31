import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, signal, HostListener, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { MessagerieService, ReclamationDto } from '../../core/services/messagerie';
import { DemandeService } from '../../core/services/demande';
import { AuthService } from '../../core/services/auth';
import { MessageDto, MatchingDto, TypeMessage, APPAREIL_LABELS, DemandeDto, StatutDemande } from '../../core/models/models';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './messagerie.html',
  styleUrl: './messagerie.scss'
})
export class MessagerieComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('messagesArea') messagesArea!: ElementRef;
  @ViewChild('galleryInput') galleryInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;
  matchings: MatchingDto[] = [];
  filteredMatchings: MatchingDto[] = [];
  demandeIdFilter: string | null = null;
  demandeAppareilFilter: string = '';
  demandeAppareilIcon: string = '';
  messages: MessageDto[] = [];
  activeMatchingId: string | null = null;
  activeMatching: MatchingDto | null = null;
  newMessage = '';
  loading = false;
  isClosed = false;
  awaitingClientConfirm = false;
  confirmedByClient = false;
  readonly TypeMessage = TypeMessage;
  readonly StatutDemande = StatutDemande;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly staticUrl = environment.staticUrl;
  // Detail demande popup
  showDemandeDetail = false;
  demandeDetail: DemandeDto | null = null;
  detailLightboxUrl: string | null = null;
  // Partage rapide
  showShareModal = false;
  shareType: 'phone' | 'email' | null = null;
  shareValue = '';
  userTelephone = signal<string | null>(null);
  userEmail = '';
  // Messages dont les coordonnees sont revelees (par l'ID du message)
  revealedMessages = new Set<string>();
  // Upload photos
  photoUploadCount = 0;
  photoUploading = false;
  readonly MAX_PHOTOS = 10;
  showPhotoMenu = false;
  photoPreviews: { file: File; dataUrl: string }[] = [];
  // Signalement
  showSignalModal = false;
  signalObjet = '';
  signalMessage = '';
  signalLoading = false;
  signalSuccess = '';
  signalError = '';
  // Prise en charge
  actionLoading = false;
  actionSuccess = '';
  actionError = '';
  // Welcome popup (1ère ouverture messagerie pour le client)
  showWelcomePopup = false;
  private readonly WELCOME_KEY_CLIENT = 'repando_welcome_chat_client_seen';
  // Reclamations
  showReclamations = false;
  reclamations: ReclamationDto[] = [];
  reclamationsLoading = false;
  // Mobile : indique si une conversation est sélectionnée (pour switcher sidebar↔chat)
  mobileConvSelected = false;
  readonly panneLabels: Record<string, { label: string; icon: string }> = {
    NE_DEMARRE_PLUS: { label: 'Ne demarre plus', icon: 'lightning' },
    FUITE_EAU:       { label: "Fuite d'eau",     icon: 'droplet'   },
    BRUIT_ANORMAL:   { label: 'Bruit anormal',   icon: 'sound'     },
    CODE_ERREUR:     { label: 'Code erreur',      icon: 'red'       },
    NE_CHAUFFE_PLUS: { label: 'Ne chauffe plus',  icon: 'temp'      },
    AUTRE:           { label: 'Autre',             icon: 'question'  },
  };
  private subs: Subscription[] = [];
  private readonly destroy$ = new Subject<void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private shouldScrollDown = false;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    public messagerieService: MessagerieService,
    private demandeService: DemandeService,
    private cdr: ChangeDetectorRef,
  ) {}
  ngOnInit(): void {
    const matchingIdFromUrl = this.route.snapshot.paramMap.get('matchingId');
    this.demandeIdFilter = this.route.snapshot.queryParamMap.get('demandeId');
    // Load user profile for phone + email
    this.userEmail = this.auth.currentUser()?.email ?? '';
    this.auth.me().pipe(takeUntil(this.destroy$)).subscribe({
      next: u => {
        this.userTelephone.set(u.telephone ?? null);
        this.userEmail = u.email;
      },
      error: () => {}
    });
    this.demandeService.getMyMatchings().pipe(takeUntil(this.destroy$)).subscribe({
      next: m => {
        this.matchings = m;
        this.messagerieService.setRecentConvs(m);
        this.applyFilter();
        if (matchingIdFromUrl) {
          this.openConversation(matchingIdFromUrl);
        } else if (this.demandeIdFilter) {
          const dm = m.filter(x => x.demandeId === this.demandeIdFilter);
          if (dm.length > 0) {
            this.openConversation(dm[0].id);
            this.demandeAppareilFilter = dm[0].demandeAppareil;
          }
          this.demandeService.getById(this.demandeIdFilter).pipe(takeUntil(this.destroy$)).subscribe({
            next: d => { this.demandeDetail = d; },
            error: () => {}
          });
        }
      },
      error: () => {
        if (matchingIdFromUrl) this.openConversation(matchingIdFromUrl);
      }
    });
    this.subs.push(
      this.messagerieService.messages$.subscribe(msgs => {
        this.messages = msgs;
        // Only trigger scroll when not in loading state (avoid scroll on empty reset)
        if (!this.loading) {
          this.shouldScrollDown = true;
        }
      }),
      this.messagerieService.convClosed$.subscribe(ev => {
        if (ev && this.activeMatchingId === ev.matchingId) {
          this.isClosed = true;
          this.loadMatchings();
        }
      }),
      this.messagerieService.priseEnChargeProposee$.subscribe(mid => {
        if (mid && mid === this.activeMatchingId) {
          this.awaitingClientConfirm = true;
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
    if (this.shouldScrollDown && !this.loading) {
      this.shouldScrollDown = false;
      this.timers.push(setTimeout(() => this.scrollToBottom(), 0));
    }
  }
  ngOnDestroy(): void {
    this.messagerieService.disconnectHub();
    this.subs.forEach(s => s.unsubscribe());
    this.timers.forEach(t => clearTimeout(t));
    this.destroy$.next();
    this.destroy$.complete();
  }
  loadMatchings(): void {
    this.demandeService.getMyMatchings().subscribe({
      next: m => {
        this.matchings = m;
        this.messagerieService.setRecentConvs(m);
        this.applyFilter();
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
  applyFilter(): void {
    if (this.demandeIdFilter) {
      this.filteredMatchings = this.matchings.filter(m => m.demandeId === this.demandeIdFilter);
      if (this.filteredMatchings.length > 0) {
        const appareil = this.filteredMatchings[0].demandeAppareil;
        this.demandeAppareilFilter = appareil;
        const entry = Object.values(APPAREIL_LABELS).find(v => v.label === appareil);
        this.demandeAppareilIcon = entry?.icon ?? '';
      }
    } else {
      this.filteredMatchings = this.matchings;
    }
  }
  clearFilter(): void {
    this.demandeIdFilter = null;
    this.demandeAppareilFilter = '';
    this.demandeAppareilIcon = '';
    this.filteredMatchings = this.matchings;
    this.router.navigate(['/messagerie'], { replaceUrl: true });
  }
  // ── Detail demande ────────────────────────────────────────────
  openDemandeDetail(): void {
    if (!this.demandeDetail && this.demandeIdFilter) {
      this.demandeService.getById(this.demandeIdFilter).subscribe({
        next: d => { this.demandeDetail = d; this.showDemandeDetail = true; },
        error: () => {}
      });
    } else {
      this.showDemandeDetail = true;
    }
  }
  closeDemandeDetail(): void { this.showDemandeDetail = false; }
  openLightbox(url: string): void { this.detailLightboxUrl = url; }
  closeLightbox(): void { this.detailLightboxUrl = null; }
  photoUrl(url: string): string {
    return url.startsWith('http') ? url : `${this.staticUrl}${url}`;
  }
  getPanneLabel(key: string): { label: string; icon: string } {
    return this.panneLabels[key] ?? { label: key, icon: '' };
  }
  getStatutMatchingLabel(statut: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
      NOUVEAU:      { label: 'Nouveau',    color: '#6366f1' },
      VU:           { label: 'Vu',         color: '#8b5cf6' },
      DEVIS_ENVOYE: { label: 'Devis recu', color: '#f59e0b' },
      ACCEPTE:      { label: 'En cours',   color: '#10b981' },
      CLOTURE:      { label: 'Cloture',    color: '#22c55e' },
      REFUSE:       { label: 'Refuse',     color: '#ef4444' },
      ANNULE:       { label: 'Annule',     color: '#ef4444' },
      EXPIRE:       { label: 'Expire',     color: '#94a3b8' },
    };
    return map[statut] ?? { label: statut, color: '#94a3b8' };
  }
  /** Mobile : retour à la liste des conversations */
  backToList(): void {
    this.mobileConvSelected = false;
    this.messagerieService.disconnectHub();
    this.activeMatchingId = null;
    this.activeMatching = null;
  }

  openConversation(matchingId: string): void {    if (this.activeMatchingId === matchingId) return;
    this.messagerieService.disconnectHub();
    this.activeMatchingId = matchingId;
    this.mobileConvSelected = true; // ← affiche le chat sur mobile, cache la sidebar
    this.photoUploadCount = 0;
    this.photoPreviews = [];
    this.showPhotoMenu = false;
    this.revealedMessages = new Set<string>();
    const found = this.matchings.find(m => m.id === matchingId) ?? null;
    this.activeMatching = found;
    this.isClosed = this.isConvClosed(found?.statut ?? '');
    this.awaitingClientConfirm = found?.awaitingClientConfirm ?? false;
    this.confirmedByClient = found?.confirmedByClient ?? false;
    this.loading = true;
    this.actionSuccess = '';
    this.actionError = '';
    // Popup bienvenue client (1ère fois uniquement)
    const role = this.auth.currentUser()?.role;
    if (role === 'CLIENT' && !localStorage.getItem(this.WELCOME_KEY_CLIENT)) {
      this.showWelcomePopup = true;
    }
    // Connect hub first so we don't miss any incoming messages while loading
    this.messagerieService.connectHub(matchingId);
    this.messagerieService.getMessages(matchingId).subscribe({
      next: msgs => {
        // Merge with any messages already received via SignalR during connection
        const existing = this.messagerieService.getMessagesSnapshot();
        const merged = [...msgs];
        existing.forEach(m => {
          if (!merged.find(x => x.id === m.id)) merged.push(m);
        });
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        this.messagerieService.setMessages(merged);
        this.photoUploadCount = merged.filter(m => m.type === TypeMessage.PHOTO).length;
        this.loading = false;
        this.cdr.detectChanges();
        this.shouldScrollDown = true;
      },
      error: () => { this.loading = false; }
    });
    if (this.auth.isReparateur() && !this.auth.isImpersonating()) {
      this.demandeService.marquerVu(matchingId).subscribe();
    }
    this.loadMatchings();
  }
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.activeMatchingId || this.isClosed) return;
    const text = this.newMessage.trim();
    this.newMessage = '';
    const matchingId = this.activeMatchingId;
    this.messagerieService.sendMessage(matchingId, { contenu: text, type: TypeMessage.TEXTE }).subscribe({
      next: (msg) => {
        const current = this.messagerieService.getMessagesSnapshot();
        if (!current.find(m => m.id === msg.id)) {
          this.messagerieService.appendMessage(msg);
        }
      },
      error: (e) => {
        // Restore message on error (blocked by anti-desintermediation)
        this.newMessage = text;
        if (e?.error?.error) {
          this.actionError = e.error.error;
          this.timers.push(setTimeout(() => this.actionError = '', 5000));
        }
      }
    });
  }
  // ── Partage rapide ────────────────────────────────────────────
  openShareModal(type: 'phone' | 'email'): void {
    this.shareType = type;
    this.shareValue = type === 'phone' ? (this.userTelephone() ?? '') : this.userEmail;
    this.showShareModal = true;
  }
  closeShareModal(): void { this.showShareModal = false; this.shareType = null; }
  confirmShare(): void {
    if (!this.shareType || !this.shareValue || !this.activeMatchingId || this.isClosed) return;
    // Format: "phone::+33612345678" ou "email::user@ex.com"
    const contenu = this.shareType + '::' + this.shareValue;
    const label = this.shareType === 'phone' ? 'Mon numero de telephone' : 'Mon adresse email';
    this.showShareModal = false;
    this.shareType = null;
    const matchingId = this.activeMatchingId;
    this.messagerieService.sendMessage(matchingId, {
      contenu: contenu,
      type: TypeMessage.COORDONNEES
    }).subscribe({
      next: (msg) => {
        const current = this.messagerieService.getMessagesSnapshot();
        if (!current.find(m => m.id === msg.id)) {
          this.messagerieService.appendMessage(msg);
        }
      },
      error: () => {}
    });
  }
  // Extraire le type et la valeur d'un message COORDONNEES
  getCoordType(msg: MessageDto): 'phone' | 'email' {
    return msg.contenu?.startsWith('phone::') ? 'phone' : 'email';
  }
  getCoordValue(msg: MessageDto): string {
    const raw = msg.contenu ?? '';
    const idx = raw.indexOf('::');
    return idx >= 0 ? raw.substring(idx + 2) : raw;
  }
  toggleReveal(msgId: string): void {
    if (this.revealedMessages.has(msgId)) {
      this.revealedMessages.delete(msgId);
    } else {
      this.revealedMessages.add(msgId);
    }
    // Force change detection
    this.revealedMessages = new Set(this.revealedMessages);
  }
  isRevealed(msgId: string): boolean {
    return this.revealedMessages.has(msgId);
  }
  // ── Upload photo ──────────────────────────────────────────────
  togglePhotoMenu(): void {
    this.showPhotoMenu = !this.showPhotoMenu;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showPhotoMenu) this.showPhotoMenu = false;
  }
  triggerGallery(): void {
    this.showPhotoMenu = false;
    this.galleryInput?.nativeElement?.click();
  }
  triggerCamera(): void {
    this.showPhotoMenu = false;
    this.cameraInput?.nativeElement?.click();
  }
  onPhotoSelect(event: Event, _source: 'gallery' | 'camera'): void {
    if (this.isClosed || this.photoUploadCount >= this.MAX_PHOTOS || !this.activeMatchingId) return;
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        this.photoPreviews = [...this.photoPreviews, { file, dataUrl }];
      };
      reader.readAsDataURL(file);
    });
    (event.target as HTMLInputElement).value = '';
  }
  removePhotoPreview(index: number): void {
    this.photoPreviews = this.photoPreviews.filter((_, i) => i !== index);
  }
  cancelPhotoPreviews(): void {
    this.photoPreviews = [];
  }
  sendPhotoPreviews(): void {
    if (!this.activeMatchingId || this.isClosed || this.photoPreviews.length === 0) return;
    const previews = [...this.photoPreviews];
    this.photoPreviews = [];
    this.photoUploading = true;
    const dataUrls = previews.map(p => p.dataUrl);
    const matchingId = this.activeMatchingId;
    this.demandeService.uploadPhotos(dataUrls).subscribe({
      next: (urls) => {
        const sends = urls.map((url: string) =>
          this.messagerieService.sendMessage(matchingId, {
            contenu: '',
            photoUrl: url,
            type: TypeMessage.PHOTO
          })
        );
        let done = 0;
        sends.forEach((obs: any) => obs.subscribe({
          next: (msg: any) => {
            this.photoUploadCount++;
            const current = this.messagerieService.getMessagesSnapshot();
            if (!current.find((m: any) => m.id === msg.id)) {
              this.messagerieService.appendMessage(msg);
            }
            done++;
            if (done === sends.length) this.photoUploading = false;
          },
          error: () => { done++; if (done === sends.length) this.photoUploading = false; }
        }));
      },
      error: () => { this.photoUploading = false; }
    });
  }
  isOwn(msg: MessageDto): boolean {
    return msg.senderId === this.auth.currentUser()?.userId;
  }
  isConvClosed(statut: string): boolean {
    return ['ANNULE', 'REFUSE', 'EXPIRE', 'CLOTURE'].includes(statut);
  }

  dismissWelcomePopup(): void {
    localStorage.setItem(this.WELCOME_KEY_CLIENT, '1');
    this.showWelcomePopup = false;
  }
  getClosedReason(statut: string): string {
    switch (statut) {
      case 'ANNULE': return 'La demande a ete annulee. Cette conversation est definitivement cloturee.';
      case 'REFUSE': return 'Cette conversation est cloturee.';
      case 'CLOTURE': return 'Reparation cloturee.';
      default: return 'Cette conversation est fermee.';
    }
  }
  // ── Prise en charge ──────────────────────────────────────────
  validerPriseEnCharge(): void {
    if (!this.activeMatchingId) return;
    this.actionLoading = true;
    this.messagerieService.validerPriseEnCharge(this.activeMatchingId).subscribe({
      next: () => {
        this.actionLoading = false;
        this.actionSuccess = 'Demande envoyee au client !';
        this.awaitingClientConfirm = true;
        if (this.activeMatching) {
          this.activeMatching = { ...this.activeMatching, awaitingClientConfirm: true };
          this.matchings = this.matchings.map(m =>
            m.id === this.activeMatchingId ? { ...m, awaitingClientConfirm: true } : m
          );
        }
        this.timers.push(setTimeout(() => this.actionSuccess = '', 5000));
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
        this.signalSuccess = 'Signalement enregistre.';
        this.timers.push(setTimeout(() => this.closeSignal(), 3000));
      },
      error: () => { this.signalLoading = false; this.signalError = 'Erreur lors de envoi.'; }
    });
  }
  // ── Reclamations ─────────────────────────────────────────────
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
    try {
      if (this.messagesArea?.nativeElement) {
        this.messagesArea.nativeElement.scrollTop = this.messagesArea.nativeElement.scrollHeight;
      } else {
        this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {}
  }
}
