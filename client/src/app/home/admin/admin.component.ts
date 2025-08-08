import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompensatoryService } from '../../Services/compensatory.service';
import { UserService } from '../../Services/user.service';
import { GlobalStatistics, UserSummary, User } from '../../Interfaces/index';
import { trigger, style, animate, transition } from '@angular/animations';

type ModalType = 'success' | 'error' | 'info';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.css'],
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
            ])
        ])
    ]
})
export class AdminComponent implements OnInit, OnDestroy {
[x: string]: any;

    /* ==================== PROPIEDADES DE ADMINISTRADOR ==================== */
    // Estadísticas globales
    globalStatistics: GlobalStatistics | null = null;
    isLoadingStats: boolean = false;

    // Propiedades de usuarios
    usersSummary: UserSummary[] = [];
    selectedUser: UserSummary | null = null;
    selectedUserDashboard: any = null;
    isLoadingUsers: boolean = false;
    isLoadingUserDashboard: boolean = false;

    // Propiedades UI
    showUserModal: boolean = false;
    showModal: boolean = false;
    modalTitle: string = '';
    modalMessage: string = '';
    modalType: ModalType = 'info';

    /* ==================== CONSTRUCTOR ==================== */
    constructor(
        private compensatoryService: CompensatoryService,
        private userService: UserService,
        private cdr: ChangeDetectorRef
    ) { }

    /* ==================== LIFECYCLE HOOKS ==================== */
    ngOnInit(): void {
        this.loadAdminData();
    }

    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    /* ==================== CARGA DE DATOS DE ADMINISTRADOR ==================== */
    // SOLO ADMINISTRADOR: Carga datos específicos del admin
    private loadAdminData(): void {
        this.loadGlobalStatistics();
        this.loadUsersSummary();
    }

    // SOLO ADMINISTRADOR: Carga estadísticas globales del sistema
    private loadGlobalStatistics(): void {
        this.isLoadingStats = true;

        this.compensatoryService.getGlobalStatistics().subscribe({
            next: (response: any) => {
                this.globalStatistics = response;
                this.isLoadingStats = false;
            },
            error: (error: any) => {
                console.error('Error cargando estadísticas:', error);
                this.isLoadingStats = false;
            }
        });
    }

    // SOLO ADMINISTRADOR: Carga lista de todos los usuarios del sistema
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

                this.isLoadingUsers = false;

                console.log('UsersSummary final:', this.usersSummary);
                console.log('Usuarios (no admin):', this.usersSummary.length);
            },
            error: (error) => {
                console.error('Error cargando usuarios:', error);
                this.isLoadingUsers = false;
                this.usersSummary = [];
            }
        });
    }

    /* ==================== GESTIÓN DE USUARIOS Y DASHBOARD ==================== */
    // SOLO ADMINISTRADOR: Visualiza detalles de un usuario específico
    viewUserDetails(user: UserSummary): void {
        if (!user) return;

        this.selectedUser = user;
        this.loadUserDashboard(user.id);
        this.showUserModal = true;
        document.body.classList.add('modal-open');
    }

    // SOLO ADMINISTRADOR: Carga dashboard de un usuario específico
    private loadUserDashboard(userId: number): void {
        this.isLoadingUserDashboard = true;

        this.userService.getUserDashboard(userId).subscribe({
            next: (response: any) => {
                this.selectedUserDashboard = response;
                this.isLoadingUserDashboard = false;
            },
            error: (error: any) => {
                console.error('Error cargando dashboard del usuario:', error);
                this.isLoadingUserDashboard = false;
                this.openModal('Error', 'No se pudo cargar la información del usuario', 'error');
            }
        });
    }

    /* ==================== UTILIDADES DE UI Y MODALES ==================== */
    // Funciones de modal
    openModal(title: string, message: string, type: ModalType = 'info'): void {
        this.modalTitle = title;
        this.modalMessage = message;
        this.modalType = type;
        this.showModal = true;
    }

    closeModal(): void {
        this.showModal = false;
    }

    // SOLO ADMINISTRADOR: Cierra modal de detalles de usuario
    closeUserModal(): void {
        this.showUserModal = false;
        document.body.classList.remove('modal-open');
    }

    // SOLO ADMINISTRADOR: Detecta tecla ESC para cerrar modales
    @HostListener('document:keydown.escape', ['$event'])
    onEscapeKey(event: KeyboardEvent): void {
        if (this.showUserModal) {
            this.closeUserModal();
        }
        if (this.showModal) {
            this.closeModal();
        }
    }

    /* ==================== HELPERS Y FORMATTERS ==================== */
    // SOLO ADMINISTRADOR: Función de tracking para optimización
    trackByUserId(index: number, user: UserSummary): number {
        return user.id;
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

    /* ==================== MÉTODOS ADICIONALES DE UTILIDAD ==================== */
    // Refresca los datos del dashboard
    refreshData(): void {
        this.loadAdminData();
    }

    // Obtiene el estado de carga general
    isLoading(): boolean {
        return this.isLoadingStats || this.isLoadingUsers || this.isLoadingUserDashboard;
    }

    // Obtiene el número total de usuarios
    getTotalUsers(): number {
        return this.usersSummary.length;
    }

    // Obtiene usuarios con solicitudes pendientes
    getUsersWithPendingRequests(): UserSummary[] {
        return this.usersSummary.filter(user => user.pendingCompensatoryRequests > 0);
    }

    // Obtiene usuarios con horas pendientes
    getUsersWithPendingHours(): UserSummary[] {
        return this.usersSummary.filter(user => user.pendingHoursRequests > 0);
    }

    // Verifica si hay datos cargados
    hasData(): boolean {
        return this.globalStatistics !== null && this.usersSummary.length > 0;
    }

    // Obtiene el último usuario activo
    getLastActiveUser(): UserSummary | null {
        if (this.usersSummary.length === 0) return null;
        
        return this.usersSummary.reduce((latest, current) => {
            const latestDate = new Date(latest.lastActivity);
            const currentDate = new Date(current.lastActivity);
            return currentDate > latestDate ? current : latest;
        });
    }

    // Calcula porcentaje de usuarios activos
    getActiveUsersPercentage(): number {
        if (this.usersSummary.length === 0) return 0;
        
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const activeUsers = this.usersSummary.filter(user => {
            const lastActivity = new Date(user.lastActivity);
            return lastActivity > weekAgo;
        });
        
        return Math.round((activeUsers.length / this.usersSummary.length) * 100);
    }
}