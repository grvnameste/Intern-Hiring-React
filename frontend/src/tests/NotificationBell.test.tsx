import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBell } from '@/components/NotificationBell';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

jest.mock('@/lib/api');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the bell icon', () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
    render(<NotificationBell />, { wrapper });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows unread badge when there are unread notifications', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        data: [{ id: '1', title: 'Test Notif', message: 'Hello', isRead: false, createdAt: new Date().toISOString() }]
      }
    });

    render(<NotificationBell />, { wrapper });

    await waitFor(() => {
      // The badge is a span with animate-ping
      expect(screen.getByRole('button').querySelector('.animate-ping')).toBeInTheDocument();
    });
  });

  it('opens dropdown on click', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
    render(<NotificationBell />, { wrapper });

    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });
});
