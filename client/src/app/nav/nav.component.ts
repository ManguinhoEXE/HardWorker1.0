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
import { NotificationStorageService } from '../Services/notification-storage.service';


@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {

  /* ==================== 3. PROPIEDADES DE USUARIO ==================== */
  firstName: string = '';
  lastName: string = '';
  profileImage: string | null = null;
  readonly defaultProfileImage: string = 'http://localhost:5072/uploads/descarga.png';
  userRole: string = '';
  currentUserId: string = '';

  // Cache para imágenes de perfil
  private static profileImageCache: { [userId: string]: string } = {};
  private static imageValidationCache: { [url: string]: boolean } = {};

  /* ==================== 4. PROPIEDADES DE NOTIFICACIONES ==================== */
  notifications: Notification[] = [];
  selectedNotification: Notification | null = null;
  private NOTIFICATIONS_STORAGE_KEY: string = '';
  private readonly MAX_NOTIFICATIONS = 50;

  /* ==================== 5. PROPIEDADES DE UI Y ESTADO ==================== */
  successMessage: string = '';
  errorMessage: string = '';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private UserService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private AuthService: AuthService,
    private hourService: hourService,
    private compensatoryService: CompensatoryService,
    private signalRService: SignalRService,
    private notificationStorage: NotificationStorageService

  ) { }

  /* ==================== 6. LIFECYCLE HOOKS ==================== */
  ngOnInit(): void {
    this.userRole = this.AuthService.getCurrentUserRole() || 'User';
    this.loadUserData();
  }

  ngOnDestroy(): void {
    if (this.currentUserId) {
      const userId = parseInt(this.currentUserId);
      this.notificationStorage.cleanReadNotifications(userId);
      console.log(` [NavComponent] Notificaciones leídas eliminadas al destruir componente para usuario ${userId}`);
    }

    this.saveNotificationsToStorage();

    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
      window.removeEventListener('signalr-notification', this.handleNotification);
      console.log('[NavComponent]  Event listener removido correctamente');
    }

    this.signalRService.disconnect();
  }

  /* ==================== 7. CARGA DE DATOS DEL USUARIO ==================== */
  private loadUserData(): void {
    this.UserService.getUser().subscribe({
      next: (user) => {
        console.log('=== USUARIO CARGADO ===', user);

        this.firstName = user.firstName;
        this.lastName = user.lastName;
        this.currentUserId = user.id.toString();
        this.userRole = user.role || this.AuthService.getCurrentUserRole() || 'User';
        this.NOTIFICATIONS_STORAGE_KEY = `hardworker_notifications_user_${this.currentUserId}`;

        this.loadNotificationsFromStorage();
        this.setProfileImage(user.profileimage);
        this.initializeSignalR(user);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading user:', err);
        this.router.navigate(['/iniciarsesion']);
      }
    });
  }

  public refreshUserRole(): void {
    const currentRole = this.AuthService.getCurrentUserRole();
    if (currentRole && currentRole !== this.userRole) {
      console.log(`[NavComponent] Rol actualizado: ${this.userRole} → ${currentRole}`);
      this.userRole = currentRole;
      this.cdr.detectChanges();
    }
  }

  /* ==================== 8. GESTIÓN DE IMAGEN DE PERFIL ==================== */
  private setProfileImage(imageUrl: string | null | undefined): void {
    if (!imageUrl?.trim()) {
      this.profileImage = this.defaultProfileImage;
      this.cdr.detectChanges();
      return;
    }

    const cacheKey = `${this.currentUserId}_${imageUrl}`;
    if (NavComponent.profileImageCache[cacheKey]) {
      this.profileImage = NavComponent.profileImageCache[cacheKey];
      this.cdr.detectChanges();
      return;
    }

    const finalImageUrl = !imageUrl.includes('?')
      ? `${imageUrl}?t=${new Date().getTime()}`
      : imageUrl;

    this.profileImage = finalImageUrl;
    this.cdr.detectChanges();
    this.validateImageUrlInBackground(finalImageUrl, cacheKey);
  }

  private validateImageUrlInBackground(url: string, cacheKey: string): void {
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
          NavComponent.profileImageCache[cacheKey] = url;
        } else {
          this.profileImage = this.defaultProfileImage;
          this.cdr.detectChanges();
        }
      })
      .catch(() => {
        NavComponent.imageValidationCache[url] = false;
        this.profileImage = this.defaultProfileImage;
        this.cdr.detectChanges();
      });
  }

  private validateImageUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 5000);
      img.src = url;
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showError('Por favor seleccione un archivo de imagen válido.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showError('La imagen debe ser menor a 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.UserService.uploadProfileImage(formData).subscribe({
      next: (response) => {
        let newImageUrl = response.profileimage;
        if (!newImageUrl.startsWith('http')) {
          newImageUrl = `http://localhost:5072/${newImageUrl}`;
        }

        this.profileImage = `${newImageUrl}?v=${new Date().getTime()}`;
        this.cdr.detectChanges();
        this.showSuccess('Imagen de perfil actualizada con éxito.');
      },
      error: (error) => {
        console.error('Error al subir la imagen:', error);
        this.showError('Error al subir la imagen. Inténtalo de nuevo.');
      }
    });
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement.src !== this.defaultProfileImage) {
      imgElement.src = this.defaultProfileImage;
      this.profileImage = this.defaultProfileImage;
      this.cdr.detectChanges();
    }
  }

  /* ==================== 9. GESTIÓN DE SIGNALR ==================== */
  private async initializeSignalR(user: any): Promise<void> {
    try {
      await this.signalRService.initializeAfterLogin(user);
      this.listenToGlobalNotifications();
    } catch (error) {
      console.error('[NavComponent] Error inicializando SignalR:', error);
    }
  }

  private listenToGlobalNotifications(): void {
    const checkForGlobalSignalR = () => {
      if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
        window.addEventListener('signalr-notification', (event: any) => {
          this.handleNotification(event.detail);
        });

        window.addEventListener('signalr-distribute', (event: any) => {
          this.handleDistributedNotification(event.detail);
        });

      } else {
        setTimeout(checkForGlobalSignalR, 1000);
      }
    };
    setTimeout(checkForGlobalSignalR, 500);
  }

  private handleDistributedNotification(data: any): void {
    console.log(' [NavComponent] Notificación distribuida recibida:', data);
    console.log(' [NavComponent] Usuario actual:', this.currentUserId, 'Rol:', this.userRole);

    const currentUserId = parseInt(this.currentUserId);
    let shouldReload = false;

    if (data.targetUserIds && Array.isArray(data.targetUserIds)) {
      if (data.targetUserIds.includes(currentUserId)) {
        console.log(' [NavComponent] Usuario actual está en targetUserIds');
        shouldReload = true;
      }
    }
    else if (data.targetRole === 'Admin' && this.userRole === 'Admin') {
      console.log(' [NavComponent] Usuario actual es Admin y notificación es para Admins');
      shouldReload = true;
    }
    else if (data.targetRole === 'User' && (this.userRole === 'User' || this.userRole === 'Admin')) {
      if (data.userId === currentUserId) {
        console.log(' [NavComponent] Usuario actual coincide con el destinatario');
        shouldReload = true;
      }
    }
    else {
      switch (data.type) {
        case 'compRequest':
        case 'hoursRequest':
          if (this.userRole === 'Admin') {
            console.log(' [NavComponent] Solicitud para admin (fallback)');
            shouldReload = true;
          }
          break;
        case 'compAccepted':
        case 'compRejected':
        case 'hoursAccepted':
        case 'hoursRejected':
          if (data.userId === currentUserId) {
            console.log(' [NavComponent] Respuesta para usuario actual (fallback)');
            shouldReload = true;
          }
          break;
      }
    }

    if (shouldReload) {
      console.log(' [NavComponent] Recargando notificaciones...');
      setTimeout(() => {
        this.loadNotificationsFromStorage();
      }, 500);
    } else {
      console.log(' [NavComponent] Notificación no es para este usuario, ignorando');
    }
  }


  /* ==================== 10. GESTIÓN DE NOTIFICACIONES ==================== */
  private loadNotificationsFromStorage(): void {
    if (!isPlatformBrowser(this.platformId) || !this.currentUserId) {
      this.notifications = [];
      return;
    }

    try {
      const userId = parseInt(this.currentUserId);

      this.notificationStorage.cleanReadNotifications(userId);

      const storedNotifications = this.notificationStorage.getUnreadNotificationsForUser(userId);

      this.notifications = storedNotifications.map((sn: any) => ({
        id: sn.id || sn.data?.id,
        firstName: sn.firstName || sn.data?.firstName || '',
        lastName: sn.lastName || sn.data?.lastName || '',
        type: sn.type,
        hours: sn.hours || sn.data?.hours || 0,
        description: sn.description || sn.data?.description || '',
        from: sn.from || sn.data?.from,
        to: sn.to || sn.data?.to,
        reason: sn.reason || sn.data?.reason || '',
        acceptedDate: sn.acceptedDate || sn.data?.acceptedDate,
        rejectedDate: sn.rejectedDate || sn.data?.rejectedDate,
        isRead: sn.isRead || false,
        timestamp: sn.timestamp || new Date()
      }));

      console.log(` Cargadas ${this.notifications.length} notificaciones NO LEÍDAS para usuario ${userId}`);

      this.notificationStorage.cleanOldNotifications(userId, 30);

      this.cdr.detectChanges();

    } catch (error) {
      console.error('[NavComponent] Error cargando notificaciones:', error);
      this.notifications = [];
    }
  }

  private saveNotificationsToStorage(): void {
    if (!isPlatformBrowser(this.platformId) || !this.currentUserId) return;

    try {
      const userId = parseInt(this.currentUserId);

      this.notificationStorage.cleanReadNotifications(userId);

      this.notificationStorage.cleanOldNotifications(userId, 30);

      console.log(` [NavComponent] Notificaciones guardadas y limpiadas para usuario ${userId}`);

    } catch (error) {
      console.error('[NavComponent] Error guardando notificaciones:', error);
    }
  }

  private handleNotification(data: any): void {
    if (this.userRole === 'Super') {
      console.log(' Super no recibe notificaciones administrativas:', data.type);
      return;
    }

    if ((data.type === 'hoursRequest' || data.type === 'compRequest') && this.userRole !== 'Admin') {
      return;
    }

    if ((data.type === 'hoursAccepted' || data.type === 'hoursRejected' ||
      data.type === 'compAccepted' || data.type === 'compRejected') &&
      (this.userRole === 'Admin' || this.userRole === 'Super')) {
      return;
    }

    const validTypes = ['hoursRequest', 'hoursAccepted', 'hoursRejected', 'compRequest', 'compAccepted', 'compRejected'];
    if (!validTypes.includes(data.type)) {
      console.warn(' Tipo de notificación no válido:', data.type);
      return;
    }

    if (this.notifications.find(n => n.id === data.id && n.type === data.type)) {
      console.log(' Notificación duplicada ignorada:', data.type, data.id);
      return;
    }

    console.log(` ${this.userRole} recibe notificación:`, data.type);

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

    this.notifications.unshift(notification);

    this.saveNotificationsToStorage();
    this.cdr.detectChanges();
  }

  /* ==================== 11. MÉTODOS DINÁMICOS PARA NOTIFICACIONES ==================== */
  isActionableNotification(type: string): boolean {
    return type === 'hoursRequest' || type === 'compRequest';
  }

  getNotificationContent(notification: any): string {
    switch (notification.type) {
      case 'hoursRequest':
        return `Ha solicitado <strong>${notification.hours} horas</strong><br>"${notification.description}"`;

      case 'hoursAccepted':
        return `Sus <strong>${notification.hours} horas</strong> han sido aceptadas.<br><strong>${notification.acceptedDate}</strong>`;

      case 'hoursRejected':
        return `Sus <strong>${notification.hours} horas</strong> han sido rechazadas.<br><strong>${notification.rejectedDate}</strong>`;

      case 'compRequest':
        return `De <strong>${this.formatDate(notification.from)}</strong> a <strong>${this.formatDate(notification.to)}</strong><br>Razón: "${notification.reason}"`;

      case 'compAccepted':
        return `Su compensatorio de <strong>${this.formatDate(notification.from)}</strong> a <strong>${this.formatDate(notification.to)}</strong> ha sido aceptado.<br>Razón: "${notification.reason}"`;

      case 'compRejected':
        return `Su compensatorio de <strong>${this.formatDate(notification.from)}</strong> a <strong>${this.formatDate(notification.to)}</strong> ha sido rechazado.<br>Razón: "${notification.reason}"`;

      default:
        return 'Notificación';
    }
  }

  getModalIcon(): string {
    if (!this.selectedNotification) return '';
    return this.selectedNotification.type === 'hoursRequest' ? 'fas fa-bell' : 'fas fa-calendar-alt';
  }

  getModalTitle(): string {
    if (!this.selectedNotification) return '';
    return this.selectedNotification.type === 'hoursRequest' ? 'Solicitud de Horas' : 'Solicitud de Compensatorio';
  }

  getModalContent(): string {
    if (!this.selectedNotification) return '';

    if (this.selectedNotification.type === 'hoursRequest') {
      return `Ha solicitado <strong>${this.selectedNotification.hours}</strong> horas<br>"${this.selectedNotification.description}"`;
    } else {
      return `Ha solicitado un compensatorio:<br>De <strong>${this.formatDate(this.selectedNotification.from)}</strong><br>Hasta <strong>${this.formatDate(this.selectedNotification.to)}</strong><br>Razón: "${this.selectedNotification.reason}"`;
    }
  }

  getNotificationCursor(notification: Notification): string {
    if (this.userRole === 'User') {
      return 'pointer';
    }

    if (this.userRole === 'Admin') {
      return this.isActionableNotification(notification.type) ? 'pointer' : 'default';
    }

    return 'default';
  }

  private formatDate(date: any): string {
    if (!date) return '';

    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /* ==================== 12. GESTIÓN DE MODALES ==================== */
  openModal(notification: Notification): void {
    console.log(' [NavComponent] openModal llamado:', {
      userRole: this.userRole,
      notificationType: notification.type,
      notificationId: notification.id
    });

    if (this.userRole === 'User') {
      console.log('[NavComponent] Usuario normal - marcando como leída');
      this.markNotificationAsRead(notification.id);
      return;
    }

    if (this.userRole === 'Admin' && this.isActionableNotification(notification.type)) {
      console.log('[NavComponent] Admin - abriendo modal para acción');
      this.selectedNotification = notification;
      return;
    }

    if (this.userRole === 'Admin' && !this.isActionableNotification(notification.type)) {
      console.log('[NavComponent] Admin - notificación no accionable, marcando como leída');
      this.markNotificationAsRead(notification.id);
      return;
    }

    console.log('[NavComponent] Caso no manejado');
  }

  closeModal(): void {
    this.selectedNotification = null;
  }


  private markNotificationAsRead(notificationId: number): void {
    try {
      const notification = this.notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.isRead = true;
        console.log(` [NavComponent] Notificación ${notificationId} marcada como leída en memoria`);
      }

      if (this.currentUserId) {
        const userId = parseInt(this.currentUserId);
        this.notificationStorage.markAsRead(userId, notificationId.toString());
        console.log(` [NavComponent] Notificación ${notificationId} marcada como leída en storage`);

        setTimeout(() => {
          this.notifications = this.notifications.filter(n => n.id !== notificationId);
          this.cdr.detectChanges();
          console.log(` [NavComponent] Notificación leída ${notificationId} eliminada de la vista`);
        }, 1000);
      }

      this.cdr.detectChanges();

    } catch (error) {
      console.error('[NavComponent] Error marcando notificación como leída:', error);
    }
  }

  /* ==================== 13. GESTIÓN UNIFICADA DE SOLICITUDES ==================== */
  acceptRequest(): void {
    if (!this.selectedNotification) return;

    if (this.selectedNotification.type === 'hoursRequest') {
      this.acceptHourRequest(this.selectedNotification.id);
    } else {
      this.acceptCompRequest(this.selectedNotification.id);
    }
  }

  rejectRequest(): void {
    if (!this.selectedNotification) return;

    if (this.selectedNotification.type === 'hoursRequest') {
      this.rejectHourRequest(this.selectedNotification.id);
    } else {
      this.rejectCompRequest(this.selectedNotification.id);
    }
  }

  private acceptHourRequest(id: number): void {
    this.hourService.acceptRequest(id).subscribe({
      next: () => this.handleRequestSuccess('Solicitud de Horas aceptada.', id),
      error: (err) => this.handleRequestError(err)
    });
  }

  private rejectHourRequest(id: number): void {
    this.hourService.rejectRequest(id).subscribe({
      next: () => this.handleRequestSuccess('Solicitud de Horas rechazada.', id),
      error: (err) => this.handleRequestError(err)
    });
  }

  private acceptCompRequest(id: number): void {
    this.compensatoryService.acceptRequestComp(id).subscribe({
      next: () => this.handleRequestSuccess('Compensatorio Aceptado.', id),
      error: (err) => this.handleRequestError(err)
    });
  }

  private rejectCompRequest(id: number): void {
    this.compensatoryService.rejectRequestComp(id).subscribe({
      next: () => this.handleRequestSuccess('Compensatorio Rechazado.', id),
      error: (err) => this.handleRequestError(err)
    });
  }

  /* ==================== 14. UTILIDADES ==================== */
  private handleRequestSuccess(message: string, id: number): void {
    this.showSuccess(message);

    this.removeNotificationById(id);

    this.removeNotificationFromStorage(id);

    this.closeModal();
    this.cdr.detectChanges();
  }

  private removeNotificationFromStorage(notificationId: number): void {
    if (!isPlatformBrowser(this.platformId) || !this.currentUserId) return;

    try {
      const userId = parseInt(this.currentUserId);

      const currentNotifications = this.notificationStorage.getNotificationsForUser(userId);

      const filteredNotifications = currentNotifications.filter((n: any) =>
        !(n.id === notificationId || n.data?.id === notificationId)
      );

      const storageKey = `hardworker_notifications_user_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(filteredNotifications));

      console.log(` [NavComponent] Notificación ${notificationId} eliminada del localStorage del admin ${userId}`);

    } catch (error) {
      console.error('[NavComponent] Error eliminando notificación del storage:', error);
    }
  }

  private handleRequestError(error: any): void {
    this.showError(`Error ${error.status}: ${error.error?.message || error.message}`);
  }

  private removeNotificationById(id: number): void {
    const beforeCount = this.notifications.length;
    this.notifications = this.notifications.filter(n => n.id !== id);
    const afterCount = this.notifications.length;

    console.log(`[NavComponent] Notificaciones en memoria: ${beforeCount} → ${afterCount}`);

    this.saveNotificationsToStorage();
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    setTimeout(() => this.successMessage = '', 5000);
  }

  private showError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = '', 5000);
  }

  public clearAllNotifications(): void {
    this.notifications = [];
    this.saveNotificationsToStorage();
    this.cdr.detectChanges();
  }

  trackByNotification(index: number, notification: Notification): number {
    return notification.id;
  }

  /* ==================== 15. GESTIÓN DE SESIÓN ==================== */

  logout(): void {
    if (this.currentUserId) {
      const userId = parseInt(this.currentUserId);
      this.notificationStorage.cleanReadNotifications(userId);
      console.log(` [NavComponent] Notificaciones leídas eliminadas al cerrar sesión para usuario ${userId}`);
    }

    this.saveNotificationsToStorage();

    this.signalRService.disconnect().then(() => {
      this.AuthService.logout().subscribe({
        next: () => this.clearSessionAndRedirect(),
        error: () => this.clearSessionAndRedirect()
      });
    });
  }

  private clearSessionAndRedirect(): void {
    this.notifications = [];
    this.currentUserId = '';
    this.NOTIFICATIONS_STORAGE_KEY = '';

    if (isPlatformBrowser(this.platformId)) {
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    }

    this.router.navigate(['/iniciarsesion']);
  }

  /* ==================== 16. GESTIÓN DE ROLES ==================== */
  isUser(): boolean {
    return this.AuthService.getCurrentUserRole() === 'User';
  }

  isAdmin(): boolean {
    return this.AuthService.getCurrentUserRole() === 'Admin';
  }

  isSuper(): boolean {
    return this.AuthService.getCurrentUserRole() === 'Super';
  }
}