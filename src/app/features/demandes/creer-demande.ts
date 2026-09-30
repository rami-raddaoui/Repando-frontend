import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { TypeAppareil, TypePanne, TypeIntervention, APPAREIL_LABELS, UserRole } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';
import { DemandeDraftService } from './demande-draft.service';
import { Subject, debounceTime } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-creer-demande',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CommonModule
  ],
  templateUrl: './creer-demande.html',
  styleUrl: './creer-demande.scss'
})
export class CreerDemandeComponent implements OnInit, OnDestroy {
  form: FormGroup;
  step: 1 | 2 = 1;  // ÉTAPE 1: Appareil & Panne | ÉTAPE 2: Localisation & Auth
  loading = false;
  error = '';
  photoPreviews: { url: string; name: string; size: string; file: File }[] = [];
  idfError: string = '';

  // Auto-save state
  autoSaveInProgress = false;
  private autoSaveSubject = new Subject<void>();
  private destroy$ = new Subject<void>();

  // Brouillon state
  draftId: string | null = null;
  hasPendingDraft = false;

  // User check state (Étape 2)
  checkingUser = false;   // true pendant l'appel réseau
  checkedUser = false;    // true une fois la vérification terminée
  userExists = false;
  userEmail: string | null = null;
  userDisplayName: string | null = null;
  authError = '';
  authInfo = '';          // message de succès (ex: email de reset envoyé)

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
    public auth: AuthService,
    private router: Router,
    private draftService: DemandeDraftService
  ) {
    this.form = this.fb.group({
      typeAppareil:    ['', Validators.required],  // Mandatory
      marque:          ['', Validators.required],  // Mandatory
      modele:          [''],  // Optional
      typePanne:       ['', Validators.required],  // Mandatory
      description:     [''],  // Optional
      email:           ['', [Validators.required, Validators.email]],  // Mandatory
      telephone:       ['', [Validators.required, Validators.pattern(/^[\d\s\-\+\(\)]+$/)]],  // Mandatory
      photoUrls:       [[]],
      adresse:         [''],  // Optional en étape 1
      ville:           ['Paris'],
      codePostal:      [''],
      typeIntervention:[TypeIntervention.INDIFFERENT],
      // Étape 2 — utilisés selon le cas (connexion existante OU création de compte)
      loginPassword:   [''],                                          // Connexion (utilisateur existant)
      prenom:          [''],                                          // Création de compte (nouvel utilisateur)
      nom:             [''],                                          // Création de compte (nouvel utilisateur)
      password:        ['', [Validators.minLength(8)]],               // Création de compte (nouvel utilisateur)
    });

    // when codePostal changes, update ville dynamically
    this.form.get('codePostal')!.valueChanges.subscribe((cp: string) => this.onCodePostalChange(cp));
  }

  ngOnInit(): void {
    // Initialiser le brouillon
    this.draftService.initDraft().pipe(
      takeUntil(this.destroy$)
    ).subscribe(res => {
      // res EST directement GetOrCreateDraftResponse (pas wrappé)
      if (res) {
        this.draftId = res.draftId;
        this.draftService.setDraftId(this.draftId!);

        if (res.draftExists && res.existingData) {
          // Charger les données en brouillon
          this.loadDraftData(res.existingData);
        }
      }
    });

    // Vérifier s'il existe un brouillon depuis localStorage
    const localDraft = this.draftService.getDraftLocal();
    if (localDraft) {
      this.hasPendingDraft = true;
    }

    // Setup auto-save (debounced)
    this.autoSaveSubject.pipe(
      debounceTime(1500),  // Sauvegarder 1.5s après la dernière modification
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.saveToServer();
    });

    // Listen to form changes (but only after first initialization)
    this.form.valueChanges.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Sauvegarder localement aussi
      const data = { ...this.form.value };
      this.draftService.saveDraftLocal(data);
      // Déclencher auto-save serveur
      this.autoSaveSubject.next();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDraftData(data: any): void {
    this.form.patchValue(data, { emitEvent: false });
    // Ne pas émettre d'événements au démarrage
  }

  private saveToServer(): void {
    if (!this.draftId) return;

    this.autoSaveInProgress = true;
    const data = { ...this.form.value };

    this.draftService.autosaveDraft(data).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.autoSaveInProgress = false;
      },
      error: () => {
        this.autoSaveInProgress = false;
        // Silencieusement échouer et réessayer plus tard (le formulaire est déjà sauvegardé localement)
      }
    });
  }

  // local map loaded from public/data/idf-postal-to-communes.json (lazy)
  private localPostalMap: Record<string, string[]> | null = null;
  private localPostalMapLoaded = false;

  private async ensureLocalMapLoaded(): Promise<void> {
    if (this.localPostalMapLoaded) return;
    try {
      const res = await fetch('/data/idf-postal-to-communes.json');
      if (!res.ok) throw new Error('local JSON not found');
      this.localPostalMap = await res.json();
    } catch (e) {
      this.localPostalMap = null;
    } finally {
      this.localPostalMapLoaded = true;
    }
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

  // when multiple communes are returned for a postal code, we show them for selection
  postalMatches: { nom: string; code: string; codesPostaux?: string[] }[] = [];
  private codePostalDebounce?: number;

  private onCodePostalChange(cpRaw?: string): void {
    const cp = (cpRaw || '').toString().trim();
    if (!cp) {
      this.form.get('ville')!.setValue('');
      return;
    }

    // If we have a full 5-digit postal code try the gov API for precise commune
    if (/^\d{5}$/.test(cp)) {
      // debounce requests while user types
      if (this.codePostalDebounce) window.clearTimeout(this.codePostalDebounce);
      this.codePostalDebounce = window.setTimeout(async () => {
        // try to use local mapping first (lazy-loaded)
        await this.ensureLocalMapLoaded();
        if (this.localPostalMap && this.localPostalMap[cp]) {
          const matches = this.localPostalMap[cp];
          if (matches.length === 1) {
            // single match: auto-fill and do not show list
            this.form.get('ville')!.setValue(matches[0]);
            this.postalMatches = [];
            this.idfError = '';
          } else {
            // multiple matches: show list for selection
            this.postalMatches = matches.map((n) => ({ nom: n, code: '' }));
            this.form.get('ville')!.setValue('');
            this.idfError = '';
          }
          return;
        }

        // else fallback to remote API
        const url = `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,code,codesPostaux&boost=population`;
        fetch(url).then(async (res) => {
          if (!res.ok) throw new Error('API error');
          const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
            // if single result, auto-fill; if multiple, show list
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
              // multiple matches: show choices
              this.postalMatches = data.map((c: any) => ({ nom: c.nom, code: c.code, codesPostaux: c.codesPostaux }));
              this.form.get('ville')!.setValue('');
              this.idfError = '';
            }
            return;
          }
          // no match
          this.postalMatches = [];
          this.form.get('ville')!.setValue('');
          this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
        }).catch(() => {
          // on API error fallback to department prefix
          this.postalMatches = [];
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

    // If less than 5 digits use department prefix fallback
    const dep = cp.substring(0,2);
    if (this.IDF_DEPS[dep]) {
      this.form.get('ville')!.setValue(this.IDF_DEPS[dep]);
      this.idfError = '';
      return;
    }

    // Not IDF
    this.form.get('ville')!.setValue('');
    this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
  }

  selectCommune(match: { nom: string; code: string }): void {
    // Determine department: prefer match.code (INSEE) if provided, otherwise derive from current postal code input
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
      // In case dep code can't be determined, assume match is valid (local JSON may not include INSEE code)
      if (!depCode) {
        this.form.get('ville')!.setValue(match.nom);
        this.idfError = '';
      } else {
        this.form.get('ville')!.setValue('');
        this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
      }
    }

    // clear matches after selection
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
      };
      reader.readAsDataURL(file);
    });
    // reset input so same file can be re-added
    (event.target as HTMLInputElement).value = '';
  }

  removePhoto(index: number): void {
    this.photoPreviews.splice(index, 1);
  }

  submit(): void {
    // ÉTAPE 1 : Continuer à l'étape 2 (pas d'authentification requise)
    if (this.step === 1) {
      if (!this.form.get('typeAppareil')!.value || !this.form.get('typePanne')!.value) {
        this.error = 'Veuillez au moins sélectionner un appareil et une panne.';
        return;
      }
      this.step = 2;
      this.error = '';
      // ✅ Auto-vérification : est-ce un client existant ? (sans lui demander de cliquer)
      this.autoCheckUser();
      return;
    }

    // ÉTAPE 2 : la finalisation se fait via loginInline() ou createAccountAndContinue()
    // (le bouton principal est masqué tant que l'utilisateur n'est pas identifié/connecté)
    if (this.step === 2 && this.auth.isLoggedIn()) {
      this.finalizeAndRedirect();
    }
  }

  goBackToStep1(): void {
    this.step = 1;
    this.error = '';
  }

  restorePendingDraft(): void {
    const localDraft = this.draftService.getDraftLocal();
    if (localDraft) {
      this.loadDraftData(localDraft);
      this.hasPendingDraft = false;
    }
  }

  clearPendingDraft(): void {
    this.draftService.clearDraftLocal();
    this.hasPendingDraft = false;
  }

  /**
   * ✅ Vérification AUTOMATIQUE (côté plateforme) — l'utilisateur n'a rien à faire.
   * Dès l'arrivée à l'étape 2, on cherche en BD si un compte existe déjà avec cet email/tél.
   */
  autoCheckUser(): void {
    // Déjà connecté ? Pas besoin de vérifier.
    if (this.auth.isLoggedIn()) {
      this.checkedUser = true;
      this.userExists = true;
      return;
    }

    const email = this.form.get('email')?.value;
    const telephone = this.form.get('telephone')?.value;
    if (!email || !telephone) return;

    this.checkingUser = true;
    this.authError = '';

    this.auth.checkUser(email, telephone).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        this.userExists = res.userExists;
        this.userEmail = res.email;
        this.userDisplayName = res.userName;
        this.checkedUser = true;
        this.checkingUser = false;
      },
      error: () => {
        // En cas d'erreur réseau, on suppose "nouvel utilisateur" pour ne pas bloquer le parcours
        this.userExists = false;
        this.checkedUser = true;
        this.checkingUser = false;
      }
    });
  }

  /**
   * Compte trouvé → l'utilisateur n'est pas la bonne personne (email partagé, etc.)
   */
  resetUserCheck(): void {
    this.checkedUser = false;
    this.userExists = false;
    this.userEmail = null;
    this.userDisplayName = null;
    this.authError = '';
    this.authInfo = '';
    this.form.get('loginPassword')?.reset();
    this.form.get('password')?.reset();
  }

  /**
   * Utilisateur existant → connexion inline (pas de redirection)
   */
  loginInline(): void {
    const email = this.form.get('email')?.value;
    const password = this.form.get('loginPassword')?.value;

    if (!password) {
      this.authError = 'Veuillez saisir votre mot de passe.';
      return;
    }

    this.loading = true;
    this.authError = '';

    this.auth.login({ email, password }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.loading = false;
        this.finalizeAndRedirect();
      },
      error: (err) => {
        this.loading = false;
        const msg: string = err?.message ?? '';
        this.authError = msg.includes('COMPTE_VERROUILLE')
          ? 'Compte temporairement verrouillé suite à plusieurs tentatives. Réessayez plus tard.'
          : (msg || 'Email ou mot de passe incorrect.');
      }
    });
  }

  /**
   * Demande de réinitialisation du mot de passe (inline, sans quitter la page)
   */
  forgotPasswordInline(): void {
    const email = this.form.get('email')?.value;
    if (!email) {
      this.authError = 'Email requis pour réinitialiser le mot de passe.';
      return;
    }

    this.authError = '';
    this.auth.forgotPassword(email).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.authInfo = '📬 Si un compte existe pour cet email, un lien de réinitialisation vient d\'être envoyé. Vérifiez vos spams.';
      },
      error: () => {
        // Message identique pour ne pas révéler l'existence de l'email
        this.authInfo = '📬 Si un compte existe pour cet email, un lien de réinitialisation vient d\'être envoyé. Vérifiez vos spams.';
      }
    });
  }

  /**
   * Nouvel utilisateur → création de compte inline puis finalisation automatique
   */
  createAccountAndContinue(): void {
    const email = this.form.get('email')?.value;
    const telephone = this.form.get('telephone')?.value;
    const prenom = this.form.get('prenom')?.value;
    const nom = this.form.get('nom')?.value;
    const password = this.form.get('password')?.value;

    if (!prenom || !nom) {
      this.authError = 'Prénom et nom sont obligatoires.';
      return;
    }
    if (!password || password.length < 8) {
      this.authError = 'Le mot de passe doit contenir au moins 8 caractères.';
      return;
    }

    this.loading = true;
    this.authError = '';

    this.auth.register({
      email, password, telephone, prenom, nom, role: UserRole.CLIENT
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.loading = false;
        this.finalizeAndRedirect();
      },
      error: (err) => {
        this.loading = false;
        this.authError = err?.message ?? 'Erreur lors de la création du compte.';
      }
    });
  }

  /**
   * Finaliser le brouillon (upload photos puis conversion) et rediriger
   */
  finalizeAndRedirect(): void {
    if (!this.draftId) {
      this.authError = 'Erreur : brouillon manquant. Merci de recharger la page.';
      return;
    }

    this.loading = true;
    this.authError = '';

    const dataUrls = this.photoPreviews.map(p => p.url);

    const doConvert = (photoUrls: string[]) => {
      this.form.patchValue({ photoUrls }, { emitEvent: false });

      this.draftService.convertToRequest(this.draftId!).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.loading = false;
          this.draftService.clearDraftLocal();
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading = false;
          this.authError = err?.message ?? 'Une erreur est survenue. Veuillez réessayer.';
        }
      });
    };

    if (dataUrls.length > 0) {
      this.demandeService.uploadPhotos(dataUrls).subscribe({
        next: (urls) => doConvert(urls),
        error: () => doConvert([])
      });
    } else {
      doConvert([]);
    }
  }
}
