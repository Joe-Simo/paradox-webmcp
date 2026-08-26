import Link from "next/link";
import { ArrowLeft, GitBranch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return <main className="not-found" id="main-content"><GitBranch aria-hidden="true" /><span className="section-label">404 / Unexplored route</span><h1>This future does not exist.</h1><p>The requested branch is outside the current product surface.</p><Link className={buttonVariants()} href="/"><ArrowLeft aria-hidden="true" /> Return to Paradox</Link></main>;
}
