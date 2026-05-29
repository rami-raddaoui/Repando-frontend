import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DemandeService } from '../../core/services/demande';
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
  tab: 'demandes' | 'reparateurs' | 'stats' | 'reclamations' = 'demandes';

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
  repFilter: 'all' | 'pending' | 'verified' = 'all';
  repsPage = 1;
  repsSearch = '';
  repsLoading = false;

  get filteredReps() {
    let list = this.allReparateurs;
    if (this.repFilter === 'pending')  list = list.filter(r => !r.isVerified);
    if (this.repFilter === 'verified') list = list.filter(r => r.isVerified);
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

  // ── Détail demande ───────────────────────────────────────────
  demandeDetail: any = null;
  demandeDetailLoading = false;

  // ── Chat readonly modal ──────────────────────────────────────
  chatModal: { matching: any; messages: MessageDto[] } | null = null;
  chatLoading = false;

  // ── Affectation ──────────────────────────────────────────────
  affectModal: AdminDemandeDto | null = null;
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

  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutDemande = StatutDemande;

  constructor(private demandeService: DemandeService, private http: HttpClient) {}

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

  // ── Détail demande ───────────────────────────────────────────
  openDemandeDetail(id: string): void {
    this.demandeDetail = null;
    this.demandeDetailLoading = true;
    this.http.get<ApiResponse<any>>(`${environment.apiUrl}/admin/demandes/${id}`)
      .subscribe({
        next: r => { this.demandeDetail = r.data; this.demandeDetailLoading = false; },
        error: () => { this.demandeDetailLoading = false; }
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

  // ── Affectation ──────────────────────────────────────────────
  openAffect(d: AdminDemandeDto): void {
    this.affectModal = d;
    this.selectedReps = new Set();
    this.messageAdmin = '';
    this.affectSuccess = '';
    this.affectError = '';
    this.closeDemandeDetail();
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
      case 'NOUVEAU':      return { label: 'Nouveau', color: '#1d4ed8', bg: '#dbeafe' };
      case 'VU':           return { label: 'Vu', color: '#92400e', bg: '#fef3c7' };
      case 'ACCEPTE':      return { label: 'Accepté ✅', color: '#15803d', bg: '#dcfce7' };
      case 'DEVIS_ENVOYE': return { label: 'Devis envoyé', color: '#7c3aed', bg: '#ede9fe' };
      case 'CLOTURE':      return { label: 'Clôturé', color: '#64748b', bg: '#f1f5f9' };
      case 'REFUSE':       return { label: 'Décliné', color: '#991b1b', bg: '#fee2e2' };
      case 'ANNULE':       return { label: 'Annulé', color: '#64748b', bg: '#f1f5f9' };
      default:             return { label: statut, color: '#64748b', bg: '#f1f5f9' };
    }
  }

  stars(n: number): string[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(n) ? '★' : '☆');
  }

  pageRange(total: number): number[] {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
}
