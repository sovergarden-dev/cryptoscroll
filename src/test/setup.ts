import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";

vi.stubGlobal("crypto", webcrypto);
vi.stubGlobal("TextEncoder", TextEncoder);
vi.stubGlobal("TextDecoder", TextDecoder);

if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
