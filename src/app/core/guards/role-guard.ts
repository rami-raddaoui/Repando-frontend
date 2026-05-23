import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth';
import { UserRole } from '../models/models';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredRole: UserRole = route.data['role'];
  if (auth.currentUser()?.role === requiredRole) return true;
  router.navigate(['/']);
  return false;
};
