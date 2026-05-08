import { SHOW_ARROW_QUERY_PARAM, TASK_WIDTH_QUERY_PARAM } from '../constants';
import { getSafeTaskWidth, clampTaskWidth } from './taskWidth';

export function getShowArrowsRouteValue() {
  const value = new URLSearchParams(window.location.search).get(
    SHOW_ARROW_QUERY_PARAM,
  );

  return value === null ? true : value === '1';
}

export function getTaskWidthRouteValue() {
  return getSafeTaskWidth(
    new URLSearchParams(window.location.search).get(TASK_WIDTH_QUERY_PARAM),
  );
}

export function getPathWithRouteSettings(
  pathname: string,
  showArrows: boolean,
  taskWidth: number,
) {
  const params = new URLSearchParams(window.location.search);
  params.set(SHOW_ARROW_QUERY_PARAM, showArrows ? '1' : '0');
  params.set(TASK_WIDTH_QUERY_PARAM, String(clampTaskWidth(taskWidth)));
  const query = params.toString();

  return `${pathname}${query ? `?${query}` : ''}`;
}

export function getTestPath(
  testName: string,
  showArrows = getShowArrowsRouteValue(),
  taskWidth = getTaskWidthRouteValue(),
) {
  return getPathWithRouteSettings(
    `/${encodeURIComponent(testName)}`,
    showArrows,
    taskWidth,
  );
}

export function getHomePath(
  showArrows = getShowArrowsRouteValue(),
  taskWidth = getTaskWidthRouteValue(),
) {
  return getPathWithRouteSettings('/', showArrows, taskWidth);
}

export function getRouteTestName() {
  const routeSegment = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (routeSegment.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(routeSegment);
  } catch {
    return routeSegment;
  }
}
