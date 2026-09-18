import '@testing-library/jest-dom';

jest.mock('@/features/office/SkyCampus3D', () => ({
  SkyCampus3D: () => null,
}));
jest.mock('./src/features/office/SkyCampus3D', () => ({
  SkyCampus3D: () => null,
}), { virtual: true });
jest.mock('../features/office/SkyCampus3D', () => ({
  SkyCampus3D: () => null,
}), { virtual: true });
