import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PotentialRange } from './PotentialRange';

describe('PotentialRange', () => {
  it('shows the low–high label', () => {
    render(<PotentialRange low={62} high={78} />);
    expect(screen.getByText('62–78')).toBeInTheDocument();
  });

  it('normalizes swapped bounds and clamps to 0–99', () => {
    render(<PotentialRange low={140} high={-5} />);
    // min clamps to 0, max clamps to 99, order corrected.
    expect(screen.getByText('0–99')).toBeInTheDocument();
  });
});
