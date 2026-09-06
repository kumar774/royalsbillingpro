import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

export const PullToRefresh: React.FC = () => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const threshold = 65;
  const maxPull = 100;

  useEffect(() => {
    const isAtTop = (target: EventTarget | null): boolean => {
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return false;
      let el = target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollTop > 0) return false;
        el = el.parentElement;
      }
      return true;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isRefreshing) return;
      if (isAtTop(e.target)) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0 && isAtTop(e.target)) {
        const distance = Math.min(diff * 0.4, maxPull);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
      } else {
        isPullingRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current || isRefreshing) return;
      isPullingRef.current = false;

      if (pullDistanceRef.current >= threshold) {
        setIsRefreshing(true);
        setPullDistance(50);
        setTimeout(() => {
          window.location.reload();
        }, 350);
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing]);

  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${pullDistance - 45}px`,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        pointerEvents: 'none',
        transition: isPullingRef.current ? 'none' : 'top 0.2s ease',
      }}
    >
      <div className="w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center border border-gray-200">
        <RefreshCw
          className={`h-5 w-5 text-[#FF5722] ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${pullDistance * 4}deg)`,
            transition: isRefreshing ? 'none' : 'transform 0.1s ease',
          }}
        />
      </div>
    </div>
  );
};

export default PullToRefresh;
