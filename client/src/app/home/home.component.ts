import { Component, OnInit } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { hourService } from '../Services/hour.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompensatoryService } from '../Services/compensatory.service';
import { trigger, state, style, animate, transition } from '@angular/animations';



@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NavComponent, CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'], // Corregido a styleUrls

  animations: [ // Definir animaciones
    trigger('fadeInOut', [
      transition(':enter', [ // Alias para void => *
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [ // Alias para * => void
        animate('300ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(-50px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateY(-50px)', opacity: 0 }))
      ]),
    ]),
  ]
})
export class HomeComponent implements OnInit {
  // Variables para registrar horas
  hours: number = 0;
  description: string = '';
  hourList: any[] = [];
  totalAcceptedHours: number = 0;

  // Mensajes para el usuario
  successMessage: string = '';
  errorMessage: string = '';

  // Variables para solicitud de compensatorio
  startDate: string = '';
  endDate: string = '';
  reason: string = '';
  requests: any[] = [];

  showModal: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private hourService: hourService,
    private compensatoryService: CompensatoryService,
  ) { }

  /**
   * Inicializa el componente cargando horas y solicitudes.
   */
  ngOnInit() {
    this.getHours();
    this.getRequests();

    this.hourService.refreshTotal();
    this.hourService.totalAccepted$.subscribe(
      total => this.totalAcceptedHours = total
    );

  }

  openModal(title: string, message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  /**
   * Envía una nueva entrada de horas al backend.
   */
  addHour() {
    if (this.hours <= 0) {
      console.log('Por favor, ingrese un número válido de horas.');
      this.openModal('Error de Validación', 'Por favor, ingrese un número válido de horas.', 'error');
      return;
    }

    if (this.hours > 8) {
      console.log('No se pueden registrar más de 8 horas en una sola entrada.');
      this.openModal('Error de Validación', 'No se pueden registrar más de 8 horas en una sola entrada.', 'error');
      return;
    }

    if (!this.description.trim()) {
      console.log('Por favor, ingrese una descripción.');
      this.openModal('Error de Validación', 'Por favor, ingrese una descripción.', 'error');
      return;
    }

    this.hourService.addHour(this.hours, this.description).subscribe(
      (response) => {
        console.log('Horas añadidas:', response);
        this.openModal('Éxito', response.message || 'Horas añadidas correctamente.', 'success');
        this.hours = 0;
        this.description = '';
        this.getHours();
      },
      (error) => {
        console.error('Error al añadir horas:', error);
        this.errorMessage = 'Ocurrió un error al añadir horas.';
        this.openModal('Error', error.error?.message || 'Ocurrió un error al añadir horas.', 'error');

      }
    );
  }

  /**
   * Obtiene las horas registradas del backend.
   */
  getHours() {
    this.hourService.getHours().subscribe(
      (response) => {
        this.hourList = response.reverse(); // Se invierte para mostrar las más recientes primero
        console.log('Horas obtenidas:', this.hourList);
      },
      (error) => {
        console.error('Error al obtener horas:', error);
      }
    );
  }

  /**
   * Envía una nueva solicitud de compensatorio.
   */
  addRequest(): void {
    // limpia mensajes previos
    this.errorMessage = '';
    this.successMessage = '';

    // valida campos
    if (!this.startDate || !this.endDate || !this.reason) {
      console.log('Por favor, complete todos los campos.');
      this.openModal('Error de Validación', 'Por favor, complete todos los campos para la solicitud.', 'error');
      return;
    }

    if (this.startDate >= this.endDate) {
      console.log('La fecha de inicio debe ser anterior a la fecha de fin.');
      this.openModal('Error de Validación', 'La fecha de inicio debe ser anterior a la fecha de fin.', 'error');
      return;
    }

    const fromDate = new Date(this.startDate);
    const toDate = new Date(this.endDate);

    // NUEVA VALIDACIÓN: Los minutos deben ser iguales para horas completas
    if (fromDate.getMinutes() !== toDate.getMinutes()) {
      this.openModal(
        'Error de Horas',
        'La solicitud deben ser horas completas. Los minutos de la hora de inicio y fin deben coincidir (ej. de 09:15 a 11:15).',
        'error'
      );
      return;
    }

    // payload: enviamos strings ISO parciales “yyyy-MM-ddTHH:mm”
    const payload = {
      from: this.startDate,
      to: this.endDate,
      reason: this.reason
    };
    console.log('addRequest → payload:', payload);

    this.compensatoryService.addRequest(payload).subscribe({
      next: (res: any) => {
        console.log('Solicitud OK:', res);
        this.openModal('Éxito', res.message || 'Solicitud enviada correctamente.', 'success');
        this.clearForm();
        this.getRequests();
      },
      error: (err: any) => {
        console.error('Error al enviar solicitud:', err);
        this.openModal('Error', `Error ${err.status}: ${err.error?.message || err.message}`, 'error');
        setTimeout(() => (this.errorMessage = ''), 5000);
      }
    });
  }


  /**
   * Verifica si una cadena representa una fecha en formato dd/MM/yy HH:mm.
   */
  isValidDate(date: string): boolean {
    const regex = /^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}$/;
    return regex.test(date);
  }

  /**
   * Limpia el formulario de solicitud de compensatorio.
   */
  clearForm(): void {
    this.startDate = '';
    this.endDate = '';
    this.reason = '';
  }



  /**
   * Obtiene todas las solicitudes de compensatorio del usuario.
   */
  getRequests() {
    this.compensatoryService.getRequests().subscribe(
      (response) => {
        this.requests = response.map((request: { from: string; to: string; currentHour: string }) => ({
          ...request,
          from: new Date(request.from).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
          to: new Date(request.to).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
          currentHour: new Date(request.currentHour).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })
        })).reverse();

        console.log('Solicitudes obtenidas:', this.requests);
      },
      (error) => {
        console.error('Error al obtener solicitudes:', error);
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    );
  }

}
