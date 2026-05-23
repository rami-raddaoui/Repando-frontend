import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { UserRole } from '../../core/models/models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  mode = signal<'login' | 'register' | 'choose-role'>('login');
  loading = false;
  error = '';
  success = '';

  loginForm: FormGroup;
  registerForm: FormGroup;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    this.registerForm = this.fb.group({
      prenom: ['', Validators.required],
      nom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  get isLogin() { return this.mode() === 'login'; }
  get isRegister() { return this.mode() === 'register'; }
  get isChooseRole() { return this.mode() === 'choose-role'; }

  switchMode(m: 'login' | 'register' | 'choose-role') {
    this.mode.set(m);
    this.error = '';
    this.success = '';
  }

  submitLogin(): void {
    if (this.loginForm.invalid) return;
    this.loading = true;
    this.error = '';
    this.auth.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.role === UserRole.REPARATEUR) this.router.navigate(['/dashboard-reparateur']);
        else if (res.role === UserRole.ADMIN) this.router.navigate(['/admin']);
        else this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message ?? 'Email ou mot de passe incorrect.';
      }
    });
  }

  submitRegister(): void {
    if (this.registerForm.invalid) return;
    this.loading = true;
    this.error = '';
    const { confirmPassword, ...data } = this.registerForm.value;
    this.auth.register({ ...data, role: UserRole.CLIENT }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message ?? 'Erreur lors de l\'inscription.';
      }
    });
  }
}
