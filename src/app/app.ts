import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/components/navbar';
import { FooterComponent } from './core/components/footer';
import { ToastContainerComponent } from './core/components/toast-container';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, ToastContainerComponent],
  template: `
    <app-navbar />
    <main>
      <router-outlet />
    </main>
    <app-footer />
    <app-toast-container />
  `,
  styles: [`main { min-height: calc(100vh - 64px - 120px); }`]
})
export class AppComponent {}
export { AppComponent as App };
