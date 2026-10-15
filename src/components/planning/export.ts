// Exports of a month's planning: A3 PDF for display, CSV for other tools.
// Built in the browser from what the grid shows; jsPDF loads on first use.
import { monthLabel, today, weekdayLetter } from '../../../shared/calendar';
import type { PlanningStatus } from '../../../shared/domain';
import { type AgentCounters, inContract } from '../../../shared/rules/model';
import { cellKey, type GridCell } from './cells';
import {
  agentName,
  type CoverageRow,
  coverageText,
  hoursText,
  isOffDay,
  isShort,
  monthGap,
} from './planning-model';
import { formatBalance, formatDate } from '@/lib/format';
import { planningStatusLabels } from '@/lib/labels';
import type { Agent, ShiftType } from '@/lib/resources';
import geistBoldUrl from '@/assets/fonts/Geist-Bold.ttf?url';
import geistRegularUrl from '@/assets/fonts/Geist-Regular.ttf?url';

export interface PlanningExport {
  month: string;
  status: PlanningStatus;
  dates: string[];
  /** In grid order. */
  agents: Agent[];
  gradeCode: Map<string, string>;
  shifts: ShiftType[];
  cells: Map<string, GridCell>;
  counters: Map<string, AgentCounters>;
  openingBalance: Map<string, number>;
  coverage: CoverageRow[];
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// --- CSV ------------------------------------------------------------------

const csvField = (value: string) =>
  /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

/**
 * One line per cell of the month, agents in grid order then dates. `;`
 * separated, decimal comma, BOM and CRLF: Excel in French opens it as is.
 */
export function toCsv(data: PlanningExport): string {
  const shiftById = new Map(data.shifts.map((shift) => [shift.id, shift]));
  const lines = [['Nom', 'Prénom', 'Grade', 'Date', 'Code', 'Libellé', 'Début', 'Fin', 'Heures']];
  for (const agent of data.agents) {
    for (const date of data.dates) {
      const cell = data.cells.get(cellKey(agent.id, date));
      const shift = cell && shiftById.get(cell.shiftTypeId);
      if (!cell || !shift) continue;
      lines.push([
        agent.lastName,
        agent.firstName,
        data.gradeCode.get(agent.gradeId) ?? '',
        date,
        shift.code,
        shift.label,
        shift.startTime ?? '',
        shift.endTime ?? '',
        (cell.countedMinutes / 60).toFixed(2).replace('.', ','),
      ]);
    }
  }
  return `﻿${lines.map((line) => line.map(csvField).join(';')).join('\r\n')}\r\n`;
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(data: PlanningExport) {
  download(
    new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' }),
    `planning-${data.month}.csv`
  );
}

// --- PDF ------------------------------------------------------------------

type Rgb = [number, number, number];

/** A shift colour lightened for the cell background (the code stays readable). */
function tint(hex: string): Rgb {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(255 - (255 - value) * 0.35);
  };
  return /^#[0-9a-f]{6}$/i.test(hex) ? [channel(1), channel(3), channel(5)] : [255, 255, 255];
}

const OFF_DAY: Rgb = [232, 232, 232];
const OUT_OF_CONTRACT: Rgb = [210, 210, 210];
const SHORT: Rgb = [200, 30, 30];

/**
 * TrueType files of the PDF font: Geist, the app's font, covers the names
 * jsPDF's built-in Helvetica cannot (Ș, ł, ğ, ễ…).
 */
export interface PdfFonts {
  regular: ArrayBuffer;
  bold: ArrayBuffer;
}

const base64 = (bytes: ArrayBuffer) => {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

/** A3 landscape: the agents × days grid, counters, coverage and a legend of the codes. */
export async function buildPdf(data: PlanningExport, fonts: PdfFonts) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  doc.addFileToVFS('Geist-Regular.ttf', base64(fonts.regular));
  doc.addFont('Geist-Regular.ttf', 'Geist', 'normal');
  doc.addFileToVFS('Geist-Bold.ttf', base64(fonts.bold));
  doc.addFont('Geist-Bold.ttf', 'Geist', 'bold');
  doc.setFont('Geist', 'normal');
  const shiftById = new Map(data.shifts.map((shift) => [shift.id, shift]));
  const title = `Planning — ${capitalized(monthLabel(data.month))}`;
  const firstDay = 2;
  const dayIndex = (column: number) => column - firstDay;
  const isDayColumn = (column: number) =>
    column >= firstDay && column < firstDay + data.dates.length;

  doc.setFontSize(16);
  doc.text(title, 10, 14);
  doc.setFontSize(10);
  const status = planningStatusLabels[data.status];
  doc.text(data.status === 'PUBLISHED' ? status : `${status} — document de travail`, 410, 14, {
    align: 'right',
  });

  let tableEnd = 0;
  autoTable(doc, {
    startY: 19,
    margin: { left: 10, right: 10, bottom: 14 },
    theme: 'grid',
    styles: {
      font: 'Geist',
      fontSize: 7,
      cellPadding: 1,
      halign: 'center',
      valign: 'middle',
      lineColor: [190, 190, 190],
      lineWidth: 0.1,
      textColor: 20,
    },
    headStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: 'bold' },
    footStyles: { fillColor: [255, 255, 255], textColor: 60, fontStyle: 'normal' },
    columnStyles: { 0: { halign: 'left', cellWidth: 42 }, 1: { cellWidth: 10 } },
    head: [
      [
        'Agent',
        'Grade',
        ...data.dates.map((date) => `${weekdayLetter(date)}\n${Number(date.slice(8))}`),
        'Heures / cible',
        'Nuits',
        'WE',
        'Solde fin',
      ],
    ],
    body: data.agents.map((agent) => {
      const count = data.counters.get(agent.id);
      return [
        agentName(agent),
        data.gradeCode.get(agent.gradeId) ?? '',
        ...data.dates.map((date) => {
          const cell = data.cells.get(cellKey(agent.id, date));
          return (cell && shiftById.get(cell.shiftTypeId)?.code) ?? '';
        }),
        count ? hoursText(count) : '',
        String(count?.nights ?? ''),
        String(count?.weekendDays ?? ''),
        formatBalance((data.openingBalance.get(agent.id) ?? 0) + monthGap(count)),
      ];
    }),
    foot: data.coverage.map((line) => [
      line.label,
      '',
      ...data.dates.map((date) => {
        const need = line.byDate.get(date);
        return need ? coverageText(need) : '';
      }),
      '',
      '',
      '',
      '',
    ]),
    didDrawPage: ({ cursor }) => {
      tableEnd = cursor?.y ?? tableEnd;
    },
    didParseCell: ({ section, column, row, cell }) => {
      if (!isDayColumn(column.index)) return;
      const date = data.dates[dayIndex(column.index)]!;
      if (section === 'head' && isOffDay(date)) cell.styles.fillColor = OFF_DAY;
      if (section === 'body') {
        const agent = data.agents[row.index]!;
        const value = data.cells.get(cellKey(agent.id, date));
        const shift = value && shiftById.get(value.shiftTypeId);
        if (!inContract(agent, date)) cell.styles.fillColor = OUT_OF_CONTRACT;
        else if (shift) cell.styles.fillColor = tint(shift.color);
        else if (isOffDay(date)) cell.styles.fillColor = OFF_DAY;
      }
      if (section === 'foot') {
        if (isShort(data.coverage[row.index]!.byDate.get(date))) {
          cell.styles.textColor = SHORT;
          cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Legend: the codes used this month.
  const used = new Set([...data.cells.values()].map((cell) => cell.shiftTypeId));
  const legend = data.shifts
    .filter((shift) => used.has(shift.id))
    .map((shift) =>
      shift.startTime && shift.endTime
        ? `${shift.code} : ${shift.label} (${shift.startTime}–${shift.endTime})`
        : `${shift.code} : ${shift.label}`
    )
    .join('   ·   ');
  let y = tableEnd + 6;
  const lines: string[] = doc.splitTextToSize(legend, 400);
  if (y + lines.length * 4 > 283) {
    doc.addPage();
    y = 14;
  }
  doc.setFontSize(8);
  doc.text(lines, 10, y);

  const editedOn = formatDate(today());
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(`Planning Manager — ${title} — édité le ${editedOn}`, 10, 291);
    doc.text(`Page ${page}/${pages}`, 410, 291, { align: 'right' });
  }
  return doc;
}

export async function downloadPdf(data: PlanningExport) {
  const [regular, bold] = await Promise.all(
    [geistRegularUrl, geistBoldUrl].map((url) =>
      fetch(url).then((response) => response.arrayBuffer())
    )
  );
  (await buildPdf(data, { regular: regular!, bold: bold! })).save(`planning-${data.month}.pdf`);
}
