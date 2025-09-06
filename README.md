# HardWorker
## Descripción
HardWorker es una aplicación orientada a la gestión y control eficiente de compensatorios y permisos dentro de una empresa.
Su objetivo es facilitar el monitoreo de la carga laboral de los empleados, proporcionando información precisa y en tiempo
real que permite a los responsables tomar decisiones proactivas para optimizar la distribución del trabajo y garantizar
el bienestar del equipo.
## Características Principales
- Gestión de usuarios y autenticación
- Gestión de horas y compensatorios
- Panel administrativo
- Roles diferenciados
- Notificaciones en tiempo real
- Interfaz modular y adaptable
- Filtros y utilidades de UI
- Persistencia y separación de servicios

## Instalación
1. Clonar repositorio:
   ```bash
   git clone https://github.com/usuario/proyecto.git
   ```
2. Instalar dependencias:
   Frontend (Angular)
   ```bash
   npm install
   ```
   Backend (.NET)
   ```bash
   Backend (.NET)
   dotnet restore
   ```
4. Configurar variables de entorno: Backend (.NET)
   
  ```json
{
  "Jwt": {
    "Issuer": "TU_ISSUER_AQUI",
    "Audience": "TU_AUDIENCE_AQUI",
    "Key": "TU_CLAVE_SECRETA_AQUI"
  },
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=HardWorker;User Id=USUARIO;Password=CONTRASEÑA;"
  },
  "EmailSettings": {
    "FromName": "HardWorker Notificaciones",
    "FromEmail": "TU_CORREO@ejemplo.com",
    "password_email": "TU_CONTRASEÑA_CORREO",
    "SmtpServer": "smtp.gmail.com",
    "SmtpPort": "587"
  }
}
```

## Uso

Ejecutar aplicación:
Frontend (Angular)
```bash
ng serve
```
Backend (.NET)
```bash
dotnet run
```

## Estructura del Proyecto
```bash
Server/
├── bin/
├── Controller/
├── Data/
├── Hubs/
├── Migrations/
├── Model/
├── obj/
├── Properties/
├── Utils/
├── wwwroot/
├── appsettings.Development.json
├── appsettings.json
├── Program.cs
├── Server.csproj
├── Server.http
```
```bash
  client/
├── .vscode/
├── public/
├── src/
│   ├── app/
│   │   ├── board/
│   │   ├── home/
│   │   ├── Interfaces/
│   │   ├── nav/
│   │   ├── Services/
│   │   ├── sign-on/
│   │   ├── sign-up/
│   │   └── super-admin/
│   │   ├── app.component.css
│   │   ├── app.component.html
│   │   ├── app.component.spec.ts
│   │   ├── app.component.ts
│   │   ├── app.config.server.ts
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   ├── index.html
│   ├── main.server.ts
│   ├── main.ts
│   ├── server.ts
│   ├── styles.css
├── .editorconfig
├── .gitignore
├── angular.json
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.spec.json
```
## Vista Previa de la Aplicación
### Pantalla de Login
<img width="921" height="478" alt="image" src="https://github.com/user-attachments/assets/c016b9dd-ece7-4423-b017-9dc1d34c4071" />

### Panel Principal del Usuario
<img width="921" height="474" alt="image" src="https://github.com/user-attachments/assets/4aca8c3c-4884-4858-9499-b42f62c54073" />

### Panel de compensatorios (Usuario)
<img width="921" height="477" alt="image" src="https://github.com/user-attachments/assets/42107363-cf76-4e5b-84d6-360de0c93af0" />

### Panel Principal del Admin
<img width="921" height="476" alt="image" src="https://github.com/user-attachments/assets/06408961-4ebc-4123-8483-5d2210adf117" />

### Panel de compensatorios (Admin)
<img width="921" height="475" alt="image" src="https://github.com/user-attachments/assets/652f921c-e14d-480d-8c9d-29a2a5071ef0" />

### Modal gestionar Solicitudes
<img width="1920" height="994" alt="image" src="https://github.com/user-attachments/assets/f3e28b2d-f4f0-4ccb-9d9f-9b756f1ac700" />

### Panel Principal del SuperAdmin
<img width="921" height="476" alt="image" src="https://github.com/user-attachments/assets/740cbe70-20bc-49e7-9745-d9ed9104010f" />

### Modal Editar y Eliminar Usuario
<img width="921" height="479" alt="image" src="https://github.com/user-attachments/assets/9611b722-ff58-4369-acbc-935d957b2165" />

<img width="1919" height="991" alt="image" src="https://github.com/user-attachments/assets/920f1a83-7fc0-4c5b-a5e4-9faeb73a0b20" />

### Panel Crear Usuario (SuperAdmin)
<img width="921" height="474" alt="image" src="https://github.com/user-attachments/assets/04e9ce95-65ce-4e4f-8bda-bec656216b03" />

