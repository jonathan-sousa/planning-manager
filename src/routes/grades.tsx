import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { client } from '@/lib/data-client';

export const Route = createFileRoute('/grades')({
  component: GradesPage,
});

const gradesQueryKey = ['grades'];

function GradesPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');

  const grades = useQuery({
    queryKey: gradesQueryKey,
    queryFn: async () => {
      const { data, errors } = await client.models.Grade.list();
      if (errors?.length) throw new Error(errors.map((error) => error.message).join(', '));
      return data.toSorted((a, b) => a.order - b.order);
    },
  });

  const createGrade = useMutation({
    mutationFn: async () => {
      const { errors } = await client.models.Grade.create({
        code: code.trim(),
        label: label.trim(),
        order: grades.data?.length ?? 0,
      });
      if (errors?.length) throw new Error(errors.map((error) => error.message).join(', '));
    },
    onSuccess: () => {
      setCode('');
      setLabel('');
      return queryClient.invalidateQueries({ queryKey: gradesQueryKey });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createGrade.mutate();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Grades</h1>

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="grade-code">Code</Label>
          <Input
            id="grade-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="w-28"
          />
        </div>
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="grade-label">Libellé</Label>
          <Input
            id="grade-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={createGrade.isPending}>
          Ajouter
        </Button>
      </form>
      {createGrade.isError && (
        <p className="text-destructive text-sm">{createGrade.error.message}</p>
      )}

      {grades.isError && <p className="text-destructive text-sm">{grades.error.message}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Code</TableHead>
            <TableHead>Libellé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grades.data?.map((grade) => (
            <TableRow key={grade.id}>
              <TableCell className="font-medium">{grade.code}</TableCell>
              <TableCell>{grade.label}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
