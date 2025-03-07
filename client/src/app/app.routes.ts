import { Routes } from '@angular/router';
import { SignUpComponent } from './sign-up/sign-up.component';
import { SignOnComponent } from './sign-on/sign-on.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
    { path: 'registro', component: SignUpComponent},
    { path: 'iniciarsession', component: SignOnComponent},
    {path: 'inicio', component: HomeComponent},
];
