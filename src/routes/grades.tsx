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
import { api, unwrap } from '@/lib/api-client';

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
    queryFn: () => api.grades.$get().then(unwrap),
  });

  const createGrade = useMutation({
    mutationFn: () => api.grades.$post({ json: { code, label } }).then(unwrap),
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
            onChange={(e) => {
              setCode(e.target.value);
              createGrade.reset();
            }}
            required
            className="w-28"
          />
        </div>
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="grade-label">Libellé</Label>
          <Input
            id="grade-label"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              createGrade.reset();
            }}
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
