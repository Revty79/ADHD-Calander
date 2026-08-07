import { PropsWithChildren } from "react";

export function Screen({
  children,
  wide = false
}: PropsWithChildren<{ wide?: boolean }>) {
  return (
    <div className={`web-page ${wide ? "web-calendar-page" : "web-shared-page"}`}>
      {children}
    </div>
  );
}
