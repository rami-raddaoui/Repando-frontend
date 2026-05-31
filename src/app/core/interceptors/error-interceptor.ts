import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { ToastService } from '../services/toast';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast  = inject(ToastService);
  const auth   = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Log discret en console (jamais visible par l'utilisateur final dans l'UI)
      console.error(`[HTTP ${err.status}] ${req.method} ${req.url}`, err);

      // Ne pas afficher de toast pour les requêtes silencieuses (polling, etc.)
      const silent = req.headers.has('X-Silent');
      if (silent) return throwError(() => err);

      switch (err.status) {
        case 0:
          // Serveur injoignable / pas de réseau
          toast.error('Impossible de contacter le serveur. Vérifiez votre connexion.');
          break;

        case 400: {
          // Erreur métier — le backend retourne un message lisible
          const msg = err.error?.error ?? err.error?.message ?? 'Données invalides.';
          // Certains messages métier sont gérés localement (ex: COMPTE_VERROUILLE) — on les laisse passer
          if (!msg.includes(':')) toast.error(msg);
          break;
        }

        case 401:
          // Token expiré ou invalide → déconnexion propre
          if (auth.isLoggedIn()) {
            auth.logout();
            toast.warning('Votre session a expiré. Veuillez vous reconnecter.');
            router.navigate(['/login']);
          }
          break;

        case 403:
          toast.error('Vous n\'avez pas les permissions pour effectuer cette action.');
          break;

        case 404:
          // Souvent géré localement dans le composant — on ne spamme pas de toast
          break;

        case 409:
          toast.error(err.error?.error ?? 'Conflit de données.');
          break;

        case 429:
          toast.warning('Trop de tentatives. Veuillez patienter quelques instants.');
          break;

        case 500:
        case 502:
        case 503:
        default:
          toast.error('Une erreur est survenue. Réessayez dans quelques instants.');
          break;
      }

      return throwError(() => err);
    })
  );
};

