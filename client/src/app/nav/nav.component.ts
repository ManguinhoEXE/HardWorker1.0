import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { UserService } from '../Services/user.service';
import { OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../Services/auth.service';
import * as signalR from '@microsoft/signalr';
import { hourService } from '../Services/hour.service';
import { CompensatoryService } from '../Services/compensatory.service';
import { HomeComponent } from '../home/home.component';


@Component({
  selector: 'app-nav',
  standalone: true, // Componente independiente
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit {
  firstName: string = '';
  lastName: string = '';
  profileImage: string | null = null;
  notifications: any[] = [];
  private hubConnection!: signalR.HubConnection;
  selectedNotification: any = null;
  successMessage: string = '';
  errorMessage: string = '';
  hours = 0;
  description = '';


  constructor(
    private UserService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private AuthService: AuthService,
    private hourService: hourService,
    private compensatoryService: CompensatoryService,
  ) { }

  /**
   * Carga los datos del usuario al inicializar el componente.
   * Asigna nombre y verifica si la imagen está accesible.
   */
  ngOnInit() {
    this.UserService.getUser().subscribe(
      (user) => {
        this.firstName = user.firstName;
        this.lastName = user.lastName;
        const imageUrl = user.profileimage;
        this.checkImageBeforeAssigning(imageUrl);

        // --- SignalR para notificaciones ---
        this.hubConnection = new signalR.HubConnectionBuilder()
          .withUrl('http://localhost:5072/notificationHub', {
            // envía la cookie y usa el JWT para auth
            accessTokenFactory: () => this.AuthService.getToken(),
            withCredentials: true
          })
          .withAutomaticReconnect()
          .build();

        this.hubConnection.on('ReceiveNotification', data => {
          console.log(' Received RAW notification:', data);
          const tiposValidos = [
            'hoursRequest', 'hoursAccepted', 'hoursRejected',
            'compRequest', 'compAccepted', 'compRejected',
          ];
          if (!tiposValidos.includes(data.type)) {
            console.warn('Notification ignored, type:', data.type);
            return;
          }
          const notification = {
            id: data.id,
            firstName: data.firstName,
            lastName: data.lastName,
            type: data.type,

            hours: data.hours,
            description: data.description,

            from: data.from,
            to: data.to,
            reason: data.reason
          };
          console.log(`[${data.type}] pushing notification:`, notification);
          this.notifications.unshift(notification);
          this.cdr.detectChanges();
        });

        this.hubConnection.start()
          .then(async () => {
            console.log(' SignalR connected. user.id=', user.id);
            try {
              await this.hubConnection.invoke('AddToGroup', user.id.toString());
              console.log(`→ Added to group ${user.id}`);
              if (user.role === 'Admin') {
                await this.hubConnection.invoke('AddToGroup', 'Admin');
                console.log('→ Added to group Admin');
              }
            } catch (e) {
              console.error('Error invoking AddToGroup:', e);
            }
          })
          .catch(err => console.error(' SignalR start failed:', err));
      }, err => {
        console.error('Error loading user:', err);
        this.router.navigate(['/iniciarsesion']);
      });
  }

  /**
   * Método para cerrar sesión.
   * Elimina el token y redirige a la página de inicio de sesión.
   */
  logout(): void {
    this.AuthService.logout().subscribe(
      () => {
        console.log('Sesión cerrada');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
        this.router.navigate(['/iniciarsesion']);
      },
      (error: any) => {
        console.error('Error al cerrar sesión:', error);
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
        this.router.navigate(['/iniciarsesion']);
      }
    );
  }

  openModal(notification: any) {
    if (notification.type !== 'hoursRequest'
      && notification.type !== 'compRequest') {
      return;
    }
    this.selectedNotification = notification;
  }

  closeModal() {
    this.selectedNotification = null;
  }


  /**
   * Acepta una solicitud de horas.
   * @param id ID de la solicitud a aceptar.
   */
  acceptHourRequest(id: number): void {
    this.hourService.acceptRequest(id).subscribe({
      next: res => {
        this.successMessage = 'Solicitud de Horas aceptada.';
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.closeModal();
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: err => {
        this.errorMessage = `Error ${err.status}: ${err.error?.message || err.message}`;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }



  rejectHourRequest(id: number): void {
    this.hourService.rejectRequest(id).subscribe({
      next: res => {
        this.successMessage = 'Solicitud de Horas rechazada.';
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.closeModal();
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: err => {
        this.errorMessage = `Error ${err.status}: ${err.error?.message || err.message}`;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  acceptCompRequest(id: number): void {
    this.compensatoryService.acceptRequestComp(id).subscribe({
      next: res => {
        this.successMessage = 'Compensatorio Aceptado.';
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.closeModal();
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: err => {
        this.errorMessage = `Error ${err.status}: ${err.error?.message || err.message}`;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  rejectCompRequest(id: number): void {
    this.compensatoryService.rejectRequestComp(id).subscribe({
      next: res => {
        this.successMessage = 'Compensatorio Rechazada.';
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.closeModal();
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: err => {
        this.errorMessage = `Error ${err.status}: ${err.error?.message || err.message}`;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }





  /**
   * Simula un clic en el input de archivo para cargar nueva imagen.
   */
  selectImage() {
    const fileInput = document.querySelector<HTMLInputElement>('#fileInput');
    if (fileInput) fileInput.click();
  }



  /**
   * Si ocurre un error al cargar la imagen, se establece una imagen por defecto.
   */
  onImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    if (!imgElement.src.includes('descarga.png')) {
      console.warn('Error al cargar imagen de perfil. Usando imagen por defecto.');
      imgElement.src = 'http://localhost:5072/uploads/descarga.png';
    }
  }

  /**
   * Verifica que una imagen exista y se pueda cargar antes de asignarla.
   * Si falla, usa imagen por defecto.
   */
  checkImageBeforeAssigning(url: string | null | undefined) {
    if (!url) {
      console.warn('No se proporcionó URL de imagen. Usando imagen por defecto.');
      this.profileImage = 'http://localhost:5072/uploads/descarga.png';
      this.cdr.detectChanges();
      return;
    }

    const img = new Image();
    img.onload = () => {
      console.log('Imagen del usuario cargada correctamente:', url);
      this.profileImage = url;
      this.cdr.detectChanges();
    };
    img.onerror = (error) => {
      console.warn('Error al cargar la imagen del usuario. Usando imagen de por defecto.', error);
      this.profileImage = 'http://localhost:5072/uploads/descarga.png';
      this.cdr.detectChanges();
    };
    img.src = url;
  }


  /**
   * Maneja la selección de un archivo e intenta subirlo al backend.
   * Si el backend responde exitosamente, actualiza la imagen de perfil.
   */
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      console.log('Archivo seleccionado:', file);

      const formData = new FormData();
      formData.append('file', file);

      console.log('FormData creado:', formData);

      this.UserService.uploadProfileImage(formData).subscribe(
        (response) => {
          console.log('Respuesta del backend:', response);
          // Se agrega timestamp para forzar recarga de imagen
          this.profileImage = `${response.profileImage}?t=${new Date().getTime()}`;
          console.log('URL de la nueva imagen asignada:', this.profileImage);
          this.cdr.detectChanges();
          alert('Imagen de perfil actualizada con éxito.');
        },
        (error) => {
          console.error('Error al subir la imagen:', error);
          alert('Error al subir la imagen.');
        }
      );
    } else {
      console.error('No se seleccionó ningún archivo.');
    }
  }


}
