import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth, User } from '@/lib/auth';
import { api } from '@/lib/api';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('Auth Context', () => {
  const queryClient = new QueryClient();
  
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should initialize auth with no user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('should handle login', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    const user: User = { id: '1', email: 'test@test.com', firstName: 'John', lastName: 'Doe', role: 'EMPLOYEE' };

    act(() => {
      result.current.login('token', user);
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.token).toEqual('token');
    expect(localStorage.getItem('token')).toEqual('token');
  });

  it('should handle logout', async () => {
    // Need to mock window.location.href somehow since JSDOM doesn't support changing it during tests easily
    delete (window as any).location;
    window.location = { href: '' } as any;

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    act(() => {
      result.current.logout();
    });

    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
