import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { APPAREIL_LABELS, TypeAppareil } from '../../core/models/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent {
  audience: 'client' | 'reparateur' = 'client';

  readonly appareils = [
    { key: TypeAppareil.LAVE_LINGE,    ...APPAREIL_LABELS[TypeAppareil.LAVE_LINGE] },
    { key: TypeAppareil.LAVE_VAISSELLE,...APPAREIL_LABELS[TypeAppareil.LAVE_VAISSELLE] },
    { key: TypeAppareil.REFRIGERATEUR, ...APPAREIL_LABELS[TypeAppareil.REFRIGERATEUR] },
    { key: TypeAppareil.SECHE_LINGE,   ...APPAREIL_LABELS[TypeAppareil.SECHE_LINGE] },
    { key: TypeAppareil.FOUR,          ...APPAREIL_LABELS[TypeAppareil.FOUR] },
    { key: TypeAppareil.AUTRE,         ...APPAREIL_LABELS[TypeAppareil.AUTRE] },
  ];

  selectedAppareil = this.appareils[0];
  adresse = '';
  photoPreview: string | null = null;

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
