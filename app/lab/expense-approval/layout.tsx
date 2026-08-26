import { ProductShell } from "@/components/paradox/product-shell";
import { AppRuntime } from "@/components/runtime/app-runtime";

export default function ExpenseLabLayout({ children }: { children: React.ReactNode }) {
  return <AppRuntime><ProductShell>{children}</ProductShell></AppRuntime>;
}
