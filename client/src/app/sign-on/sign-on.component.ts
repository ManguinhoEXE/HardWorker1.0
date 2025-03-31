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
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
  
        if (response.success) {
          alert('Inicio de sesión exitoso');
  
          // ✅ Limpiar los campos antes de redirigir
          this.username = ''; 
          this.password = ''; 
  
          // ✅ Redirección después de un breve delay (opcional)
          setTimeout(() => {
            this.router.navigate(['/inicio']);
          }, 500);  
        } else {
          alert('Credenciales incorrectas');
        }
      },
      error: (error) => {
        console.error('Error en el inicio de sesión:', error);
        alert('Ocurrió un error durante el inicio de sesión');
      }
    });
  }
  
}
