import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { APPAREIL_LABELS, DemandeDto, SaveGuestDraftRequest, TypeAppareil, TypeIntervention, TypePanne } from '../../core/models/models';
import { DemandeService } from '../../core/services/demande';
import { ToastService } from '../../core/services/toast';

interface GuestDraftStorage {
  draftId?: string;
  clientId?: string;
  email?: string;
  telephone?: string;
  typeAppareil?: TypeAppareil;
  marque?: string;
  modele?: string;
  typePanne?: TypePanne;
  description?: string;
  photoUrls?: string[];
  adresse?: string;
  ville?: string;
  codePostal?: string;
  typeIntervention?: TypeIntervention;
  draftSavedAt?: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent implements OnInit {
  audience: 'client' | 'reparateur' = 'client';
  readonly appareils = [
    { key: TypeAppareil.LAVE_LINGE, ...APPAREIL_LABELS[TypeAppareil.LAVE_LINGE] },
    { key: TypeAppareil.LAVE_VAISSELLE, ...APPAREIL_LABELS[TypeAppareil.LAVE_VAISSELLE] },
    { key: TypeAppareil.REFRIGERATEUR, ...APPAREIL_LABELS[TypeAppareil.REFRIGERATEUR] },
    { key: TypeAppareil.SECHE_LINGE, ...APPAREIL_LABELS[TypeAppareil.SECHE_LINGE] },
    { key: TypeAppareil.FOUR, ...APPAREIL_LABELS[TypeAppareil.FOUR] },
    { key: TypeAppareil.AUTRE, ...APPAREIL_LABELS[TypeAppareil.AUTRE] },
  ];

  selectedAppareil = this.appareils[0];
  adresse = '';
  photoPreview: string | null = null;
  hasDraft = false;
  draftStorage: GuestDraftStorage | null = null;
  draftDetails: DemandeDto | null = null;
  showDraftModal = false;
  draftError = '';
  draftSaving = false;
  deletingDraft = false;

  readonly TypeAppareil = TypeAppareil;
  readonly TypePanne = TypePanne;
  readonly TypeIntervention = TypeIntervention;

  constructor(
    private readonly demandeService: DemandeService,
    private readonly router: Router,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadStoredDraft();
  }

  private loadStoredDraft(): void {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem('repando_demande_draft');
      const draft = raw ? JSON.parse(raw) as GuestDraftStorage : null;
      this.draftStorage = draft;
      this.hasDraft = !!draft?.draftId;

      if (!draft?.draftId) {
        this.draftDetails = null;
        return;
      }

      this.demandeService.getGuestDraft(draft.draftId, draft.email, draft.telephone).subscribe({
        next: (demande) => {
          this.draftDetails = demande;
          this.hasDraft = true;
          this.draftError = '';
        },
        error: () => {
          this.hasDraft = false;
          this.draftDetails = null;
          this.draftError = 'Le brouillon n’est plus accessible.';
        }
      });
    } catch {
      this.hasDraft = false;
      this.draftStorage = null;
      this.draftDetails = null;
    }
  }

  openDraftManager(): void {
    if (!this.draftStorage?.draftId) return;
    this.showDraftModal = true;
    if (!this.draftDetails) this.loadStoredDraft();
  }

  closeDraftManager(): void {
    this.showDraftModal = false;
  }

  saveDraftChanges(): void {
    if (!this.draftStorage?.draftId || !this.draftDetails) return;
    this.draftSaving = true;
    this.draftError = '';

    const payload: SaveGuestDraftRequest = {
      email: this.draftStorage.email,
      telephone: this.draftStorage.telephone,
      typeAppareil: this.draftDetails.typeAppareil,
      marque: this.draftDetails.marque ?? '',
      modele: this.draftDetails.modele ?? '',
      typePanne: this.draftDetails.typePanne ?? TypePanne.AUTRE,
      description: this.draftDetails.description ?? '',
      photoUrls: this.draftDetails.photoUrls ?? [],
      adresse: this.draftDetails.adresse ?? '',
      ville: this.draftDetails.ville ?? 'Paris',
      codePostal: this.draftDetails.codePostal ?? '',
      typeIntervention: this.draftDetails.typeIntervention ?? TypeIntervention.INDIFFERENT,
    };

    this.demandeService.updateGuestDraft(this.draftStorage!.draftId!, payload).subscribe({
      next: (demande) => {
        this.draftDetails = demande;
        this.draftSaving = false;
        this.toast.success('Brouillon sauvegardé.');
        const updated = {
          ...this.draftStorage!,
          draftId: this.draftStorage!.draftId,
          clientId: this.draftStorage!.clientId,
          typeAppareil: demande.typeAppareil,
          marque: demande.marque ?? '',
          modele: demande.modele ?? '',
          typePanne: demande.typePanne ?? TypePanne.AUTRE,
          description: demande.description ?? '',
          photoUrls: demande.photoUrls ?? [],
          adresse: demande.adresse ?? '',
          ville: demande.ville ?? 'Paris',
          codePostal: demande.codePostal ?? '',
          typeIntervention: demande.typeIntervention ?? TypeIntervention.INDIFFERENT,
        };
        window.localStorage.setItem('repando_demande_draft', JSON.stringify(updated));
      },
      error: (err) => {
        this.draftSaving = false;
        this.draftError = err?.error?.error ?? 'Impossible de sauvegarder les modifications.';
        this.toast.error(this.draftError);
      }
    });
  }

  deleteDraft(): void {
    if (!this.draftStorage?.draftId) return;
    const confirmed = window.confirm('Supprimer définitivement cette demande en attente ?');
    if (!confirmed) return;

    this.deletingDraft = true;
    this.demandeService.deleteGuestDraft(this.draftStorage.draftId, this.draftStorage.email, this.draftStorage.telephone).subscribe({
      next: () => {
        window.localStorage.removeItem('repando_demande_draft');
        this.hasDraft = false;
        this.draftStorage = null;
        this.draftDetails = null;
        this.showDraftModal = false;
        this.deletingDraft = false;
        this.toast.success('Demande supprimée.');
      },
      error: (err) => {
        this.deletingDraft = false;
        const msg = err?.error?.error ?? 'Impossible de supprimer cette demande.';
        this.draftError = msg;
        this.toast.error(msg);
      }
    });
  }

  finalizeDraft(): void {
    this.router.navigate(['/creer-demande']);
  }

  selectAppareil(a: typeof this.appareils[0]): void {
    this.selectedAppareil = a;
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => this.photoPreview = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  readonly stats = [
    { num: '230+', label: 'Réparateurs QualiRépar' },
    { num: '−65€', label: 'Bonus État maximum' },
    { num: '98%', label: 'Taux de satisfaction' },
    { num: '10%', label: 'Commission — la + basse' },
    { num: '0€', label: 'De paperasse bonus' },
  ];

  readonly reviews = [
    { stars: 5, text: '"Incroyable. J\'ai économisé 50€ sur mon lave-linge Samsung sans rien faire."', name: 'Marie L.', device: '🧺 Lave-linge · Paris 15e', saving: '−50€' },
    { stars: 5, text: '"J\'ai utilisé la messagerie pour demander un devis. Réponse en 20 minutes."', name: 'Thomas B.', device: '❄️ Réfrigérateur · Paris 11e', saving: '−50€' },
    { stars: 5, text: '"Mon lave-vaisselle Miele était en panne. Trouvé un réparateur le lendemain."', name: 'Sarah M.', device: '🍽 Lave-vaisselle · Paris 16e', saving: '−50€' },
  ];
}
