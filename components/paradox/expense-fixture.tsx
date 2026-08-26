"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, PencilLine, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useParadoxStore } from "@/stores/paradox-store";
import { approveExpenseService, editExpenseService, inspectExpenseService } from "@/stores/services";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ExpenseFixture() {
  const hydrated = useParadoxStore((state) => state.hydrated);
  const session = useParadoxStore((state) => state.session);
  const notice = useParadoxStore((state) => state.notice);
  const expense = session.ledger.expenses["481"];
  const token = session.activeReviewTokenId ? session.reviewTokens[session.activeReviewTokenId] : null;
  const [amount, setAmount] = useState("23999");
  const [editing, setEditing] = useState(false);

  const saveAmount = async () => {
    const cents = Math.round(Number(amount) * 100);
    const result = await editExpenseService(expense.id, cents);
    if (result.ok) setEditing(false);
  };

  const approve = async () => {
    if (!token) return;
    await approveExpenseService(token.id, session.ledger.guardMode === "versioned" ? token.inspectedVersion : undefined);
  };

  return (
    <main className="ledger-grid">
      <div className="ledger-context">
        <span className="section-label">Instrumented fixture / Expense 481</span>
        <h1>One expense.<br />Two operators.</h1>
        <p>Ledger is the live domain inside Paradox. Human controls and WebMCP tools operate the same versioned state.</p>
      </div>

      <motion.section layout className="expense-specimen" aria-labelledby="expense-title">
        <div className="expense-meta">
          <span>Expense request</span>
          <Badge>v{expense.version}</Badge>
        </div>
        <div className="expense-identity">
          <div>
            <p>Maya Chen · Equipment</p>
            <h2 id="expense-title">{expense.description}</h2>
          </div>
          <span className={`status status-${expense.status}`}>{expense.status}</span>
        </div>
        <motion.div layout className="expense-amount">{money.format(expense.amountCents / 100)}</motion.div>
        <div className="expense-facts">
          <div><span>Current version</span><code>{expense.version}</code></div>
          <div><span>Policy limit</span><code>{money.format(session.ledger.policyLimitCents / 100)}</code></div>
          <div><span>Review token</span><code>{token?.id ?? "Not created"}</code></div>
        </div>
        <Separator />
        <div className="expense-actions">
          <Button onClick={() => void inspectExpenseService(expense.id)} disabled={!hydrated || expense.status !== "pending"}>
            <Bot className="size-4" /> Inspect expense
          </Button>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!hydrated || expense.status !== "pending"}><PencilLine className="size-4" /> Edit amount</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle className="font-serif text-3xl">Change canonical state</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-[var(--muted)]">This human mutation increments the expense version and is recorded semantically.</DialogDescription>
              <label className="amount-field">
                <span>Amount (USD)</span>
                <div><span>$</span><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
              </label>
              <div className="dialog-actions"><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => void saveAmount()} disabled={!hydrated}>Commit change</Button></div>
            </DialogContent>
          </Dialog>
          <Button variant={token ? "danger" : "outline"} onClick={() => void approve()} disabled={!hydrated || !token || expense.status !== "pending"}>
            <ShieldAlert className="size-4" /> Complete review
          </Button>
        </div>
        {notice && <p role="status" className="inline-notice">{notice}</p>}
      </motion.section>

      <aside className="review-belief" aria-label="Agent review state">
        <span className="section-label">Agent belief</span>
        {token ? (
          <>
            <div className="belief-ring"><Bot /><span>{money.format(token.inspectedAmountCents / 100)}</span><code>v{token.inspectedVersion}</code></div>
            <p>{token.inspectedAmountCents < session.ledger.policyLimitCents ? "Below policy at inspection." : "Above policy at inspection."}</p>
          </>
        ) : <p className="muted-copy">No review exists. Inspect the expense from ChatGPT or the shared control.</p>}
      </aside>

      <div className="explore-cta">
        <div><span>When the trace contains inspect, edit, and approve</span><strong>Ask Paradox which future failed.</strong></div>
        <Link href="/lab/expense-approval" className="button-link">Explore futures <ArrowRight /></Link>
      </div>
    </main>
  );
}
