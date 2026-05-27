import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { DemandeService } from '../../core/services/demande';
import { ReparateurService } from '../../core/services/reparateur';
import { MatchingDto, APPAREIL_LABELS, StatutMatching } from '../../core/models/models';

@Component({
  selector: 'app-dashboard-reparateur',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard-reparateur.html',
  styleUrl: './dashboard-reparateur.scss'
})
export class DashboardReparateurComponent implements OnInit {
  tab: 'missions' | 'actifs' | 'historique' = 'missions';
  matchings: MatchingDto[] = [];
  dashboard: any = null;
  loading = false;
  actionLoading: string | null = null;
  actionSuccess = '';
  actionError = '';

  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutMatching = StatutMatching;

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

  constructor(
    public auth: AuthService,
    private demandeService: DemandeService,
    private reparateurService: ReparateurService,
  ) {}

  ngOnInit(): void {
    this.loadMatchings();
    this.reparateurService.getDashboard().subscribe({
      next: d => this.dashboard = d,
      error: () => {}
    });
  }

  loadMatchings(): void {
    this.loading = true;
    this.demandeService.getMyMatchings().subscribe({
      next: m => { this.matchings = m; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getAppareilLabel(type: string): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }

  accepterMission(matchingId: string): void {
    this.actionLoading = matchingId;
    this.actionError = '';
    this.demandeService.accepterMission(matchingId).subscribe({
      next: () => {
        this.actionLoading = null;
        this.actionSuccess = 'Mission acceptée ! La conversation est ouverte.';
        this.loadMatchings();
        setTimeout(() => this.actionSuccess = '', 4000);
      },
      error: (e) => {
        this.actionLoading = null;
        this.actionError = e?.error?.error ?? 'Erreur lors de l\'acceptation';
        setTimeout(() => this.actionError = '', 4000);
      }
    });
  }

  declinerMission(matchingId: string): void {
    this.actionLoading = matchingId + '_decline';
    this.demandeService.declinerMission(matchingId).subscribe({
      next: () => {
        this.actionLoading = null;
        this.loadMatchings();
      },
      error: () => { this.actionLoading = null; }
    });
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
}
