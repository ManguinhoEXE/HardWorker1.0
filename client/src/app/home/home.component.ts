import { Component, OnInit } from '@angular/core';
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
export class HomeComponent implements OnInit {

  hours: number = 0;
  hourList: any[] = [];
  successMessage: string = '';
  errorMessage: string = '';
  startDate: string = '';
  endDate: string = '';
  reason: string = '';

  constructor (private hourService: hourService) {}

  ngOnInit() {
    this.getHours();
  }

   // Método para formatear la entrada de fecha y hora
    formatDateTime(event: any): void {
    let input = event.target.value.replace(/\D/g, ''); // Elimina caracteres no numéricos
    if (input.length >= 2) input = input.slice(0, 2) + '/' + input.slice(2);
    if (input.length >= 5) input = input.slice(0, 5) + '/' + input.slice(5);
    if (input.length >= 10) input = input.slice(0, 8) + ' ' + input.slice(8);
    if (input.length >= 13) input = input.slice(0, 11) + ':' + input.slice(11);
    if (input.length >= 16) input = input.slice(0, 14);
    event.target.value = input.slice(0, 14); // Limita el tamaño máximo
  }

  addHour() {
    if (this.hours <= 0) {
      this.errorMessage = ('Por favor, ingrese un número válido de horas.');
      return;
    }

    this.hourService.addHour(this.hours).subscribe(
      (response) => {
        this.successMessage = (response.message); // Muestra el mensaje del backend
        this.hours = 0; // Reinicia el campo de entrada
        this.getHours(); // Actualiza la lista de horas
      },
      (error) => {
        console.error('Error al añadir horas:', error);
        this.errorMessage = ('Ocurrió un error al añadir horas.');
      }
    );
  }

  getHours() {
    this.hourService.getHours().subscribe(
      (response) => {
        this.hourList = response.reverse();
        console.log('Horas obtenidas:', this.hourList);
      },
      (error) => {
        console.error('Error al obtener horas:', error);
        this.errorMessage = ('Ocurrió un error al obtener horas.');
      }
    );
  }



}
