// TanStack Form field and form components bound to shadcn/ui; assembled
// into `useAppForm` by src/hooks/form.ts.
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useFieldContext, useFormContext } from '@/hooks/form-context';
import { durationText, parseDuration } from '@/lib/format';

/** Errors are strings (server) or Standard Schema issues (Zod). */
function useFieldErrors() {
  const field = useFieldContext<unknown>();
  const errors = field.state.meta.errors.map((error: unknown) =>
    typeof error === 'string' ? { message: error } : (error as { message?: string })
  );
  return { field, errors, invalid: errors.length > 0 };
}

function FieldShell({
  label,
  description,
  children,
  orientation,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal';
}) {
  const { field, errors, invalid } = useFieldErrors();
  return (
    <Field data-invalid={invalid} orientation={orientation}>
      <FieldLabel id={`${field.name}-label`} htmlFor={field.name}>
        {label}
      </FieldLabel>
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={errors} />
    </Field>
  );
}

type FieldProps = { label: string; description?: string };

// Reference data, never credentials: keep browsers and password managers out.
const noAutofill = { autoComplete: 'off', 'data-1p-ignore': true } as const;

export function TextField({
  type = 'text',
  nullable,
  ...props
}: FieldProps & { type?: 'text' | 'date' | 'time'; nullable?: boolean }) {
  const field = useFieldContext<string | null>();
  return (
    <FieldShell {...props}>
      <Input
        id={field.name}
        type={type}
        {...noAutofill}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(nullable && !e.target.value ? null : e.target.value)}
        aria-invalid={field.state.meta.errors.length > 0}
      />
    </FieldShell>
  );
}

export function TextareaField(props: FieldProps) {
  const field = useFieldContext<string | null>();
  return (
    <FieldShell {...props}>
      <Textarea
        id={field.name}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value || null)}
      />
    </FieldShell>
  );
}

export function NumberField({ nullable, ...props }: FieldProps & { nullable?: boolean }) {
  const field = useFieldContext<number | null>();
  return (
    <FieldShell {...props}>
      <Input
        id={field.name}
        type="number"
        {...noAutofill}
        inputMode="numeric"
        value={
          field.state.value === null || Number.isNaN(field.state.value) ? '' : field.state.value
        }
        onBlur={field.handleBlur}
        onChange={(e) =>
          field.handleChange(nullable && !e.target.value ? null : e.target.valueAsNumber)
        }
        aria-invalid={field.state.meta.errors.length > 0}
      />
    </FieldShell>
  );
}

/** Minutes, typed as 'h:mm'. */
export function DurationField(props: FieldProps) {
  const field = useFieldContext<number>();
  const { value } = field.state;
  const [text, setText] = useState(() => durationText(value));
  const parsed = parseDuration(text);
  // Value set from elsewhere (e.g. a computed proposal): show it. Comparing
  // the texts also stops a value that has no text form (negative) from looping.
  const synced = durationText(value);
  if (parsed !== value && !(Number.isNaN(parsed) && Number.isNaN(value)) && synced !== text) {
    setText(synced);
  }
  const malformed = text !== '' && Number.isNaN(parsed);
  return (
    <FieldShell {...props} description={malformed ? undefined : props.description}>
      <Input
        id={field.name}
        {...noAutofill}
        value={text}
        placeholder="h:mm"
        onBlur={field.handleBlur}
        onChange={(e) => {
          setText(e.target.value);
          field.handleChange(parseDuration(e.target.value));
        }}
        aria-invalid={malformed || field.state.meta.errors.length > 0}
      />
      {malformed && <FieldDescription>Format attendu : h:mm</FieldDescription>}
    </FieldShell>
  );
}

type Option<V> = { value: V; label: string };

export function SelectField<V extends string>({
  options,
  nullable,
  ...props
}: FieldProps & { options: Option<V>[]; nullable?: boolean }) {
  const field = useFieldContext<V | null>();
  const items: Option<V | null>[] = nullable ? [{ value: null, label: '—' }, ...options] : options;
  return (
    <FieldShell {...props}>
      <Select
        items={items}
        value={field.state.value || null}
        // Base UI also reports a click on the current item: not a change.
        onValueChange={(value) =>
          value !== field.state.value && field.handleChange(value as V | null)
        }
      >
        <SelectTrigger
          id={field.name}
          className="w-full"
          aria-invalid={field.state.meta.errors.length > 0}
        >
          <SelectValue placeholder="Choisir…" />
        </SelectTrigger>
        <SelectContent>
          {items.map((option) => (
            <SelectItem key={option.value ?? ''} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

export function CheckboxListField({
  options,
  ...props
}: FieldProps & { options: Option<string>[] }) {
  const field = useFieldContext<string[]>();
  const toggle = (value: string, checked: boolean) =>
    field.handleChange(
      checked ? [...field.state.value, value] : field.state.value.filter((v) => v !== value)
    );
  return (
    <FieldShell {...props}>
      <div
        role="group"
        aria-labelledby={`${field.name}-label`}
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        {options.length === 0 && <span className="text-muted-foreground text-sm">Aucune</span>}
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={field.state.value.includes(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </FieldShell>
  );
}

export function SwitchField(props: FieldProps) {
  const field = useFieldContext<boolean>();
  return (
    <FieldShell {...props} orientation="horizontal">
      <Switch
        id={field.name}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked)}
      />
    </FieldShell>
  );
}

export function ColorField(props: FieldProps) {
  const field = useFieldContext<string>();
  return (
    <FieldShell {...props}>
      <Input
        id={field.name}
        type="color"
        className="h-8 w-16 p-1"
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
      />
    </FieldShell>
  );
}

export function SubmitButton({ label = 'Enregistrer' }: { label?: string }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting}>
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}

/** Form-level error (an API error that is not tied to a field). */
export function FormError() {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
      {(error) =>
        typeof error === 'string' ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null
      }
    </form.Subscribe>
  );
}

/** <form> with the fields in a responsive grid, the form-level error and the submit button. */
export function FormShell({ children }: { children: ReactNode }) {
  const form = useFormContext();
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      <FormError />
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
