import { PropsWithChildren } from "react";

export function Screen({ children }: PropsWithChildren) {
  return <div className="web-page web-shared-page">{children}</div>;
}
