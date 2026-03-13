import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import WitsImportForm from "@/components/records/WitsImportForm";

export default async function WitsImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  // Role check — super_admin bypasses membership
  let callerRole: string | null = null;
  if (profile.global_role !== "super_admin") {
    const { data: membership } = await supabase
      .from("project_memberships")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", profile.id)
      .single();
    callerRole = membership?.role ?? null;
  }

  const canImport =
    profile.global_role === "super_admin" ||
    callerRole === "project_admin" ||
    callerRole === "researcher";

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-desk-text tracking-tight">
          Import from Wits Research Archives
        </h1>
        <p className="text-desk-muted text-sm font-sans mt-1">
          {project.name}
        </p>
      </div>

      {canImport ? (
        <WitsImportForm projectId={id} />
      ) : (
        <p className="text-desk-muted text-sm font-sans">
          You do not have permission to import records into this project.
          Only project admins and researchers can import.
        </p>
      )}
    </div>
  );
}
