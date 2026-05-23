import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { DemandeService } from '../../core/services/demande';
import { ReparateurService } from '../../core/services/reparateur';
import { MatchingDto, APPAREIL_LABELS } from '../../core/models/models';

@Component({
  selector: 'app-dashboard-reparateur',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard-reparateur.html',
  styleUrl: './dashboard-reparateur.scss'
})
export class DashboardReparateurComponent implements OnInit {
  tab: 'demandes' | 'messages' = 'demandes';
  matchings: MatchingDto[] = [];
  dashboard: any = null;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;

  get nouveauxMatchings() {
    return this.matchings.filter(m => m.statut === 'NOUVEAU' || m.statut === 'VU');
  }
  get devisEnAttente() {
    return this.matchings.filter(m => m.statut === 'DEVIS_ENVOYE');
  }
  get matchingsActifs() {
    return this.matchings.filter(m => m.statut === 'ACCEPTE');
  }

  constructor(
    public auth: AuthService,
    private demandeService: DemandeService,
    private reparateurService: ReparateurService,
  ) {}

  ngOnInit(): void {
    this.demandeService.getMyMatchings().subscribe({
      next: m => this.matchings = m,
      error: () => {}
    });
    this.reparateurService.getDashboard().subscribe({
      next: d => this.dashboard = d,
      error: () => {}
    });
  }

  getAppareilLabel(type: string): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }

  marquerVu(matchingId: string): void {
    this.demandeService.marquerVu(matchingId).subscribe(() => {
      this.matchings = this.matchings.map(m =>
        m.id === matchingId ? { ...m, statut: 'VU' as any } : m
      );
    });
  }
}
