import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  let onClose;

  beforeEach(() => {
    onClose = vi.fn();

    // Mock useFocusTrap
    vi.mock('@/hooks/useFocusTrap', () => ({
      useFocusTrap: () => ({ current: null }),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders title', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          subtitle="This is a subtitle"
        >
          Content
        </Modal>
      );

      expect(screen.getByText('This is a subtitle')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('ARIA Attributes', () => {
    it('has role="dialog"', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    it('has aria-modal="true"', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');

      const title = document.getElementById('modal-title');
      expect(title).toHaveTextContent('Test Modal');
    });

    it('has aria-describedby pointing to subtitle', () => {
      render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          subtitle="Subtitle text"
        >
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-subtitle');

      const subtitle = document.getElementById('modal-subtitle');
      expect(subtitle).toHaveTextContent('Subtitle text');
    });

    it('does not have aria-labelledby when no title', () => {
      render(
        <Modal isOpen={true} onClose={onClose}>
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-labelledby');
    });

    it('does not have aria-describedby when no subtitle', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key pressed', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('calls onClose when clicking overlay', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      // Click the overlay (not the dialog content)
      const overlay = screen.getByRole('dialog').parentElement;
      await user.click(overlay);

      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when clicking modal content', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <div>Content</div>
        </Modal>
      );

      const content = screen.getByText('Content');
      await user.click(content);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Body Scroll Lock', () => {
    it('prevents body scroll when modal opens', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when modal closes', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Focus Management', () => {
    it('focuses modal content when opened', async () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <button>Test Button</button>
        </Modal>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(document.activeElement).toBe(dialog);
      });
    });

    it('saves previous focus element', () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Open Modal';
      document.body.appendChild(trigger);
      trigger.focus();

      expect(document.activeElement).toBe(trigger);

      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      // Focus should move to modal
      const dialog = screen.getByRole('dialog');
      expect(document.activeElement).not.toBe(trigger);

      document.body.removeChild(trigger);
    });

    it('restores focus when modal closes', async () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Open Modal';
      document.body.appendChild(trigger);
      trigger.focus();

      const { rerender } = render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      // Close modal
      rerender(
        <Modal isOpen={false} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });

      document.body.removeChild(trigger);
    });
  });

  describe('Focus Trap', () => {
    it('contains focusable elements within modal', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <button id="first">First</button>
          <button id="second">Second</button>
          <button id="third">Third</button>
        </Modal>
      );

      const firstButton = screen.getByText('First');
      const thirdButton = screen.getByText('Third');

      // Focus first button
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      // Tab to second
      await user.tab();

      // Tab to third
      await user.tab();
      expect(document.activeElement).toBe(thirdButton);

      // Tab from last element should cycle to close button
      await user.tab();
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /close modal/i })
      );
    });

    it('cycles focus backwards with Shift+Tab', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <button id="first">First</button>
          <button id="second">Second</button>
        </Modal>
      );

      const firstButton = screen.getByText('First');

      // Focus first button
      firstButton.focus();

      // Shift+Tab should cycle to last focusable element
      await user.tab({ shift: true });

      // Should be on close button or last button
      expect(document.activeElement).not.toBe(firstButton);
    });
  });

  describe('Size Variants', () => {
    it('applies small size class', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal" size="sm">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('max-w-md');
    });

    it('applies medium size class (default)', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('max-w-lg');
    });

    it('applies large size class', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal" size="lg">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('max-w-2xl');
    });

    it('applies extra large size class', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal" size="xl">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('max-w-4xl');
    });

    it('applies full size class', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal" size="full">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('max-w-6xl');
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          className="custom-class"
        >
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('custom-class');
    });

    it('preserves base classes with custom className', () => {
      render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          className="custom-class"
        >
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('bg-card');
      expect(dialog.className).toContain('rounded-lg');
      expect(dialog.className).toContain('custom-class');
    });
  });

  describe('Content Scrolling', () => {
    it('makes content scrollable when overflow', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <div style={{ height: '2000px' }}>Tall content</div>
        </Modal>
      );

      const contentArea = screen.getByText('Tall content').parentElement;
      expect(contentArea.className).toContain('overflow-y-auto');
    });

    it('restricts modal height to 90vh', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('max-h-[90vh]');
    });
  });

  describe('Animation', () => {
    it('has fade-in animation for overlay', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const overlay = screen.getByRole('dialog').parentElement;
      expect(overlay.className).toContain('animate-in');
      expect(overlay.className).toContain('fade-in');
    });

    it('has zoom-in animation for dialog', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('animate-in');
      expect(dialog.className).toContain('zoom-in-95');
    });
  });

  describe('Header Structure', () => {
    it('renders header when title or subtitle provided', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const header = screen.getByText('Test Modal').parentElement.parentElement;
      expect(header.className).toContain('border-b');
    });

    it('does not render header when no title or subtitle', () => {
      render(
        <Modal isOpen={true} onClose={onClose}>
          Content
        </Modal>
      );

      // Close button should still be present but no header container
      const closeButton = screen.getByRole('button', { name: /close modal/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('close button has proper styling', () => {
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          Content
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      expect(closeButton.className).toContain('hover:text-foreground');
      expect(closeButton.className).toContain('rounded-md');
    });
  });
});
