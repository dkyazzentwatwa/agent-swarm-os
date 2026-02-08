import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

describe('useFocusTrap', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('Basic Functionality', () => {
    it('returns a ref object', () => {
      const { result } = renderHook(() => useFocusTrap(false));

      expect(result.current).toBeDefined();
      expect(result.current.current).toBeNull();
    });

    it('focuses first focusable element when activated', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      container.appendChild(button1);
      container.appendChild(button2);

      const { result } = renderHook(() => useFocusTrap(false));
      result.current.current = container;

      const { rerender } = renderHook(
        ({ isActive }) => useFocusTrap(isActive),
        { initialProps: { isActive: false } }
      );

      const hookResult = renderHook(() => useFocusTrap(true));
      hookResult.result.current.current = container;

      expect(document.activeElement).toBe(button1);

      hookResult.unmount();
    });

    it('does not activate when isActive is false', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const { result } = renderHook(() => useFocusTrap(false));
      result.current.current = container;

      expect(document.activeElement).not.toBe(button);
    });

    it('handles container with no focusable elements', () => {
      const div = document.createElement('div');
      container.appendChild(div);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(() => {
        act(() => {
          container.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
          );
        });
      }).not.toThrow();
    });
  });

  describe('Tab Key Navigation', () => {
    it('traps focus on Tab at last element', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const button3 = document.createElement('button');
      container.appendChild(button1);
      container.appendChild(button2);
      container.appendChild(button3);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      button3.focus();

      act(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        );
      });

      // Focus should cycle back to first button
      expect(document.activeElement).toBe(button1);
    });

    it('traps focus on Shift+Tab at first element', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const button3 = document.createElement('button');
      container.appendChild(button1);
      container.appendChild(button2);
      container.appendChild(button3);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      button1.focus();

      act(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          })
        );
      });

      // Focus should cycle back to last button
      expect(document.activeElement).toBe(button3);
    });

    it('allows Tab navigation in middle of list', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const button3 = document.createElement('button');
      container.appendChild(button1);
      container.appendChild(button2);
      container.appendChild(button3);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      button2.focus();

      act(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
        );
      });

      // Focus should NOT be trapped (not at last element)
      // Browser handles natural tab progression
      expect(document.activeElement).toBe(button2);
    });

    it('prevents default when trapping focus', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      container.appendChild(button1);
      container.appendChild(button2);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      button2.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        container.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('ignores non-Tab keys', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(() => {
        act(() => {
          container.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
          );
        });
      }).not.toThrow();
    });
  });

  describe('Focusable Elements Detection', () => {
    it('includes buttons', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(button);
    });

    it('includes links with href', () => {
      const link = document.createElement('a');
      link.href = '#';
      container.appendChild(link);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(link);
    });

    it('includes inputs', () => {
      const input = document.createElement('input');
      container.appendChild(input);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(input);
    });

    it('includes selects', () => {
      const select = document.createElement('select');
      container.appendChild(select);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(select);
    });

    it('includes textareas', () => {
      const textarea = document.createElement('textarea');
      container.appendChild(textarea);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(textarea);
    });

    it('includes elements with tabindex >= 0', () => {
      const div = document.createElement('div');
      div.tabIndex = 0;
      container.appendChild(div);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(div);
    });

    it('excludes disabled buttons', () => {
      const button = document.createElement('button');
      button.disabled = true;
      const input = document.createElement('input');
      container.appendChild(button);
      container.appendChild(input);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      // Should focus input, not disabled button
      expect(document.activeElement).toBe(input);
    });

    it('excludes disabled inputs', () => {
      const input = document.createElement('input');
      input.disabled = true;
      const button = document.createElement('button');
      container.appendChild(input);
      container.appendChild(button);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(button);
    });

    it('excludes elements with tabindex="-1"', () => {
      const div = document.createElement('div');
      div.tabIndex = -1;
      const button = document.createElement('button');
      container.appendChild(div);
      container.appendChild(button);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(button);
    });

    it('excludes links without href', () => {
      const link = document.createElement('a');
      const button = document.createElement('button');
      container.appendChild(link);
      container.appendChild(button);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(button);
    });
  });

  describe('Activation/Deactivation', () => {
    it('activates when isActive changes to true', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const { result, rerender } = renderHook(
        ({ isActive }) => useFocusTrap(isActive),
        { initialProps: { isActive: false } }
      );

      result.current.current = container;

      expect(document.activeElement).not.toBe(button);

      rerender({ isActive: true });

      expect(document.activeElement).toBe(button);
    });

    it('deactivates when isActive changes to false', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const { result, rerender } = renderHook(
        ({ isActive }) => useFocusTrap(isActive),
        { initialProps: { isActive: true } }
      );

      result.current.current = container;

      expect(document.activeElement).toBe(button);

      rerender({ isActive: false });

      // Event listener should be removed
      act(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
        );
      });

      // Should not trap focus anymore
      expect(() => {
        button.focus();
      }).not.toThrow();
    });

    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(container, 'removeEventListener');

      const { result, unmount } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('handles null container ref', () => {
      const { result } = renderHook(() => useFocusTrap(true));

      expect(() => {
        result.current.current = null;
      }).not.toThrow();
    });

    it('handles single focusable element', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      button.focus();

      act(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        );
      });

      // Should cycle back to itself
      expect(document.activeElement).toBe(button);
    });

    it('handles dynamically added elements', () => {
      const button1 = document.createElement('button');
      container.appendChild(button1);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      expect(document.activeElement).toBe(button1);

      // Add another button dynamically
      const button2 = document.createElement('button');
      container.appendChild(button2);

      button2.focus();

      act(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        );
      });

      // Should now trap with new element included
      expect(document.activeElement).toBe(button1);
    });

    it('handles mixed element types', () => {
      const button = document.createElement('button');
      const input = document.createElement('input');
      const link = document.createElement('a');
      link.href = '#';
      const select = document.createElement('select');

      container.appendChild(button);
      container.appendChild(input);
      container.appendChild(link);
      container.appendChild(select);

      const { result } = renderHook(() => useFocusTrap(true));
      result.current.current = container;

      select.focus();

      act(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        );
      });

      expect(document.activeElement).toBe(button);
    });
  });

  describe('Multiple Refs', () => {
    it('works with different container refs', () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      container1.appendChild(button1);
      container2.appendChild(button2);

      const { result: result1 } = renderHook(() => useFocusTrap(true));
      result1.current.current = container1;

      const { result: result2 } = renderHook(() => useFocusTrap(true));
      result2.current.current = container2;

      expect(document.activeElement).toBe(button2);

      document.body.removeChild(container1);
      document.body.removeChild(container2);
    });
  });
});
