// Form kit: `useAppForm` with the shadcn field components. Validation comes
// from the API's Zod schemas (api/schemas.ts); server errors are mapped back
// onto the fields by `submitToApi`.
import { createFormHook, revalidateLogic } from '@tanstack/react-form';
import {
  CheckboxListField,
  ColorField,
  DurationField,
  NumberField,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
} from '@/components/form-fields';
import { fieldContext, formContext } from '@/hooks/form-context';
import { ApiRequestError } from '@/lib/api-client';

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    NumberField,
    DurationField,
    SelectField,
    CheckboxListField,
    SwitchField,
    ColorField,
  },
  // FormShell renders the submit button and the form error.
  formComponents: {},
});

/** Validate on submit, then on every change (no errors on untouched fields). */
export const validationLogic = revalidateLogic();

/**
 * Runs an API write from the form's `onSubmitAsync` validator. Returns null on
 * success, or the API errors in TanStack Form's shape: per field when the API
 * names fields, at form level otherwise. `fields` must always be present: it is
 * what marks the object as a form-level error rather than a raw error value.
 */
export async function submitToApi(write: () => Promise<unknown>) {
  try {
    await write();
    return null;
  } catch (error) {
    if (error instanceof ApiRequestError && Object.keys(error.fields).length > 0) {
      const fields = Object.fromEntries(
        Object.entries(error.fields).map(([name, messages]) => [name, messages.join(' ')])
      );
      return { form: undefined, fields };
    }
    return { form: error instanceof Error ? error.message : String(error), fields: {} };
  }
}
