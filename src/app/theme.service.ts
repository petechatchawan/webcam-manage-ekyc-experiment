import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly darkMode = new BehaviorSubject<boolean>(false);
  isDarkMode$ = this.darkMode.asObservable();

  constructor() {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.setDarkMode(true);
    }
  }

  toggleTheme() {
    this.darkMode.next(!this.darkMode.value);
    document.documentElement.classList.toggle('dark');
  }

  setDarkMode(isDark: boolean) {
    this.darkMode.next(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
