import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DemandeService } from '../../core/services/demande';
import { TypeAppareil, TypePanne, TypeIntervention, APPAREIL_LABELS } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-creer-demande',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './creer-demande.html',
  styleUrl: './creer-demande.scss'
})
export class CreerDemandeComponent {
  form: FormGroup;
  // step removed: not used in this component
  loading = false;
  error = '';
  photoPreviews: { url: string; name: string; size: string }[] = [];
  idfError: string = '';

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
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      typeAppareil:    [TypeAppareil.LAVE_LINGE, Validators.required],
      marque:          [''],
      modele:          [''],
      typePanne:       [TypePanne.NE_DEMARRE_PLUS, Validators.required],
      description:     [''],
      adresse:         ['', Validators.required],
      ville:           ['Paris'],
      codePostal:      [''],
      typeIntervention:[TypeIntervention.INDIFFERENT, Validators.required],
    });

    // when codePostal changes, update ville dynamically
    this.form.get('codePostal')!.valueChanges.subscribe((cp: string) => this.onCodePostalChange(cp));
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
          this.postalMatches = matches.map((n) => ({ nom: n, code: '' }));
          if (this.postalMatches.length === 1) {
            this.form.get('ville')!.setValue(this.postalMatches[0].nom);
            this.idfError = '';
          } else {
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
            // store matches for user to choose if multiple
            this.postalMatches = data.map((c: any) => ({ nom: c.nom, code: c.code, codesPostaux: c.codesPostaux }));
            if (this.postalMatches.length === 1) {
              const match = this.postalMatches[0];
              const depCode = (match.code || '').substring(0, 2);
              if (this.IDF_DEPS[depCode]) {
                this.form.get('ville')!.setValue(match.nom);
                this.idfError = '';
              } else {
                this.form.get('ville')!.setValue('');
                this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
              }
            } else {
              // multiple matches: clear city and show choices
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
    const depCode = (match.code || '').substring(0,2);
    if (this.IDF_DEPS[depCode]) {
      this.form.get('ville')!.setValue(match.nom);
      this.idfError = '';
    } else {
      this.form.get('ville')!.setValue('');
      this.idfError = "Repando opère actuellement uniquement en Île-de-France. Expansion prévue bientôt dans toute la France ! 🚀";
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
          size: sizeLabel
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
    if (this.form.invalid) return;
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/connexion']);
      return;
    }
    this.loading = true;
    this.error = '';
    this.demandeService.create(this.form.value).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/mes-demandes']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Une erreur est survenue. Veuillez réessayer.';
      }
    });
  }
}
