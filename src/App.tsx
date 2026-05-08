import { type ChangeEvent, type DragEvent, useEffect, useState } from 'react';
import './App.css';
import { TestDetail } from './components/TestDetail';
import { TestList } from './components/TestList';
import { SHOW_ARROW_QUERY_PARAM, TASK_WIDTH_QUERY_PARAM } from './constants';
import { parseStLog, type TestCase } from './parseStLog';
import {
  getHomePath,
  getPathWithRouteSettings,
  getRouteTestName,
  getShowArrowsRouteValue,
  getTaskWidthRouteValue,
  getTestPath,
} from './utils/routes';
import { clampTaskWidth } from './utils/taskWidth';

function App() {
  const [tests, setTests] = useState<TestCase[]>([]);
  const [fileName, setFileName] = useState('');
  const [isParsingLog, setIsParsingLog] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [parseError, setParseError] = useState('');
  const [showArrows, setShowArrows] = useState(() => getShowArrowsRouteValue());
  const [taskWidth, setTaskWidth] = useState(() => getTaskWidthRouteValue());
  const [routeTestName, setRouteTestName] = useState<string | null>(() =>
    getRouteTestName(),
  );
  const selectedTest =
    routeTestName === null
      ? null
      : tests.find((test) => test.testName === routeTestName) ?? null;

  useEffect(() => {
    function syncRoute() {
      setRouteTestName(getRouteTestName());
      setShowArrows(getShowArrowsRouteValue());
      setTaskWidth(getTaskWidthRouteValue());
    }

    window.addEventListener('popstate', syncRoute);

    return () => {
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      !params.has(SHOW_ARROW_QUERY_PARAM) ||
      !params.has(TASK_WIDTH_QUERY_PARAM)
    ) {
      window.history.replaceState(
        null,
        '',
        getPathWithRouteSettings(window.location.pathname, showArrows, taskWidth),
      );
    }
  }, [showArrows, taskWidth]);

  function navigateToTest(testName: string) {
    window.history.pushState(
      null,
      '',
      getTestPath(testName, showArrows, taskWidth),
    );
    setRouteTestName(testName);
  }

  function navigateHome() {
    window.history.pushState(null, '', getHomePath(showArrows, taskWidth));
    setRouteTestName(null);
  }

  function handleShowArrowsChange(nextShowArrows: boolean) {
    setShowArrows(nextShowArrows);
    window.history.replaceState(
      null,
      '',
      getPathWithRouteSettings(
        window.location.pathname,
        nextShowArrows,
        taskWidth,
      ),
    );
  }

  function handleTaskWidthChange(nextTaskWidth: number) {
    const clampedTaskWidth = clampTaskWidth(nextTaskWidth);
    setTaskWidth(clampedTaskWidth);
    window.history.replaceState(
      null,
      '',
      getPathWithRouteSettings(
        window.location.pathname,
        showArrows,
        clampedTaskWidth,
      ),
    );
  }

  async function parseFile(file: File) {
    setFileName(file.name);
    setParseError('');
    setIsParsingLog(true);
    navigateHome();

    try {
      const contents = await file.text();
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });

      const parsedTests = parseStLog(contents);
      if (parsedTests.length === 0) {
        setTests([]);
        setParseError('No tests found in this log.');
        return;
      }

      setTests(parsedTests);
    } catch (error) {
      setTests([]);
      setParseError(
        error instanceof Error ? error.message : 'Failed to parse this log.',
      );
    } finally {
      setIsParsingLog(false);
    }
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    void parseFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = isParsingLog ? 'none' : 'copy';

    if (!isParsingLog) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragActive(false);

    if (isParsingLog) {
      return;
    }

    const file = event.dataTransfer.files[0];
    if (!file) {
      return;
    }

    void parseFile(file);
  }

  return (
    <main className="app-shell">
      {selectedTest ? (
        <TestDetail
          onBack={navigateHome}
          onShowArrowsChange={handleShowArrowsChange}
          onTaskWidthChange={handleTaskWidthChange}
          showArrows={showArrows}
          taskWidth={taskWidth}
          test={selectedTest}
        />
      ) : (
        <TestList
          error={parseError}
          fileName={fileName}
          isDragActive={isDragActive}
          isLoading={isParsingLog}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onFileSelect={handleFileSelect}
          onSelect={navigateToTest}
          showArrows={showArrows}
          taskWidth={taskWidth}
          tests={tests}
        />
      )}
    </main>
  );
}

export default App;
