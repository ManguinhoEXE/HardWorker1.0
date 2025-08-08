import { Component } from '@angular/core';
import { AuthService } from '../Services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})
export class SignUpComponent {

  username: string = '';
  password: string = '';
  firstName: string = '';
  lastName: string = '';

  errors: string[] = [];
  isSubmitting: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}


  private validateForm(): boolean {
    this.errors = [];

    // 1. VALIDACIÓN DE USERNAME
    if (!this.username.trim()) {
      this.errors.push('El nombre de usuario es obligatorio.');
    } else {
      // Formato: Solo letras, números, '_', '.'
      const usernameRegex = /^[a-zA-Z0-9_.]+$/;
      if (!usernameRegex.test(this.username)) {
        this.errors.push('El nombre de usuario solo puede contener letras, números, "_" y "."');
      }
      
      // Longitud: 4-12 caracteres
      if (this.username.length < 4 || this.username.length > 12) {
        this.errors.push('El nombre de usuario debe tener entre 4 y 12 caracteres.');
      }
      
      if (this.username.includes(' ')) {
        this.errors.push('El nombre de usuario no puede contener espacios.');
      }
    }

    // VALIDACIÓN DE PASSWORD
    if (!this.password.trim()) {
      this.errors.push('La contraseña es obligatoria.');
    } else {
      // Longitud mínima: 8 caracteres
      if (this.password.length < 8) {
        this.errors.push('La contraseña debe tener al menos 8 caracteres.');
      }
      
      // mayúscula, minúscula, número, carácter especial
      const hasUpperCase = /[A-Z]/.test(this.password);
      const hasLowerCase = /[a-z]/.test(this.password);
      const hasNumbers = /\d/.test(this.password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(this.password);
      
      if (!hasUpperCase) {
        this.errors.push('La contraseña debe contener al menos una letra mayúscula.');
      }
      if (!hasLowerCase) {
        this.errors.push('La contraseña debe contener al menos una letra minúscula.');
      }
      if (!hasNumbers) {
        this.errors.push('La contraseña debe contener al menos un número.');
      }
      if (!hasSpecialChar) {
        this.errors.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>).');
      }
      
      // No igual al usuario
      if (this.password.toLowerCase() === this.username.toLowerCase()) {
        this.errors.push('La contraseña no puede ser igual al nombre de usuario.');
      }
      
      // No contener datos personales
      if (this.firstName.trim() && this.password.toLowerCase().includes(this.firstName.toLowerCase())) {
        this.errors.push('La contraseña no puede contener tu nombre.');
      }
      if (this.lastName.trim() && this.password.toLowerCase().includes(this.lastName.toLowerCase())) {
        this.errors.push('La contraseña no puede contener tu apellido.');
      }
    }

    // VALIDACIÓN DE PRIMER NOMBRE
    if (!this.firstName.trim()) {
      this.errors.push('El primer nombre es obligatorio.');
    } else {
      // Solo letras y espacios (para nombres compuestos como "José Ángel")
      const nameRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/;
      if (!nameRegex.test(this.firstName)) {
        this.errors.push('El primer nombre solo puede contener letras.');
      }
      
      // Longitud: 2-14 caracteres
      if (this.firstName.trim().length < 2 || this.firstName.trim().length > 14) {
        this.errors.push('El primer nombre debe tener entre 2 y 14 caracteres.');
      }
    }

    // VALIDACIÓN DE PRIMER APELLIDO
    if (!this.lastName.trim()) {
      this.errors.push('El primer apellido es obligatorio.');
    } else {
      // Solo letras y espacios
      const lastNameRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/;
      if (!lastNameRegex.test(this.lastName)) {
        this.errors.push('El primer apellido solo puede contener letras.');
      }
      
      // Longitud: 2-14 caracteres
      if (this.lastName.trim().length < 2 || this.lastName.trim().length > 14) {
        this.errors.push('El primer apellido debe tener entre 2 y 14 caracteres.');
      }
    }

    return this.errors.length === 0;
  }

  onSubmit() {
    this.errors = [];
    
    if (!this.validateForm()) {
      console.log('Errores de validación:', this.errors);
      return; 
    }

    this.isSubmitting = true;

    this.authService.register(
      this.username.trim(), 
      this.password, 
      this.firstName.trim(), 
      this.lastName.trim()
    ).subscribe({
      next: (response) => {
        console.log('Registro exitoso:', response);
        this.router.navigate(['/iniciarsesion']);
        this.clearForm();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.log('Error de registro:', error);
        this.isSubmitting = false;
        
        if (error.status === 400 && error.error?.message) {
          this.errors.push(error.error.message);
        } else if (error.status === 409) {
          this.errors.push('El nombre de usuario ya existe. Por favor, elige otro.');
        } else {
          this.errors.push('Error en el servidor. Por favor, inténtalo de nuevo.');
        }
      }
    });
  }


  private clearForm(): void {
    this.username = '';
    this.password = '';
    this.firstName = '';
    this.lastName = '';
    this.errors = [];
  }

  /**
   * 🔍 MÉTODO PARA VALIDACIÓN EN TIEMPO REAL (OPCIONAL)
   */
  onFieldChange(field: string): void {
    // Limpiar errores relacionados con el campo específico
    switch (field) {
      case 'username':
        this.errors = this.errors.filter(error => 
          !error.includes('nombre de usuario') && !error.includes('espacios')
        );
        break;
      case 'password':
        this.errors = this.errors.filter(error => 
          !error.includes('contraseña') && !error.includes('mayúscula') && 
          !error.includes('minúscula') && !error.includes('número') && 
          !error.includes('especial')
        );
        break;
      case 'firstName':
        this.errors = this.errors.filter(error => !error.includes('primer nombre'));
        break;
      case 'lastName':
        this.errors = this.errors.filter(error => !error.includes('primer apellido'));
        break;
    }
  }
}