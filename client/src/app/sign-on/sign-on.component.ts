import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../Services/auth.service';

@Component({
  selector: 'app-sign-on',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sign-on.component.html',
  styleUrl: './sign-on.component.css'
})
export class SignOnComponent {

  username: string = '';
  password: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    this.authService.login(this.username, this.password).subscribe(
      (response) => {
        if (response.message === 'Inicio de sesión exitoso') {
          console.log('Inicio de sesión exitoso');
          // Redirige al componente Home
          this.router.navigate(['/inicio']);
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
