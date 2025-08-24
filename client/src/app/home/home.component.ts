import { ChangeDetectorRef, Component, HostListener, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { hourService } from '../Services/hour.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompensatoryService } from '../Services/compensatory.service';
import { UserService } from '../Services/user.service';
import { AuthService } from '../Services/auth.service';
import { trigger, style, animate, transition } from '@angular/animations';
import { User, GlobalStatistics, UserSummary, RequestData } from '../Interfaces/index';
import { SignalRService } from '../Services/signalr.service';
import { Subscription } from 'rxjs';

type ModalType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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

  /* ==================== 1. PROPIEDADES COMPARTIDAS ==================== */
  private subscriptions: Subscription[] = [];
  isAdmin: boolean = false;

  // UI y modales compartidos
  showModal: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalType: ModalType = 'info';

  /* ==================== 2. PROPIEDADES DE ADMINISTRADOR ==================== */
  // Estadísticas globales
  globalStatistics: GlobalStatistics | null = null;
  isLoadingStats: boolean = false;

  // Gestión de usuarios
  usersSummary: UserSummary[] = [];
  filteredUsersSummary: UserSummary[] = [];
  selectedUser: UserSummary | null = null;
  selectedUserDashboard: any = null;
  isLoadingUsers: boolean = false;
  isLoadingUserDashboard: boolean = false;
  userSearchTerm: string = '';
  showUserModal: boolean = false;

  /* ==================== 3. PROPIEDADES DE USUARIO REGULAR ==================== */
  // Gestión de horas
  hours: number = 0;
  description: string = '';
  hourList: any[] = [];
  totalAcceptedHours: number = 0;
  availableHours: number = 0;

  // Gestión de compensatorios
  startDate: string = '';
  endDate: string = '';
  reason: string = '';
  requests: RequestData[] = [];

  constructor(
    private hourService: hourService,
    private compensatoryService: CompensatoryService,
    private userService: UserService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private signalRService: SignalRService
  ) { }

  /* ==================== 4. LIFECYCLE HOOKS (COMPARTIDOS) ==================== */
  ngOnInit(): void {
    this.initializeApp();
  }

  ngAfterViewInit(): void {
    if (this.isAdmin) {
      this.applyAdminFilters();
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove('modal-open');
    this.cleanupSubscriptions();
  }

  /* ==================== 5. INICIALIZACIÓN COMPARTIDA ==================== */
  private initializeApp(): void {
    this.checkUserRole();
  }

  private checkUserRole(): void {
    this.authService.verifySession().subscribe({
      next: (userData: any) => {
        if (userData?.role) {
          this.isAdmin = userData.role === 'Admin';
          this.isAdmin ? this.loadAdminData() : this.loadUserData();
        }
      },
      error: () => this.loadUserData()
    });
  }

  private cleanupSubscriptions(): void {
    this.subscriptions.forEach(subscription => subscription?.unsubscribe());
    this.subscriptions = [];
    console.log('[HomeComponent] Suscripciones limpiadas');
  }

  /* ==================== 6. MÉTODOS DE ADMINISTRADOR ==================== */
  private loadAdminData(): void {
    this.loadGlobalStatistics();
    this.loadUsersSummary();
  }

  private applyAdminFilters(): void {
    setTimeout(() => {
      this.filterUsers();
      this.cdr.detectChanges();
    });
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
        const users = this.extractUsersFromResponse(response);
        this.usersSummary = this.mapUsersToSummary(users);
        this.filteredUsersSummary = [...this.usersSummary];
        this.isLoadingUsers = false;
        console.log('Usuarios con rol User encontrados:', this.usersSummary.length);
      },
      error: (error) => {
        console.error('Error cargando usuarios:', error);
        this.isLoadingUsers = false;
        this.usersSummary = [];
        this.filteredUsersSummary = [];
      }
    });
  }

  private extractUsersFromResponse(response: any): User[] {
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    } else if (Array.isArray(response)) {
      return response;
    } else {
      console.error('Formato de respuesta inesperado:', response);
      return [];
    }
  }

  private mapUsersToSummary(users: User[]): UserSummary[] {
    return users
      .filter((user: User) => user.role === 'User')
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
  }

  filterUsers(): void {
    if (!this.usersSummary?.length) return;

    if (!this.userSearchTerm?.trim()) {
      this.filteredUsersSummary = [...this.usersSummary];
      return;
    }

    const searchTerm = this.userSearchTerm.toLowerCase().trim();
    this.filteredUsersSummary = this.usersSummary.filter(user => {
      return (user.firstName?.toLowerCase() || '').includes(searchTerm) ||
        (user.lastName?.toLowerCase() || '').includes(searchTerm) ||
        (user.username?.toLowerCase() || '').includes(searchTerm);
    });
  }

  handleSearchBlur(): void {
    if (!this.userSearchTerm?.trim()) {
      this.userSearchTerm = '';
      this.filteredUsersSummary = [...this.usersSummary];
    }
    this.filterUsers();
  }

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

  closeUserModal(): void {
    this.showUserModal = false;
    document.body.classList.remove('modal-open');
  }

  trackByUserId(index: number, user: UserSummary): number {
    return user.id;
  }

  /* ==================== 7. MÉTODOS DE USUARIO REGULAR ==================== */
  private loadUserData(): void {
    this.getHours();
    this.getRequests();
    this.loadAvailableHours();
    this.setupHourSubscription();
  }

  private setupHourSubscription(): void {
    this.hourService.refreshTotal();

    const totalSubscription = this.hourService.totalAccepted$.subscribe(total => {
      this.totalAcceptedHours = total;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(totalSubscription);

    const statusSubscription = this.signalRService.hourStatusUpdated$.subscribe(statusUpdate => {
      if (statusUpdate?.hourId) {
        this.updateHourStatusInList(statusUpdate);
      }
    });
    this.subscriptions.push(statusSubscription);

    window.addEventListener('available-hours-updated', (event: any) => {
      this.availableHours = event.detail.availableHours;
      this.cdr.detectChanges();
    });

    this.monitorSignalRState();
  }

  private updateHourStatusInList(statusUpdate: any): void {
    const { hourId, newStatus } = statusUpdate;
    const hourIndex = this.hourList.findIndex(hour => hour.id === hourId);

    if (hourIndex !== -1) {
      this.hourList[hourIndex].status = newStatus;
      this.cdr.detectChanges();
      this.showStatusChangeNotification(newStatus, statusUpdate.hours);
    } else {
      this.getHours();
    }
  }

  private loadAvailableHours(): void {
    this.compensatoryService.getAvailableHours().subscribe({
      next: (response) => {
        console.log(' Respuesta horas disponibles:', response);

        if (response?.data?.availableHours !== undefined) {
          this.availableHours = response.data.availableHours;
        } else if (response?.availableHours !== undefined) {
          this.availableHours = response.availableHours;
        } else if (typeof response === 'number') {
          this.availableHours = response;
        } else {
          console.warn(' Estructura de respuesta no reconocida:', response);
          this.availableHours = 0;
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error(' Error cargando horas disponibles:', error);
        this.availableHours = 0;
      }
    });
  }

  private showStatusChangeNotification(newStatus: string, hours: number): void {
    const statusMessages = {
      'Aceptada': `${hours} hora(s) han sido aceptadas`,
      'Rechazada': `${hours} hora(s) han sido rechazadas`,
      'default': `Estado actualizado a: ${newStatus}`
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages] || statusMessages.default;
    console.log(`[HomeComponent] ${message}`);
  }

  private monitorSignalRState(): void {
    this.signalRService.connectionState$.subscribe(state => {
      console.log(`[HomeComponent] Estado SignalR: ${state}`);
    });

    setTimeout(() => {
      const status = this.signalRService.isConnected() ? 'funcionando correctamente' : 'no conectado, pero puede funcionar igual';
      console.log(`[HomeComponent] Verificación final: SignalR ${status}`);
    }, 3000);
  }

  addHour(): void {
    if (!this.validateHourInput()) return;

    this.hourService.addHour(this.hours, this.description).subscribe({
      next: (response) => {
        this.openModal('Éxito', response.message || 'Horas añadidas correctamente.', 'success');
        this.clearHourForm();
        this.getHours();
      },
      error: (error) => {
        this.openModal('Error', error.error?.message || 'Ocurrió un error al añadir horas.', 'error');
      }
    });
  }

  private validateHourInput(): boolean {
    if (this.hours <= 0) {
      this.openModal('Error de Validación', 'Por favor, ingrese un número válido de horas.', 'error');
      return false;
    }

    if (this.hours > 8) {
      this.openModal('Error de Validación', 'No se pueden registrar más de 8 horas en una sola entrada.', 'error');
      return false;
    }

    if (!this.description.trim()) {
      this.openModal('Error de Validación', 'Por favor, ingrese una descripción.', 'error');
      return false;
    }

    return true;
  }

  private clearHourForm(): void {
    this.hours = 0;
    this.description = '';
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

  // Gestión de compensatorios
  addRequest(): void {
    if (!this.validateRequestInput()) return;

    const payload = {
      from: this.startDate,
      to: this.endDate,
      reason: this.reason
    };

    this.compensatoryService.addRequest(payload).subscribe({
      next: (res: any) => {
        this.openModal('Éxito', res.message || 'Solicitud enviada correctamente.', 'success');
        this.clearRequestForm();
        this.getRequests();
      },
      error: (err: any) => {
        this.openModal('Error', `Error ${err.status}: ${err.error?.message || err.message}`, 'error');
      }
    });
  }

  private validateRequestInput(): boolean {
    if (!this.startDate || !this.endDate || !this.reason) {
      this.openModal('Error de Validación', 'Por favor, complete todos los campos para la solicitud.', 'error');
      return false;
    }

    if (this.startDate >= this.endDate) {
      this.openModal('Error de Validación', 'La fecha de inicio debe ser anterior a la fecha de fin.', 'error');
      return false;
    }

    const fromDate = new Date(this.startDate);
    const toDate = new Date(this.endDate);

    if (fromDate.getMinutes() !== toDate.getMinutes()) {
      this.openModal(
        'Error de Horas',
        'La solicitud deben ser horas completas. Los minutos de la hora de inicio y fin deben coincidir (ej. de 09:15 a 11:15).',
        'error'
      );
      return false;
    }

    return true;
  }

  private clearRequestForm(): void {
    this.startDate = '';
    this.endDate = '';
    this.reason = '';
  }

  getRequests(): void {
    this.compensatoryService.getRequests().subscribe({
      next: (response) => {
        console.log(' Respuesta compensatorios:', response);

        let requestsData = [];
        if (
          typeof response === 'object' &&
          response !== null &&
          'data' in response &&
          Array.isArray((response as any).data)
        ) {
          requestsData = (response as any).data;
        } else if (Array.isArray(response)) {
          requestsData = response;
        } else {
          console.warn(' Formato de compensatorios no reconocido:', response);
          requestsData = [];
        }

        this.requests = requestsData
          .map((request: any) => ({
            ...request,
            from: this.formatLocalDate(request.from),
            to: this.formatLocalDate(request.to),
            currentHour: this.formatLocalDate(request.currentHour),
            originalCurrentHour: new Date(request.currentHour),
            originalFrom: new Date(request.from),
            originalTo: new Date(request.to)
          }))
          .sort((a: any, b: any) => {
            return b.originalCurrentHour.getTime() - a.originalCurrentHour.getTime();
          });

        console.log(' Compensatorios procesados y ordenados:', this.requests);
      },
      error: (error) => {
        console.error(' Error al obtener solicitudes:', error);
        this.requests = [];
      }
    });
  }

  /* ==================== 8. UTILIDADES COMPARTIDAS ==================== */
  openModal(title: string, message: string, type: ModalType = 'info'): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(): void {
    if (this.showUserModal) {
      this.closeUserModal();
    }
  }

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

  getHourStatusClass(status: string): string {
    const statusMap = {
      'aceptada': 'accepted',
      'rechazada': 'rejected',
      'pendiente': 'pending'
    };
    return statusMap[status?.toLowerCase() as keyof typeof statusMap] || 'pending';
  }

  getStatusIndicatorClass(status: string): string {
    return `status-${this.getHourStatusClass(status)}`;
  }

  getStatusColorClass(status: string): string {
    return this.getHourStatusClass(status);
  }

  getStatusText(status: string): string {
    const statusMap = {
      'aceptada': 'Aceptada',
      'rechazada': 'Rechazada',
      'pendiente': 'Pendiente'
    };
    return statusMap[status?.toLowerCase() as keyof typeof statusMap] || 'Pendiente';
  }

  clearForm(): void {
    this.clearRequestForm();
  }
}