import { Component, OnInit } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompensatoryService } from '../Services/compensatory.service';
import { AuthService } from '../Services/auth.service';
import { CompensatoryRequest, AdminCompensatoryRequest } from '../Interfaces';



@Component({
  selector: 'app-board',
  standalone: true,
  imports: [ CommonModule, FormsModule, RouterModule],
  templateUrl: './board.component.html',
  styleUrl: './board.component.css'
})
export class BoardComponent implements OnInit {

  /**
   * ==================== 2. PROPIEDADES ====================
   */

  // 2.1 Estado general de la aplicación
  isLoading: boolean = false;
  errorMessage: string | null = null;
  isAdmin: boolean = false;

  // 2.2 Propiedades para vista de usuario regular
  allRequests: CompensatoryRequest[] = [];
  inProgressRequests: CompensatoryRequest[] = [];
  acceptedRequests: CompensatoryRequest[] = [];
  
  // 2.3 Propiedades para vista de administrador
  adminRequests: AdminCompensatoryRequest[] = [];
  filteredRequests: AdminCompensatoryRequest[] = [];

  // 2.4 Filtros de administrador
  userFilter: string = '';
  statusFilter: string = '';
  dateFromFilter: string = '';
  dateToFilter: string = '';
  dynamicStatusFilter: string = '';

  /**
   * ==================== 3. CICLO DE VIDA ====================
   */
  constructor(
    private compensatoryService: CompensatoryService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Verificar la sesión directamente desde el backend
    this.verifySessionFromBackend();
  }

  /**
   * ==================== 4. AUTENTICACIÓN Y SESIÓN ====================
   */

  /**
   * Verifica la sesión directamente desde el backend y carga los datos según el rol
   */
  private verifySessionFromBackend(): void {
    this.authService.verifySession().subscribe({
      next: (userData: any) => {
        // Determinar rol de usuario
        if (userData && userData.role) {
          this.isAdmin = userData.role === 'Admin';
          
          // Cargar vista correspondiente según rol
          if (this.isAdmin) {
            this.loadAdminRequests();
          } else {
            this.loadCompensatoryRequests();
          }
        } else {
          // Por defecto, cargar vista de usuario regular
          this.isAdmin = false;
          this.loadCompensatoryRequests();
        }
      },
      error: () => {
        // En caso de error, mostrar vista de usuario regular
        this.isAdmin = false;
        this.loadCompensatoryRequests();
      }
    });
  }

  /**
   * ==================== 5. CARGA DE DATOS ====================
   */

  /**
   * Carga todas las solicitudes para vista de administrador
   */
  loadAdminRequests(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.compensatoryService.getAllHistory().subscribe({
      next: (response: any) => {
        this.adminRequests = response.data || response;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar el historial:', error);
        this.errorMessage = 'No se pudo cargar el historial de compensatorios. Inténtalo más tarde.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Carga las solicitudes para usuarios regulares y las filtra por estado
   */
  loadCompensatoryRequests(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.compensatoryService.getAllRequests().subscribe({
      next: (data: CompensatoryRequest[]) => {
        this.allRequests = data;
        
        // Filtrar solicitudes según su estado
        this.inProgressRequests = this.allRequests.filter(request => request.status === 'En curso');
        this.acceptedRequests = this.allRequests.filter(request => request.status === 'Aceptada');
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar las solicitudes:', error);
        this.errorMessage = 'No se pudieron cargar las solicitudes de compensatorio. Intente más tarde.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Recarga los datos según el tipo de usuario
   */
  refreshData(): void {
    if (this.isAdmin) {
      this.loadAdminRequests();
    } else {
      this.loadCompensatoryRequests();
    }
  }

  /**
   * ==================== 6. FILTROS DE ADMINISTRADOR ====================
   */

  /**
   * Aplica todos los filtros activos a las solicitudes de administrador
   */
  applyFilters(): void {
    this.filteredRequests = this.adminRequests.filter(request => {
      // Combinar todos los criterios de filtrado
      const fullName = `${request.firstName} ${request.lastName}`.toLowerCase();
      
      return (
        // Filtro por usuario
        (!this.userFilter || fullName.includes(this.userFilter.toLowerCase())) &&
        
        // Filtro por estado original
        (!this.statusFilter || request.status === this.statusFilter) &&
        
        // Filtro por estado dinámico
        (!this.dynamicStatusFilter || request.dynamicStatus === this.dynamicStatusFilter) &&
        
        // Filtro por fecha desde
        (!this.dateFromFilter || new Date(request.from) >= new Date(this.dateFromFilter)) &&
        
        // Filtro por fecha hasta
        (!this.dateToFilter || new Date(request.to) <= new Date(this.dateToFilter))
      );
    });
  }

  /**
   * Restablece todos los filtros a su valor predeterminado
   */
  clearFilters(): void {
    this.userFilter = '';
    this.statusFilter = '';
    this.dynamicStatusFilter = '';
    this.dateFromFilter = '';
    this.dateToFilter = '';
    this.applyFilters();
  }

  /**
   * ==================== 7. UTILIDADES DE UI ====================
   */

  /**
   * Obtiene la clase CSS apropiada según el estado de la solicitud
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'Aceptada':
      case 'En curso':
        return 'badge bg-success';
      case 'Pendiente':
        return 'badge bg-warning text-dark';
      case 'Rechazada':
        return 'badge bg-danger';
      case 'Finalizado':
        return 'badge bg-secondary';
      case 'Programado':
        return 'badge bg-info';
      default:
        return 'badge bg-light text-dark';
    }
  }

  /**
   * Función trackBy para optimizar el rendimiento de las listas ngFor
   */
  trackByRequestId(index: number, request: AdminCompensatoryRequest): number {
    return request.id;
  }
}