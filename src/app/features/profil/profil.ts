import {
  Component, OnInit, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { resolveStaticUrl } from '../../core/services/auth';
import {
  UserDto, UserRole, TypeAppareil, APPAREIL_LABELS,
  UpdateProfileRequest, UpdateReparateurProfileRequest, ApiResponse
} from '../../core/models/models';
import { environment } from '../../../environments/environment';
import { ReparateurService } from '../../core/services/reparateur';

interface RepProfile {
  id: string;
  siret?: string;
  numeroQualirepar?: string;
  canEditSiret?: boolean;
  canEditNumeroQualirepar?: boolean;
  bio?: string;
  anneesExperience: number;
  adresseAtelier?: string;
  ville: string;
  codePostal?: string;
  latitude?: number;
  longitude?: number;
  rayonInterventionKm: number;
  specialites: string[];
  noteMoyenne: number;
  nbAvis: number;
  nbReparations: number;
  isVerified: boolean;
  isFounder: boolean;
  founderNumber?: number;
  rcProStatut?: string;
  rcProUrl?: string;
  rcProUploadedAt?: string;
}

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profil.html',
  styleUrl: './profil.scss'
})
export class ProfilComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('rcProInput') rcProInput!: ElementRef<HTMLInputElement>;

  user: UserDto | null = null;
  repProfile: RepProfile | null = null;
  loading = true;

  // ── Form fields ──────────────────────────────────────────
  form = {
    prenom: '',
    nom: '',
    telephone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  repForm = {
    siret: '',
    numeroQualirepar: '',
    bio: '',
    anneesExperience: 0,
    adresseAtelier: '',
    ville: '',
    codePostal: '',
    rayonInterventionKm: 10,
    specialites: [] as TypeAppareil[]
  };

  private initialInfoForm = {
    prenom: '',
    nom: '',
    telephone: ''
  };

  private initialRepForm = {
    siret: '',
    numeroQualirepar: '',
    bio: '',
    anneesExperience: 0,
    adresseAtelier: '',
    ville: '',
    codePostal: '',
    rayonInterventionKm: 10,
    specialites: [] as TypeAppareil[]
  };

  // ── State ────────────────────────────────────────────────
  saveLoading = false;
  saveSuccess = '';
  saveError = '';
  avatarLoading = false;
  rcProLoading = false;
  showPasswordChange = false;
  activeTab: 'infos' | 'metier' | 'securite' = 'infos';
  highlightedMetierField: 'siret' | 'ville' | 'code_postal' | 'specialites' | null = null;
  private requestedFocusField: 'siret' | 'ville' | 'code_postal' | 'specialites' | null = null;
  private rcProCacheBuster = 0;
  idfError = '';
  postalMatches: { nom: string; code?: string }[] = [];
  private localPostalMap: Record<string, string[]> | null = null;
  private localPostalMapLoaded = false;
  private codePostalDebounce?: number;

  // ── Field-level validation errors ─────────────────────
  fieldErrors: Record<string, string> = {};
  touchedFields: Set<string> = new Set();
  showAllValidationErrors = false;
  private readonly idfDepartments = ['75', '77', '78', '91', '92', '93', '94', '95'];

  readonly TypeAppareil = TypeAppareil;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly allAppareilTypes = Object.keys(TypeAppareil) as TypeAppareil[];
  readonly UserRole = UserRole;
  readonly Object = Object;
  private readonly namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
  private readonly frPhonePattern = /^[1-9]\d{8}$/;

  constructor(
    public auth: AuthService,
    private http: HttpClient,
    private reparateurService: ReparateurService,
    private route: ActivatedRoute
  ) {}

  private loadRepProfile(forceRefresh = false): void {
    const suffix = forceRefresh ? `?t=${Date.now()}` : '';
    this.http.get<any>(`${environment.apiUrl}/reparateurs/me${suffix}`).subscribe({
      next: r => {
        this.repProfile = r;
        if (r?.rcProUploadedAt) this.rcProCacheBuster = Date.now();
        if (r) {
          this.repForm.siret = r.siret ?? '';
          this.repForm.numeroQualirepar = r.numeroQualirepar ?? '';
          this.repForm.bio = r.bio ?? '';
          this.repForm.anneesExperience = r.anneesExperience ?? 0;
          this.repForm.adresseAtelier = r.adresseAtelier ?? '';
          this.repForm.ville = r.ville ?? '';
          this.repForm.codePostal = r.codePostal ?? '';
          this.repForm.rayonInterventionKm = r.rayonInterventionKm ?? 10;
          this.repForm.specialites = (r.specialites ?? []) as TypeAppareil[];
          this.snapshotRepForm();
          this.applyRequestedMetierFocus();
        }
      },
      error: () => {}
    });
  }

  // ── Avatar ───────────────────────────────────────────────
  openFileDialog(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.saveError = 'Image trop volumineuse (max 2 Mo)';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.avatarLoading = true;
        this.auth.uploadAvatar(reader.result as string).subscribe({
          next: url => {
            this.avatarLoading = false;
            const resolved = resolveStaticUrl(url) ?? url;
            if (this.user) this.user = { ...this.user, avatarUrl: resolved };
          this.saveSuccess = 'Avatar mis à jour !';
          setTimeout(() => this.saveSuccess = '', 3000);
        },
        error: () => { this.avatarLoading = false; this.saveError = 'Erreur lors de l\'upload'; }
      });
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatarLoading = true;
    this.auth.removeAvatar().subscribe({
      next: () => {
        this.avatarLoading = false;
        if (this.user) this.user = { ...this.user, avatarUrl: undefined };
        this.saveSuccess = 'Avatar supprimé';
        setTimeout(() => this.saveSuccess = '', 3000);
      },
      error: () => { this.avatarLoading = false; }
    });
  }

  // ── Field validation helpers ───────────────────────────
  markFieldTouched(field: string): void {
    this.touchedFields.add(field);
  }

  clearFieldError(field: string): void {
    if (this.fieldErrors[field]) {
      delete this.fieldErrors[field];
    }
  }

  getFieldError(field: string): string {
    return this.fieldErrors[field] ?? '';
  }

  hasFieldError(field: string): boolean {
    return (this.showAllValidationErrors || this.touchedFields.has(field)) && !!this.fieldErrors[field];
  }

  onNameInput(field: 'prenom' | 'nom'): void {
    // Keep letters, accents, spaces, apostrophes and hyphens for names.
    const current = (this.form[field] ?? '').toString();
    const sanitized = current.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, '');
    this.form[field] = sanitized;
    this.clearFieldError(field);
  }

  onTelephoneInput(): void {
    const digitsOnly = (this.form.telephone ?? '').replace(/\D/g, '').slice(0, 9);
    this.form.telephone = digitsOnly;
    this.clearFieldError('telephone');
  }

  private normalizeFrenchPhoneEditablePart(raw?: string | null): string {
    const value = (raw ?? '').toString().trim();
    if (!value) return '';
    const digits = value.replace(/\D/g, '');

    if (digits.startsWith('33') && digits.length >= 11) {
      return digits.substring(2, 11);
    }
    if (digits.startsWith('0') && digits.length >= 10) {
      return digits.substring(1, 10);
    }
    if (digits.length >= 9) {
      return digits.substring(0, 9);
    }
    return digits;
  }

  private buildFrenchPhoneForApi(): string | undefined {
    const local = (this.form.telephone ?? '').trim();
    if (!local) return undefined;
    return `+33${local}`;
  }

  private snapshotInfoForm(): void {
    this.initialInfoForm = {
      prenom: this.form.prenom.trim(),
      nom: this.form.nom.trim(),
      telephone: this.form.telephone.trim()
    };
  }

  private snapshotRepForm(): void {
    this.initialRepForm = {
      siret: this.repForm.siret.trim(),
      numeroQualirepar: this.repForm.numeroQualirepar.trim(),
      bio: this.repForm.bio.trim(),
      anneesExperience: this.repForm.anneesExperience,
      adresseAtelier: this.repForm.adresseAtelier.trim(),
      ville: this.repForm.ville.trim(),
      codePostal: this.repForm.codePostal.trim(),
      rayonInterventionKm: this.repForm.rayonInterventionKm,
      specialites: [...this.repForm.specialites].sort()
    };
  }

  hasInfoChanges(): boolean {
    return this.form.prenom.trim() !== this.initialInfoForm.prenom
      || this.form.nom.trim() !== this.initialInfoForm.nom
      || this.form.telephone.trim() !== this.initialInfoForm.telephone;
  }

  hasMetierChanges(): boolean {
    const specialitesA = [...this.repForm.specialites].sort();
    const specialitesB = [...this.initialRepForm.specialites].sort();
    const specialitesChanged = specialitesA.length !== specialitesB.length
      || specialitesA.some((value, index) => value !== specialitesB[index]);

    const siretChanged = this.canEditSiret
      ? this.repForm.siret.trim() !== this.initialRepForm.siret
      : false;
    const qualireparChanged = this.canEditNumeroQualirepar
      ? this.repForm.numeroQualirepar.trim() !== this.initialRepForm.numeroQualirepar
      : false;

    return siretChanged
      || qualireparChanged
      || this.repForm.bio.trim() !== this.initialRepForm.bio
      || this.repForm.anneesExperience !== this.initialRepForm.anneesExperience
      || this.repForm.adresseAtelier.trim() !== this.initialRepForm.adresseAtelier
      || this.repForm.ville.trim() !== this.initialRepForm.ville
      || this.repForm.codePostal.trim() !== this.initialRepForm.codePostal
      || this.repForm.rayonInterventionKm !== this.initialRepForm.rayonInterventionKm
      || specialitesChanged;
  }

  validatePrenomNom(): boolean {
    this.fieldErrors = {};
    let isValid = true;

    if (!this.form.prenom.trim()) {
      this.fieldErrors['prenom'] = '✋ Le prénom est requis';
      isValid = false;
    } else if (this.form.prenom.trim().length < 2) {
      this.fieldErrors['prenom'] = '✋ Le prénom doit contenir au moins 2 caractères';
      isValid = false;
    } else if (!this.namePattern.test(this.form.prenom.trim())) {
      this.fieldErrors['prenom'] = '✋ Le prénom doit contenir uniquement des lettres';
      isValid = false;
    }

    if (!this.form.nom.trim()) {
      this.fieldErrors['nom'] = '✋ Le nom est requis';
      isValid = false;
    } else if (this.form.nom.trim().length < 2) {
      this.fieldErrors['nom'] = '✋ Le nom doit contenir au moins 2 caractères';
      isValid = false;
    } else if (!this.namePattern.test(this.form.nom.trim())) {
      this.fieldErrors['nom'] = '✋ Le nom doit contenir uniquement des lettres';
      isValid = false;
    }

    if (this.form.telephone.trim() && !this.frPhonePattern.test(this.form.telephone.trim())) {
      this.fieldErrors['telephone'] = '📞 Entrez un numero francais valide (9 chiffres apres +33)';
      isValid = false;
    }

    return isValid;
  }

  validatePassword(): boolean {
    this.fieldErrors = {};
    let isValid = true;

    if (this.showPasswordChange && this.form.newPassword) {
      if (!this.form.currentPassword) {
        this.fieldErrors['currentPassword'] = '🔐 Veuillez saisir votre mot de passe actuel';
        isValid = false;
      }

      if (this.form.newPassword.length < 8) {
        this.fieldErrors['newPassword'] = '🔐 Le mot de passe doit contenir au moins 8 caractères';
        isValid = false;
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(this.form.newPassword)) {
        this.fieldErrors['newPassword'] = '🔐 Le mot de passe doit contenir majuscules, minuscules et chiffres';
        isValid = false;
      }

      if (this.form.newPassword !== this.form.confirmPassword) {
        this.fieldErrors['confirmPassword'] = '🔄 Les mots de passe ne correspondent pas';
        isValid = false;
      }
    }

    return isValid;
  }

  // ── Save profile ─────────────────────────────────────────
  saveProfile(): void {
    this.fieldErrors = {};
    this.saveError = '';

    if (!this.validatePrenomNom()) {
      return;
    }

    if (!this.validatePassword()) {
      return;
    }

    this.saveLoading = true;
    const payload: UpdateProfileRequest = {
      prenom: this.form.prenom.trim(),
      nom: this.form.nom.trim(),
      telephone: this.buildFrenchPhoneForApi(),
      newPassword: this.showPasswordChange && this.form.newPassword ? this.form.newPassword : undefined,
      currentPassword: this.showPasswordChange && this.form.currentPassword ? this.form.currentPassword : undefined,
    };

    this.auth.updateProfile(payload).subscribe({
      next: u => {
        this.saveLoading = false;
        this.user = u;
        this.form.telephone = this.normalizeFrenchPhoneEditablePart(u.telephone);
        this.snapshotInfoForm();
        this.saveSuccess = '✨ Profil mis à jour avec succès !';
        this.form.currentPassword = '';
        this.form.newPassword = '';
        this.form.confirmPassword = '';
        this.showPasswordChange = false;
        this.fieldErrors = {};
        this.touchedFields.clear();
        setTimeout(() => this.saveSuccess = '', 4000);
      },
      error: (e) => {
        this.saveLoading = false;
        const errorMsg = e?.error?.error ?? 'Erreur lors de la sauvegarde';
        this.saveError = '❌ ' + errorMsg;
      }
    });
  }

  // ── Comprehensive validation for reparateur profile ───
   private validateRepProfile(): { isValid: boolean; firstErrorField: 'siret' | 'ville' | 'code_postal' | 'specialites' | null } {
     this.fieldErrors = {};
     let isValid = true;
     let firstErrorField: 'siret' | 'ville' | 'code_postal' | 'specialites' | null = null;

     // Validation SIRET
     if (this.canEditSiret && !this.repForm.siret.trim()) {
       this.fieldErrors['siret'] = '📋 Le SIRET est obligatoire pour recevoir des missions';
       if (!firstErrorField) firstErrorField = 'siret';
       isValid = false;
     } else if (this.canEditSiret && this.repForm.siret.trim().length > 0) {
       if (!/^\d{14}$/.test(this.repForm.siret.trim())) {
         this.fieldErrors['siret'] = '📋 Le SIRET doit contenir exactement 14 chiffres';
         if (!firstErrorField) firstErrorField = 'siret';
         isValid = false;
       }
     }

     // Validation Code postal
     if (!this.repForm.codePostal.trim()) {
       this.fieldErrors['code_postal'] = '📮 Veuillez saisir votre code postal';
       if (!firstErrorField) firstErrorField = 'code_postal';
       isValid = false;
     } else if (!/^\d{5}$/.test(this.repForm.codePostal.trim())) {
       this.fieldErrors['code_postal'] = '⚠️ Le code postal doit contenir 5 chiffres';
       if (!firstErrorField) firstErrorField = 'code_postal';
       isValid = false;
     } else if (this.idfError) {
       this.fieldErrors['code_postal'] = this.idfError;
       if (!firstErrorField) firstErrorField = 'code_postal';
       isValid = false;
     }

     // Validation Ville uniquement si plusieurs communes possibles
     if (this.needsCommuneSelection()) {
       this.fieldErrors['ville'] = '🏙️ Choisissez votre commune';
       if (!firstErrorField) firstErrorField = 'ville';
       isValid = false;
     }

     // Validation Spécialités
     if (this.repForm.specialites.length === 0) {
       this.fieldErrors['specialites'] = '🛠️ Sélectionnez au moins une spécialité';
       if (!firstErrorField) firstErrorField = 'specialites';
       isValid = false;
     }

     this.showAllValidationErrors = !isValid;
     return { isValid, firstErrorField };
   }

  // ── Save reparateur profile ───────────────────────────
  saveRepProfile(): void {
    this.saveError = '';
    const validation = this.validateRepProfile();

    const reparateurId = this.repProfile?.id;
    if (!reparateurId) {
      this.saveError = '❌ Profil réparateur introuvable. Rechargez la page.';
      return;
    }

    if (!validation.isValid) {
      // Scroll to first error field with smooth animation
      if (validation.firstErrorField) {
        this.highlightField(validation.firstErrorField);
      }
      return;
    }

    this.saveLoading = true;
    const payload: UpdateReparateurProfileRequest = {
      siret: this.canEditSiret ? this.repForm.siret.trim() : undefined,
      numeroQualirepar: this.canEditNumeroQualirepar ? (this.repForm.numeroQualirepar.trim() || undefined) : undefined,
      bio: this.repForm.bio || undefined,
      anneesExperience: this.repForm.anneesExperience,
      adresseAtelier: this.repForm.adresseAtelier || undefined,
      ville: this.repForm.ville.trim(),
      codePostal: this.repForm.codePostal.trim(),
      rayonInterventionKm: this.repForm.rayonInterventionKm,
      specialites: this.repForm.specialites
    };

    this.reparateurService.updateProfile(payload, reparateurId).subscribe({
      next: () => {
        this.saveLoading = false;
        this.saveSuccess = 'Profil métier mis à jour avec succès !';
        this.fieldErrors = {};
        this.touchedFields.clear();
        this.showAllValidationErrors = false;
        // Reload profile to update canEditSiret/canEditNumeroQualirepar flags
        this.loadRepProfile();
        setTimeout(() => this.saveSuccess = '', 4000);
      },
      error: (e) => {
        this.saveLoading = false;
        const errorMsg = e?.error?.error ?? 'Erreur lors de la sauvegarde';
        this.saveError = '❌ ' + errorMsg;
      }
    });
  }

  private highlightField(field: 'siret' | 'ville' | 'code_postal' | 'specialites'): void {
    this.highlightedMetierField = field;
    setTimeout(() => {
      const idMap: Record<'siret' | 'ville' | 'code_postal' | 'specialites', string> = {
        siret: 'metier-siret',
        ville: 'metier-ville',
        code_postal: 'metier-code-postal',
        specialites: 'metier-specialites'
      };
      const el = document.getElementById(idMap[field]);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setTimeout(() => {
      this.highlightedMetierField = null;
    }, 2600);
  }

  toggleSpecialite(type: TypeAppareil): void {
    const idx = this.repForm.specialites.indexOf(type);
    if (idx >= 0) this.repForm.specialites.splice(idx, 1);
    else this.repForm.specialites.push(type);
  }

  hasSpecialite(type: TypeAppareil): boolean {
    return this.repForm.specialites.includes(type);
  }

  getInitials(): string {
    const u = this.user;
    if (!u) return '?';
    return `${u.prenom.charAt(0)}${u.nom.charAt(0)}`.toUpperCase();
  }

  getRoleBadge(): string {
    switch (this.user?.role) {
      case UserRole.CLIENT: return '👤 Client';
      case UserRole.REPARATEUR: return '🔧 Réparateur';
      case UserRole.ADMIN: return '🛡️ Admin';
      default: return '';
    }
  }

  // ── Résiliation ───────────────────────────────────────────
  readonly RESILIATION_RAISONS = [
    'Je n\'utilise plus le service',
    'J\'ai trouvé une autre solution',
    'Le service ne correspond pas à mes attentes',
    'Problème technique non résolu',
    'Raison personnelle / professionnelle',
    'Autre raison',
  ];

  showResiliationModal = false;
  resiliationRaison = '';
  resiliationCommentaire = '';
  resiliationLoading = false;
  resiliationSuccess = '';
  resiliationError = '';
  demandeResiliationActive: any = null;

  // Rétractation
  showRetractModal = false;
  retractCommentaire = '';
  retractLoading = false;
  retractError = '';

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    const focus = this.route.snapshot.queryParamMap.get('focus');
    this.requestedFocusField = this.normalizeFocusField(focus);

    if ((tab === 'metier' || this.requestedFocusField) && this.auth.isReparateur()) {
      this.activeTab = 'metier';
    }

    this.auth.me().subscribe({
      next: u => {
        this.user = { ...u, avatarUrl: resolveStaticUrl(u.avatarUrl) };
        this.form.prenom = u.prenom;
        this.form.nom = u.nom;
        this.form.telephone = this.normalizeFrenchPhoneEditablePart(u.telephone);
        this.snapshotInfoForm();
        this.loading = false;
        if (this.auth.isReparateur()) this.loadRepProfile();
        this.loadResiliation();
      },
      error: () => { this.loading = false; }
    });
  }

  private loadResiliation(): void {
    this.http.get<any>(`${environment.apiUrl}/resiliation/me`).subscribe({
      next: r => { this.demandeResiliationActive = r.data ?? null; },
      error: () => {}
    });
  }

  openResiliationModal(): void {
    this.resiliationRaison = '';
    this.resiliationCommentaire = '';
    this.resiliationError = '';
    this.showResiliationModal = true;
  }

  submitResiliation(): void {
    if (!this.resiliationRaison) { this.resiliationError = 'Veuillez choisir une raison'; return; }
    this.resiliationLoading = true;
    this.resiliationError = '';
    this.http.post<any>(`${environment.apiUrl}/resiliation`, {
      raison: this.resiliationRaison,
      commentaire: this.resiliationCommentaire || null
    }).subscribe({
      next: () => {
        this.resiliationLoading = false;
        this.showResiliationModal = false;
        this.resiliationSuccess = '✅ Votre demande a été enregistrée. L\'équipe Repando la traitera dans les meilleurs délais.';
        this.loadResiliation();
        setTimeout(() => this.resiliationSuccess = '', 8000);
      },
      error: (e) => {
        this.resiliationLoading = false;
        this.resiliationError = e?.error?.error ?? 'Erreur lors de l\'envoi';
      }
    });
  }

  openRetractModal(): void {
    this.retractCommentaire = '';
    this.retractError = '';
    this.showRetractModal = true;
  }

  submitRetract(): void {
    this.retractLoading = true;
    this.retractError = '';
    this.http.post<any>(`${environment.apiUrl}/resiliation/retracter`, {
      commentaire: this.retractCommentaire || null
    }).subscribe({
      next: () => {
        this.retractLoading = false;
        this.showRetractModal = false;
        this.demandeResiliationActive = null;
        this.resiliationSuccess = '↩️ Votre demande de résiliation a été annulée.';
        setTimeout(() => this.resiliationSuccess = '', 6000);
      },
      error: (e) => {
        this.retractLoading = false;
        this.retractError = e?.error?.error ?? 'Erreur';
      }
    });
  }

  openRcProDialog(): void {
    this.rcProInput?.nativeElement.click();
  }

  onRcProSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      this.saveError = 'Format non supporte (PDF, JPG ou PNG uniquement)';
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.saveError = 'Fichier trop volumineux (max 10 Mo)';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const reparateurId = this.repProfile?.id;
      if (!reparateurId) {
        this.saveError = '❌ Profil réparateur introuvable. Rechargez la page.';
        return;
      }

      this.rcProLoading = true;
      this.saveError = '';
      this.reparateurService.uploadRcPro(reader.result as string, reparateurId).subscribe({
        next: (res) => {
          this.rcProLoading = false;
          const ext = file.type === 'application/pdf'
            ? '.pdf'
            : file.type === 'image/png'
              ? '.png'
              : '.jpg';
          const nowIso = new Date().toISOString();
          this.rcProCacheBuster = Date.now();
          if (this.repProfile) {
            this.repProfile = {
              ...this.repProfile,
              rcProStatut: 'EN_VERIFICATION',
              rcProUploadedAt: nowIso,
              rcProUrl: this.repProfile.rcProUrl ?? `/rc-pro/${reparateurId}${ext}`
            };
          }
          this.saveSuccess = res?.message ?? 'Attestation RC Pro envoyee. En cours de validation.';
          setTimeout(() => this.saveSuccess = '', 4000);
          this.loadRepProfile(true);
        },
        error: (e) => {
          this.rcProLoading = false;
          this.saveError = e?.error?.error ?? 'Erreur lors de l\'upload RC Pro';
        }
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  getRcProStatutLabel(statut?: string): string {
    switch (statut) {
      case 'VALIDE':
        return 'Validee';
      case 'REFUSE':
        return 'Refusee';
      case 'EN_VERIFICATION':
        return 'En cours de validation';
      default:
        return 'Non fournie';
    }
  }

  getResolvedRcProUrl(): string | null {
    const base = resolveStaticUrl(this.repProfile?.rcProUrl) ?? this.repProfile?.rcProUrl ?? null;
    if (!base) return null;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}v=${this.rcProCacheBuster || Date.now()}`;
  }

  get canEditSiret(): boolean {
    if (!this.repProfile) return false;
    if (typeof this.repProfile.canEditSiret === 'boolean') return this.repProfile.canEditSiret;
    return !this.repProfile.siret;
  }

  get canEditNumeroQualirepar(): boolean {
    if (!this.repProfile) return false;
    if (typeof this.repProfile.canEditNumeroQualirepar === 'boolean') return this.repProfile.canEditNumeroQualirepar;
    return !this.repProfile.numeroQualirepar;
  }

  switchTab(tab: 'infos' | 'metier' | 'securite'): void {
    this.activeTab = tab;
    this.saveError = '';
    this.saveSuccess = '';
    if (tab === 'metier') {
      this.applyRequestedMetierFocus();
    }
  }

  isMetierFieldMissing(field: 'siret' | 'ville' | 'code_postal' | 'specialites'): boolean {
    if (field === 'siret') return this.canEditSiret && !this.repForm.siret.trim();
    if (field === 'ville') return !this.repForm.ville.trim();
    if (field === 'code_postal') return !this.repForm.codePostal.trim();
    return this.repForm.specialites.length === 0;
  }

  private async ensureLocalMapLoaded(): Promise<void> {
    if (this.localPostalMapLoaded) return;
    try {
      const res = await fetch('/data/idf-postal-to-communes.json');
      if (res.ok) this.localPostalMap = await res.json();
      else this.localPostalMap = null;
    } catch {
      this.localPostalMap = null;
    } finally {
      this.localPostalMapLoaded = true;
    }
  }

  private isPostalCodeInIdf(cp: string): boolean {
    return this.idfDepartments.includes(cp.substring(0, 2));
  }

  private async onCodePostalChange(cpRaw?: string): Promise<void> {
    const cp = (cpRaw || '').toString().trim();
    this.idfError = '';
    this.postalMatches = [];

    if (!cp) {
      this.repForm.ville = '';
      return;
    }

    if (!/^\d{5}$/.test(cp)) {
      this.repForm.ville = '';
      return;
    }

    if (!this.isPostalCodeInIdf(cp)) {
      this.repForm.ville = '';
      this.idfError = 'Repando est disponible en Ile-de-France uniquement pour le moment.';
      return;
    }

    await this.ensureLocalMapLoaded();
    const localMatches = this.localPostalMap?.[cp];
    if (localMatches?.length) {
      if (localMatches.length === 1) {
        this.repForm.ville = localMatches[0];
      } else {
        this.postalMatches = localMatches.map((nom) => ({ nom }));
        this.repForm.ville = '';
      }
      return;
    }

    try {
      const url = `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,code,codesPostaux&boost=population`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        this.repForm.ville = '';
        this.idfError = 'Repando est disponible en Ile-de-France uniquement pour le moment.';
        return;
      }

      if (data.length === 1) {
        this.repForm.ville = data[0]?.nom ?? '';
        return;
      }

      this.postalMatches = data
        .map((c: any) => ({ nom: (c?.nom ?? '').toString(), code: (c?.code ?? '').toString() }))
        .filter((c: { nom: string }) => !!c.nom);
      this.repForm.ville = '';
    } catch {
      this.repForm.ville = '';
    }
  }

  onCodePostalInput(): void {
    this.validateCodePostalFormat();
    if (this.codePostalDebounce) window.clearTimeout(this.codePostalDebounce);
    this.codePostalDebounce = window.setTimeout(() => {
      this.onCodePostalChange(this.repForm.codePostal);
    }, 300);
  }

  cityError(): string {
    if (this.needsCommuneSelection()) return 'Choisissez votre commune.';
    return '';
  }

  needsCommuneSelection(): boolean {
    return this.postalMatches.length > 1 && !this.repForm.ville.trim();
  }

  selectCommuneByEvent(event: Event): void {
    const value = ((event.target as HTMLSelectElement)?.value || '').trim();
    if (!value) return;
    this.repForm.ville = value;
    this.postalMatches = [];
    this.clearFieldError('ville');
  }

  private normalizeFocusField(value: string | null): 'siret' | 'ville' | 'code_postal' | 'specialites' | null {
    if (value === 'siret' || value === 'ville' || value === 'code_postal' || value === 'specialites') return value;
    return null;
  }

  private applyRequestedMetierFocus(): void {
    if (this.activeTab !== 'metier') return;
    const field = this.requestedFocusField;
    if (!field) return;

    this.highlightedMetierField = field;
    const idMap: Record<'siret' | 'ville' | 'code_postal' | 'specialites', string> = {
      siret: 'metier-siret',
      ville: 'metier-ville',
      code_postal: 'metier-code-postal',
      specialites: 'metier-specialites'
    };

    setTimeout(() => {
      const el = document.getElementById(idMap[field]);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);

    setTimeout(() => {
      if (this.highlightedMetierField === field) this.highlightedMetierField = null;
    }, 2600);

    this.requestedFocusField = null;
  }

  // ── Validate SIRET format on input ──────────────────
  validateSiretFormat(): void {
    const trimmed = this.repForm.siret.trim();
    if (trimmed.length === 0) {
      this.fieldErrors['siret'] = '📋 Le SIRET est obligatoire pour recevoir des missions';
    } else if (!/^\d{14}$/.test(trimmed)) {
      this.fieldErrors['siret'] = '📋 Le SIRET doit contenir exactement 14 chiffres';
    } else {
      this.clearFieldError('siret');
    }
  }

  // ── Validate code postal format on input ─────────────
  validateCodePostalFormat(): void {
    const trimmed = this.repForm.codePostal.trim();
    if (trimmed.length === 0) {
      this.fieldErrors['code_postal'] = '📮 Veuillez saisir votre code postal';
    } else if (!/^\d{5}$/.test(trimmed)) {
      this.fieldErrors['code_postal'] = '⚠️ Le code postal doit contenir 5 chiffres';
    } else if (!this.isPostalCodeInIdf(trimmed)) {
      this.fieldErrors['code_postal'] = 'Repando est disponible en Ile-de-France uniquement pour le moment.';
    } else {
      this.clearFieldError('code_postal');
    }
  }

  // ── Validate ville on input ────────────────────────
  validateVilleFormat(): void {
    if (this.needsCommuneSelection()) {
      this.fieldErrors['ville'] = '🏙️ Choisissez votre commune';
    } else {
      this.clearFieldError('ville');
    }
  }
}
