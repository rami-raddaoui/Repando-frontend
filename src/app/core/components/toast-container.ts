import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast toast--{{ toast.type }}"
          role="alert"
          (click)="toastService.dismiss(toast.id)"
        >
          <span class="toast__icon">{{ icons[toast.type] }}</span>
          <span class="toast__message">{{ toast.message }}</span>
          <button class="toast__close" aria-label="Fermer">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 420px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,.15);
      font-size: 0.9rem;
      line-height: 1.4;
      cursor: pointer;
      pointer-events: all;
      animation: toast-in 0.25s ease;
      color: #fff;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .toast--success { background: #059669; }
    .toast--error   { background: #dc2626; }
    .toast--warning { background: #d97706; color: #fff; }
    .toast--info    { background: #0f172a; }

    .toast__icon    { font-size: 1.1rem; flex-shrink: 0; margin-top: 0.05rem; }
    .toast__message { flex: 1; }
    .toast__close   {
      background: none; border: none; color: inherit;
      opacity: 0.7; cursor: pointer; padding: 0;
      font-size: 0.85rem; flex-shrink: 0;
    }
    .toast__close:hover { opacity: 1; }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  readonly icons: Record<string, string> = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ'
  };
}

