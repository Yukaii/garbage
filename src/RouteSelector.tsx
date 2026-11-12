import { useMemo, useState } from 'react';
import { Route, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Eye, EyeOff, Layers, Locate } from 'lucide-react';
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
  mapStyleType?: 'street' | 'satellite';
  onMapStyleToggle?: () => void;
  onLocateClick?: () => void;
  isLocating?: boolean;
}

export default function RouteSelector({
  points,
  selectedRoute,
  onRouteSelect,
  viewportBounds,
  mapStyleType,
  onMapStyleToggle,
  onLocateClick,
  isLocating = false,
}: RouteSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showVisibleOnly, setShowVisibleOnly] = useState(true); // Show visible routes by default

  // Common map control buttons component
  // Render helpers, not components: defined inside the render, a component would get a new
  // identity every render and remount (losing the route list's scroll position).
  const renderMapControlButtons = (className = '') => (
    <>
      {/* Layer Toggle Button */}
      {onMapStyleToggle && (
        <button
          type="button"
          onClick={onMapStyleToggle}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur-md transition-colors hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 ${className}`}
          title={mapStyleType === 'street' ? '切換至衛星圖' : '切換至街道圖'}
          aria-label={mapStyleType === 'street' ? '切換至衛星圖' : '切換至街道圖'}
        >
          <Layers className="h-4 w-4" />
        </button>
      )}

      {/* Geolocation Button */}
      {onLocateClick && (
        <button
          type="button"
          onClick={onLocateClick}
          disabled={isLocating}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur-md transition-colors dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-300 ${
            isLocating
              ? 'cursor-wait opacity-60'
              : 'cursor-pointer hover:border-neutral-300 hover:bg-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800'
          } ${className}`}
          title="定位到目前位置"
          aria-label="定位到目前位置"
        >
          <Locate className={`h-4 w-4 ${isLocating ? 'animate-pulse' : ''}`} />
        </button>
      )}
    </>
  );

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

  // Desktop Sidebar
  const renderDesktopSidebar = () => (
    <div
      className={`hidden md:block absolute left-0 top-0 h-full transition-all duration-300 group ${
        isExpanded ? 'w-80 is-expanded' : 'w-12'
      }`}
      style={{ zIndex: 10, pointerEvents: 'none' }}
    >
      {/* Map Controls */}
      <div className="absolute left-3 z-20 flex flex-col gap-1.5" style={{ top: '12px', pointerEvents: 'auto' }}>
        {/* Sidebar Toggle Button - Only visible on desktop */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="hidden md:flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur-md transition-colors hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
          aria-label={isExpanded ? '收合路線列表' : '展開路線列表'}
          title={isExpanded ? '收合路線列表' : '展開路線列表'}
        >
          {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Map control buttons - hidden on desktop when sidebar is expanded */}
        {renderMapControlButtons("group-[.is-expanded]:md:hidden")}
      </div>

      {/* Sidebar Content */}
      {isExpanded && (
        <div className="flex h-full w-full flex-col border-r border-neutral-200/80 bg-white/95 shadow-xl backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/95" style={{ pointerEvents: 'auto' }}>
          <div className="border-b border-neutral-200/80 px-4 py-3 pt-14 dark:border-neutral-800/80">
            <div className="mb-3 flex items-center gap-2">
              <Route className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                路線列表
              </h3>
              <span className="ml-auto rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {routes.length} 條
              </span>
            </div>
            {/* Visibility Toggle */}
            <button
              type="button"
              onClick={() => setShowVisibleOnly(!showVisibleOnly)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                showVisibleOnly
                  ? 'border-sky-500/40 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/50 dark:text-sky-300'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800'
              }`}
            >
              {showVisibleOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="flex-1 text-left">
                {showVisibleOnly ? '僅顯示畫面內路線' : '顯示全部路線'}
              </span>
              {showVisibleOnly && viewportBounds && (
                <span className="text-[11px] opacity-75">
                  已隱藏 {allRoutes.length - routes.length} 條
                </span>
              )}
            </button>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {routes.map((route) => (
              <button
                key={route.routeKey}
                type="button"
                onClick={() => {
                  onRouteSelect(route.routeKey);
                  setIsExpanded(false);
                }}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selectedRoute === route.routeKey
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-800/80'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm font-medium ${
                    selectedRoute === route.routeKey
                      ? 'text-white dark:text-neutral-900'
                      : 'text-neutral-900 dark:text-neutral-100'
                  }`}>
                    {route.routeName}
                  </span>
                  <span className={`shrink-0 text-xs tabular-nums ${
                    selectedRoute === route.routeKey
                      ? 'text-neutral-300 dark:text-neutral-600'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}>
                    {route.pointCount} 站
                  </span>
                </div>
                <div className={`mt-0.5 truncate text-xs ${
                  selectedRoute === route.routeKey
                    ? 'text-neutral-300 dark:text-neutral-600'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}>
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
  const renderMobileBottomSheet = () => (
    <div className="md:hidden">
      {/* Trigger Button */}
      {!isMobileOpen && (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-4 py-2 text-xs font-semibold text-neutral-900 shadow-lg backdrop-blur-md transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
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
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-neutral-200 bg-white shadow-2xl animate-slide-up dark:border-neutral-800 dark:bg-neutral-950">
            {/* Handle */}
            <div className="flex items-center justify-center py-2.5">
              <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="border-b border-neutral-200/80 px-4 pb-3 dark:border-neutral-800/80">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    選擇路線
                  </h3>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {routes.length} 條
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  aria-label="關閉路線列表"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              {/* Visibility Toggle */}
              <button
                type="button"
                onClick={() => setShowVisibleOnly(!showVisibleOnly)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  showVisibleOnly
                    ? 'border-sky-500/40 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/50 dark:text-sky-300'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800'
                }`}
              >
                {showVisibleOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="flex-1 text-left">
                  {showVisibleOnly ? '僅顯示畫面內路線' : '顯示全部路線'}
                </span>
                {showVisibleOnly && viewportBounds && (
                  <span className="text-[11px] opacity-75">
                    已隱藏 {allRoutes.length - routes.length} 條
                  </span>
                )}
              </button>
            </div>

            {/* Routes List */}
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {routes.map((route) => (
                <button
                  key={route.routeKey}
                  type="button"
                  onClick={() => {
                    onRouteSelect(route.routeKey);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selectedRoute === route.routeKey
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm font-medium ${
                      selectedRoute === route.routeKey
                        ? 'text-white dark:text-neutral-900'
                        : 'text-neutral-900 dark:text-neutral-100'
                    }`}>
                      {route.routeName}
                    </span>
                    <span className={`shrink-0 text-xs tabular-nums ${
                      selectedRoute === route.routeKey
                        ? 'text-neutral-300 dark:text-neutral-600'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}>
                      {route.pointCount} 站
                    </span>
                  </div>
                  <div className={`mt-0.5 truncate text-xs ${
                    selectedRoute === route.routeKey
                      ? 'text-neutral-300 dark:text-neutral-600'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}>
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
      {renderDesktopSidebar()}
      {renderMobileBottomSheet()}

      {/* Mobile Map Controls - Always visible on mobile */}
      <div className="md:hidden absolute left-3 z-20 flex flex-col gap-1.5" style={{ top: '12px' }}>
        {renderMapControlButtons()}
      </div>
    </>
  );
}
