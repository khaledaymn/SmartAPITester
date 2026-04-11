import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiRunnerService } from '../../core/services/api-runner.service';
import { ApiRequestConfig } from '../../core/models/request-config.model';
import { ConfigPanelFormComponent } from "./components/config-panel-form/config-panel-form/config-panel-form.component";

/**
 * ConfigPanelComponent
 *
 * Main container component for the API stress testing configuration panel.
 * Handles form submission and delegates to the ApiRunnerService for test execution.
 *
 * @standalone
 */
@Component({
  selector: 'app-config-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfigPanelFormComponent],
  templateUrl: './config-panel.component.html',
  styleUrls: ['./config-panel.component.scss'],
})
export class ConfigPanelComponent {
  private readonly apiRunner = inject(ApiRunnerService);

  /**
   * Handles form submission and initiates the API stress test
   *
   * @param config - The API request configuration from the form
   */
  onConfigSubmitted(config: ApiRequestConfig): void {
    console.log('[ConfigPanel] Starting stress test with config:', config);
    this.apiRunner.executeTest(config);
  }
}
