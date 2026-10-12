import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { Resource } from '@/lib/resources';

export type Column<Row> = { header: string; cell: (row: Row) => ReactNode; className?: string };

type CrudPageProps<Row extends { id: string }, Input> = {
  title: string;
  /** Singular noun for the buttons and dialogs, e.g. « un grade ». */
  noun: { article: string; name: string };
  resource: Resource<Input>;
  rows: Row[] | undefined;
  error: Error | null;
  columns: Column<Row>[];
  rowLabel: (row: Row) => string;
  /** The create/edit form; calls `onSaved` once the API accepted it. */
  renderForm: (props: { row: Row | undefined; onSaved: () => void }) => ReactNode;
};

/** List of a resource with create, edit and delete dialogs. */
export function CrudPage<Row extends { id: string }, Input>({
  title,
  noun,
  resource,
  rows,
  error,
  columns,
  rowLabel,
  renderForm,
}: CrudPageProps<Row, Input>) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: resource.query.queryKey });

  const remove = useMutation({
    mutationFn: (row: Row) => resource.remove(row.id),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
    onSettled: () => setDeleting(null),
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Ajouter
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
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows?.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-muted-foreground">
                Aucun élément.
              </TableCell>
            </TableRow>
          )}
          {rows?.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={column.header} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
              <TableCell className="text-right whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Modifier ${rowLabel(row)}`}
                  onClick={() => setEditing(row)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Supprimer ${rowLabel(row)}`}
                  onClick={() => setDeleting(row)}
                >
                  <Trash2 />
                </Button>
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
                ? `Ajouter ${noun.article} ${noun.name}`
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
