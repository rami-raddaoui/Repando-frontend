import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  get demandesEnCours() {
    return this.demandes.filter(d => d.statut === StatutDemande.OUVERTE);
  }
  get demandesTerminees() {
    return this.demandes.filter(d => d.statut !== StatutDemande.OUVERTE);
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

  cancel(id: string): void {
    if (!confirm('Confirmer l\'annulation ?')) return;
    this.demandeService.cancel(id).subscribe(() => this.loadData());
  }

  accepterDevis(matchingId: string): void {
    this.demandeService.acceptDevis(matchingId).subscribe(() => this.loadData());
  }

  refuserDevis(matchingId: string): void {
    this.demandeService.refuserDevis(matchingId).subscribe(() => this.loadData());
  }
}
