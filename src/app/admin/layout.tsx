import { SiteNavigation } from "@/components/SiteNavigation";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SiteNavigation />
      {children}
    </>
  );
}
