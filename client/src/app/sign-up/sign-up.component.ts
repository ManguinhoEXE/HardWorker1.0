import { Component } from '@angular/core';
import { AuthService } from '../Services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [ CommonModule, FormsModule, RouterModule ],
  providers: [ provideHttpClient(withInterceptorsFromDi()) ],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})
export class SignUpComponent {
  username: string = '';
  password: string = '';

  constructor(private authService: AuthService) {}

  onSubmit() {
    this.authService.register(this.username, this.password).subscribe(
      (response) => {
        console.log(response);
        alert('Registration successful');
      },
      (error) => {
        console.log(error);
        alert('An error occurred while registering');
});
  }
}
