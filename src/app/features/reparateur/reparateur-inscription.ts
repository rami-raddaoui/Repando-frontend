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
  accountSubmitted = false;
  profileSubmitted = false;
  specialitesTouched = false;
  postalMatches: { nom: string; code?: string; codesPostaux?: string[] }[] = [];
  private localPostalMap: Record<string, string[]> | null = null;
  private localPostalMapLoaded = false;
  private codePostalDebounce?: number;

  private readonly idfDepartments = ['75', '77', '78', '91', '92', '93', '94', '95'];
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
      email: ['', [Validators.required, Validators.pattern(this.emailPattern)]],
      telephone: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.accountForm.get('email')?.valueChanges.subscribe(() => {
      this.clearControlBackendErrors(this.accountForm, 'email', ['emailTaken']);
    });

    this.profileForm = this.fb.group({
      siret: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
      numeroQualirepar: [''],
      anneesExperience: [0, [Validators.min(0)]],
      bio: [''],
      adresseAtelier: ['', Validators.required],
      codePostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      // keep the input readonly in the template but the control must be enabled
      // so its value is included when submitting the form
      ville: ['', Validators.required],
      rayonInterventionKm: [5, [Validators.min(1)]],
    });
    // when codePostal changes, update ville dynamically
    this.profileForm.get('codePostal')?.valueChanges.subscribe((value) => this.onCodePostalChange(value));
  }

  isFieldInvalid(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    if (!control) return false;
    const formWasSubmitted = form === this.accountForm ? this.accountSubmitted : this.profileSubmitted;
    return control.invalid && (control.touched || control.dirty || formWasSubmitted);
  }

  fieldError(form: FormGroup, field: string): string {
    const control = form.get(field);
    if (!control || !this.isFieldInvalid(form, field)) return '';

    const errors = control.errors || {};

    if (errors['required']) {
      const requiredMessages: Record<string, string> = {
        prenom: 'Le prénom est requis.',
        nom: 'Le nom est requis.',
        email: 'L’email est requis.',
        telephone: 'Le téléphone est requis.',
        password: 'Le mot de passe est requis.',
        siret: 'Le SIRET est requis.',
        adresseAtelier: 'L’adresse de l’atelier est requise.',
        codePostal: 'Le code postal est requis.',
        ville: 'La ville est requise.',
      };
      return requiredMessages[field] ?? 'Ce champ est requis.';
    }

    if (errors['email'] || errors['pattern'] && field === 'email') return 'Entrez une adresse email valide.';
    if (errors['emailTaken']) return 'Cet email est déjà utilisé.';
    if (errors['minlength']) return 'Au moins 8 caractères requis.';
    if (errors['pattern']) {
      if (field === 'siret') return 'Le SIRET doit contenir 14 chiffres.';
      if (field === 'codePostal') return 'Le code postal doit contenir 5 chiffres.';
      return 'Format invalide.';
    }
    if (errors['min']) return 'La valeur doit être supérieure ou égale à la valeur minimale.';

    return 'Champ invalide.';
  }

  specialitesError(): string {
    if (this.selectedSpecialites.length > 0) return '';
    return (this.specialitesTouched || this.profileSubmitted) ? 'Choisissez au moins une spécialité.' : '';
  }

  cityError(): string {
    if (this.needsCommuneSelection()) return 'Choisissez votre commune.';
    return this.fieldError(this.profileForm, 'ville');
  }

  needsCommuneSelection(): boolean {
    return this.postalMatches.length > 1 && !((this.profileForm.get('ville')?.value || '').toString().trim());
  }

  private friendlySubmissionError(fallback: string, err?: any): string {
    const raw = (err?.error?.error ?? err?.error?.message ?? err?.message ?? '').toString().trim().toLowerCase();

    if (!raw) return fallback;
    if (raw.includes('email') && (raw.includes('exist') || raw.includes('already'))) return 'Cet email est déjà utilisé.';
    if (raw.includes('siret')) return 'Le SIRET est invalide.';
    if (raw.includes('qualirepar')) return 'Le numéro QualiRépar est invalide.';

    return fallback;
  }

  private markFormTouched(form: FormGroup): void {
    form.markAllAsTouched();
  }

  private setControlBackendError(form: FormGroup, field: string, key: string): void {
    const control = form.get(field);
    if (!control) return;
    control.setErrors({ ...(control.errors || {}), [key]: true });
    control.markAsTouched();
  }

  private clearControlBackendErrors(form: FormGroup, field: string, keys: string[]): void {
    const control = form.get(field);
    if (!control?.errors) return;

    const nextErrors = { ...control.errors };
    let changed = false;
    for (const key of keys) {
      if (key in nextErrors) {
        delete nextErrors[key];
        changed = true;
      }
    }

    if (!changed) return;
    control.setErrors(Object.keys(nextErrors).length ? nextErrors : null);
  }

  private handleAccountSubmissionError(err: any): void {
    const raw = (err?.error?.error ?? err?.error?.message ?? err?.message ?? '').toString().trim().toLowerCase();

    if (raw.includes('email') && (raw.includes('exist') || raw.includes('already') || raw.includes('taken') || raw.includes('déjà'))) {
      this.setControlBackendError(this.accountForm, 'email', 'emailTaken');
      return;
    }

    if (raw.includes('prenom')) {
      this.setControlBackendError(this.accountForm, 'prenom', 'backend');
      return;
    }

    if (raw.includes('nom')) {
      this.setControlBackendError(this.accountForm, 'nom', 'backend');
      return;
    }

    if (raw.includes('password') || raw.includes('mot de passe')) {
      this.setControlBackendError(this.accountForm, 'password', 'backend');
      return;
    }

    if (raw.includes('telephone') || raw.includes('téléphone')) {
      this.setControlBackendError(this.accountForm, 'telephone', 'backend');
    }
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
              if (this.idfDepartments.includes(dep)) {
                this.profileForm.get('ville')!.setValue(m.nom);
                this.postalMatches = [];
                this.isCodePostalIDF = true;
                this.idfError = '';
              } else {
                this.profileForm.get('ville')!.setValue('');
                this.postalMatches = [];
                this.isCodePostalIDF = false;
                this.idfError = 'Repando est disponible en Île-de-France uniquement pour le moment.';
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
          this.idfError = 'Repando est disponible en Île-de-France uniquement pour le moment.';
        }).catch(() => {
          this.postalMatches = [];
          const dep = cp.substring(0,2);
          if (this.idfDepartments.includes(dep)) {
            this.profileForm.get('ville')!.setValue('');
            this.isCodePostalIDF = true;
            this.idfError = '';
          } else {
            this.profileForm.get('ville')!.setValue('');
            this.isCodePostalIDF = false;
            this.idfError = 'Repando est disponible en Île-de-France uniquement pour le moment.';
          }
        });
      }, 300);
      return;
    }
    const dep = cp.substring(0,2);
    if (this.idfDepartments.includes(dep)) {
      this.profileForm.get('ville')?.setValue('');
      this.isCodePostalIDF = true;
      this.idfError = '';
      return;
    }
    this.profileForm.get('ville')?.setValue('');
    this.isCodePostalIDF = false;
    this.idfError = 'Repando est disponible en Île-de-France uniquement pour le moment.';
  }

  selectCommune(match: { nom: string; code?: string }): void {
    let depCode = '';
    if (match.code) depCode = match.code.substring(0,2);
    else {
      const cp = (this.profileForm.get('codePostal')!.value || '').toString().trim();
      if (cp.length >= 2) depCode = cp.substring(0,2);
    }
    if (!depCode || this.idfDepartments.includes(depCode)) {
      this.profileForm.get('ville')!.setValue(match.nom);
      this.idfError = '';
      this.isCodePostalIDF = true;
    } else {
      this.profileForm.get('ville')!.setValue('');
      this.idfError = 'Repando est disponible en Île-de-France uniquement pour le moment.';
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
    this.specialitesTouched = true;
    const idx = this.selectedSpecialites.indexOf(type);
    if (idx >= 0) this.selectedSpecialites.splice(idx, 1);
    else this.selectedSpecialites.push(type);
  }

  isSelected(type: TypeAppareil): boolean {
    return this.selectedSpecialites.includes(type);
  }

  /** Étape 1 : créer le compte avec role REPARATEUR */
  submitAccount(): void {
    this.accountSubmitted = true;
    this.markFormTouched(this.accountForm);
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
        this.handleAccountSubmissionError(err);
        this.error = '';
      }
    });
  }

  /** Étape 2 : créer le profil réparateur */
  submitProfile(): void {
    this.profileSubmitted = true;
    this.specialitesTouched = true;
    this.markFormTouched(this.profileForm);
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
        this.error = this.friendlySubmissionError('La création du profil a échoué. Veuillez vérifier les champs.', err);
      }
    });
  }
}
