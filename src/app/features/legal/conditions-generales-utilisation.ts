import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-conditions-generales-utilisation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="legal-wrap">
      <div class="legal-card">
        <h1>Conditions Generales d'Utilisation (CGU)</h1>
        <p class="legal-updated">Derniere mise a jour : 31/08/2026</p>

        <h2>1. Objet</h2>
        <p>
          Les presentes Conditions Generales d'Utilisation encadrent l'utilisation de la plateforme Repando
          et des services proposes aux clients et reparateurs.
        </p>

        <h2>2. Compte utilisateur</h2>
        <p>
          L'utilisateur s'engage a fournir des informations exactes et a maintenir la confidentialite de ses
          identifiants. Toute activite effectuee depuis le compte est presumee realisee par son titulaire.
        </p>

        <h2>3. Services</h2>
        <p>
          Repando met en relation clients et reparateurs. Les devis et interventions sont de la responsabilite
          des parties concernees, dans le respect des lois en vigueur.
        </p>

        <h2>4. Contact</h2>
        <p>
          Pour toute question relative aux CGU, vous pouvez nous contacter via la page
          <a routerLink="/contact">Contact</a>.
        </p>
      </div>
    </section>
  `,
  styleUrl: './legal-page.scss'
})
export class ConditionsGeneralesUtilisationComponent {}

