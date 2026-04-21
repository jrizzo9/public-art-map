export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-0 bg-white text-zinc-900">
      <div className="mx-auto max-w-lg px-4 py-6">{children}</div>
    </div>
  );
}
