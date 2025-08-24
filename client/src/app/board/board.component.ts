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
    this.verifySessionFromBackend();
  }

  /**
   * ==================== 4. AUTENTICACIÓN Y SESIÓN ====================
   */

  private verifySessionFromBackend(): void {
    this.authService.verifySession().subscribe({
      next: (userData: any) => {
        if (userData && userData.role) {
          this.isAdmin = userData.role === 'Admin';
          
          if (this.isAdmin) {
            this.loadAdminRequests();
          } else {
            this.loadCompensatoryRequests();
          }
        } else {
          this.isAdmin = false;
          this.loadCompensatoryRequests();
        }
      },
      error: () => {
        this.isAdmin = false;
        this.loadCompensatoryRequests();
      }
    });
  }

  /**
   * ==================== 5. CARGA DE DATOS ====================
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

  loadCompensatoryRequests(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.compensatoryService.getAllRequests().subscribe({
      next: (data: CompensatoryRequest[]) => {
        this.allRequests = data;
        
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

  applyFilters(): void {
    this.filteredRequests = this.adminRequests.filter(request => {
      const fullName = `${request.firstName} ${request.lastName}`.toLowerCase();
      
      return (
        (!this.userFilter || fullName.includes(this.userFilter.toLowerCase())) &&
        
        (!this.statusFilter || request.status === this.statusFilter) &&
        
        (!this.dynamicStatusFilter || request.dynamicStatus === this.dynamicStatusFilter) &&
        
        (!this.dateFromFilter || new Date(request.from) >= new Date(this.dateFromFilter)) &&
        
        (!this.dateToFilter || new Date(request.to) <= new Date(this.dateToFilter))
      );
    });
  }

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

  trackByRequestId(index: number, request: AdminCompensatoryRequest): number {
    return request.id;
  }
}