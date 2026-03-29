import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingModal } from './OnboardingModal';
import { UserProvider } from '@/contexts/UserContext';
import { toast } from 'sonner';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock UserContext
vi.mock('@/contexts/UserContext', () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useUser: () => ({
    user: null,
    loading: false,
    setUser: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

describe('OnboardingModal - User Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render the modal when user is not logged in', () => {
    render(<OnboardingModal />);
    
    expect(screen.getByText('Welcome to JohnAI Predictions')).toBeInTheDocument();
    expect(screen.getAllByText(/10,000 JohnBucks/i).length).toBeGreaterThan(0);
  });

  it('should have input field for display name', () => {
    render(<OnboardingModal />);
    
    const input = screen.getByPlaceholderText('Your display name');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('maxLength', '30');
  });

  it('should disable submit button when name is empty', () => {
    render(<OnboardingModal />);
    
    const button = screen.getByRole('button', { name: /Claim.*JohnBucks/i });
    expect(button).toBeDisabled();
  });

  it('should enable submit button when name is entered', () => {
    render(<OnboardingModal />);
    
    const input = screen.getByPlaceholderText('Your display name');
    const button = screen.getByRole('button', { name: /Claim.*JohnBucks/i });
    
    fireEvent.change(input, { target: { value: 'TestUser' } });
    expect(button).not.toBeDisabled();
  });

  it('should not enable button with only whitespace', () => {
    render(<OnboardingModal />);
    
    const input = screen.getByPlaceholderText('Your display name');
    const button = screen.getByRole('button', { name: /Claim.*JohnBucks/i });
    
    fireEvent.change(input, { target: { value: '   ' } });
    expect(button).toBeDisabled();
  });

  it('should display initial balance of $10,000', () => {
    render(<OnboardingModal />);
    
    expect(screen.getAllByText(/\$10,000 JohnBucks/i).length).toBeGreaterThan(0);
  });
});
