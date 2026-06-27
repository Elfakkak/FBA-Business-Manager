"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Quick-create lands on a list page with ?new=1 — open that page's create modal
// once, then strip the param so a refresh/back doesn't re-open it.
export function useNewParam(open: () => void) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current && sp.get("new") === "1") {
      fired.current = true;
      open();
      router.replace(pathname, { scroll: false });
    }
  }, [sp, pathname, router, open]);
}
