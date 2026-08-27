"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, PencilLine, ShieldAlert } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const reduceMotion = useReducedMotion();
  const hasDiverged = Boolean(token && token.inspectedVersion !== expense.version);
  const isViolation = hasDiverged && expense.status === "approved";
  const amountDelta = token ? expense.amountCents - token.inspectedAmountCents : 0;

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
    <main id="main-content" className="ledger-grid" tabIndex={-1}>
      <div className="ledger-context">
        <h1>One expense.<br />{" "}Two operators.</h1>
        <ol className="race-steps">
          <li><span>1</span>Inspect as the agent</li>
          <li><span>2</span>Change the amount as the human</li>
          <li><span>3</span>Complete the stale review</li>
        </ol>
      </div>

      <motion.section layout={!reduceMotion} className={`expense-specimen${hasDiverged ? " has-diverged" : ""}${isViolation ? " is-violation" : ""}`} aria-labelledby="expense-title">
        <div className="expense-meta">
          <span>Expense request</span>
          <Badge>v{expense.version}</Badge>
        </div>
        <div className="expense-identity">
          <div>
            <p>Maya Chen · Travel</p>
            <h2 id="expense-title">{expense.description}</h2>
          </div>
          <Badge tone={expense.status === "approved" ? "green" : expense.status === "rejected" ? "red" : "amber"}>{expense.status}</Badge>
        </div>
        <motion.div layout={!reduceMotion} className="expense-amount">{money.format(expense.amountCents / 100)}</motion.div>
        {token && hasDiverged && (
          <motion.div className={`semantic-delta${isViolation ? " is-violation" : ""}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} aria-live="polite">
            <div><span>Agent reviewed</span><strong>{money.format(token.inspectedAmountCents / 100)} · v{token.inspectedVersion}</strong></div>
            <div className="semantic-delta-axis" aria-hidden="true"><span /><code>+{money.format(amountDelta / 100)} · Δv{expense.version - token.inspectedVersion}</code><span /></div>
            <div><span>Canonical state</span><strong>{money.format(expense.amountCents / 100)} · v{expense.version}</strong></div>
          </motion.div>
        )}
        <div className="expense-facts">
          <div><span>Current version</span><code>{expense.version}</code></div>
          <div><span>Policy limit</span><code>{money.format(session.ledger.policyLimitCents / 100)}</code></div>
          <div><span>Review token</span><code>{token?.id ?? "Not created"}</code></div>
        </div>
        <Separator />
        <div className="expense-actions">
          <Button variant={token ? "secondary" : "default"} onClick={() => void inspectExpenseService(expense.id)} disabled={!hydrated || expense.status !== "pending"}>
            <Bot className="size-4" aria-hidden="true" /> Inspect Expense
          </Button>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogTrigger asChild>
              <Button variant="secondary" disabled={!hydrated || expense.status !== "pending"}><PencilLine className="size-4" aria-hidden="true" /> Edit Amount</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle className="dialog-title">Change Canonical State</DialogTitle>
              <DialogDescription className="dialog-description">This human mutation increments the expense version and is recorded semantically.</DialogDescription>
              <label className="amount-field" htmlFor="expense-amount">
                <span>Amount (USD)</span>
                <div><span>$</span><input id="expense-amount" name="expense-amount" autoComplete="off" spellCheck={false} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
              </label>
              <div className="dialog-actions"><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => void saveAmount()} disabled={!hydrated}>Commit Change</Button></div>
            </DialogContent>
          </Dialog>
          <Button variant={token ? "default" : "secondary"} onClick={() => void approve()} disabled={!hydrated || !token || expense.status !== "pending"}>
            <ShieldAlert className="size-4" aria-hidden="true" /> Complete Review
          </Button>
        </div>
        {notice && <p role="status" aria-live="polite" className="inline-notice">{notice}</p>}
      </motion.section>

      {token && (
        <aside className="review-belief" aria-label="Agent review state">
          <span className="section-label">Agent belief</span>
          <div className="belief-ring"><Bot aria-hidden="true" /><span>{money.format(token.inspectedAmountCents / 100)}</span><code>v{token.inspectedVersion}</code></div>
          <p>{token.inspectedAmountCents < session.ledger.policyLimitCents ? "Below policy at inspection." : "Above policy at inspection."}</p>
        </aside>
      )}

      <div className="explore-cta">
        <strong>Ask Paradox which future failed.</strong>
        <Link href="/lab/expense-approval" className={buttonVariants({ variant: "secondary" })}>Explore Futures <ArrowRight aria-hidden="true" /></Link>
      </div>
    </main>
  );
}
