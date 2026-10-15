import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDown, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addDays, monthDates } from '../../../shared/calendar';
import type { PlanningStatus } from '../../../shared/domain';
import type { Violation } from '../../../shared/rules/model';
import type { CoverageSlotKey } from '../../../shared/rules/diagnose';
import { CoverageDiagnosis } from './coverage-diagnosis';
import { PlanningGrid } from './planning-grid';
import { cellKey } from './cells';
import { downloadCsv, downloadPdf, type PlanningExport } from './export';
import { usePlanningEditor } from './use-planning-editor';
import { usePlanningModel } from './use-planning-model';
import { useSolveRun } from './use-solve-run';
import { AcceptViolationDialog, ViolationList } from './violation-list';
import { Button } from '@/components/ui/button';
import {
  type Agent,
  type AgentRequest,
  type CoverageNeed,
  type CoverageOverride,
  type Grade,
  invalidatePlanning,
  type MonthPlanning,
  plannings,
  type RuleSettings,
  type ShiftType,
  type Skill,
} from '@/lib/resources';

interface PlanningEditorProps {
  month: string;
  data: MonthPlanning;
  agents: Agent[];
  grades: Grade[];
  skills: Skill[];
  shifts: ShiftType[];
  needs: CoverageNeed[];
  overrides: CoverageOverride[];
  requests: AgentRequest[];
  settings: RuleSettings;
}

/** Days of the previous month shown before the grid. */
const SHOWN_PREVIOUS_DAYS = 7;

/** A month's grid with live validation, counters, coverage and status. */
export function PlanningEditor(props: PlanningEditorProps) {
  const { month, data, shifts } = props;
  const queryClient = useQueryClient();
  const editor = usePlanningEditor(month, data, shifts);
  const { apply, undo, saving } = editor;
  const solver = useSolveRun(month, editor.cells, shifts);
  // While a proposal is reviewed, the grid shows it over the current cells.
  const cells = solver.preview?.cells ?? editor.cells;
  const [accepting, setAccepting] = useState<Violation | null>(null);
  const [diagnosing, setDiagnosing] = useState<{ slot: CoverageSlotKey; label: string } | null>(
    null
  );
  const dates = useMemo(() => monthDates(month), [month]);
  const contextDates = useMemo(
    () =>
      Array.from({ length: SHOWN_PREVIOUS_DAYS }, (_, i) =>
        addDays(dates[0]!, i - SHOWN_PREVIOUS_DAYS)
      ),
    [dates]
  );
  const status = data.planning!.status;
  const readOnly = status !== 'DRAFT' || solver.running || solver.preview !== null;
  const reload = () => invalidatePlanning(queryClient, month);

  const setStatus = useMutation({
    mutationFn: (next: PlanningStatus) => plannings.setStatus(month, next),
    onSuccess: reload,
    onError: (error) => toast.error(error.message),
  });
  const removeAccepted = useMutation({
    mutationFn: (id: string) => plannings.removeAccepted(month, id),
    onSuccess: reload,
    onError: (error) => toast.error(error.message),
  });

  const planningData = {
    month,
    agents: props.agents,
    grades: props.grades,
    skills: props.skills,
    shifts,
    needs: props.needs,
    overrides: props.overrides,
    requests: props.requests,
    settings: props.settings,
    acceptedViolations: data.acceptedViolations,
    openingBalances: data.balances.opening,
  };
  const model = usePlanningModel(planningData, cells);
  const { slotLabel, agentName } = model;
  const { openHard } = model.summary;

  // What the grid shows (exports are hidden while a solver proposal is reviewed).
  const exported = (): PlanningExport => ({
    month,
    status,
    dates,
    agents: model.rows,
    gradeCode: model.gradeCode,
    shifts,
    cells,
    counters: model.counters,
    openingBalance: model.openingBalance,
    coverage: model.coverage,
  });
  const exportPdf = useMutation({
    mutationFn: () => downloadPdf(exported()),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && !solver.preview && (
          <>
            <Button
              variant="outline"
              disabled={solver.running || saving}
              title="Garde toutes les cases saisies et remplit les cases vides"
              onClick={() => solver.start('COMPLETE')}
            >
              Compléter avec le solveur
            </Button>
            <Button
              variant="outline"
              disabled={solver.running || saving}
              title="Garde les cases verrouillées, les absences et les repos ; recalcule les autres postes en changeant le moins possible"
              onClick={() => solver.start('REOPTIMIZE')}
            >
              Réoptimiser
            </Button>
          </>
        )}
        {status === 'DRAFT' && !solver.preview && (
          <Button
            disabled={openHard > 0 || saving || solver.running || setStatus.isPending}
            onClick={() => setStatus.mutate('VALIDATED')}
          >
            Valider le planning
          </Button>
        )}
        {status === 'VALIDATED' && (
          <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate('PUBLISHED')}>
            Publier
          </Button>
        )}
        {status !== 'DRAFT' && (
          <Button
            variant="outline"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate('DRAFT')}
          >
            Rouvrir en brouillon
          </Button>
        )}
        {!solver.preview && (
          <>
            <Button
              variant="outline"
              disabled={exportPdf.isPending}
              title="Planning du mois en PDF A3 paysage, pour l'affichage"
              onClick={() => exportPdf.mutate()}
            >
              <FileDown />
              PDF
            </Button>
            <Button
              variant="outline"
              title="Une ligne par case (agent, date, poste, heures), pour Excel ou un autre outil"
              onClick={() => downloadCsv(exported())}
            >
              <FileDown />
              CSV
            </Button>
          </>
        )}
        <span className="text-muted-foreground text-xs">
          {solver.running
            ? 'Lecture seule pendant le calcul.'
            : solver.preview
              ? 'Lecture seule pendant la revue de la proposition.'
              : readOnly
                ? 'Lecture seule : rouvrez le planning pour le modifier.'
                : openHard > 0
                  ? `Validation possible une fois les ${openHard} violation(s) dure(s) corrigée(s) ou acceptée(s).`
                  : saving
                    ? 'Enregistrement…'
                    : 'Enregistré'}
        </span>
      </div>
      {solver.running && (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Calcul en cours, jusqu'à une minute…
        </p>
      )}
      {solver.failed && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-destructive">{solver.failed}</span>
          <Button variant="link" size="xs" onClick={solver.discard}>
            Fermer
          </Button>
        </div>
      )}
      {solver.preview && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <span>
            Proposition du solveur : {solver.preview.changed.size} case(s) modifiée(s) (marquées
            d'un point bleu), {openHard} violation(s) dure(s), manque de couverture{' '}
            {String(solver.stats?.coverage ?? '?')}.
            {Number(solver.stats?.coverage) > 0 &&
              ' Cliquez sur une case rouge de la couverture pour savoir pourquoi.'}
          </span>
          <Button size="sm" disabled={solver.applying} onClick={solver.apply}>
            Appliquer
          </Button>
          <Button size="sm" variant="outline" disabled={solver.applying} onClick={solver.discard}>
            Abandonner
          </Button>
        </div>
      )}
      {data.balances.previousMonthOpen && (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          Le mois précédent n'est pas publié : les soldes d'ouverture reprennent sa dernière
          publication, ou ne le comptent pas s'il n'a jamais été publié.
        </p>
      )}
      {data.balances.openingChangedSincePublication && (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          Un mois antérieur a été republié après ce mois : ses soldes d'ouverture ont changé depuis
          la publication.
        </p>
      )}
      {!readOnly && (
        <p className="text-muted-foreground text-xs">
          Saisie : tapez un code (J, N, CA…) ; Suppr vide ; Alt+L verrouille ; Maj+flèches
          sélectionne ; Cmd/Ctrl+C, V, Z.
        </p>
      )}

      <PlanningGrid
        contextDates={contextDates}
        dates={dates}
        model={model}
        shifts={shifts}
        cells={cells}
        changed={solver.preview?.changed}
        readOnly={readOnly}
        onApply={apply}
        onUndo={undo}
        onDiagnose={(line, date) =>
          setDiagnosing({ slot: { ...line.slot, date }, label: line.label })
        }
      />

      <ViolationList
        model={model}
        readOnly={readOnly}
        onDiagnose={(slot, date) =>
          setDiagnosing({ slot: { ...slot, date }, label: slotLabel(slot) })
        }
        onAccept={setAccepting}
        onRemove={(id) => removeAccepted.mutate(id)}
      />

      <CoverageDiagnosis
        input={model.input}
        target={diagnosing}
        isLocked={(agentId, date) => cells.get(cellKey(agentId, date))?.locked ?? false}
        agentName={agentName}
        shiftCode={model.shiftCode}
        slotLabel={slotLabel}
        readOnly={readOnly}
        onPlace={(agentId, { date, shiftTypeId }) => {
          apply([{ agentId, date, shiftTypeId, locked: false }]);
          setDiagnosing(null);
        }}
        onClose={() => setDiagnosing(null)}
      />

      <AcceptViolationDialog
        month={month}
        violation={accepting}
        who={accepting ? (agentName.get(accepting.agentId!) ?? '') : ''}
        onClose={() => setAccepting(null)}
        onSaved={() => {
          setAccepting(null);
          void reload();
        }}
      />
    </div>
  );
}
