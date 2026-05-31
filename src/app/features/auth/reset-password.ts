import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  token = '';
  loading = false;
  error = '';
  success = false;
  showPassword = signal(false);
  showConfirm  = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      password:        ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.matchValidator });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  matchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  submit(): void {
    if (this.form.invalid || !this.token) return;
    this.loading = true;
    this.error   = '';
    this.auth.resetPassword(this.token, this.form.value.password).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Lien invalide ou expiré.';
      }
    });
  }
}

