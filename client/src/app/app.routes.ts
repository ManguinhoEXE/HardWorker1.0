import { Routes } from '@angular/router';
import { SignUpComponent } from './sign-up/sign-up.component';
import { SignOnComponent } from './sign-on/sign-on.component';
import { HomeComponent } from './home/home.component';
import { BoardComponent } from './board/board.component';

export const routes: Routes = [
    { path: 'registro', component: SignUpComponent},
    { path: 'iniciarsesion', component: SignOnComponent},
    {path: 'inicio', component: HomeComponent},
    {path: 'tablero', component: BoardComponent},
    {path: '', redirectTo: '/iniciarsesion', pathMatch: 'full'}
];

