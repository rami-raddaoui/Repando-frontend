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
  idfError = '';
  isCodePostalIDF = true;
  postalMatches: { nom: string; code?: string; codesPostaux?: string[] }[] = [];
  private localPostalMap: Record<string, string[]> | null = null;
  private localPostalMapLoaded = false;
  private codePostalDebounce?: number;

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
      numeroQualirepar: [''],
      anneesExperience: [0, [Validators.required, Validators.min(0)]],
      bio: [''],
      adresseAtelier: ['', Validators.required],
      codePostal: ['', Validators.required],
      // keep the input readonly in the template but the control must be enabled
      // so its value is included when submitting the form
      ville: ['', Validators.required],
      rayonInterventionKm: [5, [Validators.required, Validators.min(1)]],
    });
    // when codePostal changes, update ville dynamically
    this.profileForm.get('codePostal')?.valueChanges.subscribe((value) => this.onCodePostalChange(value));
  }

  private async ensureLocalMapLoaded(): Promise<void> {
    if (this.localPostalMapLoaded) return;
    try {
      const res = await fetch('/data/idf-postal-to-communes.json');
      if (res.ok) this.localPostalMap = await res.json();
      else this.localPostalMap = null;
    } catch (e) {
      this.localPostalMap = null;
    } finally {
      this.localPostalMapLoaded = true;
    }
  }

  private onCodePostalChange(cpRaw?: string): void {
    const cp = (cpRaw || '').toString().trim();
    this.idfError = '';
    this.isCodePostalIDF = false;
    if (!cp) {
      this.profileForm.get('ville')?.setValue('');
      this.postalMatches = [];
      return;
    }
    if (/^\d{5}$/.test(cp)) {
      if (this.codePostalDebounce) window.clearTimeout(this.codePostalDebounce);
      this.codePostalDebounce = window.setTimeout(async () => {
        await this.ensureLocalMapLoaded();
        if (this.localPostalMap && this.localPostalMap[cp]) {
          const matches = this.localPostalMap[cp];
          if (matches.length === 1) {
            this.profileForm.get('ville')?.setValue(matches[0]);
            this.postalMatches = [];
            this.isCodePostalIDF = true;
            this.idfError = '';
          } else {
            this.postalMatches = matches.map(n => ({ nom: n }));
            this.profileForm.get('ville')?.setValue('');
            this.isCodePostalIDF = true;
            this.idfError = '';
          }
          return;
        }
        const url = `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,code,codesPostaux&boost=population`;
        fetch(url).then(async res => {
          if (!res.ok) throw new Error('API error');
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            if (data.length === 1) {
              const m = data[0];
              const dep = (m.code || '').substring(0,2);
              if (['75','77','78','91','92','93','94','95'].includes(dep)) {
                this.profileForm.get('ville')!.setValue(m.nom);
                this.postalMatches = [];
                this.isCodePostalIDF = true;
                this.idfError = '';
              } else {
                this.profileForm.get('ville')!.setValue('');
                this.postalMatches = [];
                this.isCodePostalIDF = false;
                this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
              }
            } else {
              this.postalMatches = data.map((c: any) => ({ nom: c.nom, code: c.code }));
              this.profileForm.get('ville')!.setValue('');
              this.isCodePostalIDF = true;
              this.idfError = '';
            }
            return;
          }
          this.postalMatches = [];
          this.profileForm.get('ville')!.setValue('');
          this.isCodePostalIDF = false;
          this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
        }).catch(() => {
          this.postalMatches = [];
          const dep = cp.substring(0,2);
          if (['75','77','78','91','92','93','94','95'].includes(dep)) {
            this.profileForm.get('ville')!.setValue('');
            this.isCodePostalIDF = true;
            this.idfError = '';
          } else {
            this.profileForm.get('ville')!.setValue('');
            this.isCodePostalIDF = false;
            this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
          }
        });
      }, 300);
      return;
    }
    const dep = cp.substring(0,2);
    if (['75','77','78','91','92','93','94','95'].includes(dep)) {
      this.profileForm.get('ville')?.setValue('');
      this.isCodePostalIDF = true;
      this.idfError = '';
      return;
    }
    this.profileForm.get('ville')?.setValue('');
    this.isCodePostalIDF = false;
    this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
  }

  selectCommune(match: { nom: string; code?: string }): void {
    let depCode = '';
    if (match.code) depCode = match.code.substring(0,2);
    else {
      const cp = (this.profileForm.get('codePostal')!.value || '').toString().trim();
      if (cp.length >= 2) depCode = cp.substring(0,2);
    }
    if (!depCode || ['75','77','78','91','92','93','94','95'].includes(depCode)) {
      this.profileForm.get('ville')!.setValue(match.nom);
      this.idfError = '';
      this.isCodePostalIDF = true;
    } else {
      this.profileForm.get('ville')!.setValue('');
      this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
      this.isCodePostalIDF = false;
    }
    this.postalMatches = [];
  }

  selectCommuneByName(name: string): void {
    const match = this.postalMatches.find(m => m.nom === name);
    if (match) this.selectCommune(match);
  }

  selectCommuneByEvent(event: Event) {
    const value = (event.target && (event.target as HTMLSelectElement).value) || '';
    if (value) this.selectCommuneByName(value);
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

    // include disabled controls if any in the future by using getRawValue()
    const payload = {
      ...this.profileForm.getRawValue(),
      specialites: this.selectedSpecialites,
    } as any;

    this.reparateurService.createProfile(payload).subscribe({
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
