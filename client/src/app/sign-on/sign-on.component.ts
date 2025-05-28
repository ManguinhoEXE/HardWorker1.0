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

  // Modelo de datos para el formulario de login
  username: string = '';
  password: string = '';

  constructor(
    private authService: AuthService, // Servicio de autenticación
    private router: Router            // Permite redirección entre rutas
  ) {}

  /**
   * Envía las credenciales al backend al hacer submit del formulario.
   * Si son válidas, redirige al usuario a /inicio.
   */
  onSubmit() {
    this.authService.login(this.username, this.password).subscribe(
      (response) => {
        if (response.message === 'Inicio de sesión exitoso') {
          console.log('Inicio de sesión exitoso');
          this.router.navigate(['/inicio']); // Redirige a la página principal
        } else {
          alert('Credenciales inválidas');
        }
      },
      (error) => {
        console.error('Error al iniciar sesión:', error);
        alert('Error al iniciar sesión. Por favor, inténtelo de nuevo.');
      }
    );
  }
}
