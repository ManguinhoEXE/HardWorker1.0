import { Component } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { hourService } from '../Services/hour.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-home',
  imports: [NavComponent,CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  template: `
    <app-nav></app-nav>
    <div class="content">Contenido Home</div>
  `,
  styleUrl: './home.component.css'
})
export class HomeComponent {

  hours: number = 0;

  constructor (private hourService: hourService) {}

  addHour() {
    if (this.hours <= 0) {
      alert('Por favor, ingrese un número válido de horas.');
      return;
    }

    this.hourService.addHour(this.hours).subscribe(
      (response) => {
        alert(response.message); // Muestra el mensaje del backend
        this.hours = 0; // Reinicia el campo de entrada
      },
      (error) => {
        console.error('Error al añadir horas:', error);
        alert('Ocurrió un error al añadir horas.');
      }
    );
  }
}
