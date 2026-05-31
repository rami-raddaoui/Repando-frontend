import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DemandeService } from '../../core/services/demande';
import { AuthService } from '../../core/services/auth';
import { AdminDemandeDto, AdminReparateurDispoDto, StatutDemande, APPAREIL_LABELS, MessageDto } from '../../core/models/models';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../core/models/models';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class AdminComponent implements OnInit {
  tab: 'demandes' | 'reparateurs' | 'stats' | 'reclamations' | 'utilisateurs' | 'parametres' = 'demandes';

  // ── Stats ────────────────────────────────────────────────────
  stats: any = null;

  // ── Demandes ─────────────────────────────────────────────────
  demandes: AdminDemandeDto[] = [];
  demandeFilter: string = 'OUVERTE';
  demandesPage = 1;
  demandesSearch = '';
  loading = false;

  get filteredDemandes() {
    const q = this.demandesSearch.toLowerCase();
    return q ? this.demandes.filter(d =>
      d.clientNom.toLowerCase().includes(q) ||
      d.ville.toLowerCase().includes(q) ||
      d.typeAppareil.toLowerCase().includes(q)
    ) : this.demandes;
  }
  get demandePages() { return Math.ceil(this.filteredDemandes.length / PAGE_SIZE); }
  get pagedDemandes() {
    const s = (this.demandesPage - 1) * PAGE_SIZE;
    return this.filteredDemandes.slice(s, s + PAGE_SIZE);
  }

  // ── Réparateurs ──────────────────────────────────────────────
  allReparateurs: any[] = [];
  pendingReparateurs: any[] = [];
  reparateursDispo: AdminReparateurDispoDto[] = [];
  repFilter: 'all' | 'pending' | 'verified' | 'suspended' | 'incomplet' = 'all';
  repsPage = 1;
  repsSearch = '';
  repsLoading = false;

  get filteredReps() {
    let list = this.allReparateurs;
    if (this.repFilter === 'pending')   list = list.filter(r => r.profilComplet && !r.isVerified && r.isActive);
    if (this.repFilter === 'verified')  list = list.filter(r => r.profilComplet && r.isVerified && r.isActive);
    if (this.repFilter === 'suspended') list = list.filter(r => r.profilComplet && !r.isActive);
    if (this.repFilter === 'incomplet') list = list.filter(r => !r.profilComplet);
    const q = this.repsSearch.toLowerCase();
    if (q) list = list.filter(r =>
      r.nom.toLowerCase().includes(q) || r.ville?.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    );
    return list;
  }
  get repPages() { return Math.ceil(this.filteredReps.length / PAGE_SIZE); }
  get pagedReps() {
    const s = (this.repsPage - 1) * PAGE_SIZE;
    return this.filteredReps.slice(s, s + PAGE_SIZE);
  }

  // ── Détail réparateur ────────────────────────────────────────
  repDetailModal: any = null;
  repDetailLoading = false;

  // ── Détail demande (enrichi avec tracking) ───────────────────
  demandeDetail: any = null;
  demandeDetailLoading = false;

  // ── Chat readonly modal ──────────────────────────────────────
  chatModal: { matching: any; messages: MessageDto[] } | null = null;
  chatLoading = false;

  // ── Affectation ──────────────────────────────────────────────
  affectModal: AdminDemandeDto | null = null;
  affectExistingMatchings: any[] = [];   // matchings déjà existants pour cette demande
  affectDetailLoading = false;
  selectedReps: Set<string> = new Set();
  messageAdmin = '';
  affectLoading = false;
  affectSuccess = '';
  affectError = '';

  // ── Réclamations ─────────────────────────────────────────────
  reclamations: any[] = [];
  reclamationsLoading = false;
  reclamationFilter = '';
  repondreTarget: any = null;
  repondreText = '';
  repondreLoading = false;

  // ── Utilisateurs ─────────────────────────────────────────────
  utilisateurs: any[] = [];
  utilisateursLoading = false;
  utilisateurFilter: 'all' | 'actif' | 'desactive' = 'all';
  utilisateurRoleFilter = '';
  utilisateurSearch = '';
  utilisateursPage = 1;
  desactiverModal: any = null;
  desactiverRaison = '';
  desactiverLoading = false;
  desactiverError = '';

  get filteredUtilisateurs() {
    let list = this.utilisateurs;
    if (this.utilisateurFilter === 'actif') list = list.filter(u => u.isActive);
    if (this.utilisateurFilter === 'desactive') list = list.filter(u => !u.isActive);
    if (this.utilisateurRoleFilter) list = list.filter(u => u.role === this.utilisateurRoleFilter);
    const q = this.utilisateurSearch.toLowerCase();
    if (q) list = list.filter(u => u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return list;
  }
  get utilisateursPages() { return Math.ceil(this.filteredUtilisateurs.length / PAGE_SIZE); }
  get pagedUtilisateurs() {
    const s = (this.utilisateursPage - 1) * PAGE_SIZE;
    return this.filteredUtilisateurs.slice(s, s + PAGE_SIZE);
  }

  // ── Relance ──────────────────────────────────────────────────
  relanceLoadingId: string | null = null;
  relanceMailLoadingId: string | null = null;
  relanceSuccess = '';
  relanceError = '';

  // ── Annulation matching ──────────────────────────────────────
  annulerLoadingId: string | null = null;
  annulerSuccess = '';
  annulerError = '';

  // ── Impersonation ─────────────────────────────────────────────
  impersonateLoadingId: string | null = null;

  // ── Paramètres admin ──────────────────────────────────────────
  settings: { id: string; key: string; value: boolean; description: string; updatedAt: string }[] = [];
  settingsLoading = false;
  settingsSaving: Set<string> = new Set();
  settingsSuccess = '';

  readonly staticUrl = environment.staticUrl;

  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutDemande = StatutDemande;

  constructor(private demandeService: DemandeService, private http: HttpClient, private auth: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadDemandes();
    this.loadAllReparateurs();
    this.loadPendingReparateurs();
    this.loadReparateursDispo();
  }

  // ── Loaders ──────────────────────────────────────────────────
  loadStats(): void {
    this.http.get<ApiResponse<any>>(`${environment.apiUrl}/admin/stats`)
      .pipe(map(r => r.data))
      .subscribe({ next: s => this.stats = s, error: () => {} });
  }

  loadDemandes(): void {
    this.loading = true;
    this.demandesPage = 1;
    this.demandeService.adminGetDemandes(this.demandeFilter || undefined).subscribe({
      next: d => { this.demandes = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadAllReparateurs(): void {
    this.repsLoading = true;
    this.http.get<any>(`${environment.apiUrl}/admin/reparateurs/all?pageSize=200`)
      .subscribe({
        next: r => { this.allReparateurs = r.data?.items ?? []; this.repsLoading = false; },
        error: () => { this.repsLoading = false; }
      });
  }

  loadPendingReparateurs(): void {
    this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/admin/reparateurs/pending`)
      .pipe(map(r => r.data ?? []))
      .subscribe({ next: r => this.pendingReparateurs = r, error: () => {} });
  }

  loadReparateursDispo(): void {
    this.demandeService.adminGetReparateursDispo().subscribe({
      next: r => this.reparateursDispo = r,
      error: () => {}
    });
  }

  loadReclamations(): void {
    this.reclamationsLoading = true;
    const params = this.reclamationFilter ? `?statut=${this.reclamationFilter}` : '';
    this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/reclamations/admin${params}`)
      .pipe(map(r => r.data ?? []))
      .subscribe({
        next: r => { this.reclamations = r; this.reclamationsLoading = false; },
        error: () => { this.reclamationsLoading = false; }
      });
  }

  loadUtilisateurs(): void {
    this.utilisateursLoading = true;
    this.http.get<any>(`${environment.apiUrl}/admin/users?pageSize=200`)
      .subscribe({
        next: r => { this.utilisateurs = r.data?.items ?? []; this.utilisateursLoading = false; this.cdr.detectChanges(); },
        error: () => { this.utilisateursLoading = false; this.cdr.detectChanges(); }
      });
  }

  loadSettings(): void {
    this.settingsLoading = true;
    this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/admin/settings`)
      .subscribe({
        next: r => { this.settings = r.data ?? []; this.settingsLoading = false; },
        error: () => { this.settingsLoading = false; }
      });
  }

  toggleSetting(key: string, newValue: boolean): void {
    this.settingsSaving.add(key);
    this.settingsSuccess = '';
    this.http.patch<ApiResponse<void>>(`${environment.apiUrl}/admin/settings/${key}`, newValue)
      .subscribe({
        next: () => {
          this.settingsSaving.delete(key);
          const s = this.settings.find(x => x.key === key);
          if (s) s.value = newValue;
          this.settingsSuccess = 'Paramètre mis à jour ✓';
          setTimeout(() => this.settingsSuccess = '', 3000);
        },
        error: () => { this.settingsSaving.delete(key); }
      });
  }

  openRepondre(r: any): void {
    this.repondreTarget = r;
    this.repondreText = r.reponseAdmin ?? '';
  }
  closeRepondre(): void { this.repondreTarget = null; }

  submitRepondre(): void {
    if (!this.repondreTarget || !this.repondreText.trim()) return;
    this.repondreLoading = true;
    this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/reclamations/${this.repondreTarget.id}/repondre`,
      { reponse: this.repondreText }
    ).subscribe({
      next: () => {
        this.repondreLoading = false;
        this.closeRepondre();
        this.loadReclamations();
      },
      error: () => { this.repondreLoading = false; }
    });
  }

  // ── Détail réparateur ────────────────────────────────────────
  openRepDetail(id: string): void {
    this.repDetailModal = null;
    this.repDetailLoading = true;
    this.http.get<ApiResponse<any>>(`${environment.apiUrl}/admin/reparateurs/${id}`)
      .subscribe({
        next: r => { this.repDetailModal = r.data; this.repDetailLoading = false; },
        error: () => { this.repDetailLoading = false; }
      });
  }
  closeRepDetail(): void { this.repDetailModal = null; }

  // ── Détail demande (enrichi avec tracking) ───────────────────
  openDemandeDetail(id: string): void {
    this.demandeDetail = null;
    this.demandeDetailLoading = true;
    this.relanceSuccess = '';
    this.relanceError = '';
    // On utilise le nouvel endpoint enrichi
    this.http.get<ApiResponse<any>>(`${environment.apiUrl}/admin/demandes/${id}/detail`)
      .subscribe({
        next: r => { this.demandeDetail = r.data; this.demandeDetailLoading = false; },
        error: () => {
          // fallback sur l'ancien endpoint
          this.http.get<ApiResponse<any>>(`${environment.apiUrl}/admin/demandes/${id}`)
            .subscribe({
              next: r => { this.demandeDetail = r.data; this.demandeDetailLoading = false; },
              error: () => { this.demandeDetailLoading = false; }
            });
        }
      });
  }
  closeDemandeDetail(): void { this.demandeDetail = null; this.chatModal = null; }

  // ── Chat readonly ────────────────────────────────────────────
  openChat(matching: any): void {
    this.chatModal = null;
    this.chatLoading = true;
    this.http.get<ApiResponse<MessageDto[]>>(`${environment.apiUrl}/admin/matchings/${matching.id}/messages`)
      .subscribe({
        next: r => {
          this.chatModal = { matching, messages: r.data ?? [] };
          this.chatLoading = false;
        },
        error: () => { this.chatLoading = false; }
      });
  }
  closeChat(): void { this.chatModal = null; }

  // ── Relancer réparateur (notif plateforme) ───────────────────
  relancerReparateur(matchingId: string): void {
    this.relanceLoadingId = matchingId;
    this.relanceSuccess = '';
    this.relanceError = '';
    this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/matchings/${matchingId}/relancer`, {})
      .subscribe({
        next: (r: any) => {
          this.relanceLoadingId = null;
          this.relanceSuccess = r.message ?? 'Relance envoyée !';
          // Mettre à jour le matching dans demandeDetail
          if (this.demandeDetail?.matchings) {
            const m = this.demandeDetail.matchings.find((x: any) => x.id === matchingId);
            if (m) { m.lastRelanceAt = new Date().toISOString(); m.nbRelances = (m.nbRelances ?? 0) + 1; }
          }
          setTimeout(() => this.relanceSuccess = '', 4000);
        },
        error: (e) => { this.relanceLoadingId = null; this.relanceError = e?.error?.error ?? 'Erreur'; }
      });
  }

  // ── Relancer par email ───────────────────────────────────────
  relancerEmail(matchingId: string): void {
    this.relanceMailLoadingId = matchingId;
    this.relanceSuccess = '';
    this.relanceError = '';
    this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/matchings/${matchingId}/relancer-email`, {})
      .subscribe({
        next: (r: any) => {
          this.relanceMailLoadingId = null;
          this.relanceSuccess = r.message ?? 'Email de relance envoyé !';
          if (this.demandeDetail?.matchings) {
            const m = this.demandeDetail.matchings.find((x: any) => x.id === matchingId);
            if (m) { m.lastRelanceAt = new Date().toISOString(); m.nbRelances = (m.nbRelances ?? 0) + 1; }
          }
          setTimeout(() => this.relanceSuccess = '', 4000);
        },
        error: (e) => { this.relanceMailLoadingId = null; this.relanceError = e?.error?.error ?? 'Erreur'; }
      });
  }

  // ── Affectation ──────────────────────────────────────────────
  openAffect(d: AdminDemandeDto): void {
    this.affectModal = d;
    this.affectExistingMatchings = [];
    this.selectedReps = new Set();   // toujours vide — l'admin choisit lui-même
    this.messageAdmin = '';
    this.affectSuccess = '';
    this.affectError = '';
    this.annulerSuccess = '';
    this.annulerError = '';
    this.closeDemandeDetail();
    // Charger les matchings existants pour cette demande
    this.affectDetailLoading = true;
    this.http.get<ApiResponse<any>>(`${environment.apiUrl}/admin/demandes/${d.id}/detail`)
      .subscribe({
        next: r => {
          this.affectExistingMatchings = r.data?.matchings ?? [];
          this.affectDetailLoading = false;
          // ⚠️ Ne PAS pré-sélectionner : l'admin décide lui-même qui notifier
        },
        error: () => { this.affectDetailLoading = false; }
      });
  }
  closeAffect(): void { this.affectModal = null; }

  toggleRep(id: string): void {
    if (this.selectedReps.has(id)) this.selectedReps.delete(id);
    else { if (this.selectedReps.size >= 5) return; this.selectedReps.add(id); }
  }

  submitAffect(): void {
    if (!this.affectModal || this.selectedReps.size === 0) return;
    this.affectLoading = true;
    this.affectError = '';
    this.affectSuccess = '';
    this.demandeService.adminAffecter(this.affectModal.id, {
      reparateurIds: Array.from(this.selectedReps),
      messageAdmin: this.messageAdmin || undefined
    }).subscribe({
      next: () => {
        this.affectLoading = false;
        this.affectSuccess = `${this.selectedReps.size} réparateur(s) notifié(s) avec succès !`;
        this.loadDemandes();
        setTimeout(() => this.closeAffect(), 2000);
      },
      error: (e) => {
        this.affectLoading = false;
        this.affectError = e?.error?.error ?? 'Erreur lors de l\'affectation';
      }
    });
  }

  // ── Validation réparateur ────────────────────────────────────
  validerReparateur(id: string): void {
    this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/reparateurs/${id}/valider`, {})
      .subscribe({
        next: () => {
          const r = this.allReparateurs.find(x => x.id === id);
          if (r) r.isVerified = true;
          this.pendingReparateurs = this.pendingReparateurs.filter(r => r.id !== id);
          if (this.repDetailModal?.id === id) this.repDetailModal.isVerified = true;
          this.loadReparateursDispo();
        },
        error: () => {}
      });
  }

  suspendreReparateur(id: string): void {
    this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/reparateurs/${id}/suspendre`, '"Suspendu par admin"')
      .subscribe({
        next: () => {
          this.allReparateurs = this.allReparateurs.filter(r => r.id !== id);
          this.pendingReparateurs = this.pendingReparateurs.filter(r => r.id !== id);
          this.closeRepDetail();
        },
        error: () => {}
      });
  }

  // ── Désactiver/Réactiver compte utilisateur ──────────────────
  openDesactiver(user: any): void {
    this.desactiverModal = user;
    this.desactiverRaison = '';
    this.desactiverError = '';
  }
  closeDesactiver(): void { this.desactiverModal = null; }

  submitDesactiver(): void {
    if (!this.desactiverModal || !this.desactiverRaison.trim()) {
      this.desactiverError = 'Veuillez indiquer une raison';
      return;
    }
    this.desactiverLoading = true;
    this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/admin/users/${this.desactiverModal.id}/desactiver`,
      { raison: this.desactiverRaison }
    ).subscribe({
      next: () => {
        this.desactiverLoading = false;
        // Mettre à jour localement
        const u = this.utilisateurs.find(x => x.id === this.desactiverModal.id);
        if (u) { u.isActive = false; u.disabledReason = this.desactiverRaison; }
        const r = this.allReparateurs.find(x => x.userId === this.desactiverModal.id || x.id === this.desactiverModal.id);
        if (r) r.isActive = false;
        if (this.repDetailModal?.userId === this.desactiverModal.id) this.repDetailModal.isActive = false;
        this.closeDesactiver();
      },
      error: (e) => { this.desactiverLoading = false; this.desactiverError = e?.error?.error ?? 'Erreur'; }
    });
  }

  reactiverUser(user: any): void {
    this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/users/${user.id}/reactiver`, {})
      .subscribe({
        next: () => {
          const u = this.utilisateurs.find(x => x.id === user.id);
          if (u) { u.isActive = true; u.disabledReason = null; }
          const r = this.allReparateurs.find(x => x.userId === user.id || x.id === user.id);
          if (r) r.isActive = true;
        },
        error: () => {}
      });
  }

  // ── Annuler un matching (par admin) ─────────────────────────
  annulerMatching(matchingId: string): void {
    if (!confirm('Confirmer l\'annulation de ce réparateur ? Il sera notifié et ne pourra plus répondre.')) return;
    this.annulerLoadingId = matchingId;
    this.annulerSuccess = '';
    this.annulerError = '';
    this.http.post<any>(`${environment.apiUrl}/admin/matchings/${matchingId}/annuler`, {})
      .subscribe({
        next: (r) => {
          this.annulerLoadingId = null;
          this.annulerSuccess = r.message ?? 'Matching annulé';
          if (this.demandeDetail?.matchings) {
            const m = this.demandeDetail.matchings.find((x: any) => x.id === matchingId);
            if (m) m.statut = 'ANNULE';
          }
          // aussi mettre à jour la popup affectation si ouverte
          if (this.affectModal) {
            const m = this.affectExistingMatchings.find((x: any) => x.id === matchingId);
            if (m) m.statut = 'ANNULE';
          }
          setTimeout(() => this.annulerSuccess = '', 4000);
        },
        error: (e) => { this.annulerLoadingId = null; this.annulerError = e?.error?.error ?? 'Erreur'; }
      });
  }

  // ── Impersonation ─────────────────────────────────────────────
  impersonateUser(userId: string, userNom: string): void {
    this.impersonateLoadingId = userId;
    this.http.post<ApiResponse<any>>(`${environment.apiUrl}/admin/users/${userId}/impersonate`, {})
      .subscribe({
        next: (r) => {
          this.impersonateLoadingId = null;
          if (!r.data?.token) return;
          // Sauvegarder la session admin pour pouvoir revenir
          const adminToken = this.auth.getToken();
          const adminUser  = this.auth.currentUser();
          if (adminToken && adminUser) {
            sessionStorage.setItem('repando_admin_token', adminToken);
            sessionStorage.setItem('repando_admin_user', JSON.stringify(adminUser));
          }
          // Stocker la session impersonée
          this.auth.storeSession({
            token:    r.data.token,
            userId:   r.data.userId,
            email:    r.data.email,
            prenom:   r.data.prenom,
            nom:      r.data.nom,
            role:     r.data.role,
            avatarUrl: r.data.avatarUrl
          });
          // Rediriger selon le rôle
          if (r.data.role === 'REPARATEUR') this.router.navigate(['/dashboard-reparateur']);
          else this.router.navigate(['/dashboard']);
        },
        error: () => { this.impersonateLoadingId = null; }
      });
  }

  // ── Helpers ──────────────────────────────────────────────────
  getAppareilLabel(type: string): { label: string; icon: string } {
    return (this.APPAREIL_LABELS as any)[type] ?? { label: type, icon: '🔧' };
  }

  getStatutClass(statut: string): string {
    switch (statut) {
      case 'OUVERTE': return 'badge-blue';
      case 'TRAITEE': return 'badge-green';
      case 'ANNULEE': return 'badge-gray';
      default: return 'badge-gray';
    }
  }

  getMatchingStatutStyle(statut: string): { label: string; color: string; bg: string } {
    switch (statut) {
      case 'NOUVEAU':      return { label: 'Notifié (pas encore vu)', color: '#1d4ed8', bg: '#dbeafe' };
      case 'VU':           return { label: 'Vu (sans réponse)', color: '#92400e', bg: '#fef3c7' };
      case 'ACCEPTE':      return { label: 'Accepté ✅', color: '#15803d', bg: '#dcfce7' };
      case 'DEVIS_ENVOYE': return { label: 'Devis envoyé', color: '#7c3aed', bg: '#ede9fe' };
      case 'CLOTURE':      return { label: 'Clôturé', color: '#64748b', bg: '#f1f5f9' };
      case 'REFUSE':       return { label: 'Décliné', color: '#991b1b', bg: '#fee2e2' };
      case 'ANNULE':       return { label: 'Annulé', color: '#64748b', bg: '#f1f5f9' };
      default:             return { label: statut, color: '#64748b', bg: '#f1f5f9' };
    }
  }

  canRelancer(statut: string): boolean {
    return statut === 'NOUVEAU' || statut === 'VU';
  }

  joursDepuisNotif(notifiedAt: string): number {
    return Math.floor((Date.now() - new Date(notifiedAt).getTime()) / 86_400_000);
  }

  /** Retourne "il y a Xh" ou "il y a Xj" depuis une date */
  tempsDepuis(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffJ = Math.floor(diffMs / 86_400_000);
    if (diffH < 1) return 'à l\'instant';
    if (diffH < 24) return `il y a ${diffH}h`;
    return `il y a ${diffJ}j`;
  }

  /** Vrai si le matching attend depuis ≥24h sans aucune relance récente */
  needsRelance(m: any): boolean {
    if (m.statut !== 'NOUVEAU' && m.statut !== 'VU') return false;
    const seuil24h = Date.now() - 86_400_000;
    const notifTime = new Date(m.notifiedAt).getTime();
    const lastRelanceTime = m.lastRelanceAt ? new Date(m.lastRelanceAt).getTime() : 0;
    const lastAction = Math.max(notifTime, lastRelanceTime);
    return lastAction < seuil24h;
  }

  stars(n: number): string[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(n) ? '★' : '☆');
  }

  pageRange(total: number): number[] {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
}
