import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { DemandeService } from '../../core/services/demande';
import { ReparateurService } from '../../core/services/reparateur';
import { MatchingDto, DemandeDto, APPAREIL_LABELS, StatutMatching } from '../../core/models/models';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';

export const DECLINE_REASONS = [
  { id: 'zone',      label: 'Pas dans ma zone d\'intervention', icon: '📍' },
  { id: 'expertise', label: 'En dehors de mon expertise',        icon: '🔧' },
  { id: 'dispo',     label: 'Indisponible sur cette période',     icon: '📅' },
  { id: 'marque',    label: 'Marque / modèle non maîtrisé',       icon: '🏷️' },
  { id: 'charge',    label: 'Trop chargé en ce moment',           icon: '⚡' },
  { id: 'autre',     label: 'Autre raison',                       icon: '💬' },
];

@Component({
  selector: 'app-dashboard-reparateur',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './dashboard-reparateur.html',
  styleUrl: './dashboard-reparateur.scss'
})
export class DashboardReparateurComponent implements OnInit, OnDestroy {
  tab: 'missions' | 'actifs' | 'historique' = 'missions';
  matchings: MatchingDto[] = [];
  dashboard: any = null;
  loading = false;
  get isVerified(): boolean { return this.dashboard?.reparateur?.isVerified === true; }
  get hasProfile(): boolean { return this.dashboard?.reparateur != null; }
  actionLoading: string | null = null;
  actionSuccess = '';
  actionError = '';

  // ── Detail modal ──────────────────────────────────────────────
  selectedMission: MatchingDto | null = null;
  selectedDemande: DemandeDto | null = null;
  demandeLoading = false;
  showDetailModal = false;
  /** true when the popup was opened via a notification deep-link → hide action buttons */
  detailReadOnly = false;
  detailTab: 'apercu' | 'details' = 'apercu';
  lightboxUrl: string | null = null;
  lightboxIndex = 0;
  readonly staticUrl = environment.staticUrl;
  private pendingMatchingDetailId: string | null = null;
  private routeSub?: Subscription;

  // ── Welcome popup (première ouverture messagerie) ─────────────
  showWelcomePopup = false;
  welcomeMatchingId: string | null = null;
  private readonly WELCOME_KEY = 'repando_welcome_chat_reparateur_seen';

  // ── Decline popup ─────────────────────────────────────────────
  declineTarget: MatchingDto | null = null;
  showDeclineModal = false;
  selectedReasons: Set<string> = new Set();
  readonly DECLINE_REASONS = DECLINE_REASONS;

  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutMatching = StatutMatching;

  // ── RC Pro ────────────────────────────────────────────────
  get rcProStatut(): string {
    return this.dashboard?.reparateur?.rcProStatut ?? 'MANQUANTE';
  }
  get hasRcPro(): boolean {
    return this.rcProStatut === 'VALIDEE' || this.rcProStatut === 'EN_VERIFICATION';
  }
  rcProUploading = false;
  rcProError = '';
  rcProSuccess = '';

  get nouvellesMissions() {
    return this.matchings.filter(m => m.statut === 'NOUVEAU' || m.statut === 'VU');
  }
  get missionsActives() {
    return this.matchings.filter(m => m.statut === 'ACCEPTE' || m.statut === 'DEVIS_ENVOYE');
  }
  get historique() {
    return this.matchings.filter(m =>
      m.statut === 'CLOTURE' || m.statut === 'REFUSE' || m.statut === 'ANNULE' || m.statut === 'EXPIRE'
    );
  }
  get noteMoyenne(): number {
    return Number(this.dashboard?.reparateur?.noteMoyenne ?? 0);
  }
  get nbAvis(): number {
    return Number(this.dashboard?.reparateur?.nbAvis ?? 0);
  }
  get profilComplet(): boolean {
    return this.dashboard?.reparateur?.profilComplet !== false;
  }
  get champsManquantsCodes(): string[] {
    return this.dashboard?.reparateur?.champsManquants ?? [];
  }
  get champsManquants(): Array<{ code: string; label: string; icon: string; focus: string }> {
    const map: Record<string, { label: string; icon: string; focus: string }> = {
      SIRET: { label: 'SIRET', icon: '🧾', focus: 'siret' },
      VILLE: { label: 'Ville', icon: '🏙️', focus: 'ville' },
      CODE_POSTAL: { label: 'Code postal', icon: '📮', focus: 'code_postal' },
      SPECIALITES: { label: 'Spécialités', icon: '🛠️', focus: 'specialites' }
    };

    return this.champsManquantsCodes.map(code => {
      const entry = map[code] ?? { label: code, icon: '⚠️', focus: 'siret' };
      return { code, ...entry };
    });
  }
  get profilCompletionFocus(): string {
    return this.champsManquants[0]?.focus ?? 'siret';
  }
  get avisRecents(): Array<{ id: string; note: number; commentaire?: string; createdAt: string; clientNom: string; appareil: string }> {
    return this.dashboard?.avisRecents ?? [];
  }

  getStars(note: number): string {
    const safe = Math.max(0, Math.min(5, Math.round(note || 0)));
    return `${'★'.repeat(safe)}${'☆'.repeat(5 - safe)}`;
  }

  constructor(
    public auth: AuthService,
    private demandeService: DemandeService,
    private reparateurService: ReparateurService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParamMap.subscribe(params => {
      this.pendingMatchingDetailId = params.get('matchingId');
      this.tryOpenPendingDetail();
    });

    this.loadMatchings();
    this.reparateurService.getDashboard().subscribe({
      next: d => this.dashboard = d,
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  loadMatchings(): void {
    this.loading = true;
    this.demandeService.getMyMatchings().subscribe({
      next: m => {
        this.matchings = m;
        this.loading = false;
        this.tryOpenPendingDetail();
      },
      error: () => { this.loading = false; }
    });
  }

  getAppareilLabel(type: string): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }

  // ── Detail modal ──────────────────────────────────────────────
  openDetail(m: MatchingDto, readOnly = false): void {
    this.selectedMission = m;
    this.selectedDemande = null;
    this.detailTab = 'apercu';
    this.detailReadOnly = readOnly;
    this.showDetailModal = true;
    if (m.statut === 'NOUVEAU') {
      this.demandeService.marquerVu(m.id).subscribe();
    }
    this.demandeLoading = true;
    this.demandeService.getDemandeByMatching(m.id).subscribe({
      next: d => { this.selectedDemande = d; this.demandeLoading = false; },
      error: (err) => {
        console.error('[openDetail] getDemandeByMatching failed', err?.status, err?.error);
        this.demandeLoading = false;
      }
    });
  }

  private tryOpenPendingDetail(): void {
    if (!this.pendingMatchingDetailId) return;
    if (this.showDetailModal && this.selectedMission?.id === this.pendingMatchingDetailId) return;

    const matching = this.matchings.find(m => m.id === this.pendingMatchingDetailId);
    if (!matching) return;

    this.pendingMatchingDetailId = null;
    this.openDetail(matching, true);  // readOnly — opened from notification
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  closeDetail(): void {
    this.showDetailModal = false;
    this.selectedMission = null;
    this.selectedDemande = null;
    this.lightboxUrl = null;
    this.detailTab = 'apercu';
    this.detailReadOnly = false;
  }

  openLightbox(url: string, index = 0): void { this.lightboxUrl = url; this.lightboxIndex = index; }
  closeLightbox(): void { this.lightboxUrl = null; }

  prevPhoto(): void {
    if (!this.selectedDemande?.photoUrls) return;
    this.lightboxIndex = (this.lightboxIndex - 1 + this.selectedDemande.photoUrls.length) % this.selectedDemande.photoUrls.length;
    this.lightboxUrl = this.resolvePhotoUrl(this.selectedDemande.photoUrls[this.lightboxIndex]);
  }
  nextPhoto(): void {
    if (!this.selectedDemande?.photoUrls) return;
    this.lightboxIndex = (this.lightboxIndex + 1) % this.selectedDemande.photoUrls.length;
    this.lightboxUrl = this.resolvePhotoUrl(this.selectedDemande.photoUrls[this.lightboxIndex]);
  }

  resolvePhotoUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${this.staticUrl}${url}`;
  }

  getPanneLabel(panne: string): string {
    const map: Record<string, string> = {
      NE_DEMARRE_PLUS: 'Ne démarre plus', FUITE_EAU: "Fuite d'eau",
      BRUIT_ANORMAL: 'Bruit anormal', CODE_ERREUR: 'Code erreur',
      NE_CHAUFFE_PLUS: 'Ne chauffe plus', AUTRE: 'Autre'
    };
    return map[panne] ?? panne;
  }

  // ── Decline popup ─────────────────────────────────────────────
  openDeclineModal(m: MatchingDto): void {
    this.declineTarget = m;
    this.selectedReasons = new Set();
    this.showDeclineModal = true;
    this.closeDetail();
  }

  closeDeclineModal(): void {
    this.showDeclineModal = false;
    this.declineTarget = null;
    this.selectedReasons = new Set();
  }

  toggleReason(id: string): void {
    if (this.selectedReasons.has(id)) {
      this.selectedReasons.delete(id);
    } else {
      this.selectedReasons.add(id);
    }
  }

  confirmDecline(): void {
    if (!this.declineTarget) return;
    const id = this.declineTarget.id;
    const raisons = [...this.selectedReasons].map(rid =>
      DECLINE_REASONS.find(r => r.id === rid)?.label ?? rid
    );
    this.actionLoading = id + '_decline';
    this.demandeService.declinerMission(id, raisons).subscribe({
      next: () => {
        this.actionLoading = null;
        this.closeDeclineModal();
        this.loadMatchings();
      },
      error: () => { this.actionLoading = null; }
    });
  }

  // ── Accept ────────────────────────────────────────────────────
  accepterMission(matchingId: string): void {
    this.actionLoading = matchingId;
    this.actionError = '';
    this.demandeService.accepterMission(matchingId).subscribe({
      next: () => {
        this.actionLoading = null;
        this.closeDetail();
        this.loadMatchings();
        // Afficher la popup de bienvenue à chaque fois
        this.welcomeMatchingId = matchingId;
        this.showWelcomePopup = true;
      },
      error: (e) => {
        this.actionLoading = null;
        this.actionError = e?.error?.error ?? 'Erreur lors de l\'acceptation';
        setTimeout(() => this.actionError = '', 4000);
      }
    });
  }

  dismissWelcomePopup(): void {
    this.showWelcomePopup = false;
    if (this.welcomeMatchingId) {
      this.router.navigate(['/messagerie', this.welcomeMatchingId]);
    }
    this.welcomeMatchingId = null;
  }

  // ── RC Pro upload ─────────────────────────────────────────
  onRcProFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const maxSize = 10 * 1024 * 1024; // 10 Mo
    if (file.size > maxSize) {
      this.rcProError = 'Fichier trop volumineux (max 10 Mo)';
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      this.rcProError = 'Format non supporté (PDF, JPG ou PNG)';
      return;
    }

    this.rcProUploading = true;
    this.rcProError = '';
    this.rcProSuccess = '';

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.reparateurService.uploadRcPro(dataUrl).subscribe({
        next: (res) => {
          this.rcProUploading = false;
          this.rcProSuccess = res.message ?? 'Attestation envoyée avec succès';
          // Rafraîchir le dashboard pour mettre à jour le statut
          this.reparateurService.getDashboard().subscribe({
            next: d => { this.dashboard = d; },
            error: () => {}
          });
          setTimeout(() => this.rcProSuccess = '', 6000);
        },
        error: (e) => {
          this.rcProUploading = false;
          this.rcProError = e?.error?.error ?? 'Erreur lors de l\'upload';
          setTimeout(() => this.rcProError = '', 6000);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  getStatutLabel(statut: string): { label: string; color: string; bg: string } {
    switch (statut) {
      case 'NOUVEAU':      return { label: 'Nouvelle mission', color: '#1d4ed8', bg: '#dbeafe' };
      case 'VU':           return { label: 'Vue', color: '#92400e', bg: '#fef3c7' };
      case 'ACCEPTE':      return { label: 'Acceptée ✅', color: '#15803d', bg: '#dcfce7' };
      case 'DEVIS_ENVOYE': return { label: 'Devis envoyé', color: '#7c3aed', bg: '#ede9fe' };
      case 'CLOTURE':      return { label: 'Clôturée', color: '#64748b', bg: '#f1f5f9' };
      case 'REFUSE':       return { label: 'Déclinée', color: '#991b1b', bg: '#fee2e2' };
      case 'ANNULE':       return { label: 'Annulée', color: '#64748b', bg: '#f1f5f9' };
      default:             return { label: statut, color: '#64748b', bg: '#f1f5f9' };
    }
  }

  getMatchingStatutLabel(m: MatchingDto): { label: string; color: string; bg: string } {
    const outcome = (m.repairOutcome ?? '').toUpperCase();
    if (outcome === 'TERMINEE') {
      return { label: 'Réparation terminée', color: '#166534', bg: '#dcfce7' };
    }
    if (outcome === 'CLIENT_ANNULE') {
      return { label: 'Client a annulé', color: '#991b1b', bg: '#fee2e2' };
    }
    if (outcome === 'AUTRE_PROBLEME') {
      return { label: 'Incident signalé', color: '#92400e', bg: '#fef3c7' };
    }
    return this.getStatutLabel(m.statut);
  }
}

