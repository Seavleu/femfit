export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-3 pb-10 pt-6 md:px-6 md:pt-8">
      {children}
    </div>
  );
}
