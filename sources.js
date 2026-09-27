// sources.js：优先级比较与合并判定
export function priorityOf(sources, name) {
  if (sources && Object.prototype.hasOwnProperty.call(sources, name)) {
    const priority = sources[name];
    if (typeof priority === "number") return priority;
    if (priority && typeof priority.priority === "number") return priority.priority;
  }
  return 0;
}

export function compare(priorityA, priorityB) {
  if (priorityA < priorityB) return -1;
  if (priorityA > priorityB) return 1;
  return 0;
}
