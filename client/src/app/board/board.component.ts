import { Component } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompensatoryService } from '../Services/compensatory.service';


export interface CompensatoryRequest {
  id: number;
  firstName?: string; // Opcional si a veces no viene (aunque debería para el board)
  lastName?: string;  // Opcional
  reason: string;
  from: string | Date; // El backend ahora envía Date, pero podría ser string tras JSON.parse
  to: string | Date;
  status: 'Pendiente' | 'Aceptada' | 'En curso' | 'Rechazada'; // Estados posibles
  userId?: number; // Opcional si no siempre se usa en este componente
}
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [NavComponent, CommonModule, FormsModule, RouterModule],
  templateUrl: './board.component.html',
  styleUrl: './board.component.css'
})
export class BoardComponent {

  allRequests: CompensatoryRequest[] = []; // Almacena todas las solicitudes no finalizadas
  inProgressRequests: CompensatoryRequest[] = [];
  acceptedRequests: CompensatoryRequest[] = [];
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(private compensatoryService: CompensatoryService) { }

  /**
   * carga las solicitudes de compensatorio al renderizar el componente.
   */
  ngOnInit(): void {
    this.loadCompensatoryRequests();
  }

  /**
   * Obtiene todas las solicitudes de compensatorio desde el backend.
   */
  loadCompensatoryRequests(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.compensatoryService.getAllRequests().subscribe(
      (data: CompensatoryRequest[]) => {
        this.allRequests = data; // Guardar todos los datos recibidos (ya filtrados por el backend)

        // Filtrar en las listas específicas
        this.inProgressRequests = this.allRequests.filter(request => request.status === 'En curso');
        this.acceptedRequests = this.allRequests.filter(request => request.status === 'Aceptada');

        // console.log('All requests:', this.allRequests);
        // console.log('In Progress requests:', this.inProgressRequests);
        // console.log('Accepted requests:', this.acceptedRequests);
        this.isLoading = false;
      },
      (error) => {
        console.error('Error al cargar las solicitudes:', error);
        this.errorMessage = 'No se pudieron cargar las solicitudes de compensatorio. Intente más tarde.';
        this.isLoading = false;
      }
    );
  }

  // Opcional: Método para refrescar manualmente
  refreshRequests(): void {
    this.loadCompensatoryRequests();
  }
}
