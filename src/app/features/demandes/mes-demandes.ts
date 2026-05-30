import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { DemandeDto, MatchingDto, StatutDemande, APPAREIL_LABELS } from '../../core/models/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mes-demandes',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.scss'
})
export class MesDemandesComponent implements OnInit {
  demandes: DemandeDto[] = [];
  matchings: MatchingDto[] = [];
  loading = false;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutDemande = StatutDemande;
  readonly staticUrl = environment.staticUrl;

  // Cancel confirmation popup
  showCancelModal = false;
  cancelTargetId: string | null = null;

  // Detail popup
  showDetailModal = false;
  detailDemande: DemandeDto | null = null;
  detailLightboxUrl: string | null = null;

  readonly panneLabels: Record<string, { label: string; icon: string }> = {
    NE_DEMARRE_PLUS: { label: 'Ne démarre plus', icon: '⚡' },
    FUITE_EAU:       { label: 'Fuite d\'eau',    icon: '💧' },
    BRUIT_ANORMAL:   { label: 'Bruit anormal',   icon: '🔊' },
    CODE_ERREUR:     { label: 'Code erreur',     icon: '🔴' },
    NE_CHAUFFE_PLUS: { label: 'Ne chauffe plus', icon: '🌡️' },
    AUTRE:           { label: 'Autre',            icon: '❓' },
  };

  constructor(private demandeService: DemandeService, public router: Router) {}

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
    this.demandeService.cancel(id).subscribe(() => this.loadData());
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
      NOUVEAU:      { label: 'Nouveau',    color: '#6366f1' },
      VU:           { label: 'Vu',         color: '#8b5cf6' },
      DEVIS_ENVOYE: { label: 'Devis reçu', color: '#f59e0b' },
      ACCEPTE:      { label: 'En cours',   color: '#10b981' },
      CLOTURE:      { label: 'Clôturé',   color: '#22c55e' },
      REFUSE:       { label: 'Refusé',    color: '#ef4444' },
      ANNULE:       { label: 'Annulé',    color: '#ef4444' },
      EXPIRE:       { label: 'Expiré',    color: '#94a3b8' },
    };
    return map[statut] ?? { label: statut, color: '#94a3b8' };
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
    const demandeMatchings = this.matchings.filter(m => m.demandeId === demandeId);
    if (demandeMatchings.length === 1) {
      this.router.navigate(['/messagerie', demandeMatchings[0].id]);
    } else if (demandeMatchings.length > 1) {
      this.router.navigate(['/messagerie'], { queryParams: { demandeId } });
    } else {
      this.router.navigate(['/messagerie']);
    }
  }

  getAppareilLabel(type: any): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }
}


@Component({
  selector: 'app-mes-demandes',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.scss'
})
export class MesDemandesComponent implements OnInit {
  demandes: DemandeDto[] = [];
  matchings: MatchingDto[] = [];
  loading = false;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutDemande = StatutDemande;

  // Cancel confirmation popup
  showCancelModal = false;
  cancelTargetId: string | null = null;

  constructor(private demandeService: DemandeService, private router: Router) {}

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

  /** Ouvre la popup de confirmation d'annulation */
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

  /** Navigue vers la messagerie, en ouvrant le premier matching de cette demande si disponible */
  goToMessagerie(demandeId: string): void {
    const demandeMatchings = this.matchings.filter(m => m.demandeId === demandeId);
    if (demandeMatchings.length === 1) {
      // Only one conversation → go directly to it
      this.router.navigate(['/messagerie', demandeMatchings[0].id]);
    } else if (demandeMatchings.length > 1) {
      // Multiple conversations → open messagerie filtered for this demande
      this.router.navigate(['/messagerie'], { queryParams: { demandeId } });
    } else {
      this.router.navigate(['/messagerie']);
    }
  }

  getAppareilLabel(type: any): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }
}
