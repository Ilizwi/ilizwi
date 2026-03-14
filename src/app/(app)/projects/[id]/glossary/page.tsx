import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createGlossaryRule, updateGlossaryRule } from "@/lib/actions/glossary-rules";
import type { GlossaryRule, GlossaryRuleType } from "@/types";

// ── Server action wrappers ──────────────────────────────────────────────────

async function deactivateRule(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const projectId = formData.get("project_id") as string;
  const result = await updateGlossaryRule(id, projectId, { active: false });
  if (result.error) {
    redirect(`/projects/${projectId}/glossary?deactivateError=${encodeURIComponent(result.error)}`);
  }
}

async function createRuleAction(formData: FormData) {
  "use server";
  const projectId = formData.get("project_id") as string;
  const result = await createGlossaryRule({ error: null }, formData);
  if (result.error) {
    redirect(`/projects/${projectId}/glossary?createError=${encodeURIComponent(result.error)}`);
  }
}

async function editRuleAction(formData: FormData) {
  "use server";
  const ruleId = formData.get("rule_id") as string;
  const projectId = formData.get("project_id") as string;
  const rule_type = formData.get("rule_type") as GlossaryRuleType;
  const approved_translation = (formData.get("approved_translation") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;

  const result = await updateGlossaryRule(ruleId, projectId, {
    rule_type,
    approved_translation,
    note,
  });

  if (result.error) {
    redirect(
      `/projects/${projectId}/glossary?editError=${encodeURIComponent(result.error)}&edit=${ruleId}`
    );
  } else {
    redirect(`/projects/${projectId}/glossary`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const RULE_TYPE_BADGES: Record<string, string> = {
  do_not_translate: "bg-red-50 text-red-700",
  always_flag: "bg-amber-50 text-amber-700",
  approved_translation: "bg-green-50 text-green-700",
  preserve_original: "bg-blue-50 text-blue-700",
};

// ── Page ────────────────────────────────────────────────────────────────────

export default async function GlossaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string; createError?: string; editError?: string; deactivateError?: string }>;
}) {
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", profile.id)
    .single();

  const isAdmin =
    profile.global_role === "super_admin" ||
    membership?.role === "project_admin";

  const { data: rules } = await supabase
    .from("glossary_rules")
    .select("*")
    .eq("project_id", id)
    .order("term", { ascending: true });

  const glossaryRules = (rules ?? []) as GlossaryRule[];

  const editRuleId = resolvedSearch?.edit;
  const editingRule = editRuleId ? glossaryRules.find((r) => r.id === editRuleId) : null;

  const createError = resolvedSearch?.createError;
  const editError = resolvedSearch?.editError;
  const deactivateError = resolvedSearch?.deactivateError;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm font-sans text-desk-muted">
        <Link
          href={`/projects/${id}`}
          className="underline underline-offset-2 text-desk-text"
        >
          {project.name}
        </Link>
        <span className="mx-2">/</span>
        <span>Glossary Rules</span>
      </nav>

      <h1 className="font-serif text-3xl text-desk-text tracking-tight mb-8">
        Glossary Rules
      </h1>

      {/* Global error banners */}
      {deactivateError && (
        <div className="mb-4 px-4 py-3 border border-red-200 bg-red-50 rounded-[2px] text-sm font-sans text-red-700">
          Failed to deactivate rule: {deactivateError}
        </div>
      )}

      {/* Rules table */}
      {glossaryRules.length === 0 ? (
        <div className="border border-desk-border rounded-[2px] p-8 text-center">
          <p className="text-desk-muted text-sm font-sans">
            {isAdmin
              ? "No glossary rules yet. Use the form below to create one."
              : "No glossary rules yet. A project admin can add rules."}
          </p>
        </div>
      ) : (
        <div className="border border-desk-border rounded-[2px] overflow-hidden mb-8">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="bg-vault-bg/5 border-b border-desk-border">
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Term
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Language
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Rule Type
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Approved Translation
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Note
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Status
                </th>
                {isAdmin && (
                  <th className="text-right px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {glossaryRules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-desk-border last:border-b-0"
                >
                  <td className="px-4 py-3 text-desk-text font-medium">
                    {rule.term}
                  </td>
                  <td className="px-4 py-3 text-desk-muted">{rule.language}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-[2px] ${
                        RULE_TYPE_BADGES[rule.rule_type] ?? "bg-gray-50 text-gray-700"
                      }`}
                    >
                      {rule.rule_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-desk-muted">
                    {rule.approved_translation ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-desk-muted">
                    {rule.note ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs ${
                        rule.active ? "text-green-700" : "text-desk-muted"
                      }`}
                    >
                      {rule.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right space-x-3">
                      {rule.active && (
                        <Link
                          href={`/projects/${id}/glossary?edit=${rule.id}`}
                          className="text-xs text-desk-text underline underline-offset-2"
                        >
                          Edit
                        </Link>
                      )}
                      {rule.active && (
                        <form action={deactivateRule} className="inline">
                          <input type="hidden" name="id" value={rule.id} />
                          <input type="hidden" name="project_id" value={rule.project_id} />
                          <button
                            type="submit"
                            className="text-xs text-red-700 underline underline-offset-2"
                          >
                            Deactivate
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit form — shown when ?edit=<id> is present and rule exists */}
      {isAdmin && editingRule && (
        <div className="mb-8">
          <h2 className="font-serif text-xl text-desk-text tracking-tight mb-4">
            Edit Rule: <span className="text-desk-muted">{editingRule.term}</span>
          </h2>
          {editError && (
            <div className="mb-4 px-4 py-3 border border-red-200 bg-red-50 rounded-[2px] text-sm font-sans text-red-700">
              {editError}
            </div>
          )}
          <form
            action={editRuleAction}
            className="border border-desk-border rounded-[2px] p-6 bg-white space-y-4 max-w-xl"
          >
            <input type="hidden" name="rule_id" value={editingRule.id} />
            <input type="hidden" name="project_id" value={id} />

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Rule Type
              </label>
              <select
                name="rule_type"
                defaultValue={editingRule.rule_type}
                required
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white"
              >
                <option value="do_not_translate">Do Not Translate</option>
                <option value="approved_translation">Approved Translation</option>
                <option value="always_flag">Always Flag</option>
                <option value="preserve_original">Preserve Original</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Approved Translation (required for &lsquo;Approved Translation&rsquo; rule type)
              </label>
              <input
                type="text"
                name="approved_translation"
                defaultValue={editingRule.approved_translation ?? ""}
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
              />
            </div>

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Note
              </label>
              <textarea
                name="note"
                defaultValue={editingRule.note ?? ""}
                rows={2}
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-sans bg-desk-text text-white rounded-[2px]"
              >
                Save Changes
              </button>
              <Link
                href={`/projects/${id}/glossary`}
                className="text-sm font-sans text-desk-muted underline underline-offset-2"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* Create form — admin only */}
      {isAdmin && (
        <div className="mt-8">
          <h2 className="font-serif text-xl text-desk-text tracking-tight mb-4">
            Add Glossary Rule
          </h2>
          {createError && (
            <div className="mb-4 px-4 py-3 border border-red-200 bg-red-50 rounded-[2px] text-sm font-sans text-red-700">
              {createError}
            </div>
          )}
          <form
            action={createRuleAction}
            className="border border-desk-border rounded-[2px] p-6 bg-white space-y-4 max-w-xl"
          >
            <input type="hidden" name="project_id" value={id} />

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Term
              </label>
              <input
                type="text"
                name="term"
                required
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
              />
            </div>

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Language
              </label>
              <input
                type="text"
                name="language"
                required
                placeholder="e.g. isiZulu, isiXhosa"
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
              />
            </div>

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Rule Type
              </label>
              <select
                name="rule_type"
                required
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white"
              >
                <option value="">Select rule type</option>
                <option value="do_not_translate">Do Not Translate</option>
                <option value="approved_translation">Approved Translation</option>
                <option value="always_flag">Always Flag</option>
                <option value="preserve_original">Preserve Original</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Approved Translation (required for &lsquo;Approved Translation&rsquo; rule type)
              </label>
              <input
                type="text"
                name="approved_translation"
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
              />
            </div>

            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Note
              </label>
              <textarea
                name="note"
                rows={2}
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-sm font-sans bg-desk-text text-white rounded-[2px]"
            >
              Add Rule
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
