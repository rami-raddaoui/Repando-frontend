import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReparateurService } from '../../core/services/reparateur';
import { ReparateurDetailDto, APPAREIL_LABELS, TypeAppareil } from '../../core/models/models';

@Component({
  selector: 'app-profil-reparateur',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './profil-reparateur.html',
  styleUrl: './profil-reparateur.scss'
})
export class ProfilReparateurComponent implements OnInit {
  reparateur: ReparateurDetailDto | null = null;
  loading = false;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;

  constructor(private route: ActivatedRoute, private reparateurService: ReparateurService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loading = true;
    this.reparateurService.getById(id).subscribe({
      next: r => { this.reparateur = r; this.loading = false; },
      error: () => this.loading = false
    });
  }

  getAppareilLabel(s: string): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[s] ?? { label: s, icon: '🔧' };
  }
}
