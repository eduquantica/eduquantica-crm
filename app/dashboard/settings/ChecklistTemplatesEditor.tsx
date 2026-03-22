"use client";

import { useMemo, useState } from "react";

type TemplateItem = {
  id: string;
  order: number;
  name: string;
  description: string | null;
  documentType:
    | "PASSPORT"
    | "TRANSCRIPT"
    | "DEGREE_CERT"
    | "ENGLISH_TEST"
    | "SOP"
    | "LOR"
    | "CV"
    | "FINANCIAL_PROOF"
    | "PHOTO"
    | "VISA_DOCUMENT"
    | "PERSONAL_STATEMENT"
    | "COVER_LETTER"
    | "OTHER";
  isRequired: boolean;
  isConditional: boolean;
  conditionRule: string | null;
};

type Template = {
  id: string;
  countryCode: string;
  countryName: string;
  courseLevel: string | null;
  title: string;
  items: TemplateItem[];
};

type Props = {
  templates: Template[];
};

const DOCUMENT_TYPES: TemplateItem["documentType"][] = [
  "PASSPORT",
  "TRANSCRIPT",
  "DEGREE_CERT",
  "ENGLISH_TEST",
  "SOP",
  "LOR",
  "CV",
  "FINANCIAL_PROOF",
  "PHOTO",
  "VISA_DOCUMENT",
  "PERSONAL_STATEMENT",
  "COVER_LETTER",
  "OTHER",
];

function normalizeOrders(items: TemplateItem[]): TemplateItem[] {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}

export default function ChecklistTemplatesEditor({ templates }: Props) {
  const [allTemplates, setAllTemplates] = useState<Template[]>(templates);
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  const selectedTemplate = useMemo(
    () => allTemplates.find((template) => template.id === selectedId) ?? null,
    [allTemplates, selectedId],
  );

  function patchSelected(mutator: (template: Template) => Template) {
    setAllTemplates((current) =>
      current.map((template) =>
        template.id === selectedId ? mutator(template) : template,
      ),
    );
  }

  function addItem() {
    if (!selectedTemplate) return;
    patchSelected((template) => ({
      ...template,
      items: normalizeOrders([
        ...template.items,
        {
          id: `new-${Date.now()}`,
          order: template.items.length + 1,
          name: "",
          description: "",
          documentType: "OTHER",
          isRequired: true,
          isConditional: false,
          conditionRule: "",
        },
      ]),
    }));
  }

  function removeItem(index: number) {
    patchSelected((template) => ({
      ...template,
      items: normalizeOrders(template.items.filter((_, currentIndex) => currentIndex !== index)),
    }));
  }

  function moveItem(index: number, direction: -1 | 1) {
    patchSelected((template) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= template.items.length) return template;
      const items = [...template.items];
      const [moved] = items.splice(index, 1);
      items.splice(nextIndex, 0, moved);
      return { ...template, items: normalizeOrders(items) };
    });
  }

  async function saveTemplate() {
    if (!selectedTemplate) return;

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        title: selectedTemplate.title,
        items: selectedTemplate.items.map((item) => ({
          name: item.name,
          description: item.description,
          documentType: item.documentType,
          isRequired: item.isRequired,
          isConditional: item.isConditional,
          conditionRule: item.conditionRule,
        })),
      };

      const res = await fetch(`/api/admin/settings/checklist-templates/${selectedTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error ?? "Failed to save template");
        return;
      }

      setAllTemplates((current) =>
        current.map((template) =>
          template.id === selectedTemplate.id ? (data.data as Template) : template,
        ),
      );
      setMessage("Template saved successfully.");
    } catch {
      setMessage("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  if (allTemplates.length === 0) {
    return <p className="text-sm text-slate-500">No checklist templates seeded yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">
          Templates by Country
        </div>
        <div className="max-h-[560px] overflow-auto">
          {allTemplates.map((template) => {
            const selected = template.id === selectedId;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                className={`w-full border-b border-slate-100 px-3 py-2 text-left text-sm ${
                  selected ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="font-medium">{template.countryName}</div>
                <div className="text-xs text-slate-500">{template.courseLevel ?? "All Levels"}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
        {!selectedTemplate ? (
          <p className="text-sm text-slate-500">Select a template to edit.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Template Title</label>
              <input
                value={selectedTemplate.title}
                onChange={(event) =>
                  patchSelected((template) => ({ ...template, title: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-3">
              {selectedTemplate.items.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Item {index + 1}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
                      <input
                        value={item.name}
                        onChange={(event) =>
                          patchSelected((template) => {
                            const items = [...template.items];
                            items[index] = { ...items[index], name: event.target.value };
                            return { ...template, items };
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Document Type</label>
                      <select
                        value={item.documentType}
                        onChange={(event) =>
                          patchSelected((template) => {
                            const items = [...template.items];
                            items[index] = {
                              ...items[index],
                              documentType: event.target.value as TemplateItem["documentType"],
                            };
                            return { ...template, items };
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {DOCUMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
                    <input
                      value={item.description ?? ""}
                      onChange={(event) =>
                        patchSelected((template) => {
                          const items = [...template.items];
                          items[index] = { ...items[index], description: event.target.value };
                          return { ...template, items };
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        onChange={(event) =>
                          patchSelected((template) => {
                            const items = [...template.items];
                            items[index] = { ...items[index], isRequired: event.target.checked };
                            return { ...template, items };
                          })
                        }
                      />
                      Required
                    </label>

                    <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={item.isConditional}
                        onChange={(event) =>
                          patchSelected((template) => {
                            const items = [...template.items];
                            items[index] = { ...items[index], isConditional: event.target.checked };
                            return { ...template, items };
                          })
                        }
                      />
                      Conditional
                    </label>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Condition Rule (text)</label>
                    <input
                      value={item.conditionRule ?? ""}
                      onChange={(event) =>
                        patchSelected((template) => {
                          const items = [...template.items];
                          items[index] = { ...items[index], conditionRule: event.target.value };
                          return { ...template, items };
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addItem}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Add Item
              </button>
              <button
                type="button"
                onClick={saveTemplate}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Template"}
              </button>
            </div>

            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
