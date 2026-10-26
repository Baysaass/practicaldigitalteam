"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, GradePill, Pill } from "@/components/pill";
import { PersonSheet } from "@/components/person-sheet";
import type { View } from "@/lib/data";
import type { PersonResult } from "@/lib/metrics";
import { num, pct, tone } from "@/lib/format";

/** Dashboard: per-person summary; a row opens the person sheet. */
export function PeopleTable({ view }: { view: View }) {
  const [open, setOpen] = useState<PersonResult | null>(null);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Ажилтан</TableHead>
            <TableHead className="text-right">Авсан</TableHead>
            <TableHead className="text-right">Хийсэн</TableHead>
            <TableHead>Гүйцэтгэл</TableHead>
            <TableHead className="text-right">Хугацаандаа</TableHead>
            <TableHead className="text-right">Story pts</TableHead>
            <TableHead className="text-right">Хоцорсон</TableHead>
            <TableHead className="text-right">Cycle (өдөр)</TableHead>
            <TableHead>Зэрэглэл</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="tabular-nums">
          {view.results.map((r) => {
            const isInactive = view.ratings[r.person]?.status === "inactive";
            return (
              <TableRow key={r.person} className={`cursor-pointer ${isInactive ? "opacity-60 bg-muted/20" : ""}`} onClick={() => setOpen(r)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar name={r.person} />
                    <span className="font-medium">{r.person}</span>
                    {isInactive && <Pill tone="orange">Идэвхгүй</Pill>}
                  </div>
                </TableCell>
              <TableCell className="text-right">{r.taken}</TableCell>
              <TableCell className="text-right">{r.done}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((r.completion ?? 0) * 100)}%`, background: "var(--series-1)" }} />
                  </div>
                  <span className={tone(r.completion, 0.85, 0.7)}>{pct(r.completion)}</span>
                </div>
              </TableCell>
              <TableCell className={`text-right ${tone(r.ontime, 0.85, 0.7)}`}>{pct(r.ontime)}</TableCell>
              <TableCell className="text-right">{r.sp}</TableCell>
              <TableCell className="text-right">{r.overdue ? <Pill tone="red">{r.overdue}</Pill> : <span className="text-muted-foreground">0</span>}</TableCell>
              <TableCell className="text-right">{num(r.cycle, 1)}</TableCell>
              <TableCell>
                <GradePill grade={r.grade} />
              </TableCell>
            </TableRow>
          );
        })}
        </TableBody>
      </Table>
      <PersonSheet view={view} result={open} onClose={() => setOpen(null)} />
    </>
  );
}
