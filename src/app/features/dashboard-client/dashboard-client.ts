import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { DemandeService } from '../../core/services/demande';
import { DemandeDto, MatchingDto, StatutDemande, APPAREIL_LABELS } from '../../core/models/models';

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

  // Cancel confirmation popup
  showCancelModal = false;
  cancelTargetId: string | null = null;

  get demandesActives() {
    return this.demandes.filter(d => d.statut === StatutDemande.OUVERTE || d.statut === StatutDemande.EN_PAUSE);
  }
  get demandesEnCours() {
    return this.demandesActives;
  }
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

  constructor(
    public auth: AuthService,
    private demandeService: DemandeService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

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

  openCancelModal(id: string): void {
    this.cancelTargetId = id;
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelTargetId = null;
  }

  confirmCancel(): void {
    if (!this.cancelTargetId) return;
    const id = this.cancelTargetId;
    this.showCancelModal = false;
    this.cancelTargetId = null;
    this.demandeService.cancel(id).subscribe(() => this.loadData());
  }

  togglePause(d: DemandeDto): void {
    const isPaused = d.statut === StatutDemande.EN_PAUSE;
    const msg = isPaused
      ? 'Réactiver cette demande ? Les réparateurs à proximité seront à nouveau contactés.'
      : 'Mettre en pause cette demande ? Les réparateurs ne recevront plus votre annonce, mais les chats en cours restent accessibles.';
    if (!confirm(msg)) return;
    this.demandeService.togglePause(d.id).subscribe(() => this.loadData());
  }

  goToMessagerie(demandeId: string): void {
    const matching = this.matchings.find(m => m.demandeId === demandeId);
    if (matching) {
      this.router.navigate(['/messagerie', matching.id]);
    } else {
      this.router.navigate(['/messagerie']);
    }
  }

  accepterDevis(matchingId: string): void {
    this.demandeService.acceptDevis(matchingId).subscribe(() => this.loadData());
  }

  refuserDevis(matchingId: string): void {
    this.demandeService.refuserDevis(matchingId).subscribe(() => this.loadData());
  }
}
