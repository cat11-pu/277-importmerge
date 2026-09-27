// importrun.js：按应用预算导入并留账，收尾不限预算把账应用完
import { priorityOf, compare } from "./sources.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function isValidEvent(event) {
  return event !== null && typeof event === "object"
    && event.kind === "import"
    && typeof event.source === "string"
    && typeof event.key === "string"
    && "value" in event
    && (typeof event.id === "number" || typeof event.id === "string");
}

// 入参 state 只读：跨轮复用时调用方还会再用原对象，这里整体拷一份。
function copyState(state) {
  const source = state || {};
  const values = {};
  for (const key of Object.keys(source.values || {})) {
    values[key] = [source.values[key][0], source.values[key][1]];
  }
  const conflicts = {};
  for (const key of Object.keys(source.conflicts || {})) {
    conflicts[key] = (source.conflicts[key] || []).slice();
  }
  const ledger = (source.ledger || []).map(function (entry) {
    if (Array.isArray(entry)) return { id: null, source: entry[0], key: entry[1], value: entry[2] };
    return { id: entry.id, source: entry.source, key: entry.key, value: entry.value };
  });
  return {
    values: values,
    conflicts: conflicts,
    ledger: ledger,
    applied: (source.applied || []).slice()
  };
}

function valueTag(value) {
  return JSON.stringify(value);
}

// 同级冲突要与到达顺序无关（分两轮收尾后必须一致），取确定性的一方留下：值小者，源名小者兜底。
function tieWinner(current, candidate) {
  const currentTag = valueTag(current[0]);
  const candidateTag = valueTag(candidate[0]);
  if (currentTag !== candidateTag) return currentTag < candidateTag ? current : candidate;
  return current[1] <= candidate[1] ? current : candidate;
}

function registerConflict(state, key, oldValue, newValue) {
  const values = state.conflicts[key] ? state.conflicts[key].slice() : [];
  const tags = values.map(valueTag);
  [oldValue, newValue].forEach(function (value) {
    const tag = valueTag(value);
    if (tags.indexOf(tag) === -1) {
      tags.push(tag);
      values.push(value);
    }
  });
  values.sort(function (a, b) {
    const tagA = valueTag(a);
    const tagB = valueTag(b);
    return tagA < tagB ? -1 : tagA > tagB ? 1 : 0;
  });
  state.conflicts[key] = values;
}

function applyImport(state, sources, source, key, value) {
  if (!Object.prototype.hasOwnProperty.call(state.values, key)) {
    state.values[key] = [value, source];
    return;
  }
  const current = state.values[key];
  if (current[1] === source) {
    state.values[key] = [value, source];
    return;
  }
  const order = compare(priorityOf(sources, source), priorityOf(sources, current[1]));
  if (order > 0) {
    state.values[key] = [value, source];
    delete state.conflicts[key];
  } else if (order === 0) {
    state.values[key] = tieWinner(current, [value, source]);
    registerConflict(state, key, current[0], value);
  }
  // order < 0：优先级低，忽略。
}

export function step(spec) {
  const state = copyState(spec.state);
  const events = spec.events || [];
  const sources = spec.sources || {};
  const sourceErrorCode = spec.source_error_code || "E_NO_SOURCE";
  const eventErrorCode = spec.event_error_code || "E_BAD_EVENT";

  events.forEach(function (event) {
    if (!isValidEvent(event)) fail(eventErrorCode, "非法事件");
    if (!Object.prototype.hasOwnProperty.call(sources, event.source)) fail(sourceErrorCode, "未知来源 " + event.source);
  });

  const budget = typeof spec.budget === "number" && spec.budget > 0 ? spec.budget : 0;
  const seen = new Set(state.applied);
  let applied = 0;
  events.forEach(function (event) {
    if (seen.has(event.id)) return;
    if (applied < budget) {
      applyImport(state, sources, event.source, event.key, event.value);
      state.applied.push(event.id);
      seen.add(event.id);
      applied += 1;
    } else {
      state.ledger.push({ id: event.id, source: event.source, key: event.key, value: event.value });
    }
  });

  return {
    state: state,
    applied: applied,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (entry) {
      return [entry.source, entry.key, entry.value];
    }),
    judged: applied,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = copyState(spec.state);
  const sources = spec.sources || {};
  const pending = state.ledger;
  state.ledger = [];
  let catchup = 0;
  pending.forEach(function (entry) {
    applyImport(state, sources, entry.source, entry.key, entry.value);
    if (entry.id !== null && entry.id !== undefined && state.applied.indexOf(entry.id) === -1) {
      state.applied.push(entry.id);
    }
    catchup += 1;
  });
  return { state: state, catchup: catchup };
}
