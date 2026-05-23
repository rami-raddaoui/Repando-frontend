import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { TypeAppareil, TypePanne, TypeIntervention, APPAREIL_LABELS, UserRole } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-creer-demande',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './creer-demande.html',
  styleUrl: './creer-demande.scss'
})
export class CreerDemandeComponent {
  form: FormGroup;
  step = 1;
  loading = false;
  error = '';
  photoPreview: string | null = null;

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => this.photoPreview = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  readonly TypeAppareil = TypeAppareil;
  readonly TypePanne = TypePanne;
  readonly TypeIntervention = TypeIntervention;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;

  readonly appareils = Object.values(TypeAppareil).map(k => ({ key: k, ...APPAREIL_LABELS[k] }));
  readonly pannes = [
    { key: TypePanne.NE_DEMARRE_PLUS, label: 'Ne démarre plus', icon: '⚡' },
    { key: TypePanne.FUITE_EAU,       label: 'Fuite d\'eau',    icon: '💧' },
    { key: TypePanne.BRUIT_ANORMAL,   label: 'Bruit anormal',   icon: '🔊' },
    { key: TypePanne.CODE_ERREUR,     label: 'Code erreur',     icon: '🔴' },
    { key: TypePanne.NE_CHAUFFE_PLUS, label: 'Ne chauffe plus', icon: '🌡' },
    { key: TypePanne.AUTRE,           label: 'Autre',           icon: '❓' },
  ];

  constructor(
    private fb: FormBuilder,
    private demandeService: DemandeService,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      typeAppareil:    [TypeAppareil.LAVE_LINGE, Validators.required],
      marque:          [''],
      modele:          [''],
      typePanne:       [TypePanne.NE_DEMARRE_PLUS, Validators.required],
      description:     [''],
      adresse:         ['', Validators.required],
      ville:           ['Paris'],
      codePostal:      [''],
      typeIntervention:[TypeIntervention.INDIFFERENT, Validators.required],
    });
  }

  submit(): void {
    if (this.form.invalid) return;

    // Si pas connecté, rediriger vers connexion
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/connexion']);
      return;
    }

    this.loading = true;
    this.error = '';

    this.demandeService.create(this.form.value).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/mes-demandes']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Une erreur est survenue. Veuillez réessayer.';
      }
    });
  }
}
