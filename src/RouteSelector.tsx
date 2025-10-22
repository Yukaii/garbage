import { useMemo, useState } from 'react';
import { Route, X, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import type { UnifiedTrashCollectionPoint } from './types';
import { groupPointsIntoRoutes } from './api';

interface RouteSelectorProps {
  points: UnifiedTrashCollectionPoint[];
  selectedRoute: string | null;
  onRouteSelect: (routeKey: string | null) => void;
  darkMode: boolean;
  viewportBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
}

export default function RouteSelector({
  points,
  selectedRoute,
  onRouteSelect,
  darkMode,
  viewportBounds,
}: RouteSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showVisibleOnly, setShowVisibleOnly] = useState(true); // Show visible routes by default

  // Group points into routes and create route list
  const allRoutes = useMemo(() => {
    const routeMap = groupPointsIntoRoutes(points);
    const routeList = Array.from(routeMap.entries()).map(([routeKey, routePoints]) => {
      const firstPoint = routePoints[0];
      return {
        routeKey,
        routeName: firstPoint.route,
        district: firstPoint.district,
        city: firstPoint.city,
        pointCount: routePoints.length,
        source: firstPoint.source,
        points: routePoints,
      };
    });

    // Sort by point count (most stops first)
    return routeList.sort((a, b) => b.pointCount - a.pointCount);
  }, [points]);

  // Filter routes by viewport if enabled
  const routes = useMemo(() => {
    if (!showVisibleOnly || !viewportBounds) {
      return allRoutes;
    }

    // Check if any point in the route is within viewport
    return allRoutes.filter((route) => {
      return route.points.some((point) => {
        const lat = parseFloat(point.latitude);
        const lng = parseFloat(point.longitude);
        return (
          lat >= viewportBounds.south &&
          lat <= viewportBounds.north &&
          lng >= viewportBounds.west &&
          lng <= viewportBounds.east
        );
      });
    });
  }, [allRoutes, showVisibleOnly, viewportBounds]);

  const selectedRouteInfo = useMemo(() => {
    if (!selectedRoute) return null;
    return routes.find(r => r.routeKey === selectedRoute);
  }, [selectedRoute, routes]);

  // Desktop Sidebar
  const DesktopSidebar = () => (
    <div
      className={`hidden md:block absolute left-0 top-0 h-full transition-all duration-300 z-10 ${
        isExpanded ? 'w-80' : 'w-12'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 shadow-md transition-all hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-black dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
        aria-label={isExpanded ? 'Close routes sidebar' : 'Open routes sidebar'}
      >
        {isExpanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>

      {/* Sidebar Content */}
      {isExpanded && (
        <div className="h-full w-full border-r border-neutral-200 bg-white/95 backdrop-blur-sm dark:border-neutral-800 dark:bg-black/90 shadow-lg flex flex-col">
          <div className="border-b border-neutral-200 px-4 py-3 pt-14 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <Route className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
              <h3 className="text-sm font-semibold text-black dark:text-white">
                路線列表
              </h3>
              <span className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
                {routes.length} 條
              </span>
            </div>
            {/* Visibility Toggle */}
            <button
              onClick={() => setShowVisibleOnly(!showVisibleOnly)}
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                showVisibleOnly
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {showVisibleOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="flex-1 text-left">
                {showVisibleOnly ? '顯示可見路線' : '顯示所有路線'}
              </span>
              {showVisibleOnly && viewportBounds && (
                <span className="text-xs opacity-75">
                  {allRoutes.length - routes.length} 已隱藏
                </span>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {routes.map((route) => (
              <button
                key={route.routeKey}
                onClick={() => {
                  onRouteSelect(route.routeKey);
                  setIsExpanded(false);
                }}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  selectedRoute === route.routeKey
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                    : 'border-transparent hover:border-neutral-300 hover:bg-neutral-50 dark:hover:border-neutral-700 dark:hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-black dark:text-white text-sm truncate">
                    {route.routeName}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                    {route.pointCount} 站
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400 truncate">
                  {route.district} • {route.city}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Mobile Bottom Sheet
  const MobileBottomSheet = () => (
    <div className="md:hidden">
      {/* Trigger Button */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-black shadow-lg transition-all hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-black dark:text-white dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
        >
          <Route className="h-4 w-4" />
          <span>瀏覽路線</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      )}

      {/* Bottom Sheet */}
      {isMobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black shadow-2xl animate-slide-up flex flex-col max-h-[70vh]">
            {/* Handle */}
            <div className="flex items-center justify-center py-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="h-1 w-12 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Route className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
                  <h3 className="text-sm font-semibold text-black dark:text-white">
                    選擇路線
                  </h3>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {routes.length} 條
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
              {/* Visibility Toggle */}
              <button
                onClick={() => setShowVisibleOnly(!showVisibleOnly)}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  showVisibleOnly
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                {showVisibleOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="flex-1 text-left">
                  {showVisibleOnly ? '顯示可見路線' : '顯示所有路線'}
                </span>
                {showVisibleOnly && viewportBounds && (
                  <span className="text-xs opacity-75">
                    {allRoutes.length - routes.length} 已隱藏
                  </span>
                )}
              </button>
            </div>

            {/* Routes List */}
            <div className="flex-1 overflow-y-auto p-3">
              {routes.map((route) => (
                <button
                  key={route.routeKey}
                  onClick={() => {
                    onRouteSelect(route.routeKey);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors mb-2 ${
                    selectedRoute === route.routeKey
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-black dark:text-white text-sm">
                      {route.routeName}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                      {route.pointCount} 站
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {route.district} • {route.city}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileBottomSheet />
    </>
  );
}
