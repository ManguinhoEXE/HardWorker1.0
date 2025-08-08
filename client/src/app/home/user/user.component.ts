import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompensatoryService } from '../../Services/compensatory.service';
import { hourService } from '../../Services/hour.service';
import { AuthService } from '../../Services/auth.service';
import { trigger, style, animate, transition } from '@angular/animations';
import { RequestData } from '../../Interfaces/index';

type ModalType = 'success' | 'error' | 'info';

@Component({
    selector: 'app-user-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './user.component.html',
    styleUrls: ['./user.component.css'],
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
export class UserComponent implements OnInit, OnDestroy {

    /* ==================== PROPIEDADES DE USUARIO ==================== */
    // SOLO USUARIO: Propiedades para la vista de usuario regular
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
    successMessage: string = '';
    errorMessage: string = '';

    /* ==================== CONSTRUCTOR ==================== */
    constructor(
        private hourService: hourService,
        private compensatoryService: CompensatoryService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef
    ) { }

    /* ==================== LIFECYCLE HOOKS ==================== */
    ngOnInit(): void {
        this.loadUserData();
    }

    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    /* ==================== CARGA DE DATOS DE USUARIO ==================== */
    // SOLO USUARIO: Carga datos específicos del usuario regular
    private loadUserData(): void {
        this.getHours();
        this.getRequests();
        this.setupHourSubscription();
    }

    // SOLO USUARIO: Configura suscripción a horas totales aceptadas
    private setupHourSubscription(): void {
        this.hourService.refreshTotal();
        this.hourService.totalAccepted$.subscribe(
            total => this.totalAcceptedHours = total
        );
    }

    /* ==================== GESTIÓN DE HORAS ==================== */
    // SOLO USUARIO: Añade nuevas horas trabajadas
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

    // SOLO USUARIO: Obtiene historial de horas del usuario
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

    /* ==================== GESTIÓN DE COMPENSATORIOS ==================== */
    // SOLO USUARIO: Añade nueva solicitud de compensatorio
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

    // SOLO USUARIO: Obtiene historial de solicitudes del usuario
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

    // SOLO USUARIO: Limpia formulario de solicitud
    clearForm(): void {
        this.startDate = '';
        this.endDate = '';
        this.reason = '';
    }

    // SOLO USUARIO: Detecta tecla ESC para cerrar modales
    @HostListener('document:keydown.escape', ['$event'])
    onEscapeKey(event: KeyboardEvent): void {
        if (this.showModal) {
            this.closeModal();
        }
    }

    /* ==================== HELPERS Y FORMATTERS ==================== */
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

    /* ==================== MÉTODOS ADICIONALES DE UTILIDAD ==================== */
    // Verifica si el usuario puede enviar solicitudes
    canSubmitRequest(): boolean {
        return (
            this.totalAcceptedHours > 0 &&
            !!this.startDate &&
            !!this.endDate &&
            !!this.reason
        );
    }

    // Verifica si el usuario puede añadir horas
    canAddHours(): boolean {
        return this.hours > 0 && this.description.trim().length > 0;
    }

    // Obtiene el total de horas registradas
    getTotalHours(): number {
        return this.hourList.reduce((total, hour) => total + hour.hours, 0);
    }

    // Obtiene el número de solicitudes pendientes
    getPendingRequests(): number {
        return this.requests.filter(request => request.status === 'Pendiente').length;
    }

    // Obtiene el número de solicitudes aceptadas
    getAcceptedRequests(): number {
        return this.requests.filter(request => request.status === 'Aceptada').length;
    }

    // Verifica si hay datos cargados
    hasHoursData(): boolean {
        return this.hourList.length > 0;
    }

    hasRequestsData(): boolean {
        return this.requests.length > 0;
    }

    // Refresca todos los datos
    refreshData(): void {
        this.loadUserData();
    }
}