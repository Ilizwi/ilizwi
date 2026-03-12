import ProjectForm from "@/components/projects/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="p-8 max-w-xl">
      <h1 className="font-serif text-3xl text-desk-text tracking-tight mb-6">
        New Project
      </h1>
      <ProjectForm />
    </div>
  );
}
