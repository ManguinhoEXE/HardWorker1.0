import { Component } from '@angular/core';
import { NavComponent } from '../nav/nav.component';

@Component({
  selector: 'app-home',
  imports: [ NavComponent ],
  templateUrl: './home.component.html',
  template: `
    <app-nav></app-nav>
    <div class="content">Contenido Home</div>
  `,
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
