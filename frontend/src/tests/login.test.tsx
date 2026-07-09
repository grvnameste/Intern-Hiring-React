import { render, screen } from '@testing-library/react';
import LoginPage from '../app/login/page';

// Mock the Next.js router and Auth hook
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() })
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ login: jest.fn(), isLoading: false })
}));
jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() }
}));

describe('Login Page', () => {
  it('renders login form correctly', () => {
    render(<LoginPage />);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });
});
