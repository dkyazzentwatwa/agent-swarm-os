import { useEffect, useRef } from "react";

/**
 * Focus trap hook for accessible modals and dialogs
 * Traps Tab/Shift+Tab navigation within a container
 *
 * @param {boolean} isActive - Whether the focus trap is active
 * @returns {Object} containerRef - Ref to attach to the container element
 *
 * @example
 * function Modal({ isOpen }) {
 *   const containerRef = useFocusTrap(isOpen);
 *   return <div ref={containerRef} role="dialog">...</div>;
 * }
 */
export function useFocusTrap(isActive) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Find all focusable elements within the container
    const getFocusableElements = () => {
      const selectors = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(container.querySelectorAll(selectors));
    };

    const handleKeyDown = (e) => {
      // Only handle Tab key
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: moving backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Focus the first focusable element when trap activates
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Add event listener to container
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  return containerRef;
}
