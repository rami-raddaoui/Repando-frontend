import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { MessagerieService } from '../services/messagerie';
import { DemandeService } from '../services/demande';
import { UserRole, MatchingDto, APPAREIL_LABELS } from '../models/models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent implements OnInit {
  readonly UserRole = UserRole;
  showConvBubble = false;
  recentConvs: MatchingDto[] = [];
  unreadCount = 0;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;

  constructor(
    public auth: AuthService,
    public msgService: MessagerieService,
    private demandeService: DemandeService,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.auth.currentUser() && this.loadConvs();
    this.msgService.recentConvs$.subscribe(c => this.recentConvs = c);
    this.msgService.unreadCount$.subscribe(n => this.unreadCount = n);
  }

  loadConvs(): void {
    if (!this.auth.isLoggedIn() || this.auth.isAdmin()) return;
    this.demandeService.getMyMatchings().subscribe({
      next: m => this.msgService.setRecentConvs(m),
      error: () => {}
    });
  }

  toggleBubble(): void { this.showConvBubble = !this.showConvBubble; }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target)) {
      this.showConvBubble = false;
    }
  }

  getAppareilIcon(type: string): string {
    return (this.APPAREIL_LABELS as any)[type]?.icon ?? '🔧';
  }

  logout(): void { this.auth.logout(); }
}
