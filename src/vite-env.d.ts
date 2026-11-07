/// <reference types="vite/client" />

declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
  export default test;
}

declare module 'node:assert/strict' {
  const assert: {
    equal<T>(actual: T, expected: T, message?: string): void;
    ok(value: unknown, message?: string): void;
    deepEqual<T>(actual: T, expected: T, message?: string): void;
  };
  export default assert;
}
