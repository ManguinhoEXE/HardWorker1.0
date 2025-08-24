import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { hourService } from './hour.service';
import { NotificationStorageService } from './notification-storage.service';

@Injectable({
    providedIn: 'root'
})
export class SignalRService {
    private hubConnection: signalR.HubConnection | null = null;
    private readonly hubUrl = 'http://localhost:5072/notificationHub';

    public connectionState$ = new BehaviorSubject<string>('Disconnected');
    public notifications$ = new BehaviorSubject<any>(null);

    public hourStatusUpdated$ = new BehaviorSubject<any>(null);
    private isInitialized = false;

    constructor(
        private authService: AuthService,
        private hourService: hourService,
        private notificationStorage: NotificationStorageService

    ) {
        console.log('[SignalRService] Servicio creado, esperando inicialización manual...');
    }

    public async initializeAfterLogin(user: any): Promise<void> {
        if (this.isInitialized) {
            console.log('[SignalRService] Ya está inicializado, omitiendo...');
            return;
        }

        console.log('[SignalRService]  Inicializando SignalR para usuario:', user.id);

        try {
            await this.startConnection(user);
            this.isInitialized = true;
        } catch (error) {
            console.error('[SignalRService] Error en inicialización:', error);
        }
    }

    private async startConnection(user: any): Promise<void> {
        try {
            this.hubConnection = new signalR.HubConnectionBuilder()
                .withUrl(this.hubUrl, {
                    accessTokenFactory: () => this.authService.getTokenInfo().token || '',
                    withCredentials: true
                })
                .withAutomaticReconnect([0, 2000, 10000, 30000])
                .configureLogging(signalR.LogLevel.Information)
                .build();

            this.hubConnection.on('UpdateHoursTotal', (newTotalHours: number) => {
                console.log('[SignalRService]  UpdateHoursTotal recibido:', newTotalHours);
                this.hourService.totalAccepted$.next(newTotalHours);
                console.log('[SignalRService]  hourService.totalAccepted$ actualizado via UpdateHoursTotal');
            });

            this.hubConnection.on('UpdateHourStatus', (data: any) => {
                console.log('[SignalRService]  UpdateHourStatus recibido:', data);
                console.log('[SignalRService]  Datos completos:', JSON.stringify(data, null, 2));
                this.hourStatusUpdated$.next(data);
                console.log('[SignalRService]  Estado de hora actualizado via UpdateHourStatus');
            });

            this.hubConnection.on('UpdateAvailableHours', (newAvailableHours: number) => {
                console.log('[SignalRService] UpdateAvailableHours recibido:', newAvailableHours);
                window.dispatchEvent(new CustomEvent('available-hours-updated', {
                    detail: { availableHours: newAvailableHours }
                }));
                console.log('[SignalRService] Evento available-hours-updated emitido');
            });

            this.hubConnection.on('ReceiveNotification', (data: any) => {
                console.log('[SignalRService]  ReceiveNotification recibida:', data);
                this.notifications$.next(data);

                if (data.type === 'hoursAccepted') {
                    console.log('[SignalRService]  Horas aceptadas detectadas, refrescando total...');
                    setTimeout(() => {
                        this.hourService.refreshTotal();
                        console.log('[SignalRService] Total de horas refrescado via ReceiveNotification fallback');
                    }, 500);
                }

                window.dispatchEvent(new CustomEvent('signalr-notification', { detail: data }));
            });

            this.hubConnection.on('DistributeNotification', (data: any) => {
                console.log(' [SignalRService] DistributeNotification recibida:', data);
                console.log('[SignalRService] Datos completos:', JSON.stringify(data, null, 2));

                this.notificationStorage.distributeNotificationToTargets(data);
                console.log(' [SignalRService] Notificación distribuida a localStorage');

                window.dispatchEvent(new CustomEvent('signalr-distribute', { detail: data }));
                console.log(' [SignalRService] Evento signalr-distribute emitido');
            });

            this.hubConnection.onreconnecting(() => {
                console.log('[SignalRService]  Reconectando...');
                this.connectionState$.next('Reconnecting');
            });

            this.hubConnection.onreconnected(() => {
                console.log('[SignalRService]  Reconectado exitosamente');
                this.connectionState$.next('Connected');
                (window as any).signalRConnection = this.hubConnection;
            });

            this.hubConnection.onclose(() => {
                console.log('[SignalRService]  Conexión cerrada');
                this.connectionState$.next('Disconnected');
                this.isInitialized = false;
                (window as any).signalRConnection = null;
            });

            await this.hubConnection.start();
            console.log('[SignalRService]  SignalR conectado exitosamente para usuario:', user.id);
            this.connectionState$.next('Connected');

            (window as any).signalRConnection = this.hubConnection;
            console.log('[SignalRService]  SignalR disponible globalmente');

            await this.hubConnection.invoke('AddToGroup', user.id.toString());
            console.log(`[SignalRService] → Agregado al grupo ${user.id}`);

            if (user.role === 'Admin') {
                await this.hubConnection.invoke('AddToGroup', 'Admin');
                console.log('[SignalRService] → Agregado al grupo Admin');
            }

        } catch (error) {
            console.error('[SignalRService]  Error conectando:', error);
            this.connectionState$.next('Failed');

            setTimeout(() => {
                console.log('[SignalRService]  Reintentando conexión...');
                this.startConnection(user);
            }, 5000);
        }
    }

    public isConnected(): boolean {
        return this.hubConnection?.state === signalR.HubConnectionState.Connected;
    }

    public async disconnect(): Promise<void> {
        if (this.hubConnection) {
            await this.hubConnection.stop();
            this.connectionState$.next('Disconnected');
            this.isInitialized = false;
            (window as any).signalRConnection = null;
            console.log('[SignalRService] SignalR desconectado');
        }
    }

    public getConnection(): signalR.HubConnection | null {
        return this.hubConnection;
    }
}