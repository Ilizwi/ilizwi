import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UploadForm from "@/components/records/UploadForm";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  // Role check: only project_admin and researcher can access
  if (profile.global_role !== "super_admin") {
    const { data: membership } = await supabase
      .from("project_memberships")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", profile.id)
      .single();

    if (!membership || !["project_admin", "researcher"].includes(membership.role)) {
      redirect(`/projects/${id}`);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-desk-text tracking-tight">
          Upload Archival Record
        </h1>
        <p className="text-desk-muted text-sm font-sans mt-2">
          {project.name}
        </p>
      </div>
      <UploadForm projectId={id} />
    </div>
  );
}
