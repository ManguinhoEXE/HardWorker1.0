import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { UserService } from '../Services/user.service';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../Services/auth.service';
import { hourService } from '../Services/hour.service';
import { CompensatoryService } from '../Services/compensatory.service';
import { Notification } from '../Interfaces/index';
import { SignalRService } from '../Services/signalr.service';
import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';



@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit {

  /**
   * ==================== 2. PROPIEDADES ====================
   */

  // 2.1 Información del usuario
  firstName: string = '';
  lastName: string = '';
  profileImage: string | null = null;
  readonly defaultProfileImage: string = 'http://localhost:5072/uploads/descarga.png';
  userRole: string = '';
  currentUserId: string = '';

  private static profileImageCache: { [userId: string]: string } = {};
  private static imageValidationCache: { [url: string]: boolean } = {};



  // 2.2 Sistema de notificaciones
  notifications: Notification[] = [];
  selectedNotification: Notification | null = null;
  private NOTIFICATIONS_STORAGE_KEY: string = '';
  private readonly MAX_NOTIFICATIONS = 50;


  // 2.3 Mensajes de estado
  successMessage: string = '';
  errorMessage: string = '';

  // 2.4 Variables adicionales
  hours = 0;
  description = '';

  /**
   * ==================== 3. CICLO DE VIDA ====================
   */
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,

    private UserService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private AuthService: AuthService,
    private hourService: hourService,
    private compensatoryService: CompensatoryService,
    private signalRService: SignalRService

  ) { }

  ngOnInit(): void {

    this.userRole = this.AuthService.getCurrentUserRole() || 'User';
    this.loadUserData();
  }

  /**
   * ==================== 4. CARGA DE DATOS DEL USUARIO ====================
   */

  /**
   * Carga los datos del usuario y configura SignalR
   */

  private loadUserData(): void {
    this.UserService.getUser().subscribe({
      next: (user) => {
        console.log('=== USUARIO CARGADO ===');
        console.log('Usuario completo:', JSON.stringify(user, null, 2));

        this.firstName = user.firstName;
        this.lastName = user.lastName;

        this.currentUserId = user.id.toString();

        this.NOTIFICATIONS_STORAGE_KEY = `hardworker_notifications_user_${this.currentUserId}`;

        this.loadNotificationsFromStorage();

        const imageUrl = user.profileimage;
        this.setProfileImage(imageUrl);
        this.initializeSignalR(user);
      },
      error: (err) => {
        console.error('Error loading user:', err);
        this.router.navigate(['/iniciarsesion']);
      }
    });
  }

  /**
  *  CARGAR notificaciones desde localStorage
  */
  private loadNotificationsFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('[NavComponent] ⚠️ No estamos en navegador - saltando carga de localStorage');
      this.notifications = [];
      return;
    }

    try {
      if (!this.NOTIFICATIONS_STORAGE_KEY) {
        console.warn('[NavComponent] ⚠️ No se puede cargar notificaciones: usuario no identificado');
        return;
      }

      const storedNotifications = localStorage.getItem(this.NOTIFICATIONS_STORAGE_KEY);

      if (storedNotifications) {
        this.notifications = JSON.parse(storedNotifications);
        console.log(`[NavComponent] ✅ ${this.notifications.length} notificaciones cargadas para usuario ${this.currentUserId}`);
        this.cdr.detectChanges();
      } else {
        console.log(`[NavComponent] ℹ️ No hay notificaciones guardadas para usuario ${this.currentUserId}`);
        this.notifications = [];
      }
    } catch (error) {
      console.error('[NavComponent] ❌ Error cargando notificaciones desde localStorage:', error);
      this.notifications = [];
    }
  }

  /**
  *  GUARDAR notificaciones en localStorage
  */
  private saveNotificationsToStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('[NavComponent] ⚠️ No estamos en navegador - saltando guardado en localStorage');
      return;
    }

    try {
      if (!this.NOTIFICATIONS_STORAGE_KEY) {
        console.warn('[NavComponent] ⚠️ No se puede guardar notificaciones: usuario no identificado');
        return;
      }

      const notificationsToSave = this.notifications.slice(0, this.MAX_NOTIFICATIONS);
      localStorage.setItem(this.NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notificationsToSave));
      console.log(`[NavComponent] ✅ ${notificationsToSave.length} notificaciones guardadas para usuario ${this.currentUserId}`);
    } catch (error) {
      console.error('[NavComponent] ❌ Error guardando notificaciones en localStorage:', error);
    }
  }

  /**
   *  LIMPIAR notificaciones del storage
   */
  public clearAllNotifications(): void {
    this.notifications = [];
    this.saveNotificationsToStorage();
    this.cdr.detectChanges();
    console.log(`[NavComponent] Todas las notificaciones eliminadas para usuario ${this.currentUserId}`);
  }

  /**
   *  ELIMINAR notificación específica
   */
  private removeNotificationById(id: number): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveNotificationsToStorage();
  }
  private async initializeSignalR(user: any): Promise<void> {
    try {
      console.log('[NavComponent] Iniciando SignalR para usuario:', user.id);
      await this.signalRService.initializeAfterLogin(user);
      console.log('[NavComponent]  SignalR inicializado exitosamente');

      // Configurar listener para notificaciones después de la inicialización
      this.listenToGlobalNotifications();
    } catch (error) {
      console.error('[NavComponent]  Error inicializando SignalR:', error);
    }
  }

  private listenToGlobalNotifications(): void {
    const checkForGlobalSignalR = () => {
      if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && (window as any).signalRConnection) {
        console.log('[NavComponent] ✅ SignalR global encontrado, configurando listener de eventos');

        window.addEventListener('signalr-notification', (event: any) => {
          const data = event.detail;
          console.log('[NavComponent] 📧 Evento signalr-notification recibido:', data);
          this.handleNotification(data);
        });

        console.log('[NavComponent] ✅ Event listener configurado para signalr-notification');

      } else {
        console.log('[NavComponent] ⏳ Esperando SignalR global...');
        setTimeout(checkForGlobalSignalR, 1000);
      }
    };

    setTimeout(checkForGlobalSignalR, 500);
  }

  /**
  * Configura y asigna la imagen de perfil del usuario
  */
  private setProfileImage(imageUrl: string | null | undefined): void {
    console.log('=== CONFIGURACIÓN DE IMAGEN DE PERFIL ===');
    console.log('URL recibida:', imageUrl);

    if (!imageUrl || imageUrl.trim() === '') {
      console.warn('No se proporcionó URL de imagen. Usando imagen por defecto.');
      this.profileImage = this.defaultProfileImage;
      this.cdr.detectChanges();
      return;
    }

    const cacheKey = `${this.currentUserId}_${imageUrl}`;
    if (NavComponent.profileImageCache[cacheKey]) {
      console.log('✅ Imagen encontrada en caché:', NavComponent.profileImageCache[cacheKey]);
      this.profileImage = NavComponent.profileImageCache[cacheKey];
      this.cdr.detectChanges();
      return;
    }

    let finalImageUrl = imageUrl;

    if (!finalImageUrl.includes('?')) {
      const timestamp = new Date().getTime();
      finalImageUrl = `${imageUrl}?t=${timestamp}`;
    }

    console.log('URL final con timestamp:', finalImageUrl);

    this.profileImage = finalImageUrl;
    this.cdr.detectChanges();

    this.validateImageUrlInBackground(finalImageUrl, cacheKey);

  }

  /**
   * Valida si una URL de imagen es accesible
   */

  private validateImageUrlInBackground(url: string, cacheKey: string): void {
    // Si ya validamos esta URL antes, no hacerlo de nuevo
    if (NavComponent.imageValidationCache[url] !== undefined) {
      if (NavComponent.imageValidationCache[url]) {
        NavComponent.profileImageCache[cacheKey] = url;
      }
      return;
    }

    this.validateImageUrl(url)
      .then((isValid) => {
        NavComponent.imageValidationCache[url] = isValid;

        if (isValid) {
          console.log('✅ Imagen validada exitosamente:', url);
          NavComponent.profileImageCache[cacheKey] = url;
        } else {
          console.warn('❌ Imagen no válida, fallback a imagen por defecto');
          this.profileImage = this.defaultProfileImage;
          this.cdr.detectChanges();
        }
      })
      .catch((error) => {
        console.error('Error validando imagen:', error);
        NavComponent.imageValidationCache[url] = false;
        this.profileImage = this.defaultProfileImage;
        this.cdr.detectChanges();
      });
  }

  private validateImageUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('Iniciando validación de:', url);

      const img = new Image();
      img.onload = () => {
        console.log('Imagen cargada exitosamente:', url);
        resolve(true);
      };
      img.onerror = (error) => {
        console.log(' Error cargando imagen:', url, error);
        resolve(false);
      };

      // Timeout para evitar esperas indefinidas
      setTimeout(() => {
        console.log(' Timeout validando imagen:', url);
        resolve(false);
      }, 5000);

      img.src = url;
    });
  }

  /**
   * Procesa las notificaciones recibidas via SignalR
   */
  private handleNotification(data: any): void {
    console.log('Received RAW notification:', data);

    if (data.type === 'hoursRequest' && this.userRole !== 'Admin') {
      console.warn(' Notificación hoursRequest ignorada - Usuario no es Admin');
      return;
    }

    if (data.type === 'hoursAccepted' && this.userRole === 'Admin') {
      console.warn(' Notificación hoursAccepted ignorada - Admin no debe verlas');
      return;
    }

    if (data.type === 'hoursRejected' && this.userRole === 'Admin') {
      console.warn(' Notificación hoursRejected ignorada - Admin no debe verlas');
      return;
    }

    const validTypes = [
      'hoursRequest', 'hoursAccepted', 'hoursRejected',
      'compRequest', 'compAccepted', 'compRejected'
    ];

    if (!validTypes.includes(data.type)) {
      console.warn('Notification ignored, type:', data.type);
      return;
    }

    //VERIFICAR SI YA EXISTE LA NOTIFICACIÓN
    const existingNotification = this.notifications.find(n =>
      n.id === data.id && n.type === data.type
    );

    if (existingNotification) {
      console.log(`[NavComponent] Notificación duplicada ignorada - ID: ${data.id}, Tipo: ${data.type}`);
      return;
    }

    const notification: Notification = {
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      type: data.type,
      hours: data.hours,
      description: data.description,
      from: data.from,
      to: data.to,
      reason: data.reason,
      acceptedDate: data.acceptedDate,
      rejectedDate: data.rejectedDate
    };

    console.log(`[${data.type}] Agregando nueva notificación:`, notification);
    this.notifications.unshift(notification);
    this.saveNotificationsToStorage();
    this.cdr.detectChanges();
  }

  /**
   * ==================== 6. GESTIÓN DE SESIÓN ====================
   */

  /**
   * Cierra la sesión del usuario
   */
  logout(): void {
    this.saveNotificationsToStorage();

    this.signalRService.disconnect().then(() => {
      console.log('[NavComponent] SignalR desconectado antes del logout');

      this.AuthService.logout().subscribe({
        next: () => {
          console.log('Sesión cerrada');
          this.clearSessionAndRedirect();
        },
        error: (error) => {
          console.error('Error al cerrar sesión:', error);
          this.clearSessionAndRedirect();
        }
      });
    });
  }

  /**
   * Limpia la sesión y redirige al login
   */
  private clearSessionAndRedirect(): void {
    this.notifications = [];
    this.currentUserId = '';
    this.NOTIFICATIONS_STORAGE_KEY = '';

    // 🚀 PROTEGER EL USO DE DOCUMENT
    if (isPlatformBrowser(this.platformId)) {
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    }

    this.router.navigate(['/iniciarsesion']);
  }

  /**
   * ==================== 7. GESTIÓN DE MODALES ====================
   */

  /**
   * Abre el modal de notificación si es interactiva
   */
  openModal(notification: Notification): void {
    if (notification.type !== 'hoursRequest' && notification.type !== 'compRequest') {
      return;
    }
    this.selectedNotification = notification;
  }

  /**
   * Cierra el modal de notificación
   */
  closeModal(): void {
    this.selectedNotification = null;
  }

  /**
   * ==================== 8. GESTIÓN DE SOLICITUDES ====================
   */

  /**
   * Acepta una solicitud de horas
   */
  acceptHourRequest(id: number): void {
    this.hourService.acceptRequest(id).subscribe({
      next: () => {
        this.handleRequestSuccess('Solicitud de Horas aceptada.', id);
      },
      error: (err) => {
        this.handleRequestError(err);
      }
    });
  }

  /**
   * Rechaza una solicitud de horas
   */
  rejectHourRequest(id: number): void {
    this.hourService.rejectRequest(id).subscribe({
      next: () => {
        this.handleRequestSuccess('Solicitud de Horas rechazada.', id);
      },
      error: (err) => {
        this.handleRequestError(err);
      }
    });
  }

  /**
   * Acepta una solicitud de compensatorio
   */
  acceptCompRequest(id: number): void {
    this.compensatoryService.acceptRequestComp(id).subscribe({
      next: () => {
        this.handleRequestSuccess('Compensatorio Aceptado.', id);
      },
      error: (err) => {
        this.handleRequestError(err);
      }
    });
  }

  /**
   * Rechaza una solicitud de compensatorio
   */
  rejectCompRequest(id: number): void {
    this.compensatoryService.rejectRequestComp(id).subscribe({
      next: () => {
        this.handleRequestSuccess('Compensatorio Rechazado.', id);
      },
      error: (err) => {
        this.handleRequestError(err);
      }
    });
  }

  /**
   * ==================== 9. UTILIDADES DE SOLICITUDES ====================
   */

  private handleRequestSuccess(message: string, id: number): void {
    this.successMessage = message;

    this.removeNotificationById(id);
    this.closeModal();
    this.cdr.detectChanges();

    setTimeout(() => this.successMessage = '', 5000);
  }

  /**
   * Maneja errores de solicitudes
   */
  private handleRequestError(error: any): void {
    this.errorMessage = `Error ${error.status}: ${error.error?.message || error.message}`;
    setTimeout(() => this.errorMessage = '', 5000);
  }

  /**
   * ==================== 10. GESTIÓN DE IMAGEN DE PERFIL ====================
   */

  /**
   * Maneja la selección de archivo para imagen de perfil
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) {
      console.error('No se seleccionó ningún archivo.');
      return;
    }

    const file = input.files[0];

    // Validaciones existentes...
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Por favor seleccione un archivo de imagen válido.';
      setTimeout(() => this.errorMessage = '', 5000);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'La imagen debe ser menor a 5MB.';
      setTimeout(() => this.errorMessage = '', 5000);
      return;
    }

    console.log('Archivo seleccionado:', file);

    const formData = new FormData();
    formData.append('file', file);

    this.UserService.uploadProfileImage(formData).subscribe({
      next: (response) => {
        console.log('Respuesta del backend:', response);

        let newImageUrl = response.profileimage;
        if (!newImageUrl.startsWith('http')) {
          newImageUrl = `http://localhost:5072/${newImageUrl}`;
        }

        const timestamp = new Date().getTime();
        this.profileImage = `${newImageUrl}?v=${timestamp}`;

        this.cdr.detectChanges();

        console.log('Nueva imagen asignada:', this.profileImage);
        this.successMessage = 'Imagen de perfil actualizada con éxito.';
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (error) => {
        console.error('Error al subir la imagen:', error);
        this.errorMessage = 'Error al subir la imagen. Inténtalo de nuevo.';
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  /**
   * Maneja errores de carga de imagen
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    console.warn(' Error al cargar imagen en DOM:', imgElement.src);

    if (imgElement.src !== this.defaultProfileImage) {
      console.log('Cambiando a imagen por defecto desde onImageError');
      imgElement.src = this.defaultProfileImage;
      this.profileImage = this.defaultProfileImage;
      this.cdr.detectChanges();
    } else {
      console.error(' Error crítico: ni la imagen del usuario ni la por defecto se pueden cargar');
    }
  }

  /**
   * ==================== 11. UTILIDADES DE TRACKBY ====================
   */

  trackByNotification(index: number, notification: Notification): number {
    return notification.id;
  }

  /**
   * ==================== 12. LIMPIEZA DE RECURSOS ====================
   */


  ngOnDestroy(): void {
    this.saveNotificationsToStorage();

    // 🚀 PROTEGER EL USO DE WINDOW
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
      window.removeEventListener('signalr-notification', this.handleNotification);
      console.log('[NavComponent] ✅ Event listener removido correctamente');
    } else {
      console.log('[NavComponent] ⚠️ No se puede remover event listener - no estamos en navegador');
    }

    this.signalRService.disconnect();
  }

}