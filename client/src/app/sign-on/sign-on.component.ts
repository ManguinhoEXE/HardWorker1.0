import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../Services/auth.service';

@Component({
  selector: 'app-sign-on',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sign-on.component.html',
  styleUrl: './sign-on.component.css'
})
export class SignOnComponent {

  /* ==================== 1. PROPIEDADES DEL FORMULARIO ==================== */
  username: string = '';
  password: string = '';

  /* ==================== 2. PROPIEDADES DE UI Y ESTADO ==================== */
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  /* ==================== 3. GESTIÓN DE AUTENTICACIÓN ==================== */

  onSubmit(): void {
    this.clearMessages();

    if (!this.validateInput()) {
      return;
    }

    this.performLogin();
  }

  private validateInput(): boolean {
    if (!this.username.trim()) {
      this.showError('Por favor, ingrese su nombre de usuario.');
      return false;
    }

    if (!this.password.trim()) {
      this.showError('Por favor, ingrese su contraseña.');
      return false;
    }

    if (this.username.length < 3) {
      this.showError('El nombre de usuario debe tener al menos 3 caracteres.');
      return false;
    }

    if (this.password.length < 6) {
      this.showError('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }

    return true;
  }

  private performLogin(): void {
    this.isLoading = true;

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.handleLoginSuccess(response);
      },
      error: (error) => {
        this.handleLoginError(error);
      }
    });
  }

  private handleLoginSuccess(response: any): void {
    this.isLoading = false;

    if (response.message === 'Inicio de sesión exitoso') {
      console.log('Inicio de sesión exitoso');
      this.clearForm();

      this.isLoading = true;

      this.redirectBasedOnRole();
    } else {
      this.showError('Credenciales inválidas');
    }
  }

  private redirectBasedOnRole(): void {
    this.authService.verifySession().subscribe({
      next: (userData) => {
        console.log(' Verificando rol del usuario:', userData);

        if (userData && userData.role) {
          switch (userData.role) {
            case 'Super':
              console.log(' Usuario Super Admin - Redirigiendo al panel de administración');
              this.router.navigate(['/superadmin']);
              break;

            case 'Admin':
              console.log(' Usuario Admin - Redirigiendo al panel de administración');
              this.router.navigate(['/inicio']);
              break;

              break;

            case 'User':
            default:
              console.log('👤 Usuario regular - Redirigiendo al inicio');
              this.router.navigate(['/inicio']);
              break;

          }
        } else {
          console.log(' No se pudo determinar el rol, redirigiendo al inicio');
          this.router.navigate(['/inicio']);
        }

        this.isLoading = false;

      },
      error: (error) => {
        console.error(' Error verificando sesión después del login:', error);
        this.router.navigate(['/inicio']);
      }
    });
  }

  private handleLoginError(error: any): void {
    this.isLoading = false;
    console.error('Error al iniciar sesión:', error);

    if (error.status === 401) {
      this.showError('Usuario o contraseña incorrectos.');
    } else if (error.status === 0) {
      this.showError('No se puede conectar al servidor. Verifique su conexión.');
    } else if (error.error?.message) {
      this.showError(error.error.message);
    } else {
      this.showError('Error al iniciar sesión. Por favor, inténtelo de nuevo.');
    }
  }

  /* ==================== 4. UTILIDADES DE UI ==================== */
  private showError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }

  private clearMessages(): void {
    this.errorMessage = '';
  }

  private clearForm(): void {
    this.username = '';
    this.password = '';
  }

  /* ==================== 6. MÉTODOS DE CONVENIENCIA ==================== */

  isFormValid(): boolean {
    return this.username.trim().length >= 3 &&
      this.password.trim().length >= 6;
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.isFormValid() && !this.isLoading) {
      this.onSubmit();
    }
  }

  onInputChange(): void {
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }
}