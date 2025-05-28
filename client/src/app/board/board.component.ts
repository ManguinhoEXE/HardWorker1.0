import { Component } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompensatoryService } from '../Services/compensatory.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [NavComponent, CommonModule, FormsModule, RouterModule],
  templateUrl: './board.component.html',
  styleUrl: './board.component.css'
})
export class BoardComponent {

  compensatoryRequests: any[] = [];

  constructor(private compensatoryService: CompensatoryService) { }

  /**
   * carga las solicitudes de compensatorio al renderizar el componente.
   */
  ngOnInit(): void {
    this.loadCompensatoryRequests();
  }

  /**
   * Obtiene todas las solicitudes de compensatorio desde el backend.
   */
  loadCompensatoryRequests(): void {
    this.compensatoryService.getAllRequests().subscribe(
      (data) => {
        this.compensatoryRequests = data;
        console.log('Compensatory requests:', this.compensatoryRequests);
      },
      (error) => {
        console.error('Error al cargar las solicitudes:', error);
      }
    );
  }
}
