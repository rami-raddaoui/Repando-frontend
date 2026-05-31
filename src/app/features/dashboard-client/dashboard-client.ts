import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { DemandeService } from '../../core/services/demande';
import { DemandeDto, MatchingDto, StatutDemande, StatutMatching, APPAREIL_LABELS, TypePanne } from '../../core/models/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard-client',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard-client.html',
  styleUrl: './dashboard-client.scss'
})
export class DashboardClientComponent implements OnInit {
  tab: 'en-cours' | 'historique' | 'messages' = 'en-cours';
  demandes: DemandeDto[] = [];
  matchings: MatchingDto[] = [];
  loading = false;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutDemande = StatutDemande;
  readonly StatutMatching = StatutMatching;
  readonly staticUrl = environment.staticUrl;

  // Pause / Réactivation confirmation popup
  showPauseModal = false;
  pauseTargetDemande: DemandeDto | null = null;

  openPauseModal(d: DemandeDto): void { this.pauseTargetDemande = d; this.showPauseModal = true; }
  closePauseModal(): void { this.showPauseModal = false; this.pauseTargetDemande = null; }
  confirmPause(): void {
    if (!this.pauseTargetDemande) return;
    const d = this.pauseTargetDemande;
    const isPaused = d.statut === StatutDemande.EN_PAUSE;
    this.closePauseModal();
    this.demandeService.togglePause(d.id).subscribe(() => {
      d.statut = isPaused ? StatutDemande.OUVERTE : StatutDemande.EN_PAUSE;
      if (this.detailDemande?.id === d.id) this.detailDemande.statut = d.statut;
    });
  }

  // Cancel confirmation popup
  showCancelModal = false;
  cancelTargetId: string | null = null;

  // Detail popup
  showDetailModal = false;
  detailDemande: DemandeDto | null = null;
  detailLightboxUrl: string | null = null;

  // Panne labels
  readonly panneLabels: Record<string, { label: string; icon: string }> = {
    NE_DEMARRE_PLUS: { label: 'Ne démarre plus', icon: '⚡' },
    FUITE_EAU:       { label: 'Fuite d\'eau',    icon: '💧' },
    BRUIT_ANORMAL:   { label: 'Bruit anormal',   icon: '🔊' },
    CODE_ERREUR:     { label: 'Code erreur',     icon: '🔴' },
    NE_CHAUFFE_PLUS: { label: 'Ne chauffe plus', icon: '🌡️' },
    AUTRE:           { label: 'Autre',            icon: '❓' },
  };

  get demandesActives() {
    return this.demandes.filter(d => d.statut === StatutDemande.OUVERTE || d.statut === StatutDemande.EN_PAUSE);
  }
  get demandesEnCours() { return this.demandesActives; }
  get demandesTerminees() {
    return this.demandes.filter(d => d.statut === StatutDemande.TRAITEE || d.statut === StatutDemande.ANNULEE);
  }
  get totalEconomises() {
    return this.matchings
      .filter(m => m.devisMontantBonus)
      .reduce((sum, m) => sum + (m.devisMontantBonus ?? 0), 0);
  }
  get matchingsAvecMessage() {
    return this.matchings.filter(m => m.hasUnreadMessages);
  }
  get matchingsUnread() {
    return this.matchings.filter(m => m.hasUnreadMessages).length;
  }

  constructor(
    public auth: AuthService,
    private demandeService: DemandeService,
    public router: Router,
  ) {}

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading = true;
    this.demandeService.getMesDemandes().subscribe({
      next: d => { this.demandes = d; this.loading = false; },
      error: () => this.loading = false
    });
    this.demandeService.getMyMatchings().subscribe({
      next: m => this.matchings = m,
      error: () => {}
    });
  }

  openCancelModal(id: string): void { this.cancelTargetId = id; this.showCancelModal = true; }
  closeCancelModal(): void { this.showCancelModal = false; this.cancelTargetId = null; }
  confirmCancel(): void {
    if (!this.cancelTargetId) return;
    const id = this.cancelTargetId;
    this.showCancelModal = false;
    this.cancelTargetId = null;
    this.demandeService.cancel(id).subscribe(() => {
      // Mise à jour locale optimiste
      const d = this.demandes.find(x => x.id === id);
      if (d) d.statut = StatutDemande.ANNULEE;
    });
  }

  pauseInsteadOfCancel(): void {
    if (!this.cancelTargetId) return;
    const id = this.cancelTargetId;
    this.showCancelModal = false;
    this.cancelTargetId = null;
    this.demandeService.togglePause(id).subscribe(() => {
      const d = this.demandes.find(x => x.id === id);
      if (d) d.statut = StatutDemande.EN_PAUSE;
    });
  }

  openDetail(d: DemandeDto): void { this.detailDemande = d; this.showDetailModal = true; }
  closeDetail(): void { this.showDetailModal = false; this.detailDemande = null; this.detailLightboxUrl = null; }
  openLightbox(url: string): void { this.detailLightboxUrl = url; }
  closeLightbox(): void { this.detailLightboxUrl = null; }

  photoUrl(url: string): string {
    return url.startsWith('http') ? url : `${this.staticUrl}${url}`;
  }

  getPanneLabel(key: string): { label: string; icon: string } {
    return this.panneLabels[key] ?? { label: key, icon: '🔧' };
  }

  getMatchingsForDemande(demandeId: string): MatchingDto[] {
    return this.matchings.filter(m => m.demandeId === demandeId);
  }

  getStatutMatchingLabel(statut: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
      NOUVEAU:      { label: 'Nouveau',             color: '#6366f1' },
      VU:           { label: 'Vu',                  color: '#8b5cf6' },
      DEVIS_ENVOYE: { label: 'Devis reçu',          color: '#f59e0b' },
      ACCEPTE:      { label: 'En cours',             color: '#10b981' },
      CLOTURE:      { label: 'Clôturé',             color: '#22c55e' },
      REFUSE:       { label: 'Refusé',              color: '#ef4444' },
      ANNULE:       { label: 'Annulé',              color: '#ef4444' },
      EXPIRE:       { label: 'Expiré',              color: '#94a3b8' },
    };
    return map[statut] ?? { label: statut, color: '#94a3b8' };
  }

  togglePause(d: DemandeDto): void {
    this.openPauseModal(d);
  }

  goToMessagerie(demandeId: string): void {
    const demandeMatchings = this.matchings.filter(m => m.demandeId === demandeId);
    if (demandeMatchings.length === 1) {
      this.router.navigate(['/messagerie', demandeMatchings[0].id]);
    } else if (demandeMatchings.length > 1) {
      this.router.navigate(['/messagerie'], { queryParams: { demandeId } });
    } else {
      this.router.navigate(['/messagerie']);
    }
  }

  accepterDevis(matchingId: string): void {
    this.demandeService.acceptDevis(matchingId).subscribe(() => {
      const m = this.matchings.find(x => x.id === matchingId);
      if (m) m.statut = StatutMatching.ACCEPTE;
    });
  }

  refuserDevis(matchingId: string): void {
    this.demandeService.refuserDevis(matchingId).subscribe(() => {
      const m = this.matchings.find(x => x.id === matchingId);
      if (m) m.statut = StatutMatching.REFUSE;
    });
  }
}
