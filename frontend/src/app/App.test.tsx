import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the application entry screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'CMPC Libros' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent('Gestión de inventario de libros.');
  });
});
