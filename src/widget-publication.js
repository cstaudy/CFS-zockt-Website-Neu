// Pure helpers: no database dependency, safe to exercise in unit tests.
export function widgetConfigs(data = {}, status = "draft") {
  const draft = data.draft_config ?? data.config ?? {};
  // Legacy published rows may have only config. Once a draft_config exists,
  // never fall back to the editable config if the published snapshot is missing.
  const published = status === "published"
    ? (Object.hasOwn(data, "published_config") ? data.published_config : !Object.hasOwn(data, "draft_config") ? data.config ?? null : null)
    : null;
  return {
    draft,
    published,
    changed: status === "published" && JSON.stringify(draft) !== JSON.stringify(published)
  };
}

export function nextWidgetData(data = {}, body = {}, publish = false, status = "draft") {
  const draft = body.config ?? data.draft_config ?? data.config ?? {};
  return {
    ...data,
    config: draft, // legacy editor compatibility
    draft_config: draft,
    ...(publish
      ? { published_config: structuredClone(draft) }
      : status === "published" && !Object.hasOwn(data, "published_config")
        ? { published_config: structuredClone(data.config ?? {}) }
        : {})
  };
}
