// sources.js：优先级比较与合并判定
export function priorityOf(sources, name) {
  const priority = sources ? sources[name] : undefined;
  return typeof priority === "number" ? priority : 0;
}

export function compare(priorityA, priorityB) {
  if (priorityA < priorityB) return -1;
  if (priorityA > priorityB) return 1;
  return 0;
}
