import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LanguageContext } from "@/lib/i18n";
import { NoteReader } from "./NoteReader";

it("copies the complete source with its original line endings and leaves partial selections native", () => {
  const content = "\uFEFF  *test*\r\n\tend  \r\n";
  render(
    <LanguageContext.Provider value={{ language: "en", setLanguage: () => {} }}>
      <NoteReader
        note={{ content, expiresAt: new Date(), burnAfterRead: true, hasPassphrase: false }}
        onClear={() => {}}
        onExpire={() => {}}
      />
    </LanguageContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show original text" }));
  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Original note text" });
  const clipboardData = { setData: vi.fn() };
  field.select();
  fireEvent.copy(field, { clipboardData });
  expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", content);
  clipboardData.setData.mockClear();
  field.setSelectionRange(1, 3);
  fireEvent.copy(field, { clipboardData });
  expect(clipboardData.setData).not.toHaveBeenCalled();
});
