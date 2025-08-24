import { Component, OnInit } from '@angular/core';
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
export class SignUpComponent implements OnInit {

  /* ==================== PROPIEDADES DEL FORMULARIO ==================== */
  username: string = '';
  password: string = '';
  firstName: string = '';
  lastName: string = '';

  /* ==================== PROPIEDADES DE UI Y ESTADO ==================== */
  errors: string[] = [];
  isSubmitting: boolean = false;
  isCheckingAccess: boolean = true;
  accessDeniedMessage: string = '';
  successMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    setTimeout(() => {
      this.checkUserAuthorization();
    }, 200);
  }

  /* ==================== VERIFICACIÓN DE AUTORIZACIÓN SIMPLIFICADA ==================== */

  private checkUserAuthorization(): void {
    this.isCheckingAccess = true;
    this.accessDeniedMessage = '';

    console.log('Verificando autorización desde cookies...');

    const currentRole = this.authService.getCurrentUserRole();
    console.log('Rol del usuario:', currentRole);

    if (!currentRole || currentRole === 'No autenticado') {
      this.showAccessDenied('Token inválido. Por favor, inicia sesión nuevamente.');
    } else if (currentRole !== 'Super') {
      this.showAccessDenied(`Solo usuarios con rol "Super" pueden crear usuarios. Tu rol actual es: "${currentRole}".`);
    } else {
      this.clearAccessMessages();
      console.log('Usuario con rol Super autorizado');
    }

    this.isCheckingAccess = false;
  }

  /* ==================== REGISTRO DE USUARIO ==================== */

  onSubmit() {
    console.log('Iniciando proceso de registro...');

    const currentRole = this.authService.getCurrentUserRole();
    if (currentRole !== 'Super') {
      this.showAccessDenied('No tienes permisos para crear usuarios.');
      return;
    }

    this.errors = [];

    if (!this.validateForm()) {
      console.log('Errores de validación:', this.errors);
      return;
    }

    this.performRegistration();
  }

  private performRegistration(): void {
    this.isSubmitting = true;
    console.log('Enviando petición de registro...');

    this.authService.register(
      this.username.trim(),
      this.password,
      this.firstName.trim(),
      this.lastName.trim(),
      null
    ).subscribe({
      next: (response) => {
        console.log('Usuario creado exitosamente:', response);
        this.handleRegistrationSuccess(response);
      },
      error: (error) => {
        console.error('Error al crear usuario:', error);
        this.handleRegistrationError(error);
      }
    });
  }

  private handleRegistrationSuccess(response: any): void {
    this.clearForm();
    this.isSubmitting = false;

    this.router.navigate(['/superadmin']);
  }

  private handleRegistrationError(error: any): void {
    this.isSubmitting = false;

    if (error.status === 401) {
      this.showAccessDenied('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      setTimeout(() => this.router.navigate(['/iniciarsesion']), 3000);
      return;
    }

    if (error.status === 403) {
      this.showAccessDenied('No tienes permisos suficientes para crear usuarios.');
      return;
    }

    if (error.status === 400 && error.error?.message) {
      this.errors.push(error.error.message);
    } else if (error.status === 409) {
      this.errors.push('El nombre de usuario ya existe. Por favor, elige otro.');
    } else if (error.status === 500) {
      this.errors.push('Error interno del servidor. Por favor, inténtalo más tarde.');
    } else if (error.status === 0) {
      this.errors.push('No se puede conectar al servidor. Verifica tu conexión.');
    } else {
      this.errors.push(`Error inesperado (${error.status}). Por favor, inténtalo de nuevo.`);
    }
  }

  /* ==================== MÉTODOS DE MENSAJES SIMPLIFICADOS ==================== */

  private showAccessDenied(message: string): void {
    this.accessDeniedMessage = message;
    this.successMessage = '';
    this.clearErrors();

    setTimeout(() => {
      this.accessDeniedMessage = '';
    }, 10000);
  }

  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.accessDeniedMessage = '';
    this.clearErrors();

    setTimeout(() => {
      this.successMessage = '';
    }, 5000);
  }

  private clearAccessMessages(): void {
    this.accessDeniedMessage = '';
    this.successMessage = '';
  }

  /* ==================== MÉTODOS PÚBLICOS USADOS EN HTML ==================== */

  getCurrentUserRole(): string {
    const role = this.authService.getCurrentUserRole();
    return role || 'No autenticado';
  }

  refreshAuthorization(): void {
    console.log('Forzando re-verificación...');
    this.clearAccessMessages();
    this.checkUserAuthorization();
  }

  goToLogin(): void {
    this.router.navigate(['/iniciarsesion']);
  }

  goToSuperAdmin(): void {
    this.router.navigate(['/superadmin']);
  }

  /* ==================== VALIDACIONES ==================== */

  private validateForm(): boolean {
    this.errors = [];

    if (!this.username.trim()) {
      this.errors.push('El nombre de usuario es obligatorio.');
    } else {
      const usernameRegex = /^[a-zA-Z0-9_.]+$/;
      if (!usernameRegex.test(this.username)) {
        this.errors.push('El nombre de usuario solo puede contener letras, números, "_" y "."');
      }
      if (this.username.length < 4 || this.username.length > 12) {
        this.errors.push('El nombre de usuario debe tener entre 4 y 12 caracteres.');
      }
    }

    if (!this.password.trim()) {
      this.errors.push('La contraseña es obligatoria.');
    } else {
      if (this.password.length < 8) {
        this.errors.push('La contraseña debe tener al menos 8 caracteres.');
      }
      if (!/[A-Z]/.test(this.password)) {
        this.errors.push('La contraseña debe contener al menos una letra mayúscula.');
      }
      if (!/[a-z]/.test(this.password)) {
        this.errors.push('La contraseña debe contener al menos una letra minúscula.');
      }
      if (!/\d/.test(this.password)) {
        this.errors.push('La contraseña debe contener al menos un número.');
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(this.password)) {
        this.errors.push('La contraseña debe contener al menos un carácter especial.');
      }
    }

    if (!this.firstName.trim()) {
      this.errors.push('El primer nombre es obligatorio.');
    } else if (this.firstName.trim().length < 2 || this.firstName.trim().length > 14) {
      this.errors.push('El primer nombre debe tener entre 2 y 14 caracteres.');
    }

    if (!this.lastName.trim()) {
      this.errors.push('El primer apellido es obligatorio.');
    } else if (this.lastName.trim().length < 2 || this.lastName.trim().length > 14) {
      this.errors.push('El primer apellido debe tener entre 2 y 14 caracteres.');
    }

    return this.errors.length === 0;
  }

  private clearForm(): void {
    this.username = '';
    this.password = '';
    this.firstName = '';
    this.lastName = '';
    this.errors = [];
  }

  private clearErrors(): void {
    this.errors = [];
  }

  onFieldChange(field: string): void {
  }
}