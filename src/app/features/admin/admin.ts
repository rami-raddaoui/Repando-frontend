import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DemandeService } from '../../core/services/demande';
import { AdminDemandeDto, AdminReparateurDispoDto, StatutDemande, APPAREIL_LABELS } from '../../core/models/models';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../core/models/models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class AdminComponent implements OnInit {
  tab: 'demandes' | 'reparateurs' | 'stats' = 'demandes';

  stats: any = null;
  demandes: AdminDemandeDto[] = [];
  demandeFilter: string = 'OUVERTE';
  reparateursDispo: AdminReparateurDispoDto[] = [];
  pendingReparateurs: any[] = [];

  // Affectation modal state
  affectModal: AdminDemandeDto | null = null;
  selectedReps: Set<string> = new Set();
  messageAdmin = '';
  affectLoading = false;
  affectSuccess = '';
  affectError = '';

  loading = false;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;
  readonly StatutDemande = StatutDemande;

  constructor(private demandeService: DemandeService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadDemandes();
    this.loadReparateursDispo();
    this.loadPendingReparateurs();
  }

  loadStats(): void {
    this.http.get<ApiResponse<any>>(`${environment.apiUrl}/admin/stats`)
      .pipe(map(r => r.data))
      .subscribe({ next: s => this.stats = s, error: () => {} });
  }

  loadDemandes(): void {
    this.loading = true;
    this.demandeService.adminGetDemandes(this.demandeFilter || undefined).subscribe({
      next: d => { this.demandes = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadReparateursDispo(): void {
    this.demandeService.adminGetReparateursDispo().subscribe({
      next: r => this.reparateursDispo = r,
      error: () => {}
    });
  }

  loadPendingReparateurs(): void {
    this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/admin/reparateurs/pending`)
      .pipe(map(r => r.data ?? []))
      .subscribe({ next: r => this.pendingReparateurs = r, error: () => {} });
  }

  openAffect(d: AdminDemandeDto): void {
    this.affectModal = d;
    this.selectedReps = new Set();
    this.messageAdmin = '';
    this.affectSuccess = '';
    this.affectError = '';
  }

  closeAffect(): void {
    this.affectModal = null;
  }

  toggleRep(id: string): void {
    if (this.selectedReps.has(id)) {
      this.selectedReps.delete(id);
    } else {
      if (this.selectedReps.size >= 5) return;
      this.selectedReps.add(id);
    }
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

  validerReparateur(id: string): void {
    this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/reparateurs/${id}/valider`, {})
      .subscribe({
        next: () => {
          this.pendingReparateurs = this.pendingReparateurs.filter(r => r.id !== id);
          this.loadReparateursDispo();
        },
        error: () => {}
      });
  }

  suspendreReparateur(id: string): void {
    this.http.post<ApiResponse<void>>(`${environment.apiUrl}/admin/reparateurs/${id}/suspendre`, '"Suspendu par admin"')
      .subscribe({
        next: () => this.pendingReparateurs = this.pendingReparateurs.filter(r => r.id !== id),
        error: () => {}
      });
  }

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
}
