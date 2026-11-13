import { ceilToInchMm, feetToMm, inchesToMm, formatFeetInches, snapToInchMm } from './units';

describe('units', () => {
  it('converts feet to whole millimeters', () => {
    expect(feetToMm(12)).toBe(3658);
    expect(feetToMm(10)).toBe(3048);
    expect(feetToMm(100)).toBe(30480);
  });

  it('converts inches to whole millimeters', () => {
    expect(inchesToMm(1)).toBe(25);
    expect(inchesToMm(30.5)).toBe(775);
  });

  it('snaps millimeters to the nearest whole inch', () => {
    expect(snapToInchMm(0)).toBe(0);
    expect(snapToInchMm(25)).toBe(25); // 1 in = 25.4 mm -> 25
    expect(snapToInchMm(37)).toBe(25); // 1.46 in -> 1 in
    expect(snapToInchMm(39)).toBe(51); // 1.54 in -> 2 in
    expect(snapToInchMm(3658)).toBe(3658); // 12 ft is already on an inch
    expect(snapToInchMm(3660)).toBe(3658);
    expect(snapToInchMm(30480)).toBe(30480);
  });

  it('rounds up to the next whole inch and never gives less than the input', () => {
    expect(ceilToInchMm(0)).toBe(0);
    expect(ceilToInchMm(762)).toBe(762); // exactly 30 in stays at 30 in
    expect(ceilToInchMm(761)).toBe(762);
    expect(ceilToInchMm(763)).toBe(787); // 30.04 in -> 31 in = 787.4 mm
    expect(ceilToInchMm(775)).toBe(787);
    for (let mm = 1; mm < 2000; mm++) {
      expect(ceilToInchMm(mm)).toBeGreaterThanOrEqual(mm);
    }
  });

  it('formats millimeters as feet and inches', () => {
    expect(formatFeetInches(0)).toBe('0 ft 0 in');
    expect(formatFeetInches(3658)).toBe('12 ft 0 in');
    expect(formatFeetInches(3048)).toBe('10 ft 0 in');
    expect(formatFeetInches(775)).toBe('2 ft 7 in');
  });
});