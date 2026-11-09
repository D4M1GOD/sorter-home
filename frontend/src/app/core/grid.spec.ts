import { gridLinePositions } from './grid';

describe('gridLinePositions', () => {
  it('returns one line per foot, without the edges', () => {
    expect(gridLinePositions(3658).length).toBe(11); // 12 ft wide -> lines at 1..11 ft
    expect(gridLinePositions(3048).length).toBe(9); // 10 ft deep -> lines at 1..9 ft
  });

  it('starts at one foot', () => {
    expect(gridLinePositions(3658)[0]).toBe(304.8);
  });

  it('returns no lines when the room is smaller than one square', () => {
    expect(gridLinePositions(300)).toEqual([]);
  });
});