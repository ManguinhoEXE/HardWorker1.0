import { Component } from '@angular/core';
import { AuthService } from '../Services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';

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

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    this.authService.register(this.username, this.password).subscribe(
      (response) => {
        console.log(response);
        alert('Registration successful');
        this.router.navigate(['/iniciarsesion']);
        this.username = ''; // clean the form
        this.password = ''; 
      },
      (error) => {
        console.log(error);
        alert('An error occurred while registering');
      }
    );
  }
}