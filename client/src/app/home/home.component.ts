/* ==================== 1. IMPORTACIONES Y DEPENDENCIAS ==================== */
import { ChangeDetectorRef, Component, HostListener, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { hourService } from '../Services/hour.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompensatoryService } from '../Services/compensatory.service';
import { UserService, } from '../Services/user.service';
import { AuthService } from '../Services/auth.service';
import { trigger, style, animate, transition } from '@angular/animations';
import { User, GlobalStatistics, UserSummary, RequestData } from '../Interfaces/index';
import { SignalRService } from '../Services/signalr.service';
import { Subscription } from 'rxjs';

type ModalType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
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
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  /* ==================== 4. PROPIEDADES ==================== */
  private subscriptions: Subscription[] = [];

  // Propiedades de administrador
  isAdmin: boolean = false;
  globalStatistics: GlobalStatistics | null = null;
  isLoadingStats: boolean = false;

  // Propiedades de usuarios
  usersSummary: UserSummary[] = [];
  filteredUsersSummary: UserSummary[] = [];
  selectedUser: UserSummary | null = null;
  selectedUserDashboard: any = null;
  isLoadingUsers: boolean = false;
  isLoadingUserDashboard: boolean = false;
  userSearchTerm: string = '';

  // Propiedades para horas y solicitudes
  hours: number = 0;
  description: string = '';
  hourList: any[] = [];
  totalAcceptedHours: number = 0;
  startDate: string = '';
  endDate: string = '';
  reason: string = '';
  requests: RequestData[] = [];

  // Propiedades UI y modales
  showModal: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalType: ModalType = 'info';
  showUserModal: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';

  constructor(
    private hourService: hourService,
    private compensatoryService: CompensatoryService,
    private userService: UserService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private signalRService: SignalRService
  ) { }

  /* ==================== 6. LIFECYCLE HOOKS ==================== */
  ngOnInit(): void {
    this.initializeApp();
  }

  ngAfterViewInit(): void {
    this.applyInitialFilters();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('modal-open');
    this.subscriptions.forEach(subscription => {
      if (subscription) {
        subscription.unsubscribe();
      }
    });
    this.subscriptions = [];
    console.log('[HomeComponent]  Suscripciones limpiadas');
  }

  /* ==================== 7. INICIALIZACIÓN Y CONFIGURACIÓN ==================== */
  private initializeApp(): void {
    // Inicializar variables
    this.userSearchTerm = '';
    this.filteredUsersSummary = [];

    // Verificar rol y cargar datos iniciales
    this.checkUserRole();
  }

  private applyInitialFilters(): void {
    setTimeout(() => {
      this.filterUsers();
      this.cdr.detectChanges();
    });
  }

  private checkUserRole(): void {
    this.authService.verifySession().subscribe({
      next: (userData: any) => {
        if (userData && userData.role) {
          this.isAdmin = userData.role === 'Admin';

          if (this.isAdmin) {
            this.loadAdminData();
          } else {
            this.loadUserData();
          }
        }
      },
      error: (error) => {
        console.error('Error verificando sesión:', error);
        this.loadUserData();
      }
    });
  }

  /* ==================== 8. CARGA DE DATOS ==================== */
  private loadAdminData(): void {
    this.loadGlobalStatistics();
    this.loadUsersSummary();
  }

  private loadUserData(): void {
    this.getHours();
    this.getRequests();
    this.setupHourSubscription();
  }

  private loadGlobalStatistics(): void {
    this.isLoadingStats = true;

    this.compensatoryService.getGlobalStatistics().subscribe({
      next: (response: any) => {
        this.globalStatistics = response;
        this.isLoadingStats = false;
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
        this.isLoadingStats = false;
      }
    });
  }

  private loadUsersSummary(): void {
    this.isLoadingUsers = true;

    this.userService.getAllUsers().subscribe({
      next: (response: any) => {
        console.log('Respuesta completa del servidor:', response);

        let users: User[] = [];

        if (response && response.data && Array.isArray(response.data)) {
          users = response.data;
        } else if (Array.isArray(response)) {
          users = response;
        } else {
          console.error('Formato de respuesta inesperado:', response);
          this.usersSummary = [];
          this.filteredUsersSummary = [];
          this.isLoadingUsers = false;
          return;
        }

        console.log('Usuarios extraídos:', users);

        this.usersSummary = users
          .filter((user: User) => user.role !== 'Admin')
          .map(user => ({
            ...user,
            profileImage: user.profileImage || null,
            totalHoursRequests: 0,
            totalCompensatoryRequests: 0,
            pendingHoursRequests: 0,
            pendingCompensatoryRequests: 0,
            availableHours: 0,
            lastActivity: new Date().toISOString()
          }));

        this.filteredUsersSummary = [...this.usersSummary];
        this.isLoadingUsers = false;

        console.log('UsersSummary final:', this.usersSummary);
        console.log('Usuarios filtrados (no admin):', this.usersSummary.length); 
      },
      error: (error) => {
        console.error('Error cargando usuarios:', error);
        this.isLoadingUsers = false;
        this.usersSummary = [];
        this.filteredUsersSummary = [];
      }
    });
  }

  private setupHourSubscription(): void {
    // Carga inicial
    this.hourService.refreshTotal();

    const totalSubscription = this.hourService.totalAccepted$.subscribe(
      total => {
        this.totalAcceptedHours = total;
        this.cdr.detectChanges();
        console.log('[HomeComponent] Horas totales actualizadas a:', total);
      }
    );
    this.subscriptions.push(totalSubscription);

    const statusSubscription = this.signalRService.hourStatusUpdated$.subscribe(
      (statusUpdate: any) => {
        if (statusUpdate && statusUpdate.hourId) {
          console.log('[HomeComponent]  Actualizando estado de hora:', statusUpdate);
          this.updateHourStatusInList(statusUpdate);
        }
      }
    );
    this.subscriptions.push(statusSubscription);
    this.monitorSignalRState();
  }


  private updateHourStatusInList(statusUpdate: any): void {
    const { hourId, newStatus, previousStatus } = statusUpdate;

    // Buscar la hora en la lista y actualizar su estado
    const hourIndex = this.hourList.findIndex(hour => hour.id === hourId);

    if (hourIndex !== -1) {
      // Actualizar el estado
      this.hourList[hourIndex].status = newStatus;

      console.log(`[HomeComponent]  Estado de hora ID ${hourId} actualizado: ${previousStatus} → ${newStatus}`);

      // Forzar detección de cambios para actualizar la UI
      this.cdr.detectChanges();

      // Mostrar notificación visual opcional
      this.showStatusChangeNotification(newStatus, statusUpdate.hours);
    } else {
      console.warn(`[HomeComponent]  No se encontró la hora con ID ${hourId} en la lista local`);
      // Si no se encuentra, recargar la lista completa como fallback
      this.getHours();
    }
  }

  private showStatusChangeNotification(newStatus: string, hours: number): void {
    let message = '';

    switch (newStatus) {
      case 'Aceptada':
        message = ` ${hours} hora(s) han sido aceptadas`;
        break;
      case 'Rechazada':
        message = ` ${hours} hora(s) han sido rechazadas`;
        break;
      default:
        message = `Estado actualizado a: ${newStatus}`;
    }

    console.log(`[HomeComponent]  ${message}`);

  }

  private monitorSignalRState(): void {
    // Suscribirse al estado de conexión
    this.signalRService.connectionState$.subscribe(state => {
      console.log(`[HomeComponent] Estado SignalR: ${state}`);

      switch (state) {
        case 'Connected':
          console.log('[HomeComponent]  SignalR conectado exitosamente');
          break;
        case 'Reconnecting':
          console.log('[HomeComponent]  SignalR reconectando...');
          break;
        case 'Disconnected':
          console.log('[HomeComponent]  SignalR desconectado');
          break;
        case 'Failed':
          console.log('[HomeComponent]  SignalR falló al conectar');
          break;
      }
    });
    // Verificación adicional después de 3 segundos
    setTimeout(() => {
      if (this.signalRService.isConnected()) {
        console.log('[HomeComponent]  Verificación final: SignalR funcionando correctamente');
      } else {
        console.log('[HomeComponent]  Verificación final: SignalR no conectado, pero puede funcionar igual');
      }
    }, 3000);
  }

  /* ==================== 9. FILTRADO DE USUARIOS ==================== */
  filterUsers(): void {
    // Si no hay usuarios cargados, no hacer nada
    if (!this.usersSummary || !Array.isArray(this.usersSummary)) {
      return;
    }

    // Si el término de búsqueda está vacío, mostrar todos los usuarios
    if (!this.userSearchTerm || this.userSearchTerm === '' || this.userSearchTerm.trim() === '') {
      this.filteredUsersSummary = [...this.usersSummary];
      return;
    }

    // Si hay término de búsqueda, filtrar
    const searchTerm = this.userSearchTerm.toLowerCase().trim();
    this.filteredUsersSummary = this.usersSummary.filter(user => {
      return (user.firstName?.toLowerCase() || '').includes(searchTerm) ||
        (user.lastName?.toLowerCase() || '').includes(searchTerm) ||
        (user.username?.toLowerCase() || '').includes(searchTerm);
    });
  }

  handleSearchBlur(): void {
    // Si el término de búsqueda está vacío o solo contiene espacios
    if (!this.userSearchTerm || this.userSearchTerm.trim() === '') {
      this.userSearchTerm = '';
      this.filteredUsersSummary = [...this.usersSummary];
    }
    this.filterUsers();
  }

  /* ==================== 10. GESTIÓN DE USUARIOS Y DASHBOARD ==================== */
  viewUserDetails(user: UserSummary): void {
    if (!user) return;

    this.selectedUser = user;
    this.loadUserDashboard(user.id);
    this.showUserModal = true;
    document.body.classList.add('modal-open');
  }

  private loadUserDashboard(userId: number): void {
    this.isLoadingUserDashboard = true;

    this.userService.getUserDashboard(userId).subscribe({
      next: (response: any) => {
        this.selectedUserDashboard = response;
        this.isLoadingUserDashboard = false;
      },
      error: (error) => {
        console.error('Error cargando dashboard del usuario:', error);
        this.isLoadingUserDashboard = false;
        this.openModal('Error', 'No se pudo cargar la información del usuario', 'error');
      }
    });
  }

  /* ==================== 11. GESTIÓN DE HORAS ==================== */
  addHour(): void {
    // Validaciones
    if (this.hours <= 0) {
      this.openModal('Error de Validación', 'Por favor, ingrese un número válido de horas.', 'error');
      return;
    }

    if (this.hours > 8) {
      this.openModal('Error de Validación', 'No se pueden registrar más de 8 horas en una sola entrada.', 'error');
      return;
    }

    if (!this.description.trim()) {
      this.openModal('Error de Validación', 'Por favor, ingrese una descripción.', 'error');
      return;
    }

    // Enviar solicitud
    this.hourService.addHour(this.hours, this.description).subscribe({
      next: (response) => {
        this.openModal('Éxito', response.message || 'Horas añadidas correctamente.', 'success');
        this.hours = 0;
        this.description = '';
        this.getHours();
      },
      error: (error) => {
        this.openModal('Error', error.error?.message || 'Ocurrió un error al añadir horas.', 'error');
      }
    });
  }

  getHours(): void {
    this.hourService.getHours().subscribe({
      next: (response) => {
        this.hourList = response.reverse();
      },
      error: (error) => {
        console.error('Error al obtener horas:', error);
      }
    });
  }

  /* ==================== 12. GESTIÓN DE COMPENSATORIOS ==================== */
  addRequest(): void {
    // Limpiar mensajes
    this.errorMessage = '';
    this.successMessage = '';

    // Validaciones
    if (!this.startDate || !this.endDate || !this.reason) {
      this.openModal('Error de Validación', 'Por favor, complete todos los campos para la solicitud.', 'error');
      return;
    }

    if (this.startDate >= this.endDate) {
      this.openModal('Error de Validación', 'La fecha de inicio debe ser anterior a la fecha de fin.', 'error');
      return;
    }

    const fromDate = new Date(this.startDate);
    const toDate = new Date(this.endDate);

    if (fromDate.getMinutes() !== toDate.getMinutes()) {
      this.openModal(
        'Error de Horas',
        'La solicitud deben ser horas completas. Los minutos de la hora de inicio y fin deben coincidir (ej. de 09:15 a 11:15).',
        'error'
      );
      return;
    }

    // Enviar solicitud
    const payload = {
      from: this.startDate,
      to: this.endDate,
      reason: this.reason
    };

    this.compensatoryService.addRequest(payload).subscribe({
      next: (res: any) => {
        this.openModal('Éxito', res.message || 'Solicitud enviada correctamente.', 'success');
        this.clearForm();
        this.getRequests();
      },
      error: (err: any) => {
        this.openModal('Error', `Error ${err.status}: ${err.error?.message || err.message}`, 'error');
      }
    });
  }

  getRequests(): void {
    this.compensatoryService.getRequests().subscribe({
      next: (response) => {
        this.requests = response.map((request: any) => ({
          ...request,
          from: this.formatLocalDate(request.from),
          to: this.formatLocalDate(request.to),
          currentHour: this.formatLocalDate(request.currentHour)
        })).reverse();
      },
      error: (error) => {
        console.error('Error al obtener solicitudes:', error);
      }
    });
  }

  /* ==================== 13. UTILIDADES DE UI Y MODALES ==================== */
  openModal(title: string, message: string, type: ModalType = 'info'): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    document.body.classList.remove('modal-open');
  }

  clearForm(): void {
    this.startDate = '';
    this.endDate = '';
    this.reason = '';
  }

  // Detecta la tecla ESC para cerrar modales
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.showUserModal) {
      this.closeUserModal();
    }
  }

  /* ==================== 14. HELPERS Y FORMATTERS ==================== */
  formatHours(hours: number): string {
    return Math.round(hours || 0).toString();
  }

  formatDateTime(dateString: string | undefined | null): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  private formatLocalDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  trackByUserId(index: number, user: UserSummary): number {
    return user.id;
  }

  /* ==================== 15. MÉTODOS HELPER PARA ESTADOS (NUEVOS) ==================== */
  getHourStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'aceptada': return 'accepted';
      case 'rechazada': return 'rejected';
      case 'pendiente':
      default: return 'pending';
    }
  }

  getStatusIndicatorClass(status: string): string {
    return `status-${this.getHourStatusClass(status)}`;
  }

  getStatusColorClass(status: string): string {
    return this.getHourStatusClass(status);
  }

  getStatusText(status: string): string {
    switch (status?.toLowerCase()) {
      case 'aceptada': return 'Aceptada';
      case 'rechazada': return 'Rechazada';
      case 'pendiente':
      default: return 'Pendiente';
    }
  }
}