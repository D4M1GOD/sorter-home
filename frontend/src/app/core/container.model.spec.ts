import {
  CONTAINER_TYPES,
  createContainer,
  getContainerType,
  isValidContainerName,
  nextContainerName,
  TOUGH_BOX_27_GAL,
  truncateLabel,
} from './container.model';

describe('container model', () => {
  it('has the Tough Box 27 gal with its real size in whole millimeters', () => {
    expect(TOUGH_BOX_27_GAL.widthMm).toBe(775);
    expect(TOUGH_BOX_27_GAL.depthMm).toBe(521);
    expect(TOUGH_BOX_27_GAL.heightMm).toBe(362);
    expect(CONTAINER_TYPES).toContain(TOUGH_BOX_27_GAL);
  });

  it('finds a type by id', () => {
    expect(getContainerType(TOUGH_BOX_27_GAL.id)).toBe(TOUGH_BOX_27_GAL);
    expect(getContainerType('nope')).toBeUndefined();
  });

  it('uses the same name rules as rooms', () => {
    expect(isValidContainerName('Winter clothes')).toBe(true);
    expect(isValidContainerName('a'.repeat(60))).toBe(true);
    expect(isValidContainerName('   ')).toBe(false);
    expect(isValidContainerName('a'.repeat(61))).toBe(false);
  });

  it('creates a container with a trimmed name, rotation 0 and alone in its stack (level 0)', () => {
    const container = createContainer(TOUGH_BOX_27_GAL.id, '  Toys  ', 100, 200);
    expect(container).toEqual({
      id: container.id,
      typeId: TOUGH_BOX_27_GAL.id,
      name: 'Toys',
      xMm: 100,
      yMm: 200,
      rotation: 0,
      stackPosition: 0,
    });
    expect(container.id).toBeTruthy();
  });

  it('does not create a container with an invalid name or an unknown type', () => {
    expect(() => createContainer(TOUGH_BOX_27_GAL.id, '  ', 0, 0)).toThrow();
    expect(() => createContainer('nope', 'Toys', 0, 0)).toThrow();
  });

  describe('nextContainerName', () => {
    const named = (...names: string[]) =>
      names.map((name) => createContainer(TOUGH_BOX_27_GAL.id, name, 0, 0));

    it('starts at "Container 1" in an empty room', () => {
      expect(nextContainerName([])).toBe('Container 1');
    });

    it('uses the next number', () => {
      expect(nextContainerName(named('Container 1', 'Container 2'))).toBe('Container 3');
    });

    it('uses the lowest number that is free', () => {
      expect(nextContainerName(named('Container 1', 'Container 3'))).toBe('Container 2');
      expect(nextContainerName(named('Container 2'))).toBe('Container 1');
    });

    it('ignores other names', () => {
      expect(nextContainerName(named('Toys', 'Container', 'container 1'))).toBe('Container 1');
    });
  });

  it('truncates labels with an ellipsis', () => {
    expect(truncateLabel('Toys', 10)).toBe('Toys');
    expect(truncateLabel('Toys', 4)).toBe('Toys');
    expect(truncateLabel('Winter clothes', 8)).toBe('Winter …');
    expect(truncateLabel('Winter clothes', 1)).toBe('…');
    expect(truncateLabel('Winter clothes', 0)).toBe('');
  });
});
