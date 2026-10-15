import { createFileRoute, redirect } from '@tanstack/react-router';
import { currentMonth } from '../../shared/calendar';

export const Route = createFileRoute('/planning/')({
  beforeLoad: () => {
    throw redirect({ to: '/planning/$month', params: { month: currentMonth() } });
  },
});
