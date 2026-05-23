import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { DemandeDto, StatutDemande, APPAREIL_LABELS } from '../../core/models/models';

@Component({
  selector: 'app-mes-demandes',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.scss'
})
export class MesDemandesComponent implements OnInit {
  demandes: DemandeDto[] = [];
  loading = false;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutDemande = StatutDemande;

  constructor(private demandeService: DemandeService) {}

  ngOnInit(): void {
    this.loading = true;
    this.demandeService.getMesDemandes().subscribe({
      next: d => { this.demandes = d; this.loading = false; },
      error: () => this.loading = false
    });
  }

  cancel(id: string): void {
    if (!confirm('Confirmer l\'annulation ?')) return;
    this.demandeService.cancel(id).subscribe(() => {
      this.demandes = this.demandes.map(d =>
        d.id === id ? { ...d, statut: StatutDemande.ANNULEE } : d
      );
    });
  }

  getAppareilLabel(type: any): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }
}
