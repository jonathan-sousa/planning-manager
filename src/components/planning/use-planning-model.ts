import { useMemo } from 'react';
import type { GridCell } from './cells';
import { type PlanningData, planningModel } from './planning-model';

/** The planning model, recomputed when the data or the displayed cells change. */
export function usePlanningModel(data: PlanningData, cells: Map<string, GridCell>) {
  const {
    month,
    agents,
    grades,
    skills,
    shifts,
    needs,
    overrides,
    requests,
    settings,
    acceptedViolations,
    openingBalances,
  } = data;
  return useMemo(
    () =>
      planningModel(
        {
          month,
          agents,
          grades,
          skills,
          shifts,
          needs,
          overrides,
          requests,
          settings,
          acceptedViolations,
          openingBalances,
        },
        cells
      ),
    [
      month,
      agents,
      grades,
      skills,
      shifts,
      needs,
      overrides,
      requests,
      settings,
      acceptedViolations,
      openingBalances,
      cells,
    ]
  );
}
