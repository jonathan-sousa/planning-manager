import { AuthWrapper } from '@/app/components/auth/AuthWrapper';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthWrapper>{children}</AuthWrapper>;
}