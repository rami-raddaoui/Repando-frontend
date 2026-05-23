import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { UserRole } from './core/models/models';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home').then(m => m.HomeComponent) },
  { path: 'connexion', loadComponent: () => import('./features/auth/login').then(m => m.LoginComponent) },
  { path: 'recherche', loadComponent: () => import('./features/search/search').then(m => m.SearchComponent) },
  {
    path: 'reparateur/:id',
    loadComponent: () => import('./features/reparateur/profil-reparateur').then(m => m.ProfilReparateurComponent)
  },
  {
    path: 'inscription-reparateur',
    loadComponent: () => import('./features/reparateur/reparateur-inscription').then(m => m.ReparateurInscriptionComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard-client/dashboard-client').then(m => m.DashboardClientComponent)
  },
  {
    path: 'dashboard-reparateur',
    canActivate: [authGuard, roleGuard],
    data: { role: UserRole.REPARATEUR },
    loadComponent: () => import('./features/dashboard-reparateur/dashboard-reparateur').then(m => m.DashboardReparateurComponent)
  },
  {
    path: 'messagerie',
    canActivate: [authGuard],
    loadComponent: () => import('./features/messagerie/messagerie').then(m => m.MessagerieComponent)
  },
  {
    path: 'messagerie/:matchingId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/messagerie/messagerie').then(m => m.MessagerieComponent)
  },
  {
    path: 'mes-demandes',
    canActivate: [authGuard],
    loadComponent: () => import('./features/demandes/mes-demandes').then(m => m.MesDemandesComponent)
  },
  {
    path: 'creer-demande',
    canActivate: [authGuard],
    loadComponent: () => import('./features/demandes/creer-demande').then(m => m.CreerDemandeComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { role: UserRole.ADMIN },
    loadComponent: () => import('./features/admin/admin').then(m => m.AdminComponent)
  },
  { path: '**', redirectTo: '' }
];
