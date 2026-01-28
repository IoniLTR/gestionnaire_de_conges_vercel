export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pas de Header/Footer ici pour éviter toute navigation avant connexion.
  return <>{children}</>;
}
