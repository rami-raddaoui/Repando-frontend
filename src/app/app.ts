import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/components/navbar';
import { FooterComponent } from './core/components/footer';
import { ToastContainerComponent } from './core/components/toast-container';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, ToastContainerComponent],
  template: `
    @if (draftBannerVisible) {
      <div class="app-draft-banner" role="status" aria-live="polite">
        <div class="app-draft-banner__content">
          <span class="app-draft-banner__icon">📝</span>
          <div class="app-draft-banner__text">
            <strong>Demande en attente</strong>
            <span>Votre demande est sauvegardée. Vous pouvez la reprendre quand vous voulez.</span>
          </div>
        </div>
        <div class="app-draft-banner__actions">
          <button type="button" class="app-draft-banner__primary" (click)="goToDraftManager()">Gérer mes demandes</button>
          <button type="button" class="app-draft-banner__secondary" (click)="dismissDraftBanner()" aria-label="Fermer">✕</button>
        </div>
      </div>
    }
    <app-navbar />
    <main>
      <router-outlet />
    </main>
    <app-footer />
    <app-toast-container />
  `,
  styles: [`
    :host { display: block; }
    .app-draft-banner {
      position: sticky;
      top: 0;
      z-index: 120;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1.2rem;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #fff;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }
    .app-draft-banner__content {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      min-width: 0;
    }
    .app-draft-banner__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: rgba(16, 185, 129, 0.18);
      font-size: 1.1rem;
    }
    .app-draft-banner__text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      line-height: 1.3;
    }
    .app-draft-banner__text strong {
      font-size: 0.97rem;
      font-weight: 800;
    }
    .app-draft-banner__text span {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.8);
    }
    .app-draft-banner__actions {
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }
    .app-draft-banner__primary,
    .app-draft-banner__secondary {
      border: 0;
      cursor: pointer;
      border-radius: 999px;
      font-weight: 700;
      transition: opacity 0.18s ease;
    }
    .app-draft-banner__primary {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 0.7rem 1rem;
    }
    .app-draft-banner__secondary {
      background: rgba(255, 255, 255, 0.08);
      color: white;
      width: 34px;
      height: 34px;
    }
    main { min-height: calc(100vh - 64px - 120px); }
    @media (max-width: 640px) {
      .app-draft-banner {
        align-items: flex-start;
        flex-direction: column;
      }
      .app-draft-banner__actions {
        width: 100%;
        justify-content: space-between;
      }
      .app-draft-banner__primary {
        flex: 1;
      }
    }
  `]
})
export class AppComponent {
  draftBannerVisible = false;

  constructor(private router: Router) {
    this.refreshDraftBanner();
  }

  refreshDraftBanner(): void {
    if (typeof window === 'undefined') {
      this.draftBannerVisible = false;
      return;
    }
    this.draftBannerVisible = sessionStorage.getItem('repando_app_draft_banner') === '1';
  }

  dismissDraftBanner(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('repando_app_draft_banner');
    }
    this.draftBannerVisible = false;
  }

  goToDraftManager(): void {
    this.dismissDraftBanner();
    this.router.navigate(['/']);
  }
}
export { AppComponent as App };
