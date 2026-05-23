import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReparateurService } from '../../core/services/reparateur';
import { ReparateurPublicDto, TypeAppareil, APPAREIL_LABELS, PagedResult } from '../../core/models/models';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class SearchComponent implements OnInit {
  reparateurs: ReparateurPublicDto[] = [];
  total = 0;
  loading = false;
  error = '';

  // Filtres — typeAppareil requis par l'API
  typeAppareil: TypeAppareil = TypeAppareil.LAVE_LINGE;
  rayonKm = 10;
  dispoSeulement = false;
  sort = 'pertinence';

  readonly TypeAppareil = TypeAppareil;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly appareilOptions = Object.values(TypeAppareil).map(k => ({
    key: k, ...APPAREIL_LABELS[k]
  }));

  constructor(private reparateurService: ReparateurService) {}

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    this.loading = true;
    this.error = '';
    this.reparateurService.search({
      typeAppareil: this.typeAppareil,
      rayonKm: this.rayonKm,
      dispoSeulement: this.dispoSeulement,
    }).subscribe({
      next: (res: PagedResult<ReparateurPublicDto>) => {
        this.reparateurs = res.items;
        this.total = res.total;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Erreur lors du chargement des réparateurs.';
      }
    });
  }

  selectAppareil(type: TypeAppareil): void {
    this.typeAppareil = type;
    this.search();
  }

  resetFilters(): void {
    this.typeAppareil = TypeAppareil.LAVE_LINGE;
    this.rayonKm = 10;
    this.dispoSeulement = false;
    this.search();
  }

  getLabel(s: string): string {
    const l = (this.APPAREIL_LABELS as any)[s];
    return l ? `${l.icon} ${l.label}` : s;
  }
}
