import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoanCalculator } from "@/components/dashboard/loan-calculator";

export const Route = createFileRoute("/_authenticated/kalkulator")({
  head: () => ({ meta: [{ title: "Kalkulator Pinjaman — T-COOL Koperasi" }] }),
  component: () => {
    const navigate = useNavigate();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kalkulator Pinjaman</h1>
          <p className="text-sm text-muted-foreground">Simulasikan cicilan dengan bunga flat, efektif, atau menurun.</p>
        </div>
        <LoanCalculator onApply={(input) => navigate({ to: "/pinjaman", search: input as never })} />
      </div>
    );
  },
});