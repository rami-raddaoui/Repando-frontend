import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { DemandeDto, MatchingDto, StatutDemande, APPAREIL_LABELS } from '../../core/models/models';

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
    const matching = this.matchings.find(m => m.demandeId === demandeId);
    if (matching) {
      this.router.navigate(['/messagerie', matching.id]);
    } else {
      this.router.navigate(['/messagerie']);
    }
  }

  getAppareilLabel(type: any): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }
}
