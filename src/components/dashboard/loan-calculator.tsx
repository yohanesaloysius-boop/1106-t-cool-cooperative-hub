import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type BungaJenis = "flat" | "efektif" | "menurun";

export interface CalcResult {
  cicilan: number;
  totalBunga: number;
  totalBayar: number;
  schedule: { ke: number; pokok: number; bunga: number; cicilan: number; sisa: number }[];
}

export function calcLoan(nominal: number, tenor: number, bungaPct: number, jenis: BungaJenis): CalcResult {
  const bunga = bungaPct / 100;
  const schedule: CalcResult["schedule"] = [];
  let totalBunga = 0;
  let cicilan = 0;

  if (jenis === "flat") {
    const pokokPer = nominal / tenor;
    const bungaPer = nominal * bunga;
    cicilan = pokokPer + bungaPer;
    let sisa = nominal;
    for (let i = 1; i <= tenor; i++) {
      sisa -= pokokPer;
      totalBunga += bungaPer;
      schedule.push({ ke: i, pokok: pokokPer, bunga: bungaPer, cicilan, sisa: Math.max(sisa, 0) });
    }
  } else if (jenis === "efektif") {
    const i = bunga;
    cicilan = (nominal * i) / (1 - Math.pow(1 + i, -tenor));
    let sisa = nominal;
    for (let k = 1; k <= tenor; k++) {
      const bungaPer = sisa * i;
      const pokokPer = cicilan - bungaPer;
      sisa -= pokokPer;
      totalBunga += bungaPer;
      schedule.push({ ke: k, pokok: pokokPer, bunga: bungaPer, cicilan, sisa: Math.max(sisa, 0) });
    }
  } else {
    const pokokPer = nominal / tenor;
    let sisa = nominal;
    for (let k = 1; k <= tenor; k++) {
      const bungaPer = sisa * bunga;
      const cicil = pokokPer + bungaPer;
      if (k === 1) cicilan = cicil;
      sisa -= pokokPer;
      totalBunga += bungaPer;
      schedule.push({ ke: k, pokok: pokokPer, bunga: bungaPer, cicilan: cicil, sisa: Math.max(sisa, 0) });
    }
  }

  return { cicilan, totalBunga, totalBayar: nominal + totalBunga, schedule };
}

export function LoanCalculator({ onApply }: { onApply?: (input: { nominal: number; tenor: number; bunga: number; jenis: BungaJenis }) => void }) {
  const [nominal, setNominal] = useState(5_000_000);
  const [tenor, setTenor] = useState(12);
  const [bunga, setBunga] = useState(1.5);
  const [jenis, setJenis] = useState<BungaJenis>("flat");

  const result = useMemo(() => calcLoan(nominal, tenor, bunga, jenis), [nominal, tenor, bunga, jenis]);

  return (
    <Card style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader>
        <CardTitle>Kalkulator Pinjaman</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <Label>Nominal Pinjaman</Label>
                <span className="font-semibold text-primary">{fmt.format(nominal)}</span>
              </div>
              <Slider className="mt-3" min={500_000} max={100_000_000} step={500_000} value={[nominal]} onValueChange={(v) => setNominal(v[0])} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Rp 500rb</span><span>Rp 100jt</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Tenor</Label>
                <span className="font-semibold text-primary">{tenor} bulan</span>
              </div>
              <Slider className="mt-3" min={3} max={60} step={1} value={[tenor]} onValueChange={(v) => setTenor(v[0])} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bunga">Bunga / bulan (%)</Label>
                <Input id="bunga" type="number" step="0.1" min={0} max={20} value={bunga} onChange={(e) => setBunga(parseFloat(e.target.value) || 0)} className="mt-2" />
              </div>
              <div>
                <Label>Jenis Bunga</Label>
                <Select value={jenis} onValueChange={(v) => setJenis(v as BungaJenis)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="efektif">Efektif</SelectItem>
                    <SelectItem value="menurun">Menurun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <p className="text-sm opacity-80">Estimasi cicilan / bulan</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{fmt.format(Math.round(result.cicilan))}</p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="opacity-75">Total bunga</p>
                <p className="font-semibold">{fmt.format(Math.round(result.totalBunga))}</p>
              </div>
              <div>
                <p className="opacity-75">Total pembayaran</p>
                <p className="font-semibold">{fmt.format(Math.round(result.totalBayar))}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="mt-6 w-full"
              onClick={() => onApply?.({ nominal, tenor, bunga, jenis })}
            >
              Ajukan Sekarang
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold">Grafik Simulasi</p>
            <div className="h-64 rounded-xl border border-border p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.schedule.map((s) => ({ ke: s.ke, Pokok: Math.round(s.pokok), Bunga: Math.round(s.bunga), Sisa: Math.round(s.sisa) }))}>
                  <defs>
                    <linearGradient id="gPokok" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gBunga" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ke" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt.format(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Pokok" stackId="1" stroke="hsl(var(--primary))" fill="url(#gPokok)" />
                  <Area type="monotone" dataKey="Bunga" stackId="1" stroke="hsl(var(--destructive))" fill="url(#gBunga)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Jadwal Angsuran</p>
            <div className="max-h-64 overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs sticky top-0">
                  <tr><th className="p-2 text-left">#</th><th className="p-2 text-right">Pokok</th><th className="p-2 text-right">Bunga</th><th className="p-2 text-right">Cicilan</th><th className="p-2 text-right">Sisa</th></tr>
                </thead>
                <tbody>
                  {result.schedule.map((r) => (
                    <tr key={r.ke} className="border-t border-border">
                      <td className="p-2">{r.ke}</td>
                      <td className="p-2 text-right">{fmt.format(Math.round(r.pokok))}</td>
                      <td className="p-2 text-right">{fmt.format(Math.round(r.bunga))}</td>
                      <td className="p-2 text-right font-medium">{fmt.format(Math.round(r.cicilan))}</td>
                      <td className="p-2 text-right text-muted-foreground">{fmt.format(Math.round(r.sisa))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}