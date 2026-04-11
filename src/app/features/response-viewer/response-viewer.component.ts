import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { ApiRunnerService } from '../../core/services/api-runner.service';
import { TestResult } from '../../core/models/test-result.model';

/**
 * ResponseViewerComponent
 *
 * A professional master-detail dashboard for inspecting API responses.
 *
 * Features:
 * - Master list: Scrollable list of all test results with filtering
 * - Detail view: Code editor-style response body viewer
 * - Status code color coding (green=success, red=error)
 * - Search/filter by status code
 * - Clear results functionality
 *
 * State Management:
 * - selectedResult: Currently selected test result
 * - searchQuery: Filter query for results
 *
 * Usage:
 * ```html
 * <app-response-viewer></app-response-viewer>
 * ```
 */
@Component({
  selector: 'app-response-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './response-viewer.component.html',
  styleUrls: ['./response-viewer.component.scss'],
})
export class ResponseViewerComponent {
  readonly apiRunner = inject(ApiRunnerService);

  /** Currently selected test result */
  selectedResult = signal<TestResult | null>(null);

  /** Search query for filtering */
  searchQuery = '';

  /**
   * Filtered results based on search query (status code)
   */
  filteredResults = () => {
    const results = this.apiRunner.results();

    if (!this.searchQuery.trim()) {
      return results;
    }

    const query = this.searchQuery.toLowerCase();
    return results.filter((result) => {
      return results.filter((result) => {
        const codeMatch = result.statusCode?.toString().includes(query) ?? false;
        const textMatch = result.statusText?.toLowerCase().includes(query) ?? false;
        return codeMatch || textMatch;
      });
    });
  };

  /**
   * Select a result for detail view
   */
  selectResult(result: TestResult): void {
    this.selectedResult.set(result);
  }

  /**
   * Clear all test results
   */
  onClearResults(): void {
    this.apiRunner.clearResults();
    this.selectedResult.set(null);
  }

  /**
   * Handle search query changes
   */
  onSearchChange(): void {
    // If filtered results don't contain current selection, clear it
    const filtered = this.filteredResults();
    if (this.selectedResult() && !filtered.includes(this.selectedResult()!)) {
      this.selectedResult.set(null);
    }
  }
}
