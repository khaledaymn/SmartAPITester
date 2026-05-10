import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { signal, computed } from '@angular/core';
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

  /** Search query signal for reactive filtering */
  searchTerm = signal<string>('');

  /**
   * Computed signal for filtered results
   * Efficiently filters across multiple fields: URL, status code, status text, and response body
   * Uses case-insensitive matching for all fields
   * Returns full results if search term is empty for optimal performance
   * Recalculates only when dependencies (results or searchTerm) change
   */
  filteredResults = computed(() => {
    const results = this.apiRunner.results();
    const query = this.searchTerm().trim();

    // Return all results if search is empty for optimal performance
    if (!query) {
      return results;
    }

    const lowerQuery = query.toLowerCase();

    // Single-pass filter across multiple fields with case-insensitive matching
    return results.filter((result) => {
      const urlMatch = result.url?.toLowerCase().includes(lowerQuery) ?? false;
      const codeMatch = result.statusCode?.toString().includes(lowerQuery) ?? false;
      const textMatch = result.statusText?.toLowerCase().includes(lowerQuery) ?? false;
      const bodyMatch = result.responseBody?.toLowerCase().includes(lowerQuery) ?? false;
      return urlMatch || codeMatch || textMatch || bodyMatch;
    });
  });

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
   * Clears selection if the current result is filtered out
   */
  onSearchChange(newQuery: string): void {
    this.searchTerm.set(newQuery);

    // If filtered results don't contain current selection, clear it
    if (this.selectedResult() && !this.filteredResults().includes(this.selectedResult()!)) {
      this.selectedResult.set(null);
    }
  }

  /**
   * Export test results as CSV file
   */
  onExportCSV(): void {
    this.apiRunner.exportToCSV();
  }

  /**
   * Export test results as JSON file
   */
  onExportJSON(): void {
    this.apiRunner.exportToJSON();
  }
}
