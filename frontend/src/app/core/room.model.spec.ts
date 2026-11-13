import { ROOM_MAX_SIZE_MM, ROOM_MIN_SIZE_MM, clampRoomSize, createRoom, isValidRoomName } from './room.model';

describe('room model', () => {
  it('accepts a name of 1 to 60 characters', () => {
    expect(isValidRoomName('Garage')).toBe(true);
    expect(isValidRoomName('a'.repeat(60))).toBe(true);
  });

  it('rejects empty, blank or too long names', () => {
    expect(isValidRoomName('')).toBe(false);
    expect(isValidRoomName('   ')).toBe(false);
    expect(isValidRoomName('a'.repeat(61))).toBe(false);
  });

  it('creates a room with a trimmed name and the default size', () => {
    const room = createRoom('  Garage  ');
    expect(room.name).toBe('Garage');
    expect(room.widthMm).toBe(3658);
    expect(room.depthMm).toBe(3048);
    expect(room.id).toBeTruthy();
    expect(room.containers).toEqual([]);
  });

  it('does not create a room with an invalid name', () => {
    expect(() => createRoom('   ')).toThrow();
  });

  it('keeps room sizes between the minimum and the maximum', () => {
    expect(clampRoomSize(100)).toBe(ROOM_MIN_SIZE_MM);
    expect(clampRoomSize(99999999)).toBe(ROOM_MAX_SIZE_MM);
    expect(clampRoomSize(2000.4)).toBe(2000);
  });
});
