import { Lock } from 'lucide-react';
import { type ClipboardEvent, type KeyboardEvent, useMemo } from 'react';
import { toast } from 'sonner';
import { weekdayLetter } from '../../../shared/calendar';
import { inContract, violationKey } from '../../../shared/rules/model';
import { cn } from 'cn';
import { type CellEdit, cellKey, type GridCell } from './cells';
import { blockText, parsePaste } from './grid-clipboard';
import {
  type CoverageRow,
  coverageText,
  hoursText,
  isOffDay,
  isShort,
  monthGap,
  type PlanningModel,
} from './planning-model';
import { useGridSelection } from './use-grid-selection';
import { formatBalance } from '@/lib/format';
import type { Agent, ShiftType } from '@/lib/resources';

interface PlanningGridProps {
  /** Last days of the previous month, shown read-only for continuity. */
  contextDates: string[];
  dates: string[];
  /** Rows, violations (accepted ones by key), counters, balances and coverage lines. */
  model: Pick<
    PlanningModel,
    'rows' | 'gradeCode' | 'violations' | 'accepted' | 'counters' | 'openingBalance' | 'coverage'
  >;
  shifts: ShiftType[];
  cells: Map<string, GridCell>;
  /** Cells a solver proposal changes (`agentId|date`). */
  changed?: Set<string>;
  readOnly: boolean;
  onApply: (edits: CellEdit[]) => void;
  onUndo: () => void;
  /** Opens the explanation of an unmet coverage minimum. */
  onDiagnose: (line: CoverageRow, date: string) => void;
}

/**
 * Agents × days grid, edited like a spreadsheet: arrows move (Shift extends
 * the selection), typing a code fills the selection (instantly when the code
 * is unambiguous, otherwise on Enter), Delete empties, Alt+L locks or
 * unlocks, Cmd/Ctrl+C/V copy and paste codes, Cmd/Ctrl+Z undoes.
 */
export function PlanningGrid({
  contextDates,
  dates,
  model,
  shifts,
  cells,
  changed,
  readOnly,
  onApply,
  onUndo,
  onDiagnose,
}: PlanningGridProps) {
  const { rows: agents, gradeCode, violations, accepted, counters, openingBalance } = model;
  const { focus, bounds, single, isSelected, move, typed, setTyped } = useGridSelection(
    agents.length,
    dates.length
  );
  const { top, bottom, left, right } = bounds;

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
    if (single) move(focus.row, focus.col + 1);
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

  const codeAt = (agentId: string, date: string) => {
    const cell = cells.get(cellKey(agentId, date));
    return cell ? (shiftById.get(cell.shiftTypeId)?.code ?? '') : '';
  };

  const onCopy = (event: ClipboardEvent) => {
    const block = agents
      .slice(top, bottom + 1)
      .map((agent) => dates.slice(left, right + 1).map((date) => codeAt(agent.id, date)));
    event.clipboardData.setData('text/plain', blockText(block));
    event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent) => {
    if (readOnly) return;
    event.preventDefault();
    const { edits, unknown } = parsePaste(
      event.clipboardData.getData('text/plain'),
      (dRow, dCol) => {
        const agent = agents[top + dRow];
        const date = dates[left + dCol];
        if (!agent || !date || !inContract(agent, date)) return undefined;
        if (cells.get(cellKey(agent.id, date))?.locked) return undefined;
        return { agentId: agent.id, date };
      },
      codes
    );
    onApply(edits);
    if (unknown.length) toast.error(`Codes inconnus ignorés : ${unknown.join(', ')}`);
  };

  const dayClass = (date: string) => cn(isOffDay(date) && 'bg-muted/60');

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
            {contextDates.map((date) => (
              <th
                key={date}
                className="text-muted-foreground/70 w-8 min-w-8 border-b border-l py-1 font-normal"
              >
                <div>{weekdayLetter(date)}</div>
                <div>{Number(date.slice(8))}</div>
              </th>
            ))}
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
            <th className="border-b border-l px-2 text-right">Solde fin</th>
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
                {contextDates.map((date) => (
                  <td
                    key={date}
                    className="text-muted-foreground/70 bg-muted/40 h-8 border-b border-l text-center"
                  >
                    {codeAt(agent.id, date)}
                  </td>
                ))}
                {dates.map((date, col) => {
                  const cell = cells.get(cellKey(agent.id, date));
                  const shift = cell && shiftById.get(cell.shiftTypeId);
                  const issues = violationsByCell.get(cellKey(agent.id, date)) ?? [];
                  const open = issues.filter(
                    (issue) => issue.severity === 'SOFT' || !accepted.has(violationKey(issue))
                  );
                  const hard = open.some((issue) => issue.severity === 'HARD');
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
                        !hard && open.length > 0 && 'ring-2 ring-amber-500 ring-inset',
                        open.length === 0 &&
                          issues.length > 0 &&
                          'outline-muted-foreground/60 outline-1 -outline-offset-4 outline-dashed',
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
                      {changed?.has(cellKey(agent.id, date)) && (
                        <span className="absolute top-0.5 left-0.5 size-1.5 rounded-full bg-sky-500" />
                      )}
                      {cell?.locked && (
                        <Lock className="text-muted-foreground absolute top-0.5 right-0.5 size-2.5" />
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-l px-2 text-right whitespace-nowrap tabular-nums">
                  {count && hoursText(count)}
                </td>
                <td className="border-b border-l px-2 text-center tabular-nums">{count?.nights}</td>
                <td className="border-b border-l px-2 text-center tabular-nums">
                  {count?.weekendDays}
                </td>
                <BalanceCell opening={openingBalance.get(agent.id) ?? 0} month={monthGap(count)} />
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-background sticky bottom-0 z-20">
          {model.coverage.map((line) => (
            <tr key={line.label}>
              <th className="bg-background sticky left-0 z-30 border-t px-2 text-left font-normal whitespace-nowrap">
                {line.label}
              </th>
              {contextDates.map((date) => (
                <td key={date} className="border-t border-l" />
              ))}
              {dates.map((date) => {
                const need = line.byDate.get(date);
                const short = isShort(need);
                return (
                  <td
                    key={date}
                    className={cn(
                      'border-t border-l text-center tabular-nums',
                      short && 'bg-destructive/15 text-destructive font-medium'
                    )}
                  >
                    {short ? (
                      <button
                        type="button"
                        title="Pourquoi ? Cliquez pour le diagnostic"
                        onClick={() => onDiagnose(line, date)}
                        className="hover:bg-destructive/25 focus-visible:ring-ring/50 size-full cursor-pointer outline-none focus-visible:ring-2"
                      >
                        {coverageText(need)}
                      </button>
                    ) : (
                      need && coverageText(need)
                    )}
                  </td>
                );
              })}
              <td colSpan={4} className="border-t border-l" />
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}

/** End-of-month balance: the opening plus this month's gap (credited - target). */
function BalanceCell({ opening, month }: { opening: number; month: number }) {
  const closing = opening + month;
  return (
    <td
      title={`Ouverture ${formatBalance(opening)}, mois ${formatBalance(month)}`}
      className={cn(
        'border-b border-l px-2 text-right whitespace-nowrap tabular-nums',
        closing < 0 && 'text-destructive'
      )}
    >
      {formatBalance(closing)}
    </td>
  );
}
