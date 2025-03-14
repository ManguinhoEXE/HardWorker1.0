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
        console.log(response);
        if (response.success) {
          alert('Inicio de sesión exitoso');
          this.router.navigate(['/inicio']);
        } else {
          alert('Credenciales incorrectas');
        }
        this.username = ''; // clean the form
        this.password = ''; 
      },
      (error) => {
        console.log(error);
        alert('Ocurrió un error durante el inicio de sesión');
      }
    );
  }

}
