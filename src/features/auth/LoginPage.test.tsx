import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';

const signInMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: unknown) => signInMock(args),
    },
  },
}));

function renderPage() {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => { signInMock.mockReset(); });

  it('chiama signInWithPassword con email e password', async () => {
    signInMock.mockResolvedValue({ error: null });
    renderPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.it');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /entra/i }));
    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.it', password: 'secret' });
  });

  it('mostra messaggio di errore se login fallisce', async () => {
    signInMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    renderPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'x@y.it');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /entra/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/credenziali non valide/i);
  });
});
