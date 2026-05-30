import {
  Component, OnInit, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { resolveStaticUrl } from '../../core/services/auth';
import {
  UserDto, UserRole, TypeAppareil, APPAREIL_LABELS,
  UpdateProfileRequest, UpdateReparateurProfileRequest, ApiResponse
} from '../../core/models/models';
import { environment } from '../../../environments/environment';

interface RepProfile {
  id: string;
  siret: string;
  numeroQualirepar?: string;
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
}

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profil.html',
  styleUrl: './profil.scss'
})
export class ProfilComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  user: UserDto | null = null;
  repProfile: RepProfile | null = null;
  loading = true;

  // ── Form fields ──────────────────────────────────────────
  form = {
    prenom: '',
    nom: '',
    telephone: '',
    newPassword: '',
    confirmPassword: ''
  };

  repForm = {
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
  showPasswordChange = false;
  activeTab: 'infos' | 'metier' | 'securite' = 'infos';

  readonly TypeAppareil = TypeAppareil;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly allAppareilTypes = Object.keys(TypeAppareil) as TypeAppareil[];
  readonly UserRole = UserRole;

  constructor(public auth: AuthService, private http: HttpClient) {}

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: u => {
        this.user = { ...u, avatarUrl: resolveStaticUrl(u.avatarUrl) };
        this.form.prenom = u.prenom;
        this.form.nom = u.nom;
        this.form.telephone = u.telephone ?? '';
        this.loading = false;

        if (this.auth.isReparateur()) this.loadRepProfile();
      },
      error: () => { this.loading = false; }
    });
  }

  private loadRepProfile(): void {
    this.http.get<any>(`${environment.apiUrl}/reparateurs/me`).subscribe({
      next: r => {
        this.repProfile = r;
        if (r) {
          this.repForm.bio = r.bio ?? '';
          this.repForm.anneesExperience = r.anneesExperience ?? 0;
          this.repForm.adresseAtelier = r.adresseAtelier ?? '';
          this.repForm.ville = r.ville ?? '';
          this.repForm.codePostal = r.codePostal ?? '';
          this.repForm.rayonInterventionKm = r.rayonInterventionKm ?? 10;
          this.repForm.specialites = (r.specialites ?? []) as TypeAppareil[];
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

  // ── Save profile ─────────────────────────────────────────
  saveProfile(): void {
    if (!this.form.prenom.trim() || !this.form.nom.trim()) {
      this.saveError = 'Prénom et nom sont requis';
      return;
    }
    if (this.showPasswordChange) {
      if (this.form.newPassword && this.form.newPassword !== this.form.confirmPassword) {
        this.saveError = 'Les mots de passe ne correspondent pas';
        return;
      }
      if (this.form.newPassword && this.form.newPassword.length < 6) {
        this.saveError = 'Mot de passe trop court (min 6 caractères)';
        return;
      }
    }

    this.saveLoading = true;
    this.saveError = '';
    const payload: UpdateProfileRequest = {
      prenom: this.form.prenom.trim(),
      nom: this.form.nom.trim(),
      telephone: this.form.telephone.trim() || undefined,
      newPassword: this.showPasswordChange && this.form.newPassword ? this.form.newPassword : undefined
    };

    this.auth.updateProfile(payload).subscribe({
      next: u => {
        this.saveLoading = false;
        this.user = u;
        this.saveSuccess = '✅ Profil mis à jour !';
        this.form.newPassword = '';
        this.form.confirmPassword = '';
        this.showPasswordChange = false;
        setTimeout(() => this.saveSuccess = '', 4000);
      },
      error: (e) => {
        this.saveLoading = false;
        this.saveError = e?.error?.error ?? 'Erreur lors de la sauvegarde';
      }
    });
  }

  // ── Save reparateur profile ───────────────────────────────
  saveRepProfile(): void {
    if (!this.repForm.ville.trim()) { this.saveError = 'Ville requise'; return; }
    if (this.repForm.specialites.length === 0) {
      this.saveError = 'Sélectionnez au moins une spécialité';
      return;
    }

    this.saveLoading = true;
    this.saveError = '';
    const payload: UpdateReparateurProfileRequest = {
      bio: this.repForm.bio || undefined,
      anneesExperience: this.repForm.anneesExperience,
      adresseAtelier: this.repForm.adresseAtelier || undefined,
      ville: this.repForm.ville.trim(),
      codePostal: this.repForm.codePostal || undefined,
      rayonInterventionKm: this.repForm.rayonInterventionKm,
      specialites: this.repForm.specialites
    };

    this.http.patch<ApiResponse<void>>(`${environment.apiUrl}/reparateurs/profile`, payload).subscribe({
      next: () => {
        this.saveLoading = false;
        this.saveSuccess = '✅ Profil métier mis à jour !';
        setTimeout(() => this.saveSuccess = '', 4000);
      },
      error: (e) => {
        this.saveLoading = false;
        this.saveError = e?.error?.error ?? 'Erreur';
      }
    });
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
}



