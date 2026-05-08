import type { ChangeEvent, DragEvent } from 'react';
import type { TestCase } from '../parseStLog';
import { getTestPath } from '../utils/routes';
import { getStats } from '../utils/testStats';

type TestListProps = {
  error: string;
  fileName: string;
  isDragActive: boolean;
  isLoading: boolean;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelect: (testName: string) => void;
  showArrows: boolean;
  taskWidth: number;
  tests: TestCase[];
};

export function TestList({
  error,
  fileName,
  isDragActive,
  isLoading,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelect,
  onSelect,
  showArrows,
  taskWidth,
  tests,
}: TestListProps) {
  return (
    <section className="test-list-view">
      <header className="page-header">
        <div>
          <h1>Hccl Checker Visualizer</h1>
        </div>
        <p className="dataset-count">
          {fileName ? `${tests.length} tests from ${fileName}` : 'No file loaded'}
        </p>
      </header>

      <div
        className={`upload-panel${isDragActive ? ' is-drag-active' : ''}`}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <label className="upload-button">
          Upload ST log
          <input
            accept=".log,.txt,text/plain"
            disabled={isLoading}
            onChange={onFileSelect}
            type="file"
          />
        </label>
        <span className="upload-hint">or drop a log file here</span>
        {isLoading && <span className="upload-status">loading...</span>}
        {error && <span className="upload-error">{error}</span>}
      </div>

      {tests.length > 0 && (
        <div className="test-list">
          {tests.map((test) => {
            const stats = getStats(test);

            return (
              <a
                className="test-row"
                href={getTestPath(test.testName, showArrows, taskWidth)}
                key={test.testName}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(test.testName);
                }}
              >
                <span className="test-name">{test.testName}</span>
                <span className="test-metrics">
                  {stats.rankCount} ranks
                  <span aria-hidden="true">/</span>
                  {stats.streamCount} streams
                  <span aria-hidden="true">/</span>
                  {stats.taskCount} tasks
                </span>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
