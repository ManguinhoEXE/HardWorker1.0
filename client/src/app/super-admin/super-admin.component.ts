import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../Services/auth.service';
import { UserService } from '../Services/user.service';
import { Router } from '@angular/router';
import { EditUserRequest } from '../Interfaces';

@Component({
  selector: 'app-super-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './super-admin.component.html',
  styleUrl: './super-admin.component.css'
})
export class SuperAdminComponent implements OnInit {

  /* ==================== 1. PROPIEDADES DEL FORMULARIO ==================== */
  newUser = {
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'User'
  };

  /* ==================== 2. PROPIEDADES DE USUARIOS ==================== */
  users: any[] = [];
  filteredUsers: any[] = [];
  searchTerm: string = '';
  selectedUserForDeletion: any = null;
  selectedUser: any = null;

  /* ==================== 3. PROPIEDADES DE UI Y ESTADO ==================== */
  isSubmitting: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  hasAccess: boolean = false;
  isLoadingUsers: boolean = false;
  isDeletingUser: boolean = false;
  showPassword: boolean = false;

  /* ==================== 4. PROPIEDADES DE MODALES ==================== */
  showCreateUserModal: boolean = false;
  showDeleteModal: boolean = false;
  showUserModal: boolean = false;

  /* ==================== 5. PROPIEDADES DE EDICIÓN ==================== */
  showEditModal: boolean = false;
  editingUser: any = null;
  editUserForm = {
    username: '',
    firstName: '',
    lastName: '',
    role: '',
    password: ''
  };
  isEditingUser: boolean = false;
  editPasswordChanged: boolean = false;

  /* ==================== 6. CONFIGURACIÓN ==================== */
  availableRoles = [
    { value: 'User', label: 'Usuario Regular' },
    { value: 'Admin', label: 'Administrador' },
    { value: 'Super', label: 'Super Administrador' }
  ];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) { }

  /* ==================== 7. LIFECYCLE HOOKS ==================== */
  ngOnInit(): void {
    this.checkAccess();
  }

  /* ==================== 8. VERIFICACIÓN DE ACCESO ==================== */
  private checkAccess(): void {
    this.isLoading = true;

    this.authService.verifySession().subscribe({
      next: (userData: any) => {
        if (userData && userData.role === 'Super') {
          this.hasAccess = true;
          this.loadUsers();
        } else {
          this.hasAccess = false;
          this.errorMessage = 'No tienes permisos para acceder a esta sección.';
          setTimeout(() => {
            this.router.navigate(['/inicio']);
          }, 2000);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.hasAccess = false;
        this.isLoading = false;
        this.errorMessage = 'Error verificando permisos. Redirigiendo...';
        setTimeout(() => {
          this.router.navigate(['/iniciarsesion']);
        }, 2000);
      }
    });
  }

  /* ==================== 9. GESTIÓN DE USUARIOS ==================== */
  loadUsers(): void {
    this.isLoadingUsers = true;

    this.userService.getAllUsers().subscribe({
      next: (response: any) => {
        const allUsers = Array.isArray(response) ? response : (response.data || response.users || []);

        this.users = allUsers;

        this.filteredUsers = allUsers.filter((user: { role: string; }) => user.role !== 'Super');

        this.isLoadingUsers = false;
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar la lista de usuarios.';
        this.isLoadingUsers = false;
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  filterUsers(): void {
    const visibleUsers = this.users.filter((user: { role: string; }) => user.role !== 'Super');

    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...visibleUsers];
      return;
    }

    const searchLower = this.searchTerm.toLowerCase();
    this.filteredUsers = visibleUsers.filter(user =>
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  }

  /* ==================== 10. GESTIÓN DE MODALES DE USUARIO ==================== */
  viewUserDetails(user: any): void {
    this.selectedUser = user;
    this.showUserModal = true;
    this.showPassword = false;
    document.body.classList.add('modal-open');
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.selectedUser = null;
    this.showPassword = false;
    document.body.classList.remove('modal-open');
  }

  /* ==================== 11. GESTIÓN DE MODALES DE ELIMINACIÓN ==================== */
  openDeleteModal(user: any): void {
    this.selectedUserForDeletion = user;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.selectedUserForDeletion = null;
    this.showDeleteModal = false;
  }

  confirmDeleteFromModal(): void {
    if (this.selectedUser) {
      this.selectedUserForDeletion = this.selectedUser;
      this.closeUserModal();
      this.showDeleteModal = true;
    }
  }

  /* ==================== 12. GESTIÓN DE MODAL CREAR USUARIO ==================== */
  closeCreateUserModal(): void {
    this.showCreateUserModal = false;
    this.clearForm();
    this.clearMessages();
  }

  /* ==================== 13. ELIMINACIÓN DE USUARIOS ==================== */
  confirmDeleteUser(): void {
    if (!this.selectedUserForDeletion) return;

    this.isDeletingUser = true;
    this.clearMessages();

    const userIdToDelete = this.selectedUserForDeletion.id;
    const usernameToDelete = this.selectedUserForDeletion.username;

    this.authService.deleteUser(userIdToDelete).subscribe({
      next: (response: { message: string; }) => {
        this.users = this.users.filter(user => user.id !== userIdToDelete);
        this.filteredUsers = this.filteredUsers.filter(user => user.id !== userIdToDelete);

        this.users = [...this.users];
        this.filteredUsers = [...this.filteredUsers];

        this.closeDeleteModal();
        this.isDeletingUser = false;

        this.successMessage = response?.message || `Usuario '${usernameToDelete}' eliminado exitosamente.`;
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (error: { status: number; error: { message: string; }; }) => {
        let errorMessage = 'Error al eliminar usuario.';

        if (error.status === 401) {
          errorMessage = 'No tienes permisos para eliminar usuarios.';
        } else if (error.status === 404) {
          errorMessage = 'Usuario no encontrado.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'No se puede eliminar este usuario.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        this.errorMessage = errorMessage;
        this.isDeletingUser = false;
        this.closeDeleteModal();
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  /* ==================== 14. MÉTODOS DE EDICIÓN ==================== */

  editUser(user: any): void {
    this.editingUser = { ...user };
    this.editUserForm = {
      username: user.username || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role || 'User',
      password: ''
    };

    this.editPasswordChanged = false;
    this.showEditModal = true;
    this.clearMessages();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingUser = null;
    this.editUserForm = {
      username: '',
      firstName: '',
      lastName: '',
      role: '',
      password: ''
    };
    this.editPasswordChanged = false;
    this.clearMessages();
  }

  confirmEditUser(): void {
    const hasRealChanges =
      this.editUserForm.username !== this.editingUser.username ||
      this.editUserForm.firstName !== this.editingUser.firstName ||
      this.editUserForm.lastName !== this.editingUser.lastName ||
      this.editUserForm.role !== this.editingUser.role ||
      (this.editPasswordChanged && this.editUserForm.password.trim());

    if (!hasRealChanges && !this.editPasswordChanged) {
      this.errorMessage = 'No se detectaron cambios para guardar.';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    if (!this.validateEditForm()) {
      return;
    }

    this.isEditingUser = true;

    const editData: EditUserRequest = {
      username: this.editUserForm.username.trim(),
      firstName: this.editUserForm.firstName.trim(),
      lastName: this.editUserForm.lastName.trim(),
      role: this.editUserForm.role
    };

    if (this.editPasswordChanged && this.editUserForm.password.trim()) {
      editData.password = this.editUserForm.password;
    }

    this.authService.editUser(this.editingUser.id, editData).subscribe({
      next: (response: any) => {
        this.successMessage = response?.message || `Usuario '${editData.username}' editado exitosamente.`;
        this.isEditingUser = false;

        const userIndex = this.users.findIndex(u => u.id === this.editingUser.id);
        const filteredIndex = this.filteredUsers.findIndex(u => u.id === this.editingUser.id);

        if (userIndex !== -1) {
          this.users[userIndex] = {
            ...this.users[userIndex],
            username: editData.username,
            firstName: editData.firstName,
            lastName: editData.lastName,
            role: editData.role
          };
        }

        if (filteredIndex !== -1) {
          this.filteredUsers[filteredIndex] = {
            ...this.filteredUsers[filteredIndex],
            username: editData.username,
            firstName: editData.firstName,
            lastName: editData.lastName,
            role: editData.role
          };
        }

        this.users = [...this.users];
        this.filteredUsers = [...this.filteredUsers];

        this.closeEditModal();

        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (error: any) => {
        let errorMessage = 'Error al editar usuario.';
        if (error.status === 401) {
          errorMessage = 'No tienes permisos para editar usuarios.';
        } else if (error.status === 404) {
          errorMessage = 'Usuario no encontrado.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'Datos inválidos.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        this.errorMessage = errorMessage;
        this.isEditingUser = false;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  private validateEditForm(): boolean {
    if (!this.editUserForm.username.trim()) {
      this.errorMessage = 'El nombre de usuario es obligatorio.';
      setTimeout(() => this.errorMessage = '', 3000);
      return false;
    }

    if (this.editUserForm.username.length < 4 || this.editUserForm.username.length > 12) {
      this.errorMessage = 'El nombre de usuario debe tener entre 4 y 12 caracteres.';
      setTimeout(() => this.errorMessage = '', 3000);
      return false;
    }

    if (!this.editUserForm.firstName.trim()) {
      this.errorMessage = 'El nombre es obligatorio.';
      setTimeout(() => this.errorMessage = '', 3000);
      return false;
    }

    if (!this.editUserForm.lastName.trim()) {
      this.errorMessage = 'El apellido es obligatorio.';
      setTimeout(() => this.errorMessage = '', 3000);
      return false;
    }

    if (!this.editUserForm.role) {
      this.errorMessage = 'Debe seleccionar un rol.';
      setTimeout(() => this.errorMessage = '', 3000);
      return false;
    }

    if (this.editUserForm.password.trim() && this.editUserForm.password.length < 8) {
      this.errorMessage = 'La contraseña debe tener al menos 8 caracteres.';
      setTimeout(() => this.errorMessage = '', 3000);
      return false;
    }

    return true;
  }

  onEditPasswordChange(): void {
    this.editPasswordChanged = true;
  }

  isEditFormValid(): boolean {
    return this.editUserForm.username.trim().length >= 4 &&
      this.editUserForm.firstName.trim().length > 0 &&
      this.editUserForm.lastName.trim().length > 0 &&
      this.editUserForm.role !== '' &&
      (this.editUserForm.password.trim().length === 0 ||
        this.editUserForm.password.trim().length >= 8);
  }

  editFromModal(): void {
    if (this.selectedUser) {
      this.closeUserModal();
      this.editUser(this.selectedUser);
    }
  }

  /* ==================== 15. CREACIÓN DE USUARIOS ==================== */
  onSubmit(): void {
    this.clearMessages();

    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;

    this.authService.register(
      this.newUser.username.trim(),
      this.newUser.password,
      this.newUser.firstName.trim(),
      this.newUser.lastName.trim(),
      null
    ).subscribe({
      next: (response: any) => {
        this.successMessage = response.message || `Usuario '${this.newUser.username}' creado exitosamente.`;
        this.loadUsers();
        this.closeCreateUserModal();
        this.isSubmitting = false;
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Error al crear usuario.';
        this.isSubmitting = false;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  /* ==================== 16. VALIDACIONES ==================== */
  private validateForm(): boolean {
    if (!this.newUser.username.trim()) {
      this.errorMessage = 'El nombre de usuario es obligatorio.';
      return false;
    }

    if (this.newUser.username.length < 4 || this.newUser.username.length > 12) {
      this.errorMessage = 'El nombre de usuario debe tener entre 4 y 12 caracteres.';
      return false;
    }

    if (!this.newUser.password.trim()) {
      this.errorMessage = 'La contraseña es obligatoria.';
      return false;
    }

    if (this.newUser.password.length < 8) {
      this.errorMessage = 'La contraseña debe tener al menos 8 caracteres.';
      return false;
    }

    if (!this.newUser.firstName.trim()) {
      this.errorMessage = 'El nombre es obligatorio.';
      return false;
    }

    if (!this.newUser.lastName.trim()) {
      this.errorMessage = 'El apellido es obligatorio.';
      return false;
    }

    if (!this.newUser.role) {
      this.errorMessage = 'Debe seleccionar un rol.';
      return false;
    }

    return true;
  }

  /* ==================== 17. UTILIDADES DE FORMULARIO ==================== */
  private clearForm(): void {
    this.newUser = {
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'User'
    };
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  isFormValid(): boolean {
    return this.newUser.username.trim().length >= 4 &&
      this.newUser.password.trim().length >= 8 &&
      this.newUser.firstName.trim().length > 0 &&
      this.newUser.lastName.trim().length > 0 &&
      this.newUser.role !== '';
  }

  /* ==================== 18. NAVEGACIÓN ==================== */
  goHome(): void {
    this.router.navigate(['/inicio']);
  }

  /* ==================== 19. UTILIDADES DE USUARIO ==================== */
  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'Super': return 'badge-super';
      case 'Admin': return 'badge-admin';
      case 'User': return 'badge-user';
      default: return 'badge-default';
    }
  }

  getUserCount(): number {
    return this.filteredUsers.length;
  }

  getSuperAdminCount(): number {
    return this.users.filter(user => user.role === 'Super').length;
  }

  getUsersByRole(role: string): number {
    return this.users.filter(user => user.role === role).length;
  }

  canDeleteUser(user: any): boolean {
    const currentUserId = this.authService.getCurrentUserId();
    return user.id !== currentUserId;
  }

  canEditUser(user: any): boolean {
    const currentUserId = this.authService.getCurrentUserId();
    return user.role !== 'Super' && user.id !== currentUserId;
  }

  getDeleteButtonTooltip(user: any): string {
    if (user.id === this.authService.getCurrentUserId()) {
      return 'No puedes eliminar tu propia cuenta';
    }
    return `Eliminar usuario ${user.username}`;
  }

  trackByUserId(index: number, user: any): number {
    return user.id;
  }

  /* ==================== 20. ACCIONES ADICIONALES ==================== */
  refreshUserData(): void {
    this.loadUsers();
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'No disponible';

    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return 'No disponible';

    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /* ==================== 21. GETTERS PÚBLICOS PARA EL TEMPLATE ==================== */
  get currentUserId(): number | null {
    return this.authService.getCurrentUserId();
  }

  get totalUsers(): number {
    return this.users.length;
  }

  get filteredUsersCount(): number {
    return this.filteredUsers.length;
  }

  get visibleUsersCount(): number {
    return this.users.filter(user => user.role !== 'Super').length;
  }
}