import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { UserRole } from '../../core/models/models';

@Component({
  selector: 'app-reparateur-inscription',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './reparateur-inscription.html',
  styleUrl: './reparateur-inscription.scss'
})
export class ReparateurInscriptionComponent {
  accountForm: FormGroup;
  loading = false;
  error = '';
  accountSubmitted = false;
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
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
  }

  isFieldInvalid(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty || this.accountSubmitted);
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
      };
      return requiredMessages[field] ?? 'Ce champ est requis.';
    }

    if (errors['email'] || errors['pattern'] && field === 'email') return 'Entrez une adresse email valide.';
    if (errors['emailTaken']) return 'Cet email est déjà utilisé.';
    if (errors['minlength']) return 'Au moins 8 caractères requis.';
    if (errors['pattern']) return 'Format invalide.';

    return 'Champ invalide.';
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

  // Création du compte réparateur, puis redirection vers le profil métier
  submitAccount(): void {
    this.accountSubmitted = true;
    this.markFormTouched(this.accountForm);
    if (this.accountForm.invalid) return;
    this.loading = true;
    this.error = '';

    this.auth.register({ ...this.accountForm.value, role: UserRole.REPARATEUR }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/profil'], { queryParams: { tab: 'metier' } });
      },
      error: (err) => {
        this.loading = false;
        this.handleAccountSubmissionError(err);
        this.error = '';
      }
    });
  }
}
