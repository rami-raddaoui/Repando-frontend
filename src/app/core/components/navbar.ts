import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { MessagerieService, AppNotification } from '../services/messagerie';
import { DemandeService } from '../services/demande';
import { UserRole, MatchingDto, APPAREIL_LABELS } from '../models/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly UserRole = UserRole;
  showConvBubble = false;
  showNotifPanel = false;
  showUserMenu = false;
  recentConvs: MatchingDto[] = [];
  unreadCount = 0;
  notifications: AppNotification[] = [];
  notifCount = 0;
  readonly APPAREIL_LABELS = APPAREIL_LABELS;

  private subs: Subscription[] = [];

  constructor(
    public auth: AuthService,
    public msgService: MessagerieService,
    private demandeService: DemandeService,
    private elRef: ElementRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.auth.currentUser() && !this.auth.isAdmin()) {
      // Load initial convs
      this.msgService.refreshConvs();
      // Connect persistent global hub
      this.msgService.connectGlobalHub();
    }

    this.subs.push(
      this.msgService.recentConvs$.subscribe(c => this.recentConvs = c),
      this.msgService.unreadCount$.subscribe(n => this.unreadCount = n),
      this.msgService.notifications$.subscribe(n => this.notifications = n),
      this.msgService.notifCount$.subscribe(n => this.notifCount = n),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  toggleBubble(): void {
    this.showConvBubble = !this.showConvBubble;
    if (this.showConvBubble) { this.showNotifPanel = false; this.showUserMenu = false; }
  }

  toggleNotifPanel(): void {
    this.showNotifPanel = !this.showNotifPanel;
    if (this.showNotifPanel) { this.showConvBubble = false; this.showUserMenu = false; }
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    if (this.showUserMenu) { this.showConvBubble = false; this.showNotifPanel = false; }
  }

  closeUserMenu(): void { this.showUserMenu = false; }

  closeAll(): void {
    this.showConvBubble = false;
    this.showNotifPanel = false;
    this.showUserMenu = false;
  }

  get lastLoginLabel(): string {
    const u = this.auth.currentUser();
    if (!(u as any)?.lastLoginAt) return '';
    const d = new Date((u as any).lastLoginAt);
    return `Connexion le ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  navigateToNotif(notif: AppNotification): void {
    this.msgService.markNotifRead(notif.id);
    this.showNotifPanel = false;
    if (notif.matchingId) {
      this.router.navigate(['/messagerie', notif.matchingId]);
    }
  }

  markAllRead(): void {
    this.msgService.markAllNotifsRead();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target)) {
      this.showConvBubble = false;
      this.showNotifPanel = false;
      this.showUserMenu = false;
    }
  }

  getAppareilIcon(type: string): string {
    return (this.APPAREIL_LABELS as any)[type]?.icon ?? '🔧';
  }

  getNotifIcon(type: string): string {
    switch (type) {
      case 'NEW_MESSAGE':     return '💬';
      case 'PRISE_EN_CHARGE': return '🔧';
      case 'CONFIRMED':       return '✅';
      case 'CONV_CLOSED':     return '🔒';
      case 'MISSION_ACCEPTEE':return '🎉';
      default:                return '🔔';
    }
  }

  logout(): void {
    this.msgService.disconnectGlobalHub();
    this.auth.logout();
  }
}
