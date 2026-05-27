import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { DemandeService } from '../../core/services/demande';
import { ReparateurService } from '../../core/services/reparateur';
import { MatchingDto, APPAREIL_LABELS, StatutMatching } from '../../core/models/models';

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
export class DashboardReparateurComponent implements OnInit {
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
  showDetailModal = false;

  // ── Decline popup ─────────────────────────────────────────────
  declineTarget: MatchingDto | null = null;
  showDeclineModal = false;
  selectedReasons: Set<string> = new Set();
  readonly DECLINE_REASONS = DECLINE_REASONS;

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

  // ── Detail modal ──────────────────────────────────────────────
  openDetail(m: MatchingDto): void {
    this.selectedMission = m;
    this.showDetailModal = true;
    // Mark as seen if NOUVEAU
    if (m.statut === 'NOUVEAU') {
      this.demandeService.marquerVu(m.id).subscribe();
    }
  }

  closeDetail(): void {
    this.showDetailModal = false;
    this.selectedMission = null;
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
        this.actionSuccess = 'Mission acceptée ! La conversation est ouverte.';
        this.closeDetail();
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
