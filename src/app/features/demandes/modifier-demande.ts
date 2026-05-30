import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { TypeAppareil, TypePanne, APPAREIL_LABELS, StatutDemande } from '../../core/models/models';

@Component({
  selector: 'app-modifier-demande',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './modifier-demande.html',
  styleUrl: './creer-demande.scss'
})
export class ModifierDemandeComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  loadingInit = true;
  error = '';
  demandeId = '';
  hasActiveChats = false;
  existingPhotoUrls: string[] = [];
  photoPreviews: { url: string; name: string; size: string; isExisting: boolean }[] = [];

  readonly TypeAppareil = TypeAppareil;
  readonly TypePanne = TypePanne;
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
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.demandeId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.demandeId) { this.router.navigate(['/dashboard']); return; }

    this.demandeService.getById(this.demandeId).subscribe({
      next: (d) => {
        if (d.statut === StatutDemande.ANNULEE || d.statut === StatutDemande.TRAITEE) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.hasActiveChats = d.nbMatchings > 0;
        this.existingPhotoUrls = d.photoUrls ?? [];
        this.photoPreviews = this.existingPhotoUrls.map(url => ({
          url,
          name: url.split('/').pop() ?? 'photo',
          size: '',
          isExisting: true
        }));
        this.form = this.fb.group({
          typeAppareil: [d.typeAppareil, Validators.required],
          marque:       [d.marque ?? ''],
          modele:       [d.modele ?? ''],
          typePanne:    [d.typePanne, Validators.required],
          description:  [d.description ?? ''],
        });
        this.loadingInit = false;
      },
      error: () => this.router.navigate(['/dashboard'])
    });
  }

  onFileChange(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      const sizeLabel = file.size > 1024 * 1024
        ? (file.size / 1024 / 1024).toFixed(1) + ' Mo'
        : (file.size / 1024).toFixed(0) + ' Ko';
      reader.onload = e => {
        this.photoPreviews.push({ url: e.target?.result as string, name: file.name, size: sizeLabel, isExisting: false });
      };
      reader.readAsDataURL(file);
    });
    (event.target as HTMLInputElement).value = '';
  }

  removePhoto(index: number): void {
    this.photoPreviews.splice(index, 1);
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const existingUrls = this.photoPreviews.filter(p => p.isExisting).map(p => p.url);
    const newDataUrls   = this.photoPreviews.filter(p => !p.isExisting).map(p => p.url);

    const doUpdate = (newUrls: string[]) => {
      const allUrls = [...existingUrls, ...newUrls];
      this.demandeService.update(this.demandeId, { ...this.form.value, photoUrls: allUrls }).subscribe({
        next: () => { this.loading = false; this.router.navigate(['/dashboard']); },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error ?? 'Une erreur est survenue.';
        }
      });
    };

    if (newDataUrls.length > 0) {
      this.demandeService.uploadPhotos(newDataUrls).subscribe({
        next: (urls) => doUpdate(urls),
        error: () => doUpdate([])
      });
    } else {
      doUpdate([]);
    }
  }
}

