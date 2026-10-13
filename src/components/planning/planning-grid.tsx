import { Lock } from 'lucide-react';
import { type ClipboardEvent, type KeyboardEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { dayOfWeek, isPublicHoliday, weekdayLetter } from '../../../api/calendar';
import type { AgentCounters, Violation } from '../../../api/rules/model';
import { cn } from 'cn';
import type { CellEdit, GridCell } from './use-planning-editor';
import { cellKey } from './use-planning-editor';
import { formatMinutes } from '@/lib/format';
import type { Agent, ShiftType } from '@/lib/resources';

export interface CoverageRow {
  label: string;
  /** Per date: required minimum and agents counted, or undefined when no need. */
  byDate: Map<string, { count: number; min: number }>;
}

interface PlanningGridProps {
  dates: string[];
  agents: Agent[];
  gradeCode: Map<string, string>;
  shifts: ShiftType[];
  cells: Map<string, GridCell>;
  violations: Violation[];
  counters: Map<string, AgentCounters>;
  coverage: CoverageRow[];
  readOnly: boolean;
  onApply: (edits: CellEdit[]) => void;
  onUndo: () => void;
}

type Position = { row: number; col: number };

const inContract = (agent: Agent, date: string) =>
  date >= agent.startDate && (!agent.endDate || date <= agent.endDate);

/**
 * Agents × days grid, edited like a spreadsheet: arrows move (Shift extends
 * the selection), typing a code fills the selection (instantly when the code
 * is unambiguous, otherwise on Enter), Delete empties, Alt+L locks or
 * unlocks, Cmd/Ctrl+C/V copy and paste codes, Cmd/Ctrl+Z undoes.
 */
export function PlanningGrid({
  dates,
  agents,
  gradeCode,
  shifts,
  cells,
  violations,
  counters,
  coverage,
  readOnly,
  onApply,
  onUndo,
}: PlanningGridProps) {
  const [anchor, setAnchor] = useState<Position>({ row: 0, col: 0 });
  const [focus, setFocus] = useState<Position>({ row: 0, col: 0 });
  const [typed, setTyped] = useState('');

  const shiftById = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);
  const codes = useMemo(
    () =>
      new Map(
        shifts.filter((shift) => !shift.archived).map((shift) => [shift.code.toUpperCase(), shift])
      ),
    [shifts]
  );
  const violationsByCell = useMemo(
    () =>
      Map.groupBy(
        violations.filter((violation) => violation.agentId),
        (violation) => cellKey(violation.agentId!, violation.date)
      ),
    [violations]
  );

  const top = Math.min(anchor.row, focus.row);
  const bottom = Math.max(anchor.row, focus.row);
  const left = Math.min(anchor.col, focus.col);
  const right = Math.max(anchor.col, focus.col);
  const isSelected = (row: number, col: number) =>
    row >= top && row <= bottom && col >= left && col <= right;

  /** Editable cells of the selection (in contract). */
  const selection = () => {
    const result: { agent: Agent; date: string; cell?: GridCell }[] = [];
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const agent = agents[row]!;
        const date = dates[col]!;
        if (inContract(agent, date)) {
          result.push({ agent, date, cell: cells.get(cellKey(agent.id, date)) });
        }
      }
    }
    return result;
  };

  const move = (row: number, col: number, extend = false) => {
    const next = {
      row: Math.max(0, Math.min(agents.length - 1, row)),
      col: Math.max(0, Math.min(dates.length - 1, col)),
    };
    setFocus(next);
    if (!extend) setAnchor(next);
    setTyped('');
  };

  /** Fills the selection with a shift (or empties it), skipping locked cells. */
  const fill = (shift: ShiftType | null) => {
    const targets = selection();
    const locked = targets.filter((target) => target.cell?.locked).length;
    onApply(
      targets
        .filter((target) => !target.cell?.locked)
        .map(({ agent, date }) => ({
          agentId: agent.id,
          date,
          shiftTypeId: shift?.id ?? null,
          locked: false,
        }))
    );
    if (locked) toast.info(`${locked} case(s) verrouillée(s) laissée(s) telle(s) quelle(s)`);
  };

  const commit = (code: string) => {
    const shift = codes.get(code);
    setTyped('');
    if (!shift) {
      toast.error(`Code inconnu : ${code}`);
      return;
    }
    fill(shift);
    if (top === bottom && left === right) move(focus.row, focus.col + 1);
  };

  const toggleLock = () => {
    const filled = selection().filter((target) => target.cell);
    const lock = !filled.every((target) => target.cell!.locked);
    onApply(
      filled.map(({ agent, date, cell }) => ({
        agentId: agent.id,
        date,
        shiftTypeId: cell!.shiftTypeId,
        locked: lock,
      }))
    );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const { key, shiftKey, altKey, metaKey, ctrlKey } = event;
    const steps: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (steps[key]) {
      event.preventDefault();
      const [dRow, dCol] = steps[key]!;
      move(focus.row + dRow, focus.col + dCol, shiftKey);
      return;
    }
    if (key === 'Escape') return setTyped('');
    if (readOnly) return;
    if ((metaKey || ctrlKey) && key.toLowerCase() === 'z') {
      event.preventDefault();
      return onUndo();
    }
    if (altKey && event.code === 'KeyL') {
      event.preventDefault();
      return toggleLock();
    }
    if ((key === 'Enter' || key === 'Tab') && typed) {
      event.preventDefault();
      return commit(typed);
    }
    if ((key === 'Delete' || key === 'Backspace') && !typed) {
      event.preventDefault();
      return fill(null);
    }
    if (key === 'Backspace') return setTyped(typed.slice(0, -1));
    if (key.length === 1 && /[\p{L}\p{N}]/u.test(key) && !metaKey && !ctrlKey && !altKey) {
      event.preventDefault();
      const next = typed + key.toUpperCase();
      const longer = [...codes.keys()].some((code) => code !== next && code.startsWith(next));
      // An exact code that no other code extends is entered at once.
      if (codes.has(next) && !longer) commit(next);
      else setTyped(next);
    }
  };

  const onCopy = (event: ClipboardEvent) => {
    const rows = [];
    for (let row = top; row <= bottom; row++) {
      const codesOfRow = [];
      for (let col = left; col <= right; col++) {
        const cell = cells.get(cellKey(agents[row]!.id, dates[col]!));
        codesOfRow.push(cell ? (shiftById.get(cell.shiftTypeId)?.code ?? '') : '');
      }
      rows.push(codesOfRow.join('\t'));
    }
    event.clipboardData.setData('text/plain', rows.join('\n'));
    event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent) => {
    if (readOnly) return;
    event.preventDefault();
    const grid = event.clipboardData
      .getData('text/plain')
      .replace(/\r/g, '')
      .split('\n')
      .filter((line, index, all) => line || index < all.length - 1)
      .map((line) => line.split('\t'));
    const edits: CellEdit[] = [];
    const unknown = new Set<string>();
    grid.forEach((line, dRow) =>
      line.forEach((raw, dCol) => {
        const agent = agents[top + dRow];
        const date = dates[left + dCol];
        if (!agent || !date || !inContract(agent, date)) return;
        if (cells.get(cellKey(agent.id, date))?.locked) return;
        const code = raw.trim().toUpperCase();
        const shift = code ? codes.get(code) : null;
        if (shift === undefined) return void unknown.add(code);
        edits.push({ agentId: agent.id, date, shiftTypeId: shift?.id ?? null, locked: false });
      })
    );
    onApply(edits);
    if (unknown.size) toast.error(`Codes inconnus ignorés : ${[...unknown].join(', ')}`);
  };

  const dayClass = (date: string) =>
    cn((dayOfWeek(date) === 0 || dayOfWeek(date) === 6 || isPublicHoliday(date)) && 'bg-muted/60');

  return (
    <div
      role="grid"
      aria-label="Planning"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onCopy={onCopy}
      onPaste={onPaste}
      className="focus-visible:ring-ring/50 max-w-full overflow-auto rounded-lg border outline-none focus-visible:ring-3"
    >
      <table className="border-separate border-spacing-0 text-xs">
        <thead className="bg-background sticky top-0 z-20">
          <tr>
            <th className="bg-background sticky left-0 z-30 min-w-44 border-b px-2 text-left">
              Agent
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className={cn('w-9 min-w-9 border-b border-l py-1 font-normal', dayClass(date))}
              >
                <div className="text-muted-foreground">{weekdayLetter(date)}</div>
                <div className="font-medium">{Number(date.slice(8))}</div>
              </th>
            ))}
            <th className="border-b border-l px-2 text-right">Heures / cible</th>
            <th className="border-b border-l px-2">Nuits</th>
            <th className="border-b border-l px-2">WE</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, row) => {
            const count = counters.get(agent.id);
            return (
              <tr key={agent.id}>
                <th
                  scope="row"
                  className="bg-background sticky left-0 z-10 border-b px-2 text-left font-normal whitespace-nowrap"
                >
                  <span className="font-medium">{agent.lastName}</span> {agent.firstName}{' '}
                  <span className="text-muted-foreground">{gradeCode.get(agent.gradeId)}</span>
                </th>
                {dates.map((date, col) => {
                  const cell = cells.get(cellKey(agent.id, date));
                  const shift = cell && shiftById.get(cell.shiftTypeId);
                  const issues = violationsByCell.get(cellKey(agent.id, date)) ?? [];
                  const hard = issues.some((issue) => issue.severity === 'HARD');
                  const selected = isSelected(row, col);
                  const focused = focus.row === row && focus.col === col;
                  return (
                    <td
                      key={date}
                      role="gridcell"
                      aria-selected={selected}
                      title={issues.map((issue) => issue.message).join('\n') || undefined}
                      onMouseDown={(event) => move(row, col, event.shiftKey)}
                      className={cn(
                        'relative h-8 border-b border-l text-center font-medium select-none',
                        dayClass(date),
                        !inContract(agent, date) &&
                          'bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)]',
                        hard && 'ring-destructive ring-2 ring-inset',
                        !hard && issues.length > 0 && 'ring-2 ring-amber-500 ring-inset',
                        selected && 'bg-primary/15',
                        focused && 'outline-primary outline-2 -outline-offset-2'
                      )}
                      style={
                        shift && !selected ? { backgroundColor: `${shift.color}40` } : undefined
                      }
                    >
                      {focused && typed ? (
                        <span className="text-primary underline">{typed}</span>
                      ) : (
                        shift?.code
                      )}
                      {cell?.locked && (
                        <Lock className="text-muted-foreground absolute top-0.5 right-0.5 size-2.5" />
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-l px-2 text-right whitespace-nowrap tabular-nums">
                  {count &&
                    `${formatMinutes(count.creditedMinutes)} / ${formatMinutes(count.targetMinutes)}`}
                </td>
                <td className="border-b border-l px-2 text-center tabular-nums">{count?.nights}</td>
                <td className="border-b border-l px-2 text-center tabular-nums">
                  {count?.weekendDays}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-background sticky bottom-0 z-20">
          {coverage.map((line) => (
            <tr key={line.label}>
              <th className="bg-background sticky left-0 z-30 border-t px-2 text-left font-normal whitespace-nowrap">
                {line.label}
              </th>
              {dates.map((date) => {
                const need = line.byDate.get(date);
                return (
                  <td
                    key={date}
                    className={cn(
                      'border-t border-l text-center tabular-nums',
                      need &&
                        need.count < need.min &&
                        'bg-destructive/15 text-destructive font-medium'
                    )}
                  >
                    {/* A need with no minimum (target only) shows the headcount. */}
                    {need && (need.min ? `${need.count}/${need.min}` : need.count)}
                  </td>
                );
              })}
              <td colSpan={3} className="border-t border-l" />
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}
