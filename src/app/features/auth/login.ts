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
  mode = signal<'login' | 'register' | 'choose-role' | 'forgot-password'>('login');
  loading = false;
  error = '';
  success = '';
  isCompteDesactive = false;

  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotForm: FormGroup;

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

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  get isLogin()         { return this.mode() === 'login'; }
  get isRegister()      { return this.mode() === 'register'; }
  get isChooseRole()    { return this.mode() === 'choose-role'; }
  get isForgotPassword(){ return this.mode() === 'forgot-password'; }

  switchMode(m: 'login' | 'register' | 'choose-role' | 'forgot-password') {
    this.mode.set(m);
    this.error = '';
    this.success = '';
    this.isCompteDesactive = false;
  }

  submitLogin(): void {
    if (this.loginForm.invalid) return;
    this.loading = true;
    this.error = '';
    this.isCompteDesactive = false;
    this.auth.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.role === UserRole.REPARATEUR) this.router.navigate(['/dashboard-reparateur']);
        else if (res.role === UserRole.ADMIN) this.router.navigate(['/admin']);
        else this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        const msg: string = err?.message ?? '';
        if (msg.includes('COMPTE_DESACTIVE')) {
          this.isCompteDesactive = true;
          this.error = '';
        } else {
          this.error = msg || 'Email ou mot de passe incorrect.';
        }
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

  submitForgotPassword(): void {
    if (this.forgotForm.invalid) return;
    this.loading = true;
    this.error = '';
    this.success = '';
    this.auth.forgotPassword(this.forgotForm.value.email).subscribe({
      next: () => {
        this.loading = false;
        this.success =
          '📬 Si un compte existe pour cet email, vous recevrez un lien de réinitialisation dans quelques minutes. Pensez à vérifier vos spams.';
      },
      error: () => {
        // Même message pour ne pas révéler si l'email existe
        this.loading = false;
        this.success =
          '📬 Si un compte existe pour cet email, vous recevrez un lien de réinitialisation dans quelques minutes. Pensez à vérifier vos spams.';
      }
    });
  }
}
