export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-0 bg-background text-foreground">
      <div className="mx-auto max-w-lg px-4 py-6">{children}</div>
    </div>
  );
}
