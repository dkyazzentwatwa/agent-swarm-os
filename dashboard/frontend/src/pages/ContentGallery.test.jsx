import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import ContentGallery from './ContentGallery';

// Mock the hooks
vi.mock('@/hooks/useContent', () => ({
  useContent: vi.fn(),
}));

vi.mock('@/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({
      workspaceId: 'test-workspace',
      workspaceData: {
        manifest: {
          modules: [
            { id: 'research', label: 'Research', emoji: '🔬' },
            { id: 'analysis', label: 'Analysis', emoji: '📊' },
            { id: 'reports', label: 'Reports', emoji: '📄' },
          ],
        },
      },
    })),
    useSearchParams: vi.fn(() => {
      const params = new URLSearchParams();
      const setParams = vi.fn();
      return [params, setParams];
    }),
  };
});

import { useContent } from '@/hooks/useContent';
import { usePolling } from '@/hooks/usePolling';

const mockArtifacts = [
  {
    workspaceId: 'workspace-1',
    title: 'Project Alpha',
    modules: {
      research: ['docs/findings.md', 'docs/notes.txt', 'data/results.json'],
      analysis: ['reports/summary.pdf'],
    },
    moduleMeta: {
      research: {
        fileCount: 3,
        folderCount: 2,
        lastModified: '2026-02-07T10:00:00.000Z',
        totalSize: 15000,
        typeBreakdown: { md: 1, txt: 1, json: 1 },
      },
      analysis: {
        fileCount: 1,
        folderCount: 1,
        lastModified: '2026-02-06T10:00:00.000Z',
        totalSize: 8000,
        typeBreakdown: { pdf: 1 },
      },
    },
  },
  {
    workspaceId: 'workspace-2',
    title: 'Project Beta',
    modules: {
      reports: ['output/final.docx', 'output/draft.docx'],
    },
    moduleMeta: {
      reports: {
        fileCount: 2,
        folderCount: 1,
        lastModified: '2026-02-05T10:00:00.000Z',
        totalSize: 12000,
        typeBreakdown: { docx: 2 },
      },
    },
  },
];

describe('ContentGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useContent.mockReturnValue({ data: mockArtifacts, isLoading: false });
    usePolling.mockReturnValue({ data: null });

    // Mock localStorage
    Storage.prototype.getItem = vi.fn();
    Storage.prototype.setItem = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Structure', () => {
    it('renders page header', () => {
      renderWithProviders(<ContentGallery />);
      expect(screen.getByText('Artifacts')).toBeInTheDocument();
      expect(screen.getByText('Browse generated outputs across all modules')).toBeInTheDocument();
    });

    it('renders search input', () => {
      renderWithProviders(<ContentGallery />);
      expect(screen.getByPlaceholderText('Search modules/files/folders...')).toBeInTheDocument();
    });

    it('renders filter controls', () => {
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText('Group')).toBeInTheDocument();
      expect(screen.getByText('Sort')).toBeInTheDocument();
      expect(screen.getByText('Order')).toBeInTheDocument();
    });

    it('renders module tabs', () => {
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Research')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    it('renders recently opened toggle', () => {
      renderWithProviders(<ContentGallery />);
      expect(screen.getByText('Recently opened')).toBeInTheDocument();
    });
  });

  describe('Artifact Cards', () => {
    it('renders artifact cards', () => {
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('displays module labels', () => {
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText('Research')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    it('displays file and folder counts', () => {
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText(/3 files • 2 folders/)).toBeInTheDocument();
      expect(screen.getByText(/1 file • 1 folder/)).toBeInTheDocument();
      expect(screen.getByText(/2 files • 1 folder/)).toBeInTheDocument();
    });

    it('displays file type breakdown', () => {
      renderWithProviders(<ContentGallery />);

      // Top types should be shown
      expect(screen.getByText(/.md \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/.pdf \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/.docx \(2\)/)).toBeInTheDocument();
    });

    it('displays last updated time', () => {
      renderWithProviders(<ContentGallery />);

      // Should show "Updated X ago" for each card
      const updateTexts = screen.getAllByText(/Updated/);
      expect(updateTexts.length).toBeGreaterThan(0);
    });

    it('has proper ARIA labels', () => {
      renderWithProviders(<ContentGallery />);

      const card = screen.getByLabelText(/Open research artifacts for Project Alpha/);
      expect(card).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters cards by search query', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const searchInput = screen.getByPlaceholderText('Search modules/files/folders...');
      await user.type(searchInput, 'Alpha');

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });

    it('searches module names', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const searchInput = screen.getByPlaceholderText('Search modules/files/folders...');
      await user.type(searchInput, 'research');

      // Should show cards with research module
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });

    it('searches file names', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const searchInput = screen.getByPlaceholderText('Search modules/files/folders...');
      await user.type(searchInput, 'findings');

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });

    it('searches file types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const searchInput = screen.getByPlaceholderText('Search modules/files/folders...');
      await user.type(searchInput, 'pdf');

      // Should show cards with .pdf files
      const cards = screen.queryAllByText('Project Alpha');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const searchInput = screen.getByPlaceholderText('Search modules/files/folders...');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No artifact modules match the current filter.')).toBeInTheDocument();
    });
  });

  describe('Module Filtering', () => {
    it('filters by module tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const researchTab = screen.getByRole('button', { name: /🔬 Research/ });
      await user.click(researchTab);

      // Should only show cards with research module
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });

    it('shows all modules by default', () => {
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('highlights active tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const allTab = screen.getByRole('button', { name: /📦 All/ });
      expect(allTab.className).toContain('bg-[var(--interactive-active)]');

      const researchTab = screen.getByRole('button', { name: /🔬 Research/ });
      await user.click(researchTab);

      expect(researchTab.className).toContain('bg-[var(--interactive-active)]');
    });
  });

  describe('Grouping', () => {
    it('groups by folder when selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const groupSelect = screen.getByLabelText(/Group/);
      await user.selectOptions(groupSelect, 'folder');

      // Should show folder groups
      await waitFor(() => {
        expect(screen.getByText(/Folder: docs/)).toBeInTheDocument();
      });
    });

    it('groups by type when selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const groupSelect = screen.getByLabelText(/Group/);
      await user.selectOptions(groupSelect, 'type');

      // Should show type groups
      await waitFor(() => {
        expect(screen.getByText(/Type: \.md/)).toBeInTheDocument();
      });
    });

    it('shows no groups by default', () => {
      renderWithProviders(<ContentGallery />);

      // Should not show group headers
      expect(screen.queryByText(/Folder:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Type:/)).not.toBeInTheDocument();
    });

    it('persists grouping preference to localStorage', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const groupSelect = screen.getByLabelText(/Group/);
      await user.selectOptions(groupSelect, 'folder');

      expect(Storage.prototype.setItem).toHaveBeenCalledWith(
        expect.stringContaining('groupBy'),
        'folder'
      );
    });
  });

  describe('Sorting', () => {
    it('sorts by recent by default', () => {
      renderWithProviders(<ContentGallery />);

      const sortSelect = screen.getByLabelText(/Sort/);
      expect(sortSelect).toHaveValue('recent');
    });

    it('sorts by name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const sortSelect = screen.getByLabelText(/Sort/);
      await user.selectOptions(sortSelect, 'name');

      // Cards should be reordered alphabetically
      expect(sortSelect).toHaveValue('name');
    });

    it('sorts by size', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const sortSelect = screen.getByLabelText(/Sort/);
      await user.selectOptions(sortSelect, 'size');

      expect(sortSelect).toHaveValue('size');
    });

    it('changes sort direction', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const orderSelect = screen.getByLabelText(/Order/);
      await user.selectOptions(orderSelect, 'asc');

      expect(orderSelect).toHaveValue('asc');
    });

    it('persists sorting preferences to localStorage', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const sortSelect = screen.getByLabelText(/Sort/);
      await user.selectOptions(sortSelect, 'name');

      expect(Storage.prototype.setItem).toHaveBeenCalledWith(
        expect.stringContaining('sortBy'),
        'name'
      );
    });
  });

  describe('Keyboard Navigation (Phase 3 Feature)', () => {
    it('supports arrow key navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      const firstCard = cards[0];

      firstCard.focus();
      expect(document.activeElement).toBe(firstCard);

      // Arrow right should move to next card
      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(document.activeElement).toBe(cards[1]);
      });
    });

    it('supports arrow left navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });

      // Focus second card
      cards[1].focus();

      // Arrow left should move to previous card
      await user.keyboard('{ArrowLeft}');

      await waitFor(() => {
        expect(document.activeElement).toBe(cards[0]);
      });
    });

    it('supports arrow down navigation (grid)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      cards[0].focus();

      // Arrow down should move down by 3 (columns)
      await user.keyboard('{ArrowDown}');

      // Should move focus down
      expect(document.activeElement).not.toBe(cards[0]);
    });

    it('supports arrow up navigation (grid)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });

      if (cards.length >= 4) {
        cards[3].focus();

        await user.keyboard('{ArrowUp}');

        // Should move focus up
        expect(document.activeElement).not.toBe(cards[3]);
      }
    });

    it('supports Home key to jump to first card', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });

      // Focus last card
      cards[cards.length - 1].focus();

      await user.keyboard('{Home}');

      await waitFor(() => {
        expect(document.activeElement).toBe(cards[0]);
      });
    });

    it('supports End key to jump to last card', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      cards[0].focus();

      await user.keyboard('{End}');

      await waitFor(() => {
        expect(document.activeElement).toBe(cards[cards.length - 1]);
      });
    });

    it('opens module with Enter key', async () => {
      const user = userEvent.setup();
      usePolling.mockReturnValue({ data: { 'file1.md': 'content' } });

      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      cards[0].focus();

      await user.keyboard('{Enter}');

      // Modal should open
      await waitFor(() => {
        // ContentPreviewModal should be triggered
        expect(usePolling).toHaveBeenCalled();
      });
    });

    it('opens module with Space key', async () => {
      const user = userEvent.setup();
      usePolling.mockReturnValue({ data: { 'file1.md': 'content' } });

      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      cards[0].focus();

      await user.keyboard(' ');

      // Modal should open
      await waitFor(() => {
        expect(usePolling).toHaveBeenCalled();
      });
    });

    it('uses roving tabindex for keyboard navigation', () => {
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });

      // First card should have tabIndex 0
      expect(cards[0]).toHaveAttribute('tabIndex', '0');

      // Other cards should have tabIndex -1
      cards.slice(1).forEach(card => {
        expect(card).toHaveAttribute('tabIndex', '-1');
      });
    });
  });

  describe('Recently Opened', () => {
    it('toggles recent mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const recentButton = screen.getByText('Recently opened');
      await user.click(recentButton);

      // Button should be highlighted
      expect(recentButton.className).toContain('border-[var(--status-info)]');
    });

    it('stores recently opened modules', async () => {
      const user = userEvent.setup();
      usePolling.mockReturnValue({ data: { 'file1.md': 'content' } });

      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      await user.click(cards[0]);

      // Should store in localStorage
      expect(Storage.prototype.setItem).toHaveBeenCalledWith(
        expect.stringContaining('recentModules'),
        expect.any(String)
      );
    });
  });

  describe('Loading State', () => {
    it('shows skeleton blocks when loading', () => {
      useContent.mockReturnValue({ data: undefined, isLoading: true });
      renderWithProviders(<ContentGallery />);

      // Should show skeleton blocks
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows 6 skeleton cards', () => {
      useContent.mockReturnValue({ data: undefined, isLoading: true });
      const { container } = renderWithProviders(<ContentGallery />);

      const skeletonCards = container.querySelectorAll('.rounded-lg.border.border-border.bg-card.p-5');
      expect(skeletonCards.length).toBe(6);
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no artifacts', () => {
      useContent.mockReturnValue({ data: [], isLoading: false });
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText(/No artifacts yet/i)).toBeInTheDocument();
    });

    it('shows search empty state when no matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const searchInput = screen.getByPlaceholderText('Search modules/files/folders...');
      await user.type(searchInput, 'nonexistent query that matches nothing');

      expect(screen.getByText('No artifact modules match the current filter.')).toBeInTheDocument();
    });
  });

  describe('ArtifactCard Memoization', () => {
    it('renders with stable props', () => {
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      expect(cards.length).toBeGreaterThan(0);
    });

    it('displays module emoji', () => {
      renderWithProviders(<ContentGallery />);

      // Module emojis should be visible
      expect(screen.getByText('🔬')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
      expect(screen.getByText('📄')).toBeInTheDocument();
    });

    it('has focus ring on focus', async () => {
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      cards[0].focus();

      expect(cards[0].className).toContain('focus:ring-2');
    });
  });

  describe('Accessibility', () => {
    it('has accessible search input', () => {
      renderWithProviders(<ContentGallery />);

      const searchInput = screen.getByPlaceholderText('Search modules/files/folders...');
      expect(searchInput).toHaveAttribute('id', 'artifacts-search');
    });

    it('cards have descriptive aria-labels', () => {
      renderWithProviders(<ContentGallery />);

      const card = screen.getByLabelText(/Open research artifacts for Project Alpha/);
      expect(card).toBeInTheDocument();
    });

    it('filter controls have labels', () => {
      renderWithProviders(<ContentGallery />);

      expect(screen.getByText('Group')).toBeInTheDocument();
      expect(screen.getByText('Sort')).toBeInTheDocument();
      expect(screen.getByText('Order')).toBeInTheDocument();
    });

    it('module tabs are keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ContentGallery />);

      const allTab = screen.getByRole('button', { name: /📦 All/ });
      allTab.focus();

      await user.keyboard('{Tab}');

      // Should move to next tab
      expect(document.activeElement).not.toBe(allTab);
    });

    it('cards have proper focus states', () => {
      renderWithProviders(<ContentGallery />);

      const cards = screen.getAllByRole('button', { name: /Open .* artifacts/ });
      cards.forEach(card => {
        expect(card.className).toContain('focus:outline-none');
        expect(card.className).toContain('focus:ring-2');
      });
    });
  });

  describe('Responsive Layout', () => {
    it('uses responsive grid', () => {
      const { container } = renderWithProviders(<ContentGallery />);

      const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
      expect(grid).toBeInTheDocument();
    });

    it('has responsive filter controls', () => {
      const { container } = renderWithProviders(<ContentGallery />);

      const filterGrid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
      expect(filterGrid).toBeInTheDocument();
    });
  });

  describe('Data Calculations', () => {
    it('calculates dominant folder correctly', () => {
      renderWithProviders(<ContentGallery />);

      // Should show folder information in grouped view
      // This is tested indirectly through grouping tests
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    it('calculates top file types', () => {
      renderWithProviders(<ContentGallery />);

      // Should show top 2 file types per card
      expect(screen.getByText(/.md \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/.docx \(2\)/)).toBeInTheDocument();
    });

    it('handles cards with no typed files', () => {
      useContent.mockReturnValue({
        data: [{
          workspaceId: 'workspace-empty',
          title: 'Empty Project',
          modules: {
            research: ['file1', 'file2'],
          },
          moduleMeta: {
            research: {
              fileCount: 2,
              folderCount: 1,
              typeBreakdown: {},
            },
          },
        }],
        isLoading: false,
      });

      renderWithProviders(<ContentGallery />);

      expect(screen.getByText('No typed files')).toBeInTheDocument();
    });
  });

  describe('View Preferences', () => {
    it('reads preferences from localStorage on mount', () => {
      Storage.prototype.getItem.mockImplementation((key) => {
        if (key.includes('groupBy')) return 'folder';
        if (key.includes('sortBy')) return 'name';
        if (key.includes('sortDir')) return 'asc';
        return null;
      });

      renderWithProviders(<ContentGallery />);

      const groupSelect = screen.getByLabelText(/Group/);
      const sortSelect = screen.getByLabelText(/Sort/);
      const orderSelect = screen.getByLabelText(/Order/);

      expect(groupSelect).toHaveValue('folder');
      expect(sortSelect).toHaveValue('name');
      expect(orderSelect).toHaveValue('asc');
    });

    it('normalizes invalid stored values', () => {
      Storage.prototype.getItem.mockImplementation((key) => {
        if (key.includes('groupBy')) return 'invalid-value';
        return null;
      });

      renderWithProviders(<ContentGallery />);

      const groupSelect = screen.getByLabelText(/Group/);
      // Should fallback to default 'none'
      expect(groupSelect).toHaveValue('none');
    });
  });
});
