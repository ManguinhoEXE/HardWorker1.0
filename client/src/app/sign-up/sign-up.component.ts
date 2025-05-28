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

  // Modelo de formulario de registro
  username: string = '';
  password: string = '';
  firstName: string = '';
  lastName: string = '';

  constructor(
    private authService: AuthService,  // Servicio para registrar usuario
    private router: Router             // Redirección entre rutas
  ) {}

  /**
   * Envía los datos del formulario al backend para registrar un nuevo usuario.
   * Limpia el formulario y redirige al login si es exitoso.
   */
  onSubmit() {
    this.authService.register(this.username, this.password, this.firstName, this.lastName).subscribe(
      (response) => {
        console.log(response);
        // Redirige al formulario de inicio de sesión
        this.router.navigate(['/iniciarsesion']);

        // Limpia el formulario
        this.username = '';
        this.password = '';
        this.firstName = '';
        this.lastName = '';
      },
      (error) => {
        console.log(error);
      }
    );
  }
}
