import { Component, OnInit } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { hourService } from '../Services/hour.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompensatoryService } from '../Services/compensatory.service';


@Component({
  selector: 'app-home',
  imports: [NavComponent, CommonModule, FormsModule, RouterModule],
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
  requests: any[] = [];

  constructor(private hourService: hourService, private compensatoryService: CompensatoryService) { }

  ngOnInit() {
    this.getHours();
    this.getRequests();
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

  // Método para enviar una solicitud de compensatorio
  addRequest(): void {
    if (!this.startDate || !this.endDate || !this.reason) {
      this.errorMessage = 'Por favor, complete todos los campos.';
      return;
    }
  
    // Validar el formato de las fechas
    if (!this.isValidDate(this.startDate) || !this.isValidDate(this.endDate)) {
      this.errorMessage = 'El formato de las fechas es incorrecto. Use dd/MM/yy HH:mm.';
      return;
    }
  
    // Convertir las fechas ingresadas al formato ISO 8601 sin desfase de zona horaria
    const [day, month, year, hour, minute] = this.startDate.match(/\d+/g)!.map(Number);
    const startDate = `${year + 2000}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  
    const [dayEnd, monthEnd, yearEnd, hourEnd, minuteEnd] = this.endDate.match(/\d+/g)!.map(Number);
    const endDate = `${yearEnd + 2000}-${String(monthEnd).padStart(2, '0')}-${String(dayEnd).padStart(2, '0')}T${String(hourEnd).padStart(2, '0')}:${String(minuteEnd).padStart(2, '0')}:00`;
  
    const requestData = {
      from: startDate,
      to: endDate,
      reason: this.reason,
    };
  
    console.log('Datos enviados al backend:', requestData);
  
    this.compensatoryService.addRequest(requestData).subscribe(
      (response) => {
        console.log('Respuesta del backend:', response);
        this.successMessage = response.message; // Mensaje del backend
        this.clearForm(); // Limpia el formulario después de enviar
        setTimeout(() => (this.successMessage = ''), 3000); // Limpia el mensaje después de 3 segundos
        this.getRequests(); // Actualiza la lista de solicitudes
      },
      (error) => {
        console.error('Error al enviar la solicitud:', error);
        this.errorMessage = error.error?.message || 'Ocurrió un error al enviar la solicitud.';
        setTimeout(() => (this.errorMessage = ''), 3000); // Limpia el mensaje después de 3 segundos
      }
    );
  }

  formatDateTime(event: any): void {
    let input = event.target.value.replace(/\D/g, ''); // Elimina caracteres no numéricos
    if (input.length >= 2) input = input.slice(0, 2) + '/' + input.slice(2);
    if (input.length >= 5) input = input.slice(0, 5) + '/' + input.slice(5);
    if (input.length >= 8) input = input.slice(0, 8) + ' ' + input.slice(8);
    if (input.length >= 11) input = input.slice(0, 11) + ':' + input.slice(11);
    event.target.value = input.slice(0, 14); // Limita el tamaño máximo
  }

  // Método para validar el formato de la fecha
  isValidDate(date: string): boolean {
    const regex = /^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}$/; // Formato dd/MM/yy HH:mm
    return regex.test(date);
  }

  // Método para limpiar el formulario
  clearForm(): void {
    this.startDate = '';
    this.endDate = '';
    this.reason = '';
  }


  // Método para obtener las solicitudes de compensatorios
  getRequests() {
    this.compensatoryService.getRequests().subscribe(
      (response) => {
        this.requests = response.map((request: { from: string; to: string; currentHour: string }) => ({
          ...request,
          from: new Date(request.from).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
          to: new Date(request.to).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
          currentHour: new Date(request.currentHour).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        }))
        .reverse();
        console.log('Solicitudes obtenidas:', this.requests);
      },
      (error) => {
        console.error('Error al obtener solicitudes:', error);
        this.errorMessage = 'Ocurrió un error al obtener las solicitudes.';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    );
  }



}
