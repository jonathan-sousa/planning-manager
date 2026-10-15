import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

/** An address that matches no page of the app. */
export function NotFound() {
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-muted-foreground text-sm">
        Cette adresse ne correspond à aucune page de l'application. Le lien est peut-être ancien ou
        incomplet.
      </p>
      <Button nativeButton={false} render={<Link to="/" />}>
        Retour à l'accueil
      </Button>
    </div>
  );
}
