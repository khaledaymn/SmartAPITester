import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiRunnerService } from '../../core/services/api-runner.service';

/**
 * RequestMonitorComponent
 *
 * Displays real-time progress and statistics during API stress testing.
 * This component is a visual representation of the ApiRunnerService signals.
 *
 * Features:
 * - Shows only when testing is active or when results exist
 * - Custom animated progress bar
 * - Quick stats display (total, success, failed, average time)
 * - Pulse animation indicator during active testing
 * - Glassmorphism card design with dark theme
 *
 * State Management:
 * - progress(): Current test progress (0-100%)
 * - isTesting(): Whether a test is currently running
 * - testSummary(): Computed summary of test results (successes, errors, avg time, etc.)
 *
 * Usage:
 * ```html
 * <app-request-monitor></app-request-monitor>
 * ```
 */
@Component({
  selector: 'app-request-monitor',
  standalone: true,
  imports: [CommonModule],
 templateUrl: './request-monitor.component.html',
  styleUrls: ['./request-monitor.component.scss'],
})
export class RequestMonitorComponent {
  readonly apiRunner = inject(ApiRunnerService);
  @Input() minimal: boolean = false;
  /**
   * Determines whether the monitor should be visible.
   * Shows when testing is active OR when there are previous results.
   */
  shouldDisplay = () => {
    return this.apiRunner.isTesting() || this.apiRunner.results().length > 0;
  };

  /**
   * Expose apiRunner to template for signal access
   */
  protected get apiRunnerService() {
    return this.apiRunner;
  }
}
