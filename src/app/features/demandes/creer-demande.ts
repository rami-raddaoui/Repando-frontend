import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { TypeAppareil, TypePanne, TypeIntervention, APPAREIL_LABELS, UserRole } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';
import { ToastService } from '../../core/services/toast';

@Component({
  selector: 'app-creer-demande',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './creer-demande.html',
  styleUrl: './creer-demande.scss'
})
export class CreerDemandeComponent {
  form: FormGroup;
  quickRegisterForm: FormGroup;
  loading = false;
  error = '';
  photoPreviews: { url: string; name: string; size: string; file: File }[] = [];
  idfError = '';
  hasDraft = false;
  showLoginPrompt = false;
  showGuestPrompt = false;
  showDraftSavedSuccess = false;
  guestDraftSaved = false;
  contactHidden = false;
  quickRegisterSubmitted = false;
  private draftSaveTimer?: number;
  private lastPersistedLocalDraftSignature = '';
  private guestDraftSaveInFlight = false;
  private readonly quickEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  readonly TypeAppareil = TypeAppareil;
  readonly TypePanne = TypePanne;
  readonly TypeIntervention = TypeIntervention;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly draftKey = 'repando_demande_draft';

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
    public auth: AuthService,
    private router: Router,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      typeAppareil:    [TypeAppareil.LAVE_LINGE, Validators.required],
      marque:          [''],
      modele:          [''],
      typePanne:       [TypePanne.NE_DEMARRE_PLUS, Validators.required],
      description:     [''],
      email:           ['', [Validators.email]],
      telephone:       [''],
      adresse:         ['', Validators.required],
      ville:           ['Paris'],
      codePostal:      [''],
      typeIntervention:[TypeIntervention.INDIFFERENT, Validators.required],
    });

    this.quickRegisterForm = this.fb.group({
      prenom: ['', Validators.required],
      nom: ['', Validators.required],
      email: ['', [Validators.required, Validators.pattern(this.quickEmailPattern)]],
      telephone: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      acceptCgu: [false, Validators.requiredTrue],
    }, { validators: this.passwordMatchValidator });

    this.form.get('codePostal')!.valueChanges.subscribe((cp: string) => this.onCodePostalChange(cp));
    this.form.valueChanges.subscribe(() => this.persistDraft());

    this.restoreDraft();
    this.hydrateAuthenticatedContact();
    this.syncDraftBanner();
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true };
  }

  isQuickFieldInvalid(field: string): boolean {
    const control = this.quickRegisterForm.get(field);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty || this.quickRegisterSubmitted);
  }

  quickFieldError(field: string): string {
    const control = this.quickRegisterForm.get(field);
    if (!control || !this.isQuickFieldInvalid(field)) return '';

    const errors = control.errors || {};

    if (errors['required']) {
      const requiredMessages: Record<string, string> = {
        prenom: 'Le prénom est requis.',
        nom: 'Le nom est requis.',
        email: 'L’email est requis.',
        telephone: 'Le téléphone est requis.',
        password: 'Le mot de passe est requis.',
        confirmPassword: 'La confirmation du mot de passe est requise.',
        acceptCgu: 'Vous devez accepter les Conditions Générales d\'Utilisation et la Politique de confidentialité pour continuer.'
      };
      return requiredMessages[field] ?? 'Ce champ est requis.';
    }

    if (errors['requiredTrue'] && field === 'acceptCgu') {
      return 'Vous devez accepter les Conditions Générales d\'Utilisation et la Politique de confidentialité pour continuer.';
    }

    if ((errors['email'] || errors['pattern']) && field === 'email') {
      return 'Entrez une adresse email valide.';
    }

    if (errors['minlength'] && field === 'password') {
      return 'Le mot de passe doit contenir au moins 8 caractères.';
    }

    if (this.quickRegisterForm.hasError('mismatch') && (field === 'password' || field === 'confirmPassword')) {
      return 'Les mots de passe ne correspondent pas.';
    }

    return 'Champ invalide.';
  }

  hasQuickRegisterCguError(): boolean {
    const c = this.quickRegisterForm.get('acceptCgu');
    if (!c) return false;
    return c.invalid && (c.touched || c.dirty || this.quickRegisterSubmitted);
  }

  private syncDraftBanner(): void {
    this.hasDraft = typeof window !== 'undefined' && !!window.localStorage.getItem(this.draftKey);
  }

  private hydrateAuthenticatedContact(): void {
    const user = this.auth.currentUser();
    if (user?.email) {
      this.form.patchValue({ email: user.email }, { emitEvent: false });
      this.contactHidden = true;
    }

    this.auth.me().subscribe({
      next: u => {
        this.contactHidden = true;
        this.form.patchValue({
          email: u.email || this.form.get('email')?.value || '',
          telephone: u.telephone || this.form.get('telephone')?.value || ''
        }, { emitEvent: false });
      },
      error: () => {
        this.contactHidden = !!user;
      }
    });
  }

  private getDraftPayload() {
    const raw = this.form.getRawValue();
    return {
      ...raw,
      photoPreviews: this.photoPreviews.map(p => ({
        url: p.url,
        name: p.name,
        size: p.size,
      }))
    };
  }

  private persistDraft(): void {
    if (typeof window === 'undefined') return;

    const data = this.getDraftPayload();
    if (!data || Object.keys(data).length === 0) return;

    const nextSignature = JSON.stringify(data);
    if (nextSignature === this.lastPersistedLocalDraftSignature) return;

    if (this.draftSaveTimer) {
      window.clearTimeout(this.draftSaveTimer);
    }

    this.draftSaveTimer = window.setTimeout(() => {
      const payload = {
        email: (this.form.get('email')?.value ?? '').toString().trim(),
        telephone: (this.form.get('telephone')?.value ?? '').toString().trim(),
        prenom: '',
        nom: '',
        typeAppareil: this.form.get('typeAppareil')?.value,
        marque: this.form.get('marque')?.value,
        modele: this.form.get('modele')?.value,
        typePanne: this.form.get('typePanne')?.value,
        description: this.form.get('description')?.value,
        photoUrls: this.photoPreviews.map(p => p.url),
        adresse: this.form.get('adresse')?.value,
        ville: this.form.get('ville')?.value ?? 'Paris',
        codePostal: this.form.get('codePostal')?.value,
        latitude: undefined,
        longitude: undefined,
        typeIntervention: this.form.get('typeIntervention')?.value,
      };

      const draftRecord = { ...data, draftSavedAt: Date.now() };
      const hasGuestContact = !!(payload.email || payload.telephone);
      this.lastPersistedLocalDraftSignature = nextSignature;

      if (!hasGuestContact) {
        window.localStorage.setItem(this.draftKey, JSON.stringify(draftRecord));
        this.hasDraft = true;
        return;
      }

      if (this.guestDraftSaveInFlight) {
        return;
      }

      this.guestDraftSaveInFlight = true;

      this.demandeService.saveGuestDraft(payload).subscribe({
        next: (resp) => {
          if (resp?.draftId) {
            window.localStorage.setItem(this.draftKey, JSON.stringify({ ...draftRecord, draftId: resp.draftId, clientId: resp.clientId }));
            this.hasDraft = true;
          }
          this.guestDraftSaveInFlight = false;
        },
        error: () => {
          window.localStorage.setItem(this.draftKey, JSON.stringify(draftRecord));
          this.hasDraft = true;
          this.guestDraftSaveInFlight = false;
        }
      });
    }, 700);
  }

  private restoreDraft(): void {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(this.draftKey);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw);
      if (!draft) return;
      this.form.patchValue({
        typeAppareil: draft.typeAppareil ?? TypeAppareil.LAVE_LINGE,
        marque: draft.marque ?? '',
        modele: draft.modele ?? '',
        typePanne: draft.typePanne ?? TypePanne.NE_DEMARRE_PLUS,
        description: draft.description ?? '',
        email: draft.email ?? '',
        telephone: draft.telephone ?? '',
        adresse: draft.adresse ?? '',
        ville: draft.ville ?? 'Paris',
        codePostal: draft.codePostal ?? '',
        typeIntervention: draft.typeIntervention ?? TypeIntervention.INDIFFERENT,
      }, { emitEvent: false });

      if (Array.isArray(draft.photoPreviews)) {
        this.photoPreviews = draft.photoPreviews.map((p: any) => ({
          url: p.url,
          name: p.name ?? 'photo',
          size: p.size ?? '',
          file: new File([], p.name ?? 'photo')
        }));
      }
      this.hasDraft = true;
    } catch {
      this.hasDraft = false;
      window.localStorage.removeItem(this.draftKey);
    }
  }

  private clearDraft(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(this.draftKey);
    this.hasDraft = false;
  }

  private validateContactBeforeSubmit(): void {
    if (this.auth.isLoggedIn()) {
      this.submitDemand();
      return;
    }

    const email = (this.form.get('email')?.value ?? '').toString().trim();
    const telephone = (this.form.get('telephone')?.value ?? '').toString().trim();

    if (!email && !telephone) {
      this.showGuestPrompt = true;
      this.showLoginPrompt = false;
      return;
    }

    this.quickRegisterForm.patchValue({
      email: email || this.quickRegisterForm.get('email')?.value || '',
      telephone: telephone || this.quickRegisterForm.get('telephone')?.value || ''
    }, { emitEvent: false });

    this.auth.checkContact({ email: email || undefined, telephone: telephone || undefined }).subscribe({
      next: ({ emailExists, telephoneExists, emailIsGuest, telephoneIsGuest }) => {
        const hasRealExistingAccount = (emailExists && !!email) || (telephoneExists && !!telephone);
        const hasGuestMatch = (emailIsGuest && !!email) || (telephoneIsGuest && !!telephone);

        if (hasRealExistingAccount) {
          this.showLoginPrompt = true;
          this.showGuestPrompt = false;
          return;
        }

        if (hasGuestMatch) {
          this.showGuestPrompt = true;
          this.showLoginPrompt = false;
          return;
        }

        this.showGuestPrompt = true;
        this.showLoginPrompt = false;
      },
      error: () => {
        this.showGuestPrompt = true;
        this.showLoginPrompt = false;
      }
    });
  }

  private submitDemand(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const dataUrls = this.photoPreviews.map(p => p.url);

    const doCreate = (photoUrls: string[]) => {
      const payload = { ...this.form.value, photoUrls };
      this.demandeService.create(payload).subscribe({
        next: () => {
          this.clearDraft();
          this.loading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error ?? 'Une erreur est survenue. Veuillez réessayer.';
        }
      });
    };

    if (dataUrls.length > 0) {
      this.demandeService.uploadPhotos(dataUrls).subscribe({
        next: (urls) => doCreate(urls),
        error: () => doCreate([]) // fallback: créer sans photos
      });
    } else {
      doCreate([]);
    }
  }

  scrollToForm(): void {
    const el = document.querySelector('.cd-form');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.validateContactBeforeSubmit();
  }

  continueAsGuest(): void {
    const email = (this.form.get('email')?.value ?? '').toString().trim();
    const telephone = (this.form.get('telephone')?.value ?? '').toString().trim();

    if (!email && !telephone) {
      this.error = 'Ajoutez un email ou un téléphone pour enregistrer votre demande.';
      this.toast.warning(this.error);
      return;
    }

    const payload = {
      email: email || undefined,
      telephone: telephone || undefined,
      prenom: '',
      nom: '',
      typeAppareil: this.form.get('typeAppareil')?.value,
      marque: this.form.get('marque')?.value,
      modele: this.form.get('modele')?.value,
      typePanne: this.form.get('typePanne')?.value,
      description: this.form.get('description')?.value,
      photoUrls: this.photoPreviews.map(p => p.url),
      adresse: this.form.get('adresse')?.value,
      ville: this.form.get('ville')?.value ?? 'Paris',
      codePostal: this.form.get('codePostal')?.value,
      latitude: undefined,
      longitude: undefined,
      typeIntervention: this.form.get('typeIntervention')?.value,
    };

    this.loading = true;
    this.error = '';

    this.demandeService.saveGuestDraft(payload).subscribe({
      next: (resp) => {
        const draftRecord = {
          ...payload,
          draftId: resp.draftId,
          clientId: resp.clientId,
          draftSavedAt: Date.now(),
        };
        window.localStorage.setItem(this.draftKey, JSON.stringify(draftRecord));
        window.localStorage.setItem('repando_last_success_message', 'Demande créée avec succès !');
        window.sessionStorage.setItem('repando_app_draft_banner', '1');
        window.dispatchEvent(new CustomEvent('repando-draft-banner-changed', { detail: { visible: true } }));
        this.guestDraftSaved = true;
        this.showGuestPrompt = false;
        this.loading = false;
        this.toast.success('Demande créée avec succès !');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Impossible d\'enregistrer votre demande sans connexion.';
        this.toast.error(this.error);
      }
    });
  }

  registerQuick(): void {
    this.quickRegisterSubmitted = true;
    this.quickRegisterForm.markAllAsTouched();
    if (this.quickRegisterForm.invalid) {
      this.error = 'Le formulaire est incomplet ou invalide. Vérifiez les champs de votre inscription.';
      this.toast.error(this.error);
      return;
    }

    const email = (this.quickRegisterForm.get('email')?.value ?? '').toString().trim();
    const telephone = (this.quickRegisterForm.get('telephone')?.value ?? '').toString().trim();

    if (!email || !telephone) {
      this.error = 'Ajoutez un email et un téléphone valides pour finaliser votre inscription.';
      this.toast.error(this.error);
      return;
    }

    const { confirmPassword, acceptCgu, ...data } = this.quickRegisterForm.value;
    this.loading = true;
    this.error = '';

    const draftId = this.getStoredDraft()?.draftId;
    this.auth.register({
      ...data,
      email,
      telephone,
      role: UserRole.CLIENT,
      draftId: draftId ?? undefined,
    }).subscribe({
      next: () => {
        this.contactHidden = true;
        this.showGuestPrompt = false;
        this.showLoginPrompt = false;
        this.quickRegisterForm.reset();

        this.form.patchValue({ email, telephone }, { emitEvent: false });

        const stored = this.getStoredDraft();
        if (stored?.draftId) {
          window.localStorage.setItem(this.draftKey, JSON.stringify({ ...stored, draftId: stored.draftId, clientId: stored.clientId }));
        }

        if (this.form.valid) {
          this.submitDemand();
          return;
        }

        this.loading = false;
        this.toast.success('Compte créé avec succès. Vous pouvez maintenant finaliser votre demande.');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.error ?? err?.message ?? 'Erreur lors de l\'inscription.';
        this.error = msg;
        this.toast.error(msg);
      }
    });
  }

  closeLoginPrompt(): void {
    this.showLoginPrompt = false;
    this.showDraftSavedSuccess = true;
    this.hasDraft = false;

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('repando_app_draft_banner', '1');
    }

    this.toast.success('Votre demande a bien été enregistrée en brouillon.');

    window.setTimeout(() => {
      this.router.navigate(['/']);
    }, 650);
  }

  closeGuestPrompt(): void {
    this.showGuestPrompt = false;
  }

  goToLogin(): void {
    this.router.navigate(['/connexion']);
  }

  redirectToRegister(): void {
    this.router.navigate(['/connexion'], { queryParams: { mode: 'register' } });
  }

  private readonly IDF_DEPS: Record<string, string> = {
    '75': 'Paris',
    '77': 'Seine-et-Marne',
    '78': 'Yvelines',
    '91': 'Essonne',
    '92': 'Hauts-de-Seine',
    '93': 'Seine-Saint-Denis',
    '94': 'Val-de-Marne',
    '95': 'Val-d\'Oise'
  };

  private localPostalMap: Record<string, string[]> | null = null;
  private localPostalMapLoaded = false;

  private async ensureLocalMapLoaded(): Promise<void> {
    if (this.localPostalMapLoaded) return;
    try {
      const res = await fetch('/data/idf-postal-to-communes.json');
      if (!res.ok) throw new Error('local JSON not found');
      this.localPostalMap = await res.json();
    } catch {
      this.localPostalMap = null;
    } finally {
      this.localPostalMapLoaded = true;
    }
  }

  postalMatches: { nom: string; code: string; codesPostaux?: string[] }[] = [];
  private codePostalDebounce?: number;

  private onCodePostalChange(cpRaw?: string): void {
    const cp = (cpRaw || '').toString().trim();
    if (!cp) {
      this.form.get('ville')!.setValue('');
      return;
    }

    if (/^\d{5}$/.test(cp)) {
      if (this.codePostalDebounce) {
        window.clearTimeout(this.codePostalDebounce);
      }
      this.codePostalDebounce = window.setTimeout(async () => {
        await this.ensureLocalMapLoaded();
        if (this.localPostalMap && this.localPostalMap[cp]) {
          const matches = this.localPostalMap[cp];
          if (matches.length === 1) {
            this.form.get('ville')!.setValue(matches[0]);
            this.postalMatches = [];
            this.idfError = '';
          } else {
            this.postalMatches = matches.map((n) => ({ nom: n, code: '' }));
            this.form.get('ville')!.setValue('');
            this.idfError = '';

            return;
          }
          return;
        }

        const url = `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,code,codesPostaux&boost=population`;
        fetch(url).then(async (res) => {
          if (!res.ok) throw new Error('API error');
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            if (data.length === 1) {
              const m = data[0];
              const depCode = (m.code || '').substring(0,2);
              if (this.IDF_DEPS[depCode]) {
                this.form.get('ville')!.setValue(m.nom);
                this.postalMatches = [];
                this.idfError = '';
              } else {
                this.form.get('ville')!.setValue('');
                this.postalMatches = [];
                this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
              }
            } else {
              this.postalMatches = data.map((c: any) => ({ nom: c.nom, code: c.code, codesPostaux: c.codesPostaux }));
              this.form.get('ville')!.setValue('');
              this.idfError = '';
            }
            return;
          }
          this.postalMatches = [];
          this.form.get('ville')!.setValue('');
          this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
        }).catch(() => {

          const dep = cp.substring(0,2);
          if (this.IDF_DEPS[dep]) {
            this.form.get('ville')!.setValue(this.IDF_DEPS[dep]);
            this.idfError = '';
          } else {
            this.form.get('ville')!.setValue('');
            this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
          }
        });
      }, 300);
      return;
    }

    const dep = cp.substring(0,2);
    if (this.IDF_DEPS[dep]) {
      this.form.get('ville')!.setValue(this.IDF_DEPS[dep]);
      this.idfError = '';
      return;
    }

    this.form.get('ville')!.setValue('');
    this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
  }

  selectCommune(match: { nom: string; code: string }): void {
    let depCode = '';
    if (match.code) {
      depCode = match.code.substring(0, 2);
    } else {
      const cp = (this.form.get('codePostal')!.value || '').toString().trim();
      if (cp.length >= 2) depCode = cp.substring(0, 2);
    }

    if (depCode && this.IDF_DEPS[depCode]) {
      this.form.get('ville')!.setValue(match.nom);
      this.idfError = '';
    } else {
      if (!depCode) {
        this.form.get('ville')!.setValue(match.nom);
        this.idfError = '';
      } else {
        this.form.get('ville')!.setValue('');
        this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
      }
    }

    this.postalMatches = [];
  }

  onFileChange(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      const sizeKb = (file.size / 1024).toFixed(0);
      const sizeLabel = file.size > 1024 * 1024
        ? (file.size / 1024 / 1024).toFixed(1) + ' Mo'
        : sizeKb + ' Ko';
      reader.onload = e => {
        this.photoPreviews.push({
          url: e.target?.result as string,
          name: file.name,
          size: sizeLabel,
          file
        });
        this.persistDraft();
      };
      reader.readAsDataURL(file);
    });
    (event.target as HTMLInputElement).value = '';
  }

  removePhoto(index: number): void {
    this.photoPreviews.splice(index, 1);
    this.persistDraft();
  }

  private getStoredDraft(): any | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(this.draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
