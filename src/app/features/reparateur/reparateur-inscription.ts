import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { ReparateurService } from '../../core/services/reparateur';
import { TypeAppareil, UserRole } from '../../core/models/models';

@Component({
  selector: 'app-reparateur-inscription',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './reparateur-inscription.html',
  styleUrl: './reparateur-inscription.scss'
})
export class ReparateurInscriptionComponent {
  // Étape 1 = infos compte, Étape 2 = infos pro
  step = 1;
  accountForm: FormGroup;
  profileForm: FormGroup;
  loading = false;
  error = '';

  readonly TypeAppareil = TypeAppareil;
  readonly appareilsList = Object.values(TypeAppareil);
  selectedSpecialites: TypeAppareil[] = [TypeAppareil.LAVE_LINGE];

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private reparateurService: ReparateurService,
    private router: Router
  ) {
    this.accountForm = this.fb.group({
      prenom: ['', Validators.required],
      nom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.profileForm = this.fb.group({
      siret: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
      numeroQualirepar: ['', Validators.required],
      anneesExperience: [0, [Validators.required, Validators.min(0)]],
      bio: [''],
      adresseAtelier: ['', Validators.required],
      ville: ['Paris', Validators.required],
      codePostal: ['', Validators.required],
      rayonInterventionKm: [5, [Validators.required, Validators.min(1)]],
    });
  }

  toggleSpecialite(type: TypeAppareil): void {
    const idx = this.selectedSpecialites.indexOf(type);
    if (idx >= 0) this.selectedSpecialites.splice(idx, 1);
    else this.selectedSpecialites.push(type);
  }

  isSelected(type: TypeAppareil): boolean {
    return this.selectedSpecialites.includes(type);
  }

  /** Étape 1 : créer le compte avec role REPARATEUR */
  submitAccount(): void {
    if (this.accountForm.invalid) return;
    this.loading = true;
    this.error = '';

    this.auth.register({ ...this.accountForm.value, role: UserRole.REPARATEUR }).subscribe({
      next: () => {
        this.loading = false;
        this.step = 2;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message ?? 'Erreur lors de la création du compte.';
      }
    });
  }

  /** Étape 2 : créer le profil réparateur */
  submitProfile(): void {
    if (this.profileForm.invalid || this.selectedSpecialites.length === 0) return;
    this.loading = true;
    this.error = '';

    this.reparateurService.createProfile({
      ...this.profileForm.value,
      specialites: this.selectedSpecialites,
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard-reparateur']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Erreur lors de la création du profil.';
      }
    });
  }
}
