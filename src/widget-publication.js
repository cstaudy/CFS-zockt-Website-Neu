// Pure helpers: no database dependency, safe to exercise in unit tests.
export function widgetConfigs(data = {}, status = "draft") {
  const draft = data.draft_config ?? data.config ?? {};
  // Existing published rows have only data.config; keep them readable until migrated.
  const published = status === "published"
    ? (data.published_config ?? data.config ?? null)
    : null;
  return {
    draft,
    published,
    changed: status === "published" && JSON.stringify(draft) !== JSON.stringify(published)
  };
}

export function nextWidgetData(data = {}, body = {}, publish = false) {
  const draft = body.config ?? data.draft_config ?? data.config ?? {};
  return {
    ...data,
    config: draft, // legacy editor compatibility
    draft_config: draft,
    ...(publish ? { published_config: structuredClone(draft) } : {})
  };
}
