import { Component, computed, effect, inject, signal } from '@angular/core';
import { ResponseViewerComponent } from './features/response-viewer/response-viewer.component';
import { CommonModule } from '@angular/common';
import { ConfigPanelComponent } from './features/config-panel/config-panel.component';
import { RequestMonitorComponent } from './features/request-monitor/request-monitor.component';
import { ApiRunnerService } from './core/services/api-runner.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ConfigPanelComponent, RequestMonitorComponent, ResponseViewerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('SmartAPITester');

  apiRunner = inject(ApiRunnerService);

  activeTab = signal<'request' | 'results'>('request');
  showExecutionOverlay = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.apiRunner.isTesting()) {
        this.showExecutionOverlay.set(true);
        document.body.style.overflow = 'hidden';
      }
    });
  }

  closeOverlay() {
    this.showExecutionOverlay.set(false);
    document.body.style.overflow = 'auto';
    this.activeTab.set('results');
    this.scrollToTop();
  }

  switchTab(tab: 'request' | 'results') {
    this.activeTab.set(tab);
  }
  
  private scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth' // خليه 'auto' لو عاوزه يطلع فجأة بدون أنيميشن
    });
  }
}
