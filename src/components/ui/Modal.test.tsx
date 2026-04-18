import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('non renderizza quando open=false', () => {
    render(<Modal open={false} onClose={() => {}} title="T">body</Modal>);
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });
  it('renderizza body e titolo quando open=true', () => {
    render(<Modal open onClose={() => {}} title="Titolo">body content</Modal>);
    expect(screen.getByText('Titolo')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });
  it('chiama onClose su ESC', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="T">body</Modal>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('chiama onClose su click del bottone X', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="T">body</Modal>);
    fireEvent.click(screen.getByLabelText(/chiudi/i));
    expect(onClose).toHaveBeenCalled();
  });
});
