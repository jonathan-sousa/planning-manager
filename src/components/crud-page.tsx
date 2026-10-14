import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type Column<Row> = { header: string; cell: (row: Row) => ReactNode; className?: string };

type CrudPageProps<Row> = {
  title: string;
  /** Under the title. */
  description?: ReactNode;
  /** Singular noun for the buttons and dialogs, e.g. « un grade ». */
  noun: { article: string; name: string };
  /** Verb of the create button and dialog. */
  createLabel?: string;
  /** The list query to reload after a write; `remove` adds a delete button. */
  resource: { query: { queryKey: QueryKey }; remove?: (id: string) => Promise<void> };
  rows: Row[] | undefined;
  /** Identifier of a row: its `id` unless told otherwise. */
  rowId?: (row: Row) => string;
  error: Error | null;
  columns: Column<Row>[];
  rowLabel: (row: Row) => string;
  rowClassName?: (row: Row) => string;
  /** More buttons of a row, before the edit one. */
  rowActions?: (row: Row) => ReactNode;
  /** The create/edit form; calls `onSaved` once the API accepted it. */
  renderForm: (props: { row: Row | undefined; onSaved: () => void }) => ReactNode;
};

const ownId = (row: unknown) => (row as { id: string }).id;

/** List of a resource with create, edit and (optionally) delete dialogs. */
export function CrudPage<Row>({
  title,
  description,
  noun,
  createLabel = 'Ajouter',
  resource,
  rows,
  rowId = ownId,
  error,
  columns,
  rowLabel,
  rowClassName,
  rowActions,
  renderForm,
}: CrudPageProps<Row>) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: resource.query.queryKey });

  const remove = useMutation({
    mutationFn: (row: Row) => resource.remove!(rowId(row)),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
    onSettled: () => setDeleting(null),
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          {createLabel}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.header} className={column.className}>
                {column.header}
              </TableHead>
            ))}
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rows?.length === 0 || (!rows && !error)) && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-muted-foreground">
                {rows ? 'Aucun élément.' : 'Chargement…'}
              </TableCell>
            </TableRow>
          )}
          {rows?.map((row) => (
            <TableRow key={rowId(row)} className={rowClassName?.(row)}>
              {columns.map((column) => (
                <TableCell key={column.header} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
              <TableCell className="text-right whitespace-nowrap">
                {rowActions?.(row)}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Modifier ${rowLabel(row)}`}
                  title="Modifier"
                  onClick={() => setEditing(row)}
                >
                  <Pencil />
                </Button>
                {resource.remove && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Supprimer ${rowLabel(row)}`}
                    title="Supprimer"
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing === 'new'
                ? `${createLabel} ${noun.article} ${noun.name}`
                : `Modifier ${editing ? rowLabel(editing) : ''}`}
            </DialogTitle>
          </DialogHeader>
          {editing !== null &&
            renderForm({
              row: editing === 'new' ? undefined : editing,
              onSaved: () => {
                setEditing(null);
                void invalidate();
              },
            })}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleting && rowLabel(deleting)} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La suppression est définitive. Un élément encore utilisé ne peut pas être supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
