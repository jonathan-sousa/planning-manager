import {
  type Candidate,
  type CandidateStatus,
  type CoverageSlotKey,
  diagnoseCoverage,
} from '../../../api/rules/diagnose';
import type { RuleInput } from '../../../api/rules/model';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';

/** Groups in display order: who can fill the gap first, then why the others cannot. */
const GROUPS: { status: CandidateStatus; title: string }[] = [
  { status: 'AVAILABLE', title: 'Libres, sans conflit' },
  { status: 'ELSEWHERE', title: 'Sur un autre poste, déplaçables sans conflit' },
  { status: 'BLOCKED', title: 'Bloqués par une règle dure' },
  { status: 'LOCKED', title: 'Case verrouillée' },
  { status: 'ABSENT', title: 'Absents' },
  { status: 'NO_SKILL', title: 'Sans la compétence requise' },
  { status: 'OUT_OF_CONTRACT', title: 'Hors contrat' },
  { status: 'COUNTED', title: 'Déjà comptés' },
];

function summary(candidates: Candidate[]): string {
  const count = (status: CandidateStatus) =>
    candidates.filter((candidate) => candidate.status === status).length;
  if (count('AVAILABLE'))
    return `${count('AVAILABLE')} agent(s) libre(s) peuvent prendre ce poste.`;
  if (count('ELSEWHERE')) return "Personne de libre : il faut déplacer un agent d'un autre poste.";
  return "Aucun agent du grade ne peut prendre ce poste ce jour-là sans enfreindre une règle dure : il faut changer d'autres jours, l'effectif ou le besoin.";
}

interface CoverageDiagnosisProps {
  input: RuleInput;
  /** The unmet need and its row label, or null when closed. */
  target: { slot: CoverageSlotKey; label: string } | null;
  isLocked: (agentId: string, date: string) => boolean;
  agentName: Map<string, string>;
  shiftCode: Map<string, string>;
  readOnly: boolean;
  onPlace: (agentId: string, slot: CoverageSlotKey) => void;
  onClose: () => void;
}

/** Why a coverage minimum is not met that day, agent by agent. */
export function CoverageDiagnosis({
  input,
  target,
  isLocked,
  agentName,
  shiftCode,
  readOnly,
  onPlace,
  onClose,
}: CoverageDiagnosisProps) {
  const candidates = target ? diagnoseCoverage(input, target.slot, isLocked) : [];
  const byStatus = Map.groupBy(candidates, (candidate) => candidate.status);
  const byName = (a: Candidate, b: Candidate) =>
    (agentName.get(a.agentId) ?? '').localeCompare(agentName.get(b.agentId) ?? '', 'fr');

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {target && `Couverture ${target.label} du ${formatDate(target.slot.date)}`}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm">{summary(candidates)}</p>
        {GROUPS.filter(({ status }) => byStatus.has(status)).map(({ status, title }) => (
          <section key={status} className="space-y-1">
            <h3 className="text-sm font-medium">
              {title} ({byStatus.get(status)!.length})
            </h3>
            <ul className="space-y-1 text-sm">
              {byStatus
                .get(status)!
                .sort(byName)
                .map((candidate) => (
                  <li key={candidate.agentId} className="flex flex-wrap items-center gap-x-2">
                    <span>{agentName.get(candidate.agentId)}</span>
                    {candidate.shiftTypeId && (
                      <span className="text-muted-foreground">
                        ({shiftCode.get(candidate.shiftTypeId)})
                      </span>
                    )}
                    {candidate.blockers.map((blocker, index) => (
                      <span key={index} className="text-muted-foreground w-full pl-4 text-xs">
                        {blocker.date !== target!.slot.date && `${formatDate(blocker.date)} : `}
                        {blocker.message}
                      </span>
                    ))}
                    {!readOnly && (status === 'AVAILABLE' || status === 'ELSEWHERE') && (
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => onPlace(candidate.agentId, target!.slot)}
                      >
                        Placer
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
