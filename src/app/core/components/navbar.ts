import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth';
import { UserRole } from '../models/models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent {
  readonly UserRole = UserRole;

  constructor(public auth: AuthService) {}

  logout(): void {
    this.auth.logout();
  }
}
