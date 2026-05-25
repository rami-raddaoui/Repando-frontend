import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss'
})
export class ContactComponent {
  contactForm: FormGroup;
  submitted = signal(false);
  error = signal('');
  success = signal('');

  constructor(private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      message: ['', Validators.required]
    });
  }

  submit() {
    this.submitted.set(true);
    this.error.set('');
    if (this.contactForm.invalid) return;
    // Simulate success (no backend integration)
    this.success.set('Votre message a bien été envoyé. Nous vous répondrons rapidement.');
    this.contactForm.reset();
    setTimeout(() => this.success.set(''), 5000);
  }
}

